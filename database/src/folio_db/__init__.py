"""Folio Database Foundation Package.

The system of record for Folio GST workspace:
- Tenants & Organizations
- Invoices & Rules
- ITC Reconciliation
- Vendor Risk & Auditing
"""

from folio_db.config import Settings, get_settings
from folio_db.session import (
    create_engine_from_settings,
    tenant_session,
    system_session,
    TenantContext,
)
from folio_db.errors import (
    FolioDbError,
    NotFoundError,
    ConflictError,
    TenantIsolationError,
    ValidationError,
)
from folio_db.base import Base, UuidPk, Timestamps, TenantOwned

__all__ = [
    "Settings",
    "get_settings",
    "create_engine_from_settings",
    "tenant_session",
    "system_session",
    "TenantContext",
    "FolioDbError",
    "NotFoundError",
    "ConflictError",
    "TenantIsolationError",
    "ValidationError",
    "Base",
    "UuidPk",
    "Timestamps",
    "TenantOwned",
]
