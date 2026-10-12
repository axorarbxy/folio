"""Tenant-scoped repositories for invoices, human review, and processing traces."""

import json
import re
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from folio_ml.contracts import Box, ReviewDecision
from folio_ml.contracts import Field as ContractField
from folio_ml.contracts import Invoice as InvoiceContract
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from folio_db.clock import utc_now
from folio_db.errors import ConflictError, NotFoundError, ValidationError
from folio_db.models.invoices import (
    FieldEdit,
    FieldValue,
    File,
    Invoice,
    LineItem,
    Party,
    ProcessingStage,
    ReviewTask,
)
from folio_db.session import paginate_by_keyset

_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
_ITEM_PATH_RE = re.compile(r"^items\[(\d+)]\.([a-z_]+)$")
_MONEY_FIELDS = {
    "taxable_total",
    "cgst_total",
    "sgst_total",
    "igst_total",
    "cess_total",
    "round_off",
    "grand_total",
    "discount",
    "taxable",
    "rate",
    "cgst_amount",
    "sgst_amount",
    "igst_amount",
    "cess_amount",
}
_TAX_RATE_FIELDS = {"cgst_pct", "sgst_pct", "igst_pct", "cess_pct"}


def _strict_decimal(value: Any, field: str, scale: int = 2) -> Decimal:
    if isinstance(value, (bool, float)):
        raise ValidationError(f"{field} must be supplied as Decimal, not float", field)
    try:
        decimal_value = value if isinstance(value, Decimal) else Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError(f"{field} must be a decimal value", field) from exc
    if not decimal_value.is_finite():
        raise ValidationError(f"{field} must be finite", field)
    if decimal_value.as_tuple().exponent < -scale:
        raise ValidationError(f"{field} allows at most {scale} decimal places", field)
    return decimal_value


def _encode_value(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, default=str, separators=(",", ":"), ensure_ascii=False)


@dataclass(frozen=True)
class InvoiceFilters:
    """Supported invoice table filters."""

    status: str | None = None
    severity: str | None = None
    supplier: str | uuid.UUID | None = None
    date_from: date | None = None
    date_to: date | None = None
    amount_min: Decimal | None = None
    amount_max: Decimal | None = None
    direction: str | None = None
    text: str | None = None
    limit: int = 50


class InvoiceRepo:
    """Invoice operations bound to an active tenant session."""

    def __init__(self, session: Session, org_id: uuid.UUID) -> None:
        self.session = session
        self.org_id = org_id

    def create_from_extraction(
        self,
        contract: InvoiceContract,
        *,
        review_decision: ReviewDecision | None = None,
        direction: str = "purchase",
    ) -> Invoice:
        """Persist a validated ML contract; the original file must already be registered."""
        source_hash = contract.source_file_hash.casefold()
        if not _SHA256_RE.fullmatch(source_hash):
            raise ValidationError("source_file_hash must be a 64-character SHA-256 digest")
        if direction not in {"purchase", "sales"}:
            raise ValidationError("direction must be purchase or sales", "direction")

        self.session.execute(
            select(
                func.pg_advisory_xact_lock(
                    func.hashtextextended(f"{self.org_id}:{source_hash}", 0)
                )
            )
        )
        file = self.session.scalar(
            select(File).where(
                File.org_id == self.org_id,
                File.sha256 == source_hash,
                File.kind == "original",
            )
        )
        if file is None:
            raise NotFoundError("Original file", source_hash)

        existing = self.session.scalar(select(Invoice).where(Invoice.file_id == file.id))
        if existing is not None:
            return existing

        supplier = self._party(
            contract.supplier_gstin.value,
            contract.supplier_name.value,
            contract.supplier_state.value,
        )
        buyer = self._party(
            contract.buyer_gstin.value,
            contract.buyer_name.value,
            contract.buyer_state.value,
        )
        status = (
            "needs_review"
            if contract.status == "needs_review"
            or (review_decision is not None and bool(review_decision.needs_review))
            else "uploaded"
        )
        invoice = Invoice(
            org_id=self.org_id,
            file_id=file.id,
            direction=direction,
            status=status,
            number_raw=str(contract.number.value or ""),
            number_norm=re.sub(r"[^A-Z0-9]", "", str(contract.number.value or "").upper()),
            invoice_date=datetime.fromisoformat(contract.date.value).date(),
            supplier_party_id=supplier.id,
            buyer_party_id=buyer.id,
            place_of_supply_state=contract.place_of_supply.value,
            reverse_charge=bool(contract.reverse_charge.value),
            irn=contract.irn.value,
            taxable_total=_strict_decimal(contract.totals.taxable_amount.value, "taxable_total"),
            cgst_total=_strict_decimal(contract.totals.cgst_amount.value, "cgst_total"),
            sgst_total=_strict_decimal(contract.totals.sgst_amount.value, "sgst_total"),
            igst_total=_strict_decimal(contract.totals.igst_amount.value, "igst_total"),
            cess_total=_strict_decimal(contract.totals.cess_amount.value, "cess_total"),
            grand_total=_strict_decimal(contract.totals.total_amount.value, "grand_total"),
            raw_extraction=contract.model_dump(mode="json"),
        )
        self.session.add(invoice)
        self.session.flush()

        for line_no, item in enumerate(contract.items, start=1):
            self.session.add(
                LineItem(
                    invoice_id=invoice.id,
                    org_id=self.org_id,
                    line_no=line_no,
                    description=str(item.description.value or ""),
                    hsn=item.hsn.value,
                    qty=(
                        _strict_decimal(item.qty.value, f"items[{line_no - 1}].qty", 4)
                        if item.qty.value is not None else None
                    ),
                    unit=item.unit.value,
                    rate=(
                        _strict_decimal(item.rate.value, f"items[{line_no - 1}].rate")
                        if item.rate.value is not None else None
                    ),
                    taxable=_strict_decimal(item.taxable.value, f"items[{line_no - 1}].taxable"),
                    cgst_pct=self._tax_rate(item.cgst_pct.value, line_no, "cgst_pct"),
                    sgst_pct=self._tax_rate(item.sgst_pct.value, line_no, "sgst_pct"),
                    igst_pct=self._tax_rate(item.igst_pct.value, line_no, "igst_pct"),
                    cess_pct=self._tax_rate(item.cess_pct.value, line_no, "cess_pct"),
                )
            )

        for field_path, field in self._contract_fields(contract):
            self._store_field(invoice.id, field_path, field)
        self.session.flush()

        if status == "needs_review":
            reasons = list(review_decision.reasons) if review_decision else []
            if not reasons and review_decision:
                reasons = [detail.reason for detail in review_decision.needs_review]
            ReviewRepo(self.session, self.org_id).create_task(
                invoice.id,
                reasons or ["Invoice routed for human review"],
                priority=self._review_priority(review_decision),
            )
        return invoice

    def apply_edit(
        self,
        invoice_id: uuid.UUID,
        field_path: str,
        new_value: Any,
        user: uuid.UUID,
        reason: str,
        *,
        recompute_totals: bool = False,
    ) -> FieldValue:
        """Update the current field and append its prior value and editor to the audit trail."""
        field = self.session.get(FieldValue, (invoice_id, field_path))
        if field is None or field.org_id != self.org_id:
            raise NotFoundError("Invoice field", field_path)
        invoice = self.session.scalar(
            select(Invoice).where(Invoice.id == invoice_id, Invoice.org_id == self.org_id)
        )
        if invoice is None:
            raise NotFoundError("Invoice", invoice_id)

        old_value = field.value_norm
        new_encoded = _encode_value(new_value)
        self.session.add(
            FieldEdit(
                org_id=self.org_id,
                invoice_id=invoice_id,
                field_path=field_path,
                old_value=old_value,
                new_value=new_encoded,
                edited_by=user,
                reason=reason,
            )
        )
        field.raw_text = str(new_value) if new_value is not None else None
        field.value_norm = new_encoded
        field.source = "human"
        field.edited = True
        self._apply_column_edit(invoice, field_path, new_value)
        if recompute_totals:
            self._recompute_totals(invoice)
        self.session.flush()
        return field

    def list_invoices(
        self,
        filters: InvoiceFilters | None = None,
        cursor: str | None = None,
    ) -> tuple[list[dict[str, Any]], str | None, bool]:
        """Return tenant-scoped invoice summaries with keyset pagination."""
        filters = filters or InvoiceFilters()
        amount_min = (
            _strict_decimal(filters.amount_min, "amount_min")
            if filters.amount_min is not None else None
        )
        amount_max = (
            _strict_decimal(filters.amount_max, "amount_max")
            if filters.amount_max is not None else None
        )
        if amount_min is not None and amount_max is not None and amount_min > amount_max:
            raise ValidationError("amount_min cannot exceed amount_max")
        query = self.session.query(Invoice).options(
            selectinload(Invoice.supplier),
            selectinload(Invoice.field_values),
        ).filter(Invoice.org_id == self.org_id)

        if filters.status:
            query = query.filter(Invoice.status == filters.status)
        if filters.direction:
            query = query.filter(Invoice.direction == filters.direction)
        if filters.supplier:
            if isinstance(filters.supplier, uuid.UUID):
                query = query.filter(Invoice.supplier_party_id == filters.supplier)
            else:
                supplier_term = f"%{filters.supplier}%"
                query = query.filter(
                    Invoice.supplier.has(
                        Party.legal_name.ilike(supplier_term) | Party.gstin.ilike(supplier_term)
                    )
                )
        if filters.date_from is not None:
            query = query.filter(Invoice.invoice_date >= filters.date_from)
        if filters.date_to is not None:
            query = query.filter(Invoice.invoice_date <= filters.date_to)
        if amount_min is not None:
            query = query.filter(Invoice.grand_total >= amount_min)
        if amount_max is not None:
            query = query.filter(Invoice.grand_total <= amount_max)
        if filters.text:
            term = f"%{filters.text}%"
            number_term = re.sub(r"[^A-Z0-9]", "", filters.text.upper())
            query = query.filter(
                (
                    Invoice.number_norm.ilike(f"%{number_term}%")
                    if number_term else False
                )
                | Invoice.supplier.has(Party.legal_name.ilike(term))
            )
        if filters.severity:
            priority_map = {
                "low": "low",
                "medium": "normal",
                "high": "high",
                "critical": "urgent",
            }
            priority = priority_map.get(filters.severity)
            if priority is None:
                raise ValidationError("Unknown invoice severity", "severity")
            query = query.filter(
                select(ReviewTask.id)
                .where(
                    ReviewTask.invoice_id == Invoice.id,
                    ReviewTask.org_id == self.org_id,
                    ReviewTask.priority == priority,
                    ReviewTask.status != "cancelled",
                )
                .exists()
            )

        items, next_cursor, has_more = paginate_by_keyset(
            query, Invoice, limit=filters.limit, cursor=cursor
        )
        summaries = [
            {
                "id": invoice.id,
                "status": invoice.status,
                "direction": invoice.direction,
                "number": invoice.number_norm,
                "invoice_date": invoice.invoice_date,
                "supplier": invoice.supplier.legal_name if invoice.supplier else None,
                "supplier_party_id": invoice.supplier_party_id,
                "grand_total": invoice.grand_total,
                "created_at": invoice.created_at,
            }
            for invoice in items
        ]
        return summaries, next_cursor, has_more

    def get_review_bundle(self, invoice_id: uuid.UUID) -> dict[str, Any]:
        """Return contract, current field metadata, and chronological edit history."""
        invoice = self.session.scalar(
            select(Invoice)
            .where(Invoice.id == invoice_id, Invoice.org_id == self.org_id)
            .options(selectinload(Invoice.field_values))
        )
        if invoice is None:
            raise NotFoundError("Invoice", invoice_id)
        edits = self.session.scalars(
            select(FieldEdit)
            .where(FieldEdit.invoice_id == invoice_id, FieldEdit.org_id == self.org_id)
            .order_by(FieldEdit.at, FieldEdit.id)
        ).all()
        return {
            "invoice": self._contract_with_current_fields(invoice),
            "fields": [
                {
                    "field_path": field.field_path,
                    "raw_text": field.raw_text,
                    "value_norm": field.value_norm,
                    "confidence": field.confidence,
                    "calibrated_confidence": field.calibrated_confidence,
                    "box": field.box,
                    "source": field.source,
                    "edited": field.edited,
                }
                for field in invoice.field_values
            ],
            "edits": edits,
        }

    @staticmethod
    def to_contract(invoice: Invoice) -> InvoiceContract:
        """Rehydrate the exact ML contract persisted with the relational rows."""
        if invoice.raw_extraction is None:
            raise ValidationError("Invoice has no stored ML extraction contract")
        return InvoiceContract.model_validate(invoice.raw_extraction)

    def _contract_with_current_fields(self, invoice: Invoice) -> InvoiceContract:
        contract = self.to_contract(invoice).model_copy(deep=True)
        for row in invoice.field_values:
            original = self._field_at_path(contract, row.field_path)
            value = json.loads(row.value_norm) if row.value_norm is not None else None
            if isinstance(original.value, Decimal) and value is not None:
                value = Decimal(value)
            current = original.model_copy(
                update={
                    "value": value,
                    "confidence": float(row.confidence),
                    "box": Box.model_validate(row.box) if row.box else None,
                    "source": row.source,
                    "edited": row.edited,
                }
            )
            self._replace_field(contract, row.field_path, current)
        return contract

    @staticmethod
    def _field_at_path(
        contract: InvoiceContract,
        field_path: str,
    ) -> ContractField[Any]:
        if field_path.startswith("totals."):
            return getattr(contract.totals, field_path.removeprefix("totals."))
        match = _ITEM_PATH_RE.fullmatch(field_path)
        if match:
            return getattr(contract.items[int(match.group(1))], match.group(2))
        return getattr(contract, field_path)

    @staticmethod
    def _replace_field(
        contract: InvoiceContract,
        field_path: str,
        value: ContractField[Any],
    ) -> None:
        if field_path.startswith("totals."):
            name = field_path.removeprefix("totals.")
            contract.totals = contract.totals.model_copy(update={name: value})
            return
        match = _ITEM_PATH_RE.fullmatch(field_path)
        if match:
            items = list(contract.items)
            index = int(match.group(1))
            items[index] = items[index].model_copy(update={match.group(2): value})
            contract.items = items
            return
        setattr(contract, field_path, value)

    def _party(self, gstin: str | None, legal_name: str | None, state_code: str | None) -> Party:
        if not gstin:
            raise ValidationError("Invoice supplier and buyer GSTINs are required")
        party = self.session.scalar(
            select(Party).where(Party.org_id == self.org_id, Party.gstin == gstin)
        )
        if party is None:
            party = Party(
                org_id=self.org_id,
                gstin=gstin,
                legal_name=legal_name or gstin,
                state_code=state_code,
            )
            self.session.add(party)
            self.session.flush()
        else:
            party.last_seen_at = utc_now()
        return party

    @staticmethod
    def _tax_rate(value: Any, line_no: int, name: str) -> Decimal:
        if value is None:
            return Decimal("0.00")
        return _strict_decimal(value, f"items[{line_no - 1}].{name}")

    @staticmethod
    def _contract_fields(contract: InvoiceContract) -> list[tuple[str, Any]]:
        fields: list[tuple[str, Any]] = [
            (name, getattr(contract, name))
            for name in (
                "supplier_name",
                "supplier_gstin",
                "supplier_state",
                "buyer_name",
                "buyer_gstin",
                "buyer_state",
                "number",
                "date",
                "place_of_supply",
                "reverse_charge",
                "irn",
            )
        ]
        fields.extend(
            (f"totals.{name}", getattr(contract.totals, name))
            for name in (
                "taxable_amount",
                "cgst_amount",
                "sgst_amount",
                "igst_amount",
                "cess_amount",
                "total_amount",
            )
        )
        for index, item in enumerate(contract.items):
            fields.extend(
                (f"items[{index}].{name}", getattr(item, name))
                for name in (
                    "description",
                    "hsn",
                    "qty",
                    "unit",
                    "rate",
                    "taxable",
                    "cgst_pct",
                    "sgst_pct",
                    "igst_pct",
                    "cess_pct",
                )
            )
        return fields

    def _store_field(self, invoice_id: uuid.UUID, path: str, field: Any) -> None:
        value = field.value
        box = field.box.model_dump(mode="json") if field.box else None
        self.session.add(
            FieldValue(
                invoice_id=invoice_id,
                field_path=path,
                org_id=self.org_id,
                raw_text=str(value) if value is not None else None,
                value_norm=_encode_value(value),
                confidence=Decimal(str(field.confidence)),
                box=box,
                source=field.source,
                edited=field.edited,
            )
        )

    @staticmethod
    def _review_priority(decision: ReviewDecision | None) -> str:
        if decision is None:
            return "normal"
        return {
            "low": "low",
            "medium": "normal",
            "high": "high",
            "critical": "urgent",
        }[decision.priority]

    def _apply_column_edit(self, invoice: Invoice, field_path: str, value: Any) -> None:
        invoice_fields = {
            "number": "number_raw",
            "totals.taxable_amount": "taxable_total",
            "totals.cgst_amount": "cgst_total",
            "totals.sgst_amount": "sgst_total",
            "totals.igst_amount": "igst_total",
            "totals.cess_amount": "cess_total",
            "totals.total_amount": "grand_total",
        }
        column = invoice_fields.get(field_path)
        if column:
            setattr(invoice, column, _strict_decimal(value, field_path) if column in _MONEY_FIELDS else str(value))
            if field_path == "number":
                invoice.number_norm = re.sub(r"[^A-Z0-9]", "", str(value).upper())
            return

        match = _ITEM_PATH_RE.fullmatch(field_path)
        if not match:
            return
        line_no = int(match.group(1)) + 1
        attr = match.group(2)
        item = self.session.get(LineItem, (invoice.id, line_no))
        if item is None or not hasattr(item, attr):
            return
        if attr in _MONEY_FIELDS or attr in _TAX_RATE_FIELDS:
            value = _strict_decimal(value, field_path)
        setattr(item, attr, value)

    def _recompute_totals(self, invoice: Invoice) -> None:
        lines = self.session.scalars(
            select(LineItem).where(LineItem.invoice_id == invoice.id).order_by(LineItem.line_no)
        ).all()
        invoice.taxable_total = sum((line.taxable for line in lines), Decimal("0.00"))
        for field_name in ("cgst", "sgst", "igst", "cess"):
            amount = Decimal("0.00")
            for line in lines:
                line_amount = getattr(line, f"{field_name}_amount")
                if line_amount:
                    amount += line_amount
                else:
                    amount += (
                        line.taxable
                        * getattr(line, f"{field_name}_pct")
                        / Decimal(100)
                    ).quantize(Decimal("0.01"))
            setattr(invoice, f"{field_name}_total", amount)
        invoice.grand_total = (
            invoice.taxable_total
            + invoice.cgst_total
            + invoice.sgst_total
            + invoice.igst_total
            + invoice.cess_total
            + invoice.round_off
        )


class ReviewRepo:
    """Tenant-scoped human review queue operations."""

    def __init__(self, session: Session, org_id: uuid.UUID) -> None:
        self.session = session
        self.org_id = org_id

    def create_task(
        self,
        invoice_id: uuid.UUID,
        reasons: list[str],
        *,
        priority: str = "normal",
        due_at: datetime | None = None,
    ) -> ReviewTask:
        invoice = self.session.scalar(
            select(Invoice).where(Invoice.id == invoice_id, Invoice.org_id == self.org_id)
        )
        if invoice is None:
            raise NotFoundError("Invoice", invoice_id)
        task = ReviewTask(
            org_id=self.org_id,
            invoice_id=invoice_id,
            reasons=reasons,
            priority=priority,
            due_at=due_at,
        )
        self.session.add(task)
        self.session.flush()
        return task

    def assign(self, task_id: uuid.UUID, assignee_id: uuid.UUID) -> ReviewTask:
        task = self._get_task(task_id)
        task.assignee_id = assignee_id
        if task.status == "open":
            task.status = "in_progress"
        self.session.flush()
        return task

    def complete(self, task_id: uuid.UUID) -> ReviewTask:
        task = self._get_task(task_id)
        if task.status in {"done", "cancelled"}:
            raise ConflictError(f"Cannot complete review task with status {task.status}")
        task.status = "done"
        task.completed_at = utc_now()
        self.session.flush()
        return task

    def compute_sla_breach(self, now: datetime | None = None) -> int:
        """Set breached_at once for overdue open or in-progress tasks."""
        breached_at = now or utc_now()
        result = self.session.execute(
            update(ReviewTask)
            .where(
                ReviewTask.org_id == self.org_id,
                ReviewTask.status.in_(("open", "in_progress")),
                ReviewTask.due_at <= breached_at,
                ReviewTask.breached_at.is_(None),
            )
            .values(breached_at=breached_at)
        )
        return result.rowcount or 0

    def queue_stats(self, now: datetime | None = None) -> dict[str, dict[str, int]]:
        reference = now or utc_now()
        tasks = self.session.scalars(
            select(ReviewTask).where(
                ReviewTask.org_id == self.org_id,
                ReviewTask.status.in_(("open", "in_progress")),
            )
        ).all()
        ages = {"under_1_day": 0, "1_to_3_days": 0, "over_3_days": 0}
        reasons: dict[str, int] = {}
        for task in tasks:
            age = reference - task.created_at
            bucket = (
                "under_1_day" if age < timedelta(days=1)
                else "1_to_3_days" if age < timedelta(days=3)
                else "over_3_days"
            )
            ages[bucket] += 1
            for reason in task.reasons:
                reasons[reason] = reasons.get(reason, 0) + 1
        return {"age_buckets": ages, "reasons": reasons}

    def _get_task(self, task_id: uuid.UUID) -> ReviewTask:
        task = self.session.scalar(
            select(ReviewTask).where(
                ReviewTask.id == task_id,
                ReviewTask.org_id == self.org_id,
            )
        )
        if task is None:
            raise NotFoundError("Review task", task_id)
        return task


class TraceRepo:
    """Tenant-scoped pipeline stage tracing operations."""

    def __init__(self, session: Session, org_id: uuid.UUID) -> None:
        self.session = session
        self.org_id = org_id

    def record_start(
        self,
        invoice_id: uuid.UUID,
        stage: str,
        *,
        model_version: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> ProcessingStage:
        invoice = self.session.scalar(
            select(Invoice.id).where(Invoice.id == invoice_id, Invoice.org_id == self.org_id)
        )
        if invoice is None:
            raise NotFoundError("Invoice", invoice_id)
        self.session.execute(
            select(
                func.pg_advisory_xact_lock(
                    func.hashtextextended(f"trace:{invoice_id}:{stage}", 0)
                )
            )
        )
        attempt = self.session.scalar(
            select(func.coalesce(func.max(ProcessingStage.attempt), 0)).where(
                ProcessingStage.invoice_id == invoice_id,
                ProcessingStage.stage == stage,
                ProcessingStage.org_id == self.org_id,
            )
        )
        trace = ProcessingStage(
            org_id=self.org_id,
            invoice_id=invoice_id,
            stage=stage,
            status="running",
            attempt=attempt + 1,
            model_version=model_version,
            meta=meta,
        )
        self.session.add(trace)
        self.session.flush()
        return trace

    def record_finish(
        self,
        stage_id: uuid.UUID,
        *,
        status: str,
        error_code: str | None = None,
        error_detail: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> ProcessingStage:
        trace = self.session.scalar(
            select(ProcessingStage).where(
                ProcessingStage.id == stage_id,
                ProcessingStage.org_id == self.org_id,
            )
        )
        if trace is None:
            raise NotFoundError("Processing stage", stage_id)
        if trace.finished_at is not None:
            raise ConflictError("Processing stage has already finished")
        if status not in {"success", "failed", "skipped"}:
            raise ValidationError("Finished stage status must be success, failed, or skipped")
        finished_at = utc_now()
        trace.status = status
        trace.finished_at = finished_at
        trace.latency_ms = max(0, round((finished_at - trace.started_at).total_seconds() * 1000))
        trace.error_code = error_code
        trace.error_detail = error_detail
        if meta:
            trace.meta = {**(trace.meta or {}), **meta}
        self.session.flush()
        return trace

    def get_waterfall(self, invoice_id: uuid.UUID) -> list[ProcessingStage]:
        invoice = self.session.scalar(
            select(Invoice.id).where(Invoice.id == invoice_id, Invoice.org_id == self.org_id)
        )
        if invoice is None:
            raise NotFoundError("Invoice", invoice_id)
        return list(
            self.session.scalars(
                select(ProcessingStage)
                .where(
                    ProcessingStage.invoice_id == invoice_id,
                    ProcessingStage.org_id == self.org_id,
                )
                .order_by(ProcessingStage.started_at, ProcessingStage.stage, ProcessingStage.attempt)
            ).all()
        )
