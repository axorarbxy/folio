"""Acceptance tests for invoice persistence, human review, and processing traces."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from folio_db.clock import utc_now
from folio_db.errors import ValidationError
from folio_db.models.identity import Organization
from folio_db.models.invoices import (
    File,
    InvoiceStatusHistory,
    ReviewTask,
)
from folio_db.models.invoices import (
    Invoice as InvoiceRow,
)
from folio_db.repositories.auth import AuthRepo
from folio_db.repositories.invoices import (
    InvoiceFilters,
    InvoiceRepo,
    ReviewRepo,
    TraceRepo,
    _strict_decimal,
)
from folio_db.session import system_session, tenant_session
from folio_ml.contracts import (
    Field,
    Invoice,
    InvoiceTotals,
    LineItem,
    ReviewDecision,
    ReviewFieldDetail,
)
from folio_ml.contracts.base import Box
from sqlalchemy import Engine, func, select
from sqlalchemy.exc import DBAPIError


def _field(value, confidence: float = 0.95) -> Field:
    return Field(
        value=value,
        confidence=confidence,
        box=Box(page=1, x0=0.1, y0=0.2, x1=0.4, y1=0.3),
    )


def _contract(source_hash: str = "a" * 64, status: str = "draft") -> Invoice:
    return Invoice(
        id="synthetic-invoice-1",
        source_file_hash=source_hash,
        supplier_name=_field("Synthetic Precision Ltd"),
        supplier_gstin=_field("27AABCU9603R1ZM"),
        supplier_state=_field("27"),
        buyer_name=_field("Synthetic Buyer Pvt Ltd"),
        buyer_gstin=_field("29AABCB1234F1Z5"),
        buyer_state=_field("29"),
        number=_field("INV-001", 0.98),
        date=_field("2026-10-01"),
        place_of_supply=_field("27"),
        items=[
            LineItem(
                description=_field("Synthetic component"),
                hsn=_field("123456"),
                qty=_field(Decimal("1.0000")),
                unit=_field("each"),
                rate=_field(Decimal("100.00")),
                taxable=_field(Decimal("100.00")),
                cgst_pct=_field(Decimal("9.00")),
                sgst_pct=_field(Decimal("9.00")),
                igst_pct=_field(Decimal("0.00")),
                cess_pct=_field(Decimal("0.00")),
            )
        ],
        totals=InvoiceTotals(
            taxable_amount=_field(Decimal("100.00")),
            cgst_amount=_field(Decimal("9.00")),
            sgst_amount=_field(Decimal("9.00")),
            igst_amount=_field(Decimal("0.00")),
            cess_amount=_field(Decimal("0.00")),
            total_amount=_field(Decimal("118.00")),
        ),
        status=status,
    )


def _register_file(db_engine: Engine, contract: Invoice) -> uuid.UUID:
    org_id = uuid.uuid4()
    with system_session(db_engine) as session:
        session.add(
            Organization(
                id=org_id,
                name="Synthetic Invoice Test Org",
                gstin="27AAACF1234F1Z9",
            )
        )
        session.flush()
        session.add(
            File(
                org_id=org_id,
                sha256=contract.source_file_hash,
                size_bytes=123,
                mime="application/pdf",
                storage_key=f"synthetic/{contract.source_file_hash}.pdf",
                kind="original",
                source="upload",
                scan_status="clean",
            )
        )
    return org_id


def test_invoice_creation_is_idempotent_and_round_trips_contract(db_engine: Engine):
    contract = _contract(status="needs_review")
    org_id = _register_file(db_engine, contract)

    with tenant_session(db_engine, org_id) as session:
        repo = InvoiceRepo(session, org_id)
        first = repo.create_from_extraction(contract)
        second = repo.create_from_extraction(contract)

        assert first.id == second.id
        assert repo.to_contract(first) == contract
        assert first.status == "needs_review"
        bundle = repo.get_review_bundle(first.id)
        assert bundle["invoice"] == contract
        number = next(field for field in bundle["fields"] if field["field_path"] == "number")
        assert number["confidence"] == Decimal("0.9800")
        assert number["box"]["x0"] == 0.1
        assert session.scalar(
            select(func.count()).select_from(InvoiceRow).where(InvoiceRow.file_id == first.file_id)
        ) == 1


def test_edit_history_records_reader_value_and_review_trace_operations(db_engine: Engine):
    contract = _contract(status="needs_review")
    org_id = _register_file(db_engine, contract)
    decision = ReviewDecision(
        invoice_id=contract.id,
        priority="high",
        needs_review=[
            ReviewFieldDetail(
                field_name="number",
                reason="Synthetic uncertain number",
                confidence=0.55,
                current_value="INV-001",
            )
        ],
        reasons=["Synthetic review reason"],
    )
    with system_session(db_engine) as session:
        user = AuthRepo(session).create_user(
            "invoice-review@example.test",
            "Synthetic Reviewer",
            "SyntheticPassword123!",
        )
        user_id = user.id

    with tenant_session(db_engine, org_id, user_id=user_id) as session:
        invoice_repo = InvoiceRepo(session, org_id)
        invoice = invoice_repo.create_from_extraction(contract, review_decision=decision)
        invoice_repo.apply_edit(
            invoice.id,
            "number",
            "INV-002",
            user_id,
            "Synthetic correction",
        )
        bundle = invoice_repo.get_review_bundle(invoice.id)
        assert len(bundle["edits"]) == 1
        assert bundle["invoice"].number.value == "INV-002"
        assert invoice_repo.to_contract(invoice).number.value == "INV-001"
        assert bundle["edits"][0].old_value == '"INV-001"'
        assert bundle["edits"][0].new_value == '"INV-002"'
        edit = bundle["edits"][0]
        with pytest.raises(DBAPIError), session.begin_nested():
            edit.reason = "tampered"
            session.flush()
        session.expire(edit, ["reason"])
        assert edit.reason == "Synthetic correction"

        status_event = session.scalar(
            select(InvoiceStatusHistory).where(InvoiceStatusHistory.invoice_id == invoice.id)
        )
        assert status_event is not None
        with pytest.raises(DBAPIError), session.begin_nested():
            session.delete(status_event)
            session.flush()

        review_repo = ReviewRepo(session, org_id)
        task = session.scalar(
            select(ReviewTask).where(ReviewTask.invoice_id == invoice.id)
        )
        assert task is not None
        review_repo.assign(task.id, user_id)
        assert task.status == "in_progress"
        task.due_at = utc_now() - timedelta(seconds=1)
        session.flush()
        assert review_repo.compute_sla_breach() == 1
        assert task.breached_at is not None
        assert review_repo.queue_stats()["reasons"]["Synthetic review reason"] == 1
        review_repo.complete(task.id)
        assert task.completed_at is not None

        trace_repo = TraceRepo(session, org_id)
        stage = trace_repo.record_start(invoice.id, "read", model_version="synthetic-v1")
        trace_repo.record_finish(stage.id, status="success")
        assert stage.latency_ms is not None and stage.latency_ms >= 0
        assert trace_repo.get_waterfall(invoice.id) == [stage]

        summaries, cursor, has_more = invoice_repo.list_invoices(
            InvoiceFilters(text="INV-002", supplier="Synthetic Precision", severity="high")
        )
        assert len(summaries) == 1
        assert summaries[0]["id"] == invoice.id
        assert cursor is None
        assert not has_more


def test_database_rejects_illegal_invoice_status_jump(db_engine: Engine):
    contract = _contract()
    org_id = _register_file(db_engine, contract)
    with tenant_session(db_engine, org_id) as session:
        invoice = InvoiceRepo(session, org_id).create_from_extraction(contract)
        invoice_id = invoice.id
        with pytest.raises(DBAPIError), session.begin_nested():
            invoice.status = "closed"
            session.flush()
        invalid_file = File(
            org_id=org_id,
            sha256="b" * 64,
            size_bytes=123,
            mime="application/pdf",
            storage_key=f"synthetic/{'b' * 64}.pdf",
            kind="original",
            source="upload",
            scan_status="clean",
        )
        session.add(invalid_file)
        session.flush()
        with pytest.raises(DBAPIError), session.begin_nested():
            session.add(
                InvoiceRow(
                    org_id=org_id,
                    file_id=invalid_file.id,
                    direction="purchase",
                    status="closed",
                    number_raw="INV-INVALID",
                    number_norm="INVALID",
                    invoice_date=date.fromisoformat(contract.date.value),
                )
            )
            session.flush()
        session.expire(invoice, ["status"])
        assert invoice.status == "uploaded"

    with system_session(db_engine) as session:
        history = session.scalars(
            select(InvoiceStatusHistory).where(InvoiceStatusHistory.invoice_id == invoice_id)
        ).all()
        assert [entry.to_status for entry in history] == ["uploaded"]


def test_repository_rejects_money_with_excess_scale_and_floats():
    with pytest.raises(ValidationError):
        _strict_decimal(Decimal("10.001"), "grand_total")
    with pytest.raises(ValidationError):
        _strict_decimal(10.25, "grand_total")
    assert _strict_decimal(Decimal("10.25"), "grand_total") == Decimal("10.25")
