"""Database-backed adapter for the ML vendor-risk store protocol."""

from __future__ import annotations

import uuid
from typing import Any, Protocol, runtime_checkable

from sqlalchemy.orm import Session

from folio_db.models.vendors import VendorEvent, VendorRiskScore


@runtime_checkable
class VendorStoreProtocol(Protocol):
    """Protocol expected by the ML risk scorer for vendor event persistence."""

    def record_event(self, event: dict[str, Any]) -> dict[str, Any]:
        ...

    def get_history(self, vendor_id: uuid.UUID) -> list[VendorEvent]:
        ...

    def get_features(self, vendor_id: uuid.UUID) -> dict[str, Any]:
        ...

    def save_score(self, *, vendor_id: uuid.UUID, score: VendorRiskScore) -> VendorRiskScore:
        ...

    def get_latest_score(self, vendor_id: uuid.UUID) -> VendorRiskScore | None:
        ...


class DatabaseVendorStore:
    """Minimal adapter that persists vendor events and risk score snapshots."""

    def __init__(self, session: Session, org_id: uuid.UUID) -> None:
        self.session = session
        self.org_id = org_id

    def record_event(self, event: dict[str, Any]) -> dict[str, Any]:
        row = VendorEvent(
            org_id=self.org_id,
            vendor_id=uuid.UUID(str(event["vendor_id"])),
            kind=str(event["kind"]),
            period_id=uuid.UUID(str(event["period_id"])) if event.get("period_id") else None,
            value=event.get("value"),
            meta=event.get("meta") or {},
        )
        self.session.add(row)
        self.session.flush()
        return {
            "id": str(row.id),
            "vendor_id": str(row.vendor_id),
            "kind": row.kind,
            "period_id": str(row.period_id) if row.period_id else None,
            "meta": row.meta,
        }

    def get_history(self, vendor_id: uuid.UUID) -> list[VendorEvent]:
        return list(
            self.session.query(VendorEvent)
            .filter(VendorEvent.org_id == self.org_id, VendorEvent.vendor_id == vendor_id)
            .order_by(VendorEvent.occurred_at.asc())
            .all()
        )

    def get_features(self, vendor_id: uuid.UUID) -> dict[str, Any]:
        return {
            "vendor_id": str(vendor_id),
            "org_id": str(self.org_id),
            "limited_history": True,
            "events": [
                {"kind": row.kind, "occurred_at": row.occurred_at.isoformat(), "value": str(row.value) if row.value is not None else None}
                for row in self.get_history(vendor_id)
            ],
        }

    def save_score(self, *, vendor_id: uuid.UUID, score: VendorRiskScore) -> VendorRiskScore:
        self.session.add(score)
        self.session.flush()
        return score

    def get_latest_score(self, vendor_id: uuid.UUID) -> VendorRiskScore | None:
        return (
            self.session.query(VendorRiskScore)
            .filter(VendorRiskScore.vendor_id == vendor_id)
            .order_by(VendorRiskScore.scored_at.desc())
            .first()
        )


__all__ = ["DatabaseVendorStore", "VendorStoreProtocol"]
