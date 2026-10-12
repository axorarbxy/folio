"""Custom exceptions for Folio Database Layer.

All repositories translate driver exceptions into these domain errors.
"""

from typing import Any


class FolioDbError(Exception):
    """Base exception for all database layer errors."""

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(FolioDbError):
    """Raised when an entity is not found within the current tenant scope."""

    def __init__(self, entity_name: str, identifier: Any) -> None:
        super().__init__(
            f"{entity_name} with identifier '{identifier}' was not found.",
            {"entity": entity_name, "identifier": str(identifier)},
        )


class ConflictError(FolioDbError):
    """Raised when a unique constraint or concurrency check fails."""

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message, details)


class TenantIsolationError(FolioDbError):
    """Raised when an operation attempts to bypass or violate tenant boundaries."""

    def __init__(self, message: str = "Tenant isolation policy violation") -> None:
        super().__init__(message)


class ValidationError(FolioDbError):
    """Raised when input data violates a domain format or database check constraint."""

    def __init__(self, message: str, field: str | None = None) -> None:
        details = {"field": field} if field else {}
        super().__init__(message, details)
