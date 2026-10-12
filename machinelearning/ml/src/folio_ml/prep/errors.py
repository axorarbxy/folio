"""Exceptions for document ingestion and preprocessing."""


class PreprocessingError(Exception):
    """Base error for document preprocessing failures."""


class UnsupportedFileFormatError(PreprocessingError):
    """Raised when an uploaded file is not an allowed format (PDF, PNG, JPG, JSON)."""

    def __init__(self, filename: str, mime_type: str | None = None) -> None:
        super().__init__(
            f"Unsupported file format for '{filename}' (mime: {mime_type or 'unknown'}). "
            "Supported formats are PDF, PNG, JPG/JPEG, and JSON e-invoices."
        )
        self.filename = filename
        self.mime_type = mime_type


class FileOversizeError(PreprocessingError):
    """Raised when an uploaded document exceeds size thresholds."""

    def __init__(self, filename: str, size_bytes: int, max_bytes: int) -> None:
        size_mb = size_bytes / (1024 * 1024)
        max_mb = max_bytes / (1024 * 1024)
        super().__init__(
            f"File '{filename}' ({size_mb:.2f} MB) exceeds maximum allowed size of {max_mb:.2f} MB."
        )
        self.filename = filename
        self.size_bytes = size_bytes
        self.max_bytes = max_bytes


class CorruptDocumentError(PreprocessingError):
    """Raised when file content cannot be parsed as a valid image or document."""

    def __init__(self, filename: str, details: str) -> None:
        super().__init__(f"Corrupted or unreadable document '{filename}': {details}")
        self.filename = filename
        self.details = details
