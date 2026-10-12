"""Monitoring, ML Ops, and security signals schema.

Revision ID: 0010_monitoring_ml_ops_schema
Revises: 0009_reconciliation_schema
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0010_monitoring_ml_ops_schema"
down_revision = "0009_reconciliation_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "model_registry",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("version", sa.Text(), nullable=False),
        sa.Column("artifact_hash", sa.Text(), nullable=False),
        sa.Column("data_hash", sa.Text(), nullable=False),
        sa.Column("metrics", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("status", sa.Text(), server_default="candidate", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("promoted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint("status IN ('candidate', 'production', 'retired')", name="ck_model_registry_status"),
        sa.PrimaryKeyConstraint("id", name="pk_model_registry"),
        schema="platform",
    )
    op.create_index("ix_model_registry_name", "model_registry", ["name"], unique=False, schema="platform")

    op.create_table(
        "eval_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("git_commit", sa.Text(), nullable=True),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("model_versions", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("rule_table_versions", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("data_hash", sa.Text(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.Text(), server_default="running", nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_eval_runs"),
        schema="platform",
    )

    op.create_table(
        "eval_metrics",
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("platform.eval_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("suite", sa.Text(), nullable=False),
        sa.Column("metric", sa.Text(), nullable=False),
        sa.Column("value", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("ci_low", sa.Numeric(precision=18, scale=6), nullable=True),
        sa.Column("ci_high", sa.Numeric(precision=18, scale=6), nullable=True),
        sa.Column("slice", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("run_id", "suite", "metric", name="pk_eval_metrics"),
        schema="platform",
    )

    op.create_table(
        "component_status_daily",
        sa.Column("component", sa.Text(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("status", sa.Text(), server_default="healthy", nullable=False),
        sa.Column("uptime_pct", sa.Numeric(precision=5, scale=2), server_default="100.00", nullable=False),
        sa.CheckConstraint("status IN ('healthy', 'degraded', 'down')", name="ck_component_status_daily_status"),
        sa.PrimaryKeyConstraint("component", "date", name="pk_component_status_daily"),
        sa.UniqueConstraint("component", "date", name="uq_component_status_daily_component_date"),
        schema="platform",
    )

    op.create_table(
        "incidents",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("impact", sa.Text(), server_default="degraded", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("root_cause", sa.Text(), nullable=True),
        sa.Column("changes_made", sa.Text(), nullable=True),
        sa.Column("components", postgresql.ARRAY(sa.Text()), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("impact IN ('degraded', 'outage')", name="ck_incidents_impact"),
        sa.PrimaryKeyConstraint("id", name="pk_incidents"),
        schema="platform",
    )

    op.create_table(
        "incident_updates",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("incident_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("platform.incidents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('investigating', 'identified', 'monitoring', 'resolved')", name="ck_incident_updates_status"),
        sa.PrimaryKeyConstraint("id", name="pk_incident_updates"),
        schema="platform",
    )
    op.create_index("ix_incident_updates_incident_id", "incident_updates", ["incident_id"], unique=False, schema="platform")

    op.create_table(
        "pipeline_metrics",
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stage", sa.Text(), nullable=False),
        sa.Column("bucket_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("throughput", sa.Integer(), server_default="0", nullable=False),
        sa.Column("p50_ms", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("p95_ms", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("p99_ms", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("error_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("queue_depth", sa.Integer(), server_default="0", nullable=False),
        sa.CheckConstraint("stage IN ('upload', 'reading', 'validation', 'reconciliation', 'notifications')", name="ck_pipeline_metrics_stage"),
        sa.PrimaryKeyConstraint("org_id", "stage", "bucket_start", name="pk_pipeline_metrics"),
        schema="app",
    )
    op.create_index("ix_pipeline_metrics_org_id", "pipeline_metrics", ["org_id"], unique=False, schema="app")

    op.create_table(
        "calibration_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("model_version", sa.Text(), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ece", sa.Numeric(precision=10, scale=6), nullable=False),
        sa.Column("brier", sa.Numeric(precision=10, scale=6), nullable=False),
        sa.Column("bins", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("slices", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_calibration_snapshots"),
        schema="app",
    )
    op.create_index("ix_calibration_snapshots_model_version", "calibration_snapshots", ["model_version"], unique=False, schema="app")

    op.create_table(
        "drift_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("psi", sa.Numeric(precision=10, scale=6), nullable=False),
        sa.Column("baseline_window", sa.Text(), nullable=False),
        sa.Column("recent_window", sa.Text(), nullable=False),
        sa.Column("severity", sa.Text(), server_default="low", nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.CheckConstraint("kind IN ('confidence', 'input_mix', 'accuracy')", name="ck_drift_snapshots_kind"),
        sa.PrimaryKeyConstraint("id", name="pk_drift_snapshots"),
        schema="app",
    )

    op.create_table(
        "alert_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("metric", sa.Text(), nullable=False),
        sa.Column("condition", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("window_minutes", sa.Integer(), server_default="60", nullable=False),
        sa.Column("severity", sa.Text(), server_default="medium", nullable=False),
        sa.Column("channels", postgresql.ARRAY(sa.Text()), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("severity IN ('low', 'medium', 'high', 'critical')", name="ck_alert_rules_severity"),
        sa.PrimaryKeyConstraint("id", name="pk_alert_rules"),
        schema="app",
    )
    op.create_index("ix_alert_rules_org_id", "alert_rules", ["org_id"], unique=False, schema="app")

    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.alert_rules.id", ondelete="SET NULL"), nullable=True),
        sa.Column("severity", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="open", nullable=False),
        sa.Column("fired_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("acknowledged_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("snoozed_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("metric_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL"), nullable=True),
        sa.CheckConstraint("severity IN ('low', 'medium', 'high', 'critical')", name="ck_alerts_severity"),
        sa.CheckConstraint("source IN ('pipeline', 'ai_quality', 'rules', 'review_queue', 'filing', 'vendors', 'security')", name="ck_alerts_source"),
        sa.CheckConstraint("status IN ('open', 'acknowledged', 'snoozed', 'resolved')", name="ck_alerts_status"),
        sa.PrimaryKeyConstraint("id", name="pk_alerts"),
        schema="app",
    )
    op.create_index("ix_alerts_rule_id", "alerts", ["rule_id"], unique=False, schema="app")
    op.create_index("ix_alerts_assignee_id", "alerts", ["assignee_id"], unique=False, schema="app")

    op.create_table(
        "alert_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("alert_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.alerts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_alert_events"),
        schema="app",
    )
    op.create_index("ix_alert_events_alert_id", "alert_events", ["alert_id"], unique=False, schema="app")

    op.create_table(
        "notification_channels",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("target", sa.Text(), nullable=False),
        sa.Column("quiet_hours", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("kind IN ('in_app', 'email', 'whatsapp', 'sms')", name="ck_notification_channels_kind"),
        sa.PrimaryKeyConstraint("id", name="pk_notification_channels"),
        sa.UniqueConstraint("org_id", "kind", "target", name="uq_notification_channels_org_kind_target"),
        schema="app",
    )
    op.create_index("ix_notification_channels_org_id", "notification_channels", ["org_id"], unique=False, schema="app")

    op.create_table(
        "notification_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.notification_channels.id", ondelete="SET NULL"), nullable=True),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("target", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="queued", nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_notification_log"),
        schema="app",
    )
    op.create_index("ix_notification_log_org_id", "notification_log", ["org_id"], unique=False, schema="app")
    op.create_index("ix_notification_log_channel_id", "notification_log", ["channel_id"], unique=False, schema="app")

    op.create_table(
        "threat_signals",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("severity", sa.Text(), server_default="medium", nullable=False),
        sa.Column("status", sa.Text(), server_default="open", nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("evidence", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("risk", sa.Numeric(precision=5, scale=2), server_default="0.00", nullable=False),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.invoices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.sessions.id", ondelete="SET NULL"), nullable=True),
        sa.CheckConstraint("severity IN ('low', 'medium', 'high', 'critical')", name="ck_threat_signals_severity"),
        sa.CheckConstraint("status IN ('open', 'investigating', 'dismissed', 'resolved', 'escalated')", name="ck_threat_signals_status"),
        sa.PrimaryKeyConstraint("id", name="pk_threat_signals"),
        schema="app",
    )
    op.create_index("ix_threat_signals_org_id", "threat_signals", ["org_id"], unique=False, schema="app")
    op.create_index("ix_threat_signals_kind", "threat_signals", ["kind"], unique=False, schema="app")
    op.create_index("ix_threat_signals_assignee_id", "threat_signals", ["assignee_id"], unique=False, schema="app")

    op.create_table(
        "signal_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("signal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.threat_signals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("actor", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("action IN ('investigate', 'dismiss_false_positive', 'escalate', 'block_session', 'hold_invoice')", name="ck_signal_actions_action"),
        sa.PrimaryKeyConstraint("id", name="pk_signal_actions"),
        schema="app",
    )
    op.create_index("ix_signal_actions_signal_id", "signal_actions", ["signal_id"], unique=False, schema="app")

    op.create_table(
        "monitoring_settings",
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("thresholds", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("retention", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("masking_toggles", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("access_rules", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.PrimaryKeyConstraint("org_id", name="pk_monitoring_settings"),
        schema="app",
    )


def downgrade() -> None:
    op.drop_table("monitoring_settings", schema="app")
    op.drop_table("signal_actions", schema="app")
    op.drop_table("threat_signals", schema="app")
    op.drop_table("notification_log", schema="app")
    op.drop_table("notification_channels", schema="app")
    op.drop_table("alert_events", schema="app")
    op.drop_table("alerts", schema="app")
    op.drop_table("alert_rules", schema="app")
    op.drop_table("drift_snapshots", schema="app")
    op.drop_table("calibration_snapshots", schema="app")
    op.drop_table("pipeline_metrics", schema="app")
    op.drop_table("incident_updates", schema="platform")
    op.drop_table("incidents", schema="platform")
    op.drop_table("component_status_daily", schema="platform")
    op.drop_table("eval_metrics", schema="platform")
    op.drop_table("eval_runs", schema="platform")
    op.drop_table("model_registry", schema="platform")
