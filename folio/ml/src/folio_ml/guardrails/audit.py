"""Human override audit logging for tracking manual interventions on model values."""

import uuid
from datetime import UTC, datetime
from typing import Any

from folio_ml.guardrails.contracts import OverrideRecord


class HumanOverrideLogger:
    """Records human auditor corrections or manual approvals of AI flagged records."""

    def __init__(self) -> None:
        self._records: list[OverrideRecord] = []

    def log_override(
        self,
        invoice_id: str,
        field_name: str,
        original_value: Any,
        override_value: Any,
        user_id: str,
        reason: str,
    ) -> OverrideRecord:
        """Appends a human override entry to the audit log."""
        record = OverrideRecord(
            override_id=f"OVR-{uuid.uuid4().hex[:8]}",
            invoice_id=invoice_id,
            field_name=field_name,
            original_value=original_value,
            override_value=override_value,
            user_id=user_id,
            reason=reason,
            timestamp_iso=datetime.now(UTC).isoformat(),
        )
        self._records.append(record)
        return record

    @property
    def records(self) -> list[OverrideRecord]:
        return list(self._records)
