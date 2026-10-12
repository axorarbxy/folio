"""Database configuration and environment loading."""

from functools import lru_cache
import os
from pydantic_settings import BaseSettings
from pydantic import Field
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    """Strongly-typed database settings with environment fallback."""

    db_url: str = Field(
        default_factory=lambda: os.getenv(
            "FOLIO_DB_URL",
            "postgresql+psycopg://postgres:root@localhost:5432/folio",
        ),
        alias="FOLIO_DB_URL",
    )
    test_db_url: str = Field(
        default_factory=lambda: os.getenv(
            "FOLIO_TEST_DB_URL",
            "postgresql+psycopg://postgres:root@localhost:5432/folio_test",
        ),
        alias="FOLIO_TEST_DB_URL",
    )
    pool_size: int = Field(
        default_factory=lambda: int(os.getenv("FOLIO_DB_POOL_SIZE", "10")),
        alias="FOLIO_DB_POOL_SIZE",
    )
    max_overflow: int = Field(
        default_factory=lambda: int(os.getenv("FOLIO_DB_MAX_OVERFLOW", "20")),
        alias="FOLIO_DB_MAX_OVERFLOW",
    )
    pool_timeout: int = Field(
        default_factory=lambda: int(os.getenv("FOLIO_DB_POOL_TIMEOUT", "30")),
        alias="FOLIO_DB_POOL_TIMEOUT",
    )
    echo: bool = Field(
        default_factory=lambda: os.getenv("FOLIO_DB_ECHO", "false").lower() in ("true", "1", "yes"),
        alias="FOLIO_DB_ECHO",
    )
    encryption_key: str = Field(
        default_factory=lambda: os.getenv(
            "FOLIO_ENCRYPTION_KEY",
            "k4gT_XyDqZ0qV7nN1uW9yL2oP5sA8dF4gH7jK0lM3vE=",
        ),
        alias="FOLIO_ENCRYPTION_KEY",
    )


    model_config = {
        "extra": "ignore",
        "env_prefix": "FOLIO_DB_",
    }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
