"""Logging configuration with PII masking and IST timestamps."""

import logging
import sys

from folio_ml.config import settings
from folio_ml.utils.dates import now_ist
from folio_ml.utils.text import mask_pii


class PiiMaskingFormatter(logging.Formatter):
    """Formatter that formats records with IST timestamps and masks PII in logs."""

    def formatTime(self, record: logging.LogRecord, datefmt: str | None = None) -> str:
        ist_dt = now_ist()
        if datefmt:
            return ist_dt.strftime(datefmt)
        return ist_dt.isoformat()

    def format(self, record: logging.LogRecord) -> str:
        original = super().format(record)
        if settings.folio_redact_pii:
            return mask_pii(original)
        return original


def configure_logging(level: str | None = None) -> logging.Logger:
    """Configures root logger with PII masking and clean stream handler."""
    log_level = level or settings.folio_log_level
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)

    logger = logging.getLogger("folio_ml")
    logger.setLevel(numeric_level)
    logger.propagate = False

    # Remove existing handlers to avoid duplicates
    for handler in list(logger.handlers):
        logger.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    formatter = PiiMaskingFormatter(
        fmt="[%(asctime)s IST] [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    return logger


logger = configure_logging()
