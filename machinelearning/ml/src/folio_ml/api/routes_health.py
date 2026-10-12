"""Health check endpoint."""

from fastapi import APIRouter

from folio_ml.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
def get_health() -> dict[str, str]:
    """Returns service health, version, and FOLIO_MODE."""
    return {
        "status": "ok",
        "mode": settings.folio_mode,
        "version": "0.1.0",
    }
