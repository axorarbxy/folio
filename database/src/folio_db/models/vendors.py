"""Vendor risk, event history, and messaging models."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from folio_db.base import Base, UuidPk


class Vendor(Base, UuidPk):
    """A supplier or counterparty tracked for compliance risk and messaging."""

    __tablename__ = "vendors"
    __table_args__ = (
        UniqueConstraint("org_id", "party_id", name="uq_vendors_org_party"),
        CheckConstraint("tag IN ('reliable', 'watch', 'high_risk', 'unrated')", name="ck_vendors_tag"),
        CheckConstraint("status IN ('active', 'blocked')", name="ck_vendors_status"),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    party_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.parties.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    tag: Mapped[str] = mapped_column(Text, nullable=False, default="unrated")
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class VendorEvent(Base, UuidPk):
    """Append-only event stream for vendor risk and filing behavior."""

    __tablename__ = "vendor_events"
    __table_args__ = (
        ForeignKeyConstraint(
            ["vendor_id", "org_id"],
            ["app.vendors.id", "app.vendors.org_id"],
            ondelete="CASCADE",
            name="fk_vendor_events_vendor_org_vendors",
        ),
        CheckConstraint(
            "kind IN ('invoice_received','error_found','mismatch_found','filed_on_time','filed_late','not_filed','message_sent','message_replied','gstin_status_checked','credit_note_received')",
            name="ck_vendor_events_kind",
        ),
        Index("ix_vendor_events_vendor_occurred", "vendor_id", "occurred_at"),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.vendors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    period_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.periods.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    value: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class VendorMonthly(Base):
    """Monthly rollup rebuilt from vendor events or updated incrementally."""

    __tablename__ = "vendor_monthly"
    __table_args__ = (
        UniqueConstraint("org_id", "vendor_id", "month", name="uq_vendor_monthly_org_vendor_month"),
        CheckConstraint(
            "filing_status IN ('on_time','late','not_filed','unknown')",
            name="ck_vendor_monthly_filing_status",
        ),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.vendors.id", ondelete="CASCADE"),
        primary_key=True,
    )
    month: Mapped[str] = mapped_column(String(7), primary_key=True)
    invoices: Mapped[int] = mapped_column(nullable=False, default=0)
    errors_by_type: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    mismatches: Mapped[int] = mapped_column(nullable=False, default=0)
    filing_status: Mapped[str] = mapped_column(Text, nullable=False, default="unknown")
    avg_response_hours: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    itc_exposure: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))


class VendorRiskScore(Base, UuidPk):
    """Explainable risk score snapshot for a vendor."""

    __tablename__ = "vendor_risk_scores"
    __table_args__ = (
        CheckConstraint("tag IN ('Reliable','Watch','High risk')", name="ck_vendor_risk_scores_tag"),
        {"schema": "app"},
    )

    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.vendors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scored_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    model_version: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    ci_low: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))
    ci_high: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("100.00"))
    tag: Mapped[str] = mapped_column(Text, nullable=False, default="Watch")
    limited_history: Mapped[bool] = mapped_column(nullable=False, default=True)
    contributions: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)


class Message(Base, UuidPk):
    """Draft and approved outbound communication to a supplier."""

    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("channel IN ('whatsapp', 'email', 'sms')", name="ck_messages_channel"),
        CheckConstraint("language IN ('en', 'hi', 'mr')", name="ck_messages_language"),
        CheckConstraint("tone IN ('polite', 'firm')", name="ck_messages_tone"),
        CheckConstraint(
            "status IN ('draft', 'approved', 'opened_link', 'copied', 'emailed', 'failed')",
            name="ck_messages_status",
        ),
        Index("ix_messages_vendor_status_followup", "vendor_id", "status", "follow_up_at"),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.vendors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.invoices.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    channel: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(Text, nullable=False, default="en")
    tone: Mapped[str] = mapped_column(Text, nullable=False, default="polite")
    draft_text: Mapped[str] = mapped_column(Text, nullable=False)
    final_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="draft")
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    link: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    follow_up_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


__all__ = [
    "Vendor",
    "VendorEvent",
    "VendorMonthly",
    "VendorRiskScore",
    "Message",
]
