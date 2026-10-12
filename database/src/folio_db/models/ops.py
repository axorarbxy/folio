"""Monitoring, ML ops, and security signal models."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import (
    ARRAY,
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
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from folio_db.base import Base, UuidPk


class ModelRegistry(Base, UuidPk):
    """Registered model versions and their artifact metadata."""

    __tablename__ = "model_registry"
    __table_args__ = (
        CheckConstraint(
            "status IN ('candidate', 'production', 'retired')",
            name="ck_model_registry_status",
        ),
        {"schema": "platform"},
    )

    name: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    version: Mapped[str] = mapped_column(Text, nullable=False)
    artifact_hash: Mapped[str] = mapped_column(Text, nullable=False)
    data_hash: Mapped[str] = mapped_column(Text, nullable=False)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="candidate")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    promoted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class EvalRun(Base, UuidPk):
    """A full ML evaluation run against a set of model and rule versions."""

    __tablename__ = "eval_runs"
    __table_args__ = ({"schema": "platform"},)

    git_commit: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    model_versions: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    rule_table_versions: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    data_hash: Mapped[str] = mapped_column(Text, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="running")


class EvalMetric(Base):
    """Metric emitted by a model evaluation suite."""

    __tablename__ = "eval_metrics"
    __table_args__ = ({"schema": "platform"},)

    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("platform.eval_runs.id", ondelete="CASCADE"),
        primary_key=True,
    )
    suite: Mapped[str] = mapped_column(Text, primary_key=True)
    metric: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    ci_low: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 6), nullable=True)
    ci_high: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 6), nullable=True)
    slice: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)


class ComponentStatusDaily(Base):
    """Daily component health snapshot, one row per component/day."""

    __tablename__ = "component_status_daily"
    __table_args__ = (
        UniqueConstraint("component", "date", name="uq_component_status_daily_component_date"),
        CheckConstraint(
            "status IN ('healthy', 'degraded', 'down')",
            name="ck_component_status_daily_status",
        ),
        {"schema": "platform"},
    )

    component: Mapped[str] = mapped_column(Text, primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="healthy")
    uptime_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("100.00"))


class Incident(Base, UuidPk):
    """Major degradation or outage incident record."""

    __tablename__ = "incidents"
    __table_args__ = (
        CheckConstraint(
            "impact IN ('degraded', 'outage')",
            name="ck_incidents_impact",
        ),
        {"schema": "platform"},
    )

    title: Mapped[str] = mapped_column(Text, nullable=False)
    impact: Mapped[str] = mapped_column(Text, nullable=False, default="degraded")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    root_cause: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changes_made: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    components: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class IncidentUpdate(Base, UuidPk):
    """Append-only timeline for an incident."""

    __tablename__ = "incident_updates"
    __table_args__ = (
        CheckConstraint(
            "status IN ('investigating', 'identified', 'monitoring', 'resolved')",
            name="ck_incident_updates_status",
        ),
        {"schema": "platform"},
    )

    incident_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("platform.incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class PipelineMetric(Base):
    """Minute-level pipeline health metrics for a tenant or organization-wide pipeline."""

    __tablename__ = "pipeline_metrics"
    __table_args__ = (
        CheckConstraint(
            "stage IN ('upload', 'reading', 'validation', 'reconciliation', 'notifications')",
            name="ck_pipeline_metrics_stage",
        ),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    stage: Mapped[str] = mapped_column(Text, primary_key=True)
    bucket_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    throughput: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    p50_ms: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    p95_ms: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    p99_ms: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    queue_depth: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class CalibrationSnapshot(Base, UuidPk):
    """Latest calibration fit for an ML model version."""

    __tablename__ = "calibration_snapshots"
    __table_args__ = ({"schema": "app"},)

    model_version: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ece: Mapped[Decimal] = mapped_column(Numeric(10, 6), nullable=False)
    brier: Mapped[Decimal] = mapped_column(Numeric(10, 6), nullable=False)
    bins: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    slices: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)


class DriftSnapshot(Base, UuidPk):
    """Drift measurement snapshot for model or input distribution drift."""

    __tablename__ = "drift_snapshots"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('confidence', 'input_mix', 'accuracy')",
            name="ck_drift_snapshots_kind",
        ),
        {"schema": "app"},
    )

    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    psi: Mapped[Decimal] = mapped_column(Numeric(10, 6), nullable=False)
    baseline_window: Mapped[str] = mapped_column(Text, nullable=False)
    recent_window: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(Text, nullable=False, default="low")
    message: Mapped[str] = mapped_column(Text, nullable=False)


class AlertRule(Base, UuidPk):
    """Threshold-based alerting rule that runs against recent metrics."""

    __tablename__ = "alert_rules"
    __table_args__ = (
        CheckConstraint(
            "severity IN ('low', 'medium', 'high', 'critical')",
            name="ck_alert_rules_severity",
        ),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    metric: Mapped[str] = mapped_column(Text, nullable=False)
    condition: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    window_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    severity: Mapped[str] = mapped_column(Text, nullable=False, default="medium")
    channels: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class Alert(Base, UuidPk):
    """An open, acknowledged, snoozed, or resolved operational alert."""

    __tablename__ = "alerts"
    __table_args__ = (
        CheckConstraint(
            "severity IN ('low', 'medium', 'high', 'critical')",
            name="ck_alerts_severity",
        ),
        CheckConstraint(
            "source IN ('pipeline', 'ai_quality', 'rules', 'review_queue', 'filing', 'vendors', 'security')",
            name="ck_alerts_source",
        ),
        CheckConstraint(
            "status IN ('open', 'acknowledged', 'snoozed', 'resolved')",
            name="ck_alerts_status",
        ),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rule_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.alert_rules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    severity: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="open")
    fired_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    acknowledged_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    snoozed_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metric_snapshot: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    assignee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )


class AlertEvent(Base, UuidPk):
    """Append-only state transition log for alerts."""

    __tablename__ = "alert_events"
    __table_args__ = ({"schema": "app"},)

    alert_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.alerts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class NotificationChannel(Base, UuidPk):
    """Delivery configuration for notifications to a user or inbox target."""

    __tablename__ = "notification_channels"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('in_app', 'email', 'whatsapp', 'sms')",
            name="ck_notification_channels_kind",
        ),
        UniqueConstraint("org_id", "kind", "target", name="uq_notification_channels_org_kind_target"),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    target: Mapped[str] = mapped_column(Text, nullable=False)
    quiet_hours: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class NotificationLog(Base, UuidPk):
    """Delivery log; not every channel is a hard-coded queue."""

    __tablename__ = "notification_log"
    __table_args__ = ({"schema": "app"},)

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    channel_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.notification_channels.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    target: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="queued")
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class ThreatSignal(Base, UuidPk):
    """Signals raised by the ML scanner or monitoring pipeline."""

    __tablename__ = "threat_signals"
    __table_args__ = (
        CheckConstraint(
            "severity IN ('low', 'medium', 'high', 'critical')",
            name="ck_threat_signals_severity",
        ),
        CheckConstraint(
            "status IN ('open', 'investigating', 'dismissed', 'resolved', 'escalated')",
            name="ck_threat_signals_status",
        ),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    severity: Mapped[str] = mapped_column(Text, nullable=False, default="medium")
    status: Mapped[str] = mapped_column(Text, nullable=False, default="open")
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    risk: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    assignee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resolution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.invoices.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )


class SignalAction(Base, UuidPk):
    """Append-only action log for threat signals."""

    __tablename__ = "signal_actions"
    __table_args__ = (
        CheckConstraint(
            "action IN ('investigate', 'dismiss_false_positive', 'escalate', 'block_session', 'hold_invoice')",
            name="ck_signal_actions_action",
        ),
        {"schema": "app"},
    )

    signal_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.threat_signals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    actor: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class MonitoringSettings(Base):
    """Per-tenant monitoring configuration."""

    __tablename__ = "monitoring_settings"
    __table_args__ = ({"schema": "app"},)

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    thresholds: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    retention: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    masking_toggles: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    access_rules: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)


__all__ = [
    "ModelRegistry",
    "EvalRun",
    "EvalMetric",
    "ComponentStatusDaily",
    "Incident",
    "IncidentUpdate",
    "PipelineMetric",
    "CalibrationSnapshot",
    "DriftSnapshot",
    "AlertRule",
    "Alert",
    "AlertEvent",
    "NotificationChannel",
    "NotificationLog",
    "ThreatSignal",
    "SignalAction",
    "MonitoringSettings",
]
