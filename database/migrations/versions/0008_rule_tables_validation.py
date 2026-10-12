"""Rule tables, validation runs, and feedback artifacts.

Revision ID: 0008_rule_tables_validation
Revises: 0007_invoice_party_domains
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0008_rule_tables_validation"
down_revision = "0007_invoice_party_domains"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS platform;")
    op.create_table(
        "rule_tables",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("version", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="draft", nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("verified_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL", name="fk_rule_tables_verified_by_users"), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("checksum", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL", name="fk_rule_tables_created_by_users"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("kind IN ('hsn_rates', 'state_codes', 'thresholds')", name="ck_rule_tables_kind"),
        sa.CheckConstraint("status IN ('draft', 'active', 'retired')", name="ck_rule_tables_status"),
        sa.PrimaryKeyConstraint("id", name="pk_rule_tables"),
        sa.UniqueConstraint("kind", "version", name="uq_rule_tables_kind_version"),
        schema="platform",
    )
    op.create_index(
        "ix_rule_tables_active_kind",
        "rule_tables",
        ["kind"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
        schema="platform",
    )

    op.create_table(
        "hsn_rate_entries",
        sa.Column("rule_table_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("platform.rule_tables.id", ondelete="CASCADE", name="fk_hsn_rate_entries_rule_table_id_rule_tables"), nullable=False),
        sa.Column("hsn_prefix", sa.String(length=8), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("rate_pct", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("conditions", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.PrimaryKeyConstraint("rule_table_id", "hsn_prefix", name="pk_hsn_rate_entries"),
        schema="platform",
    )

    op.create_table(
        "state_codes",
        sa.Column("rule_table_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("platform.rule_tables.id", ondelete="CASCADE", name="fk_state_codes_rule_table_id_rule_tables"), nullable=False),
        sa.Column("code", sa.String(length=2), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.Text(), server_default="state", nullable=False),
        sa.CheckConstraint("type IN ('state', 'ut', 'other')", name="ck_state_codes_type"),
        sa.PrimaryKeyConstraint("rule_table_id", "code", name="pk_state_codes"),
        schema="platform",
    )

    op.create_table(
        "thresholds",
        sa.Column("rule_table_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("platform.rule_tables.id", ondelete="CASCADE", name="fk_thresholds_rule_table_id_rule_tables"), nullable=False),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.PrimaryKeyConstraint("rule_table_id", "key", name="pk_thresholds"),
        schema="platform",
    )

    op.create_table(
        "rule_change_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("rule_table_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("platform.rule_tables.id", ondelete="CASCADE", name="fk_rule_change_log_rule_table_id_rule_tables"), nullable=False),
        sa.Column("change_type", sa.Text(), nullable=False),
        sa.Column("actor", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL", name="fk_rule_change_log_actor_users"), nullable=True),
        sa.Column("diff", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_rule_change_log"),
        schema="platform",
    )
    op.create_index("ix_rule_change_log_rule_table_id", "rule_change_log", ["rule_table_id"], unique=False, schema="platform")

    op.create_table(
        "validation_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_validation_runs_org_id_organizations"), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.invoices.id", ondelete="CASCADE", name="fk_validation_runs_invoice_id_invoices"), nullable=False),
        sa.Column("engine_version", sa.Text(), nullable=False),
        sa.Column("rule_table_versions", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verdict", sa.Text(), nullable=False),
        sa.Column("rupee_at_risk", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("trigger", sa.Text(), server_default="auto", nullable=False),
        sa.CheckConstraint("verdict IN ('safe', 'fix_first', 'itc_blocked', 'needs_review')", name="ck_validation_runs_verdict"),
        sa.CheckConstraint("trigger IN ('auto', 'manual', 'revalidate')", name="ck_validation_runs_trigger"),
        sa.PrimaryKeyConstraint("id", name="pk_validation_runs"),
        schema="app",
    )
    op.create_index("ix_validation_runs_org_id", "validation_runs", ["org_id"], unique=False, schema="app")
    op.create_index("ix_validation_runs_invoice_id", "validation_runs", ["invoice_id"], unique=False, schema="app")

    op.create_table(
        "check_results",
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.validation_runs.id", ondelete="CASCADE", name="fk_check_results_run_id_validation_runs"), nullable=False),
        sa.Column("check_id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("severity", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), server_default="deterministic", nullable=False),
        sa.Column("expected", sa.Text(), nullable=True),
        sa.Column("found", sa.Text(), nullable=True),
        sa.Column("formula", sa.Text(), nullable=True),
        sa.Column("why_it_matters", sa.Text(), nullable=True),
        sa.Column("fixes", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.CheckConstraint("status IN ('pass', 'fail', 'inconclusive', 'skipped')", name="ck_check_results_status"),
        sa.CheckConstraint("kind IN ('deterministic', 'ai')", name="ck_check_results_kind"),
        sa.PrimaryKeyConstraint("run_id", "check_id", name="pk_check_results"),
        schema="app",
    )

    op.create_table(
        "check_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.validation_runs.id", ondelete="CASCADE", name="fk_check_feedback_run_id_validation_runs"), nullable=False),
        sa.Column("check_id", sa.Text(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL", name="fk_check_feedback_user_id_users"), nullable=True),
        sa.Column("feedback", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("feedback IN ('confirmed', 'dismissed', 'accepted_with_note')", name="ck_check_feedback_feedback"),
        sa.PrimaryKeyConstraint("id", name="pk_check_feedback"),
        schema="app",
    )
    op.create_index("ix_check_feedback_run_id", "check_feedback", ["run_id"], unique=False, schema="app")
    op.create_index("ix_check_feedback_check_id", "check_feedback", ["check_id"], unique=False, schema="app")

    op.create_table(
        "rule_daily_stats",
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_rule_daily_stats_org_id_organizations"), nullable=False),
        sa.Column("rule_id", sa.Text(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("runs", sa.Integer(), server_default="0", nullable=False),
        sa.Column("fails", sa.Integer(), server_default="0", nullable=False),
        sa.Column("inconclusive", sa.Integer(), server_default="0", nullable=False),
        sa.Column("confirmed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("dismissed", sa.Integer(), server_default="0", nullable=False),
        sa.PrimaryKeyConstraint("org_id", "rule_id", "date", name="pk_rule_daily_stats"),
        schema="app",
    )

    op.execute("ALTER TABLE app.validation_runs ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE app.validation_runs FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE app.check_results ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE app.check_results FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE app.check_feedback ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE app.check_feedback FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE app.rule_daily_stats ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE app.rule_daily_stats FORCE ROW LEVEL SECURITY;")

    op.execute("CREATE POLICY validation_runs_isolation_policy ON app.validation_runs AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.is_system', true) = 'true' OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid) WITH CHECK (current_setting('app.is_system', true) = 'true' OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid);")
    op.execute("CREATE POLICY check_results_isolation_policy ON app.check_results AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.is_system', true) = 'true' OR run_id IN (SELECT id FROM app.validation_runs WHERE org_id = NULLIF(current_setting('app.org_id', true), '')::uuid)) WITH CHECK (current_setting('app.is_system', true) = 'true' OR run_id IN (SELECT id FROM app.validation_runs WHERE org_id = NULLIF(current_setting('app.org_id', true), '')::uuid));")
    op.execute("CREATE POLICY check_feedback_isolation_policy ON app.check_feedback AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.is_system', true) = 'true' OR run_id IN (SELECT id FROM app.validation_runs WHERE org_id = NULLIF(current_setting('app.org_id', true), '')::uuid)) WITH CHECK (current_setting('app.is_system', true) = 'true' OR run_id IN (SELECT id FROM app.validation_runs WHERE org_id = NULLIF(current_setting('app.org_id', true), '')::uuid));")
    op.execute("CREATE POLICY rule_daily_stats_isolation_policy ON app.rule_daily_stats AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.is_system', true) = 'true' OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid) WITH CHECK (current_setting('app.is_system', true) = 'true' OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid);")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS rule_daily_stats_isolation_policy ON app.rule_daily_stats;")
    op.execute("DROP POLICY IF EXISTS check_feedback_isolation_policy ON app.check_feedback;")
    op.execute("DROP POLICY IF EXISTS check_results_isolation_policy ON app.check_results;")
    op.execute("DROP POLICY IF EXISTS validation_runs_isolation_policy ON app.validation_runs;")
    op.drop_table("rule_daily_stats", schema="app")
    op.drop_table("check_feedback", schema="app")
    op.drop_table("check_results", schema="app")
    op.drop_table("validation_runs", schema="app")
    op.drop_table("rule_change_log", schema="platform")
    op.drop_table("thresholds", schema="platform")
    op.drop_table("state_codes", schema="platform")
    op.drop_table("hsn_rate_entries", schema="platform")
    op.drop_index("ix_rule_tables_active_kind", table_name="rule_tables", schema="platform")
    op.drop_table("rule_tables", schema="platform")
