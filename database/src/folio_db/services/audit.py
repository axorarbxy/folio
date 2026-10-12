"""Audit logging hook interface.

Every mutating service writes an audit event in the same transaction.
Until README 07 implements the full audit subsystem, this provides the compliant signature.
"""

from typing import Any, Dict, Optional
import uuid
from sqlalchemy.orm import Session


def audit_record(
    session: Session,
    org_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    action: str,
    resource_type: str,
    resource_id: str,
    payload: Optional[Dict[str, Any]] = None,
) -> None:
    """Record an audit event within the active transaction.

    No-op stub with production-ready signature until README 07 audit log explorer tables exist.
    """
    pass
