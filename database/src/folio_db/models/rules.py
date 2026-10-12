"""Versioned rule tables and validation results used by the review engine."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
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
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from folio_db.base import Base, UuidPk


class RuleTable(Base, UuidPk):
    """Versioned legal or business rule-set metadata."""

    __tablename__ = "rule_tables"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('hsn_rates', 'state_codes', 'thresholds')",
            name="ck_rule_tables_kind",
        ),
        CheckConstraint(
            "status IN ('draft', 'active', 'retired')",
            name="ck_rule_tables_status",
        ),
        UniqueConstraint("kind", "version", name="uq_rule_tables_kind_version"),
        Index(
            "ix_rule_tables_active_kind",
            "kind",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
        {"schema": "platform"},
    )

    kind: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="draft")
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    checksum: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class HsnRateEntry(Base):
    """Tax-rate rule entries keyed by HSN prefix."""

    __tablename__ = "hsn_rate_entries"
    __table_args__ = ({"schema": "platform"},)

    rule_table_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("platform.rule_tables.id", ondelete="CASCADE"),
        primary_key=True,
    )
    hsn_prefix: Mapped[str] = mapped_column(String(8), nullable=False, primary_key=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    rate_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    conditions: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class StateCodeEntry(Base):
    """State or UT code metadata."""

    __tablename__ = "state_codes"
    __table_args__ = (
        CheckConstraint("type IN ('state', 'ut', 'other')", name="ck_state_codes_type"),
        {"schema": "platform"},
    )

    rule_table_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("platform.rule_tables.id", ondelete="CASCADE"),
        primary_key=True,
    )
    code: Mapped[str] = mapped_column(String(2), nullable=False, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False, default="state")


class ThresholdEntry(Base):
    """JSON-based thresholds for engine guardrails and compliance checks."""

    __tablename__ = "thresholds"
    __table_args__ = ({"schema": "platform"},)

    rule_table_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("platform.rule_tables.id", ondelete="CASCADE"),
        primary_key=True,
    )
    key: Mapped[str] = mapped_column(Text, nullable=False, primary_key=True)
    value: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class RuleChangeLog(Base, UuidPk):
    """Append-only log of changes to rule tables."""

    __tablename__ = "rule_change_log"
    __table_args__ = ({"schema": "platform"},)

    rule_table_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("platform.rule_tables.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    change_type: Mapped[str] = mapped_column(Text, nullable=False)
    actor: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    diff: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class ValidationRun(Base, UuidPk):
    """One rule-engine validation execution for an invoice."""

    __tablename__ = "validation_runs"
    __table_args__ = (
        CheckConstraint(
            "verdict IN ('safe', 'fix_first', 'itc_blocked', 'needs_review')",
            name="ck_validation_runs_verdict",
        ),
        CheckConstraint(
            "trigger IN ('auto', 'manual', 'revalidate')",
            name="ck_validation_runs_trigger",
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
    engine_version: Mapped[str] = mapped_column(Text, nullable=False)
    rule_table_versions: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verdict: Mapped[str] = mapped_column(Text, nullable=False)
    rupee_at_risk: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    trigger: Mapped[str] = mapped_column(Text, nullable=False, default="auto")


class CheckResult(Base):
    """A single result produced by a validation check."""

    __tablename__ = "check_results"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pass', 'fail', 'inconclusive', 'skipped')",
            name="ck_check_results_status",
        ),
        CheckConstraint(
            "kind IN ('deterministic', 'ai')",
            name="ck_check_results_kind",
        ),
        ForeignKeyConstraint(
            ["run_id", "check_id"],
            ["app.check_results.run_id", "app.check_results.check_id"],
        ),
        {"schema": "app"},
    )

    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.validation_runs.id", ondelete="CASCADE"),
        primary_key=True,
    )
    check_id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False, default="deterministic")
    expected: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    found: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    formula: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    why_it_matters: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fixes: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text), nullable=True)
    details: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)


class CheckFeedback(Base, UuidPk):
    """Append-only human override trail for check results."""

    __tablename__ = "check_feedback"
    __table_args__ = (
        CheckConstraint(
            "feedback IN ('confirmed', 'dismissed', 'accepted_with_note')",
            name="ck_check_feedback_feedback",
        ),
        ForeignKeyConstraint(
            ["run_id", "check_id"],
            ["app.check_results.run_id", "app.check_results.check_id"],
            ondelete="CASCADE",
        ),
        {"schema": "app"},
    )

    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.validation_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    check_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    feedback: Mapped[str] = mapped_column(Text, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class RuleDailyStats(Base):
    """Rollup statistics used to populate the rules monitoring page."""

    __tablename__ = "rule_daily_stats"
    __table_args__ = ({"schema": "app"},)

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    rule_id: Mapped[str] = mapped_column(Text, primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    runs: Mapped[int] = mapped_column(default=0, nullable=False)
    fails: Mapped[int] = mapped_column(default=0, nullable=False)
    inconclusive: Mapped[int] = mapped_column(default=0, nullable=False)
    confirmed: Mapped[int] = mapped_column(default=0, nullable=False)
    dismissed: Mapped[int] = mapped_column(default=0, nullable=False)
