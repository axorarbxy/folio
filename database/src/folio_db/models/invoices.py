"""Documents, Invoices, Line Items, Review Tasks, and Processing Traces models."""

from datetime import datetime, date
import uuid
from decimal import Decimal
from typing import List, Optional, Any, Dict
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Index,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, DOMAIN, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from folio_db.base import Base, UuidPk, Timestamps


class File(Base, UuidPk):
    """Immutable uploaded document or exported file."""

    __tablename__ = "files"
    __table_args__ = (
        UniqueConstraint("org_id", "sha256", "kind", name="uq_files_org_sha256_kind"),
        CheckConstraint(
            "kind IN ('original', 'derived', 'export')",
            name="ck_files_kind",
        ),
        CheckConstraint(
            "source IN ('upload', 'camera', 'whatsapp', 'email', 'api')",
            name="ck_files_source",
        ),
        CheckConstraint(
            "scan_status IN ('pending', 'clean', 'infected', 'error')",
            name="ck_files_scan_status",
        ),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    mime: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    storage_key: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    kind: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="original",
    )
    source: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="upload",
    )
    scan_status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="pending",
    )
    uploaded_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<File id={self.id} sha256={self.sha256[:10]}... kind={self.kind}>"


class Party(Base, UuidPk):
    """Counterparty entity (supplier or buyer) with registered GSTIN."""

    __tablename__ = "parties"
    __table_args__ = (
        UniqueConstraint("org_id", "gstin", name="uq_parties_org_gstin"),
        CheckConstraint(
            "gstin_status IN ('unknown', 'active', 'cancelled', 'suspended')",
            name="ck_parties_gstin_status",
        ),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    gstin: Mapped[str] = mapped_column(
        DOMAIN("gstin_t", String(15), schema="app", create_type=False),
        nullable=False,
        index=True,
        comment="PII: 15-character Goods and Services Tax Identification Number",
    )
    legal_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="PII: Legal entity or trade name",
    )
    state_code: Mapped[Optional[str]] = mapped_column(
        DOMAIN("state_code_t", String(2), schema="app", create_type=False),
        nullable=True,
    )
    pan: Mapped[Optional[str]] = mapped_column(
        DOMAIN("pan_t", String(10), schema="app", create_type=False),
        nullable=True,
        comment="PII: Permanent Account Number associated with this GSTIN",
    )
    gstin_status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="unknown",
        comment="PII: GSTIN registration status",
    )
    status_checked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Party id={self.id} gstin={self.gstin} name={self.legal_name!r}>"


class InvoiceTransition(Base):
    """Reference table of allowed transitions in the invoice state machine."""

    __tablename__ = "invoice_transitions"
    __table_args__ = {"schema": "app"}

    from_status: Mapped[str] = mapped_column(Text, primary_key=True)
    to_status: Mapped[str] = mapped_column(Text, primary_key=True)


class Invoice(Base, UuidPk, Timestamps):
    """Core invoice record with financial totals, parties, and extraction metadata."""

    __tablename__ = "invoices"
    __table_args__ = (
        CheckConstraint(
            "direction IN ('purchase', 'sales')",
            name="ck_invoices_direction",
        ),
        CheckConstraint(
            "status IN ('uploaded', 'processing', 'needs_review', 'reviewed', 'validated', 'flagged', 'fixed', 'reconciled', 'closed', 'failed')",
            name="ck_invoices_status",
        ),
        UniqueConstraint("file_id", name="uq_invoices_file_id"),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.files.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    direction: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="purchase",
    )
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="uploaded",
    )
    number_raw: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    number_norm: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True,
    )
    invoice_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )
    supplier_party_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.parties.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    buyer_party_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.parties.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    place_of_supply_state: Mapped[Optional[str]] = mapped_column(
        DOMAIN("state_code_t", String(2), schema="app", create_type=False),
        nullable=True,
    )
    reverse_charge: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    irn: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    taxable_total: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    cgst_total: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    sgst_total: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    igst_total: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    cess_total: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    round_off: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    grand_total: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    quality_score: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    languages: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(Text),
        nullable=True,
    )
    fingerprint: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        index=True,
    )
    reader_version: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    prompt_version: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    raw_extraction: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
    )
    period_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        nullable=True,
    )


    file: Mapped["File"] = relationship("File")
    supplier: Mapped[Optional["Party"]] = relationship("Party", foreign_keys=[supplier_party_id])
    buyer: Mapped[Optional["Party"]] = relationship("Party", foreign_keys=[buyer_party_id])
    items: Mapped[List["LineItem"]] = relationship("LineItem", back_populates="invoice", cascade="all, delete-orphan")
    field_values: Mapped[List["FieldValue"]] = relationship("FieldValue", back_populates="invoice", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Invoice id={self.id} number={self.number_norm!r} total={self.grand_total}>"


class LineItem(Base):
    """Individual item line extracted from an invoice."""

    __tablename__ = "line_items"
    __table_args__ = (
        {"schema": "app"},
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.invoices.id", ondelete="CASCADE"),
        primary_key=True,
    )
    line_no: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    hsn: Mapped[Optional[str]] = mapped_column(
        DOMAIN("hsn_t", String(8), schema="app", create_type=False),
        nullable=True,
    )
    qty: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(14, 4),
        nullable=True,
    )
    unit: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    rate: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2),
        nullable=True,
    )
    discount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    taxable: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    cgst_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    sgst_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    igst_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    cess_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    cgst_amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    sgst_amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    igst_amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    cess_amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")


class FieldValue(Base):
    """Current extracted or human-corrected field value with confidence and bbox."""

    __tablename__ = "field_values"
    __table_args__ = (
        CheckConstraint(
            "source IN ('reader', 'human', 'rule')",
            name="ck_field_values_source",
        ),
        {"schema": "app"},
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.invoices.id", ondelete="CASCADE"),
        primary_key=True,
    )
    field_path: Mapped[str] = mapped_column(
        Text,
        primary_key=True,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    raw_text: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    value_norm: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    confidence: Mapped[Decimal] = mapped_column(
        Numeric(5, 4),
        nullable=False,
        default=Decimal("1.0000"),
    )
    calibrated_confidence: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )
    box: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
    )
    source: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="reader",
    )
    edited: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="field_values")


class FieldEdit(Base, UuidPk):
    """Append-only audit trail of human edits to extracted invoice fields."""

    __tablename__ = "field_edits"
    __table_args__ = {"schema": "app"}

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    field_path: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    old_value: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    new_value: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    edited_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class InvoiceStatusHistory(Base, UuidPk):
    """Append-only progression history through the invoice status machine."""

    __tablename__ = "invoice_status_history"
    __table_args__ = {"schema": "app"}

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_status: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    to_status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    actor: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    note: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class ReviewTask(Base, UuidPk):
    """Human verification queue task for flagged or low-confidence invoices."""

    __tablename__ = "review_tasks"
    __table_args__ = (
        CheckConstraint(
            "priority IN ('low', 'normal', 'high', 'urgent')",
            name="ck_review_tasks_priority",
        ),
        CheckConstraint(
            "status IN ('open', 'in_progress', 'done', 'cancelled')",
            name="ck_review_tasks_status",
        ),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reasons: Mapped[List[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
    )
    priority: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="normal",
    )
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="open",
    )
    assignee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    due_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    breached_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class ProcessingStage(Base, UuidPk):
    """Pipeline processing trace powering waterfall latency and telemetry."""

    __tablename__ = "processing_stages"
    __table_args__ = (
        CheckConstraint(
            "stage IN ('ingest', 'preprocess', 'read', 'validate', 'reconcile', 'notify')",
            name="ck_processing_stages_stage",
        ),
        CheckConstraint(
            "status IN ('pending', 'running', 'success', 'failed', 'skipped')",
            name="ck_processing_stages_status",
        ),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stage: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="pending",
    )
    attempt: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    latency_ms: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    model_version: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    error_code: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    error_detail: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    meta: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
    )
