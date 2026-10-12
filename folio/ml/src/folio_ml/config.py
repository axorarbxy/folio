"""Application configuration using Pydantic Settings."""

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Folio ML runtime settings."""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    folio_mode: Literal["fake", "replay", "live"] = Field(
        default="fake",
        alias="FOLIO_MODE",
        description="Operating mode: fake (fixtures), replay (recorded eval), live (real models)",
    )
    folio_api_host: str = Field(default="0.0.0.0", alias="FOLIO_API_HOST")
    folio_api_port: int = Field(default=8000, alias="FOLIO_API_PORT")
    folio_log_level: str = Field(default="INFO", alias="FOLIO_LOG_LEVEL")
    folio_cors_origins: list[str] = Field(
        default=["http://localhost:3000"],
        alias="FOLIO_CORS_ORIGINS",
    )

    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")

    folio_redact_pii: bool = Field(default=True, alias="FOLIO_REDACT_PII")


settings = Settings()
