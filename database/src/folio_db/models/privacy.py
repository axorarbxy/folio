"""Privacy, consent, and retention models."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from folio_db.base import Base, Timestamps, UuidPk


class PrivacyRequest(Base, UuidPk, Timestamps):
    """Privacy access/correction/deletion requests."""

    __tablename__ = "privacy_requests"
    __table_args__ = ({"schema": "app"},)

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subject_ref: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="received")
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    handled_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), nullable=True)
    outcome: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class ConsentRecord(Base, UuidPk, Timestamps):
    """Consent records for personal data processing."""

    __tablename__ = "consent_records"
    __table_args__ = ({"schema": "app"},)

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subject_ref: Mapped[str] = mapped_column(Text, nullable=False)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    policy_version: Mapped[str] = mapped_column(String(64), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
    withdrawn_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    evidence_file_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), nullable=True)


class RetentionPolicy(Base, UuidPk, Timestamps):
    """Data retention policies for tenant data classes."""

    __tablename__ = "retention_policies"
    __table_args__ = ({"schema": "app"},)

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    data_type: Mapped[str] = mapped_column(Text, nullable=False)
    retention_days: Mapped[int] = mapped_column(Integer, nullable=False)
    legal_hold: Mapped[bool] = mapped_column(default=False, nullable=False)
    updated_by: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), nullable=True)


__all__ = ["PrivacyRequest", "ConsentRecord", "RetentionPolicy"]
