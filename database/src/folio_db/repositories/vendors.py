"""Repositories for vendor risk, rollups, and supplier messaging."""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from folio_db.errors import NotFoundError, ValidationError
from folio_db.models.vendors import Message, Vendor, VendorEvent, VendorMonthly, VendorRiskScore


class VendorRepo:
    """Create and fetch suppliers while enforcing tenant boundaries."""

    def __init__(self, session: Session, org_id: uuid.UUID) -> None:
        self.session = session
        self.org_id = org_id

    def get_or_create_from_party(self, party_id: uuid.UUID, *, tag: str = "unrated", status: str = "active", notes: str | None = None) -> Vendor:
        vendor = self.session.scalar(
            select(Vendor).where(Vendor.org_id == self.org_id, Vendor.party_id == party_id)
        )
        if vendor is not None:
            if tag != "unrated":
                vendor.tag = tag
            vendor.status = status
            if notes is not None:
                vendor.notes = notes
            return vendor

        vendor = Vendor(
            org_id=self.org_id,
            party_id=party_id,
            tag=tag,
            status=status,
            notes=notes,
        )
        self.session.add(vendor)
        self.session.flush()
        return vendor

    def list_vendors(
        self,
        *,
        filters: dict[str, Any] | None = None,
        sort: str = "tag",
        cursor: str | None = None,
    ) -> tuple[list[Vendor], str | None, bool]:
        stmt = select(Vendor).where(Vendor.org_id == self.org_id)
        params = filters or {}
        if "tag" in params and params["tag"]:
            stmt = stmt.where(Vendor.tag == params["tag"])
        if "status" in params and params["status"]:
            stmt = stmt.where(Vendor.status == params["status"])
        if sort == "tag":
            stmt = stmt.order_by(Vendor.tag.asc(), Vendor.id.asc())
        else:
            stmt = stmt.order_by(Vendor.first_seen_at.desc(), Vendor.id.desc())
        rows = self.session.scalars(stmt.limit(51)).all()
        has_more = len(rows) > 50
        items = rows[:50]
        return items, None if not has_more else str(items[-1].id), has_more


class EventRepo:
    """Append immutable vendor events and rebuild rollups."""

    def __init__(self, session: Session, org_id: uuid.UUID) -> None:
        self.session = session
        self.org_id = org_id

    def append(
        self,
        *,
        vendor_id: uuid.UUID,
        kind: str,
        period_id: uuid.UUID | None = None,
        value: Decimal | int | float | None = None,
        meta: dict[str, Any] | None = None,
        occurred_at: datetime | None = None,
    ) -> VendorEvent:
        event = VendorEvent(
            org_id=self.org_id,
            vendor_id=vendor_id,
            kind=kind,
            period_id=period_id,
            value=Decimal(str(value)) if value is not None else None,
            meta=meta or {},
            occurred_at=occurred_at or datetime.utcnow(),
        )
        self.session.add(event)
        self.session.flush()
        return event

    def rollup_month(self, vendor_id: uuid.UUID, month: str) -> VendorMonthly:
        rows = self.session.execute(
            select(
                VendorEvent.kind,
                func.count(VendorEvent.id).label("n"),
                func.coalesce(func.sum(VendorEvent.value), Decimal("0.00")).label("sum_value"),
            )
            .where(
                VendorEvent.org_id == self.org_id,
                VendorEvent.vendor_id == vendor_id,
                func.date_trunc("month", VendorEvent.occurred_at).cast(String) == month,
            )
            .group_by(VendorEvent.kind)
        ).all()

        errors_by_type: dict[str, Any] = {}
        mismatches = 0
        filing_status = "unknown"
        invoices = 0
        for row in rows:
            kind = row.kind
            count = int(row.n)
            errors_by_type[kind] = count
            if kind == "mismatch_found":
                mismatches = count
            if kind == "invoice_received":
                invoices = count
            if kind in {"filed_on_time", "filed_late", "not_filed"}:
                if kind == "not_filed":
                    filing_status = "not_filed"
                elif kind == "filed_late":
                    filing_status = "late"
                elif kind == "filed_on_time":
                    filing_status = "on_time"

        row = self.session.scalar(
            select(VendorMonthly).where(
                VendorMonthly.org_id == self.org_id,
                VendorMonthly.vendor_id == vendor_id,
                VendorMonthly.month == month,
            )
        )
        if row is None:
            row = VendorMonthly(
                org_id=self.org_id,
                vendor_id=vendor_id,
                month=month,
            )
        row.invoices = invoices
        row.errors_by_type = errors_by_type
        row.mismatches = mismatches
        row.filing_status = filing_status
        row.itc_exposure = Decimal(str(sum(Decimal(str(v)) for v in [r.sum_value for r in rows if r.kind in {"mismatch_found", "not_filed"}] or [Decimal("0.00")])) )
        self.session.add(row)
        self.session.flush()
        return row

    def rebuild_all(self, org_id: uuid.UUID | None = None) -> list[VendorMonthly]:
        target_org_id = org_id or self.org_id
        self.session.execute(
            select(VendorMonthly).where(VendorMonthly.org_id == target_org_id)
        )
        vendors = self.session.scalars(select(Vendor).where(Vendor.org_id == target_org_id)).all()
        rows: list[VendorMonthly] = []
        for vendor in vendors:
            months = {
                row.month for row in self.session.scalars(
                    select(VendorEvent).where(
                        VendorEvent.org_id == target_org_id,
                        VendorEvent.vendor_id == vendor.id,
                    )
                ).all()
            }
            for month in sorted({
                dt.strftime("%Y-%m") for dt in [
                    event.occurred_at for event in self.session.scalars(
                        select(VendorEvent).where(
                            VendorEvent.org_id == target_org_id,
                            VendorEvent.vendor_id == vendor.id,
                        )
                    ).all()
                ]
            }):
                rows.append(self.rollup_month(vendor.id, month))
        return rows


class HeatmapRepo:
    """Vendor heatmap and historical timeline queries."""

    def __init__(self, session: Session, org_id: uuid.UUID) -> None:
        self.session = session
        self.org_id = org_id

    def filing_history(self, vendor_id: uuid.UUID, months: int = 12) -> list[dict[str, Any]]:
        rows = self.session.execute(
            select(
                func.to_char(VendorEvent.occurred_at, "YYYY-MM").label("month"),
                VendorEvent.kind,
                func.count(VendorEvent.id).label("count"),
            )
            .where(
                VendorEvent.org_id == self.org_id,
                VendorEvent.vendor_id == vendor_id,
                VendorEvent.occurred_at >= func.now() - (months * 30 * 24 * 60 * 60),
            )
            .group_by("month", VendorEvent.kind)
            .order_by("month")
        ).all()
        return [
            {"month": row.month, "kind": row.kind, "count": int(row.count)}
            for row in rows
        ]

    def error_types_over_time(self, vendor_id: uuid.UUID, months: int = 12) -> list[dict[str, Any]]:
        rows = self.session.execute(
            select(
                func.to_char(VendorEvent.occurred_at, "YYYY-MM").label("month"),
                VendorEvent.kind,
                func.count(VendorEvent.id).label("count"),
            )
            .where(
                VendorEvent.org_id == self.org_id,
                VendorEvent.vendor_id == vendor_id,
                VendorEvent.kind.in_({"error_found", "mismatch_found", "not_filed"}),
                VendorEvent.occurred_at >= func.now() - (months * 30 * 24 * 60 * 60),
            )
            .group_by("month", VendorEvent.kind)
            .order_by("month")
        ).all()
        return [
            {"month": row.month, "kind": row.kind, "count": int(row.count)}
            for row in rows
        ]


class MessageRepo:
    """Create, approve, and follow up on outbound supplier messages."""

    def __init__(self, session: Session, org_id: uuid.UUID) -> None:
        self.session = session
        self.org_id = org_id

    def create_draft(self, *, vendor_id: uuid.UUID, draft_text: str, channel: str, language: str = "en", tone: str = "polite", invoice_id: uuid.UUID | None = None, created_by: uuid.UUID | None = None) -> Message:
        message = Message(
            org_id=self.org_id,
            vendor_id=vendor_id,
            invoice_id=invoice_id,
            channel=channel,
            language=language,
            tone=tone,
            draft_text=draft_text,
            status="draft",
            created_by=created_by,
        )
        self.session.add(message)
        self.session.flush()
        return message

    def approve(self, message_id: uuid.UUID, *, approved_by: uuid.UUID) -> Message:
        message = self.session.get(Message, message_id)
        if message is None:
            raise NotFoundError("Message", message_id)
        if message.status != "draft":
            raise ValidationError("Only draft messages can be approved", "status")
        message.status = "approved"
        message.approved_by = approved_by
        message.final_text = message.draft_text
        self.session.flush()
        return message

    def mark_opened_link(self, message_id: uuid.UUID) -> Message:
        message = self.session.get(Message, message_id)
        if message is None:
            raise NotFoundError("Message", message_id)
        if message.status not in {"approved", "copied", "emailed"}:
            raise ValidationError("Message cannot be marked opened until approved", "status")
        message.status = "opened_link"
        self.session.flush()
        return message

    def schedule_follow_up(self, message_id: uuid.UUID, when: datetime) -> Message:
        message = self.session.get(Message, message_id)
        if message is None:
            raise NotFoundError("Message", message_id)
        message.follow_up_at = when
        self.session.flush()
        return message

    def list_due_follow_ups(self) -> list[Message]:
        return list(
            self.session.scalars(
                select(Message)
                .where(
                    Message.org_id == self.org_id,
                    Message.status.in_({"approved", "opened_link", "copied", "emailed"}),
                    Message.follow_up_at.is_not(None),
                    Message.follow_up_at <= datetime.utcnow(),
                )
                .order_by(Message.follow_up_at.asc())
            ).all()
        )


class WatchlistRepo:
    """Suppliers with late or missing filing evidence."""

    def __init__(self, session: Session, org_id: uuid.UUID) -> None:
        self.session = session
        self.org_id = org_id

    def non_filers(self, period: str) -> list[dict[str, Any]]:
        rows = self.session.execute(
            select(Vendor.id, Vendor.party_id, Vendor.tag, func.max(VendorEvent.occurred_at).label("last_event"))
            .join(VendorEvent, VendorEvent.vendor_id == Vendor.id)
            .where(
                Vendor.org_id == self.org_id,
                VendorEvent.org_id == self.org_id,
                VendorEvent.kind == "not_filed",
                func.to_char(VendorEvent.occurred_at, "YYYY-MM") == period,
            )
            .group_by(Vendor.id, Vendor.party_id, Vendor.tag)
        ).all()
        return [
            {
                "vendor_id": row.id,
                "party_id": row.party_id,
                "tag": row.tag,
                "last_event": row.last_event,
            }
            for row in rows
        ]


__all__ = [
    "VendorRepo",
    "EventRepo",
    "HeatmapRepo",
    "MessageRepo",
    "WatchlistRepo",
]
