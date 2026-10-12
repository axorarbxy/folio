"""Reconciliation, GSTR-2B imports, and invoice-evidence models."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from folio_db.base import Base, UuidPk


class Period(Base, UuidPk):
    """Accounting period used for filing readiness and reconciliation."""

    __tablename__ = "periods"
    __table_args__ = (
        UniqueConstraint("org_id", "year", "month", name="uq_periods_org_year_month"),
        CheckConstraint("status IN ('open', 'reconciling', 'ready', 'filed')", name="ck_periods_status"),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="open")
    due_dates: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    filed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    filed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )


class Gstr2bImport(Base, UuidPk):
    """One imported GSTR-2B file; superseded imports remain for auditability."""

    __tablename__ = "gstr2b_imports"
    __table_args__ = (
        CheckConstraint("status IN ('parsed', 'failed', 'superseded')", name="ck_gstr2b_imports_status"),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    period_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.periods.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.files.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    adapter: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
    record_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="parsed")
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Gstr2bRow(Base, UuidPk):
    """One row imported from a GSTR-2B file."""

    __tablename__ = "gstr2b_rows"
    __table_args__ = (
        Index("ix_gstr2b_rows_import_supplier_no", "import_id", "supplier_gstin", "invoice_no_norm"),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    import_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.gstr2b_imports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    supplier_gstin: Mapped[str] = mapped_column(String(15), nullable=False, index=True)
    supplier_name: Mapped[str] = mapped_column(Text, nullable=False)
    doc_type: Mapped[str] = mapped_column(Text, nullable=False)
    invoice_no_raw: Mapped[str] = mapped_column(Text, nullable=False)
    invoice_no_norm: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    invoice_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    taxable: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    igst: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    cgst: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    sgst: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    cess: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    itc_available: Mapped[bool] = mapped_column(nullable=False, default=False)
    itc_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_period: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class RegisterImport(Base, UuidPk):
    """External purchase-register import metadata."""

    __tablename__ = "register_imports"
    __table_args__ = ({"schema": "app"},)

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    period_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.periods.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.files.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    adapter: Mapped[str] = mapped_column(Text, nullable=False)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
    mapping: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="parsed")


class RegisterRow(Base, UuidPk):
    """One row from an uploaded purchase register."""

    __tablename__ = "register_rows"
    __table_args__ = ({"schema": "app"},)

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    import_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.register_imports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    supplier_gstin: Mapped[Optional[str]] = mapped_column(String(15), nullable=True, index=True)
    supplier_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    invoice_no_raw: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    invoice_no_norm: Mapped[Optional[str]] = mapped_column(Text, nullable=True, index=True)
    invoice_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    taxable: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    igst: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    cgst: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    sgst: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    cess: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    source_row: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)


class ReconRun(Base, UuidPk):
    """A period-level reconciliation execution."""

    __tablename__ = "recon_runs"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'running', 'complete', 'failed')", name="ck_recon_runs_status"),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    period_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.periods.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    import_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.gstr2b_imports.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    params: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    engine_version: Mapped[str] = mapped_column(Text, nullable=False, default="folio-db")
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    totals: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    itc_at_risk: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    is_latest: Mapped[bool] = mapped_column(nullable=False, default=False)


class ReconMatch(Base, UuidPk):
    """A single invoice-to-2B/register reconciliation decision."""

    __tablename__ = "recon_matches"
    __table_args__ = (
        CheckConstraint(
            "num_nonnulls(invoice_id, gstr2b_row_id, register_row_id) >= 1",
            name="ck_recon_matches_anchor",
        ),
        CheckConstraint(
            "bucket IN ('matched', 'value_mismatch', 'missing_in_2b', 'missing_in_books', 'vendor_not_filed', 'ineligible', 'duplicate', 'timing_difference')",
            name="ck_recon_matches_bucket",
        ),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.recon_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.invoices.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    gstr2b_row_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.gstr2b_rows.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    register_row_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.register_rows.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    bucket: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    reasons: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    diff: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    amount_at_risk: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    supplier_gstin: Mapped[Optional[str]] = mapped_column(String(15), nullable=True, index=True)


class ReconResolution(Base, UuidPk):
    """Append-only history of match resolutions."""

    __tablename__ = "recon_resolutions"
    __table_args__ = (
        CheckConstraint(
            "action IN ('contact_vendor', 'defer', 'reverse_itc', 'accept_difference')",
            name="ck_recon_resolutions_action",
        ),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.recon_matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    actor: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), nullable=False)


class EinvoiceEvidence(Base):
    """e-invoice evidence captured for an invoice."""

    __tablename__ = "einvoice_evidence"
    __table_args__ = (
        CheckConstraint("source IN ('qr', 'portal', 'upload')", name="ck_einvoice_evidence_source"),
        UniqueConstraint("org_id", "invoice_id", name="uq_einvoice_evidence_org_invoice"),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.invoices.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    irn: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ack_no: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ack_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    qr_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    signature_verified: Mapped[bool] = mapped_column(nullable=False, default=False)
    source: Mapped[str] = mapped_column(Text, nullable=False, default="qr")


class WhatifScenario(Base, UuidPk):
    """Projected exposure scenario for a reconciliation run."""

    __tablename__ = "whatif_scenarios"
    __table_args__ = ({"schema": "app"},)

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.recon_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    vendors_not_filing: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    projected_loss: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
