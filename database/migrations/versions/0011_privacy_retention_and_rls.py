"""Privacy retention tables and RLS hardening for app schema.

Revision ID: 0011_privacy_retention_and_rls
Revises: 0010_monitoring_ml_ops_schema
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0011_privacy_retention_and_rls"
down_revision = "0010_monitoring_ml_ops_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(schema: str, table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(
        sa.text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = :schema
              AND table_name = :table_name
              AND column_name = :column_name
            LIMIT 1
            """
        ),
        {"schema": schema, "table_name": table_name, "column_name": column_name},
    ).fetchone()
    return result is not None


def _apply_org_policy(table_name: str) -> None:
    if not _has_column("app", table_name, "org_id"):
        return
    op.execute(f"ALTER TABLE app.{table_name} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"ALTER TABLE app.{table_name} FORCE ROW LEVEL SECURITY;")
    policy_sql = (
        "current_setting('app.is_system', true) = 'true' OR "
        "org_id = NULLIF(current_setting('app.org_id', true), '')::uuid"
    )
    op.execute(
        f"""
        CREATE POLICY {table_name}_isolation_policy ON app.{table_name}
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING ({policy_sql})
        WITH CHECK ({policy_sql});
        """
    )


def _apply_global_policy(table_name: str) -> None:
    op.execute(f"ALTER TABLE app.{table_name} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"ALTER TABLE app.{table_name} FORCE ROW LEVEL SECURITY;")
    policy_sql = "current_setting('app.is_system', true) = 'true' OR NULLIF(current_setting('app.org_id', true), '') IS NOT NULL"
    op.execute(
        f"""
        CREATE POLICY {table_name}_isolation_policy ON app.{table_name}
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING ({policy_sql})
        WITH CHECK ({policy_sql});
        """
    )


def _apply_join_policy(table_name: str, join_column: str, parent_table: str) -> None:
    if not _has_column("app", table_name, join_column):
        return
    if not _has_column("app", parent_table, "org_id"):
        return
    op.execute(f"ALTER TABLE app.{table_name} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"ALTER TABLE app.{table_name} FORCE ROW LEVEL SECURITY;")
    policy_sql = (
        "current_setting('app.is_system', true) = 'true' OR "
        f"{join_column} IN (SELECT id FROM app.{parent_table} WHERE org_id = NULLIF(current_setting('app.org_id', true), '')::uuid)"
    )
    op.execute(
        f"""
        CREATE POLICY {table_name}_isolation_policy ON app.{table_name}
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING ({policy_sql})
        WITH CHECK ({policy_sql});
        """
    )


def upgrade() -> None:
    op.create_table(
        "privacy_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject_ref", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="received", nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("handled_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("outcome", sa.Text(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.CheckConstraint("kind IN ('access', 'correction', 'deletion')", name="ck_privacy_requests_kind"),
        sa.CheckConstraint("status IN ('received', 'in_review', 'approved', 'rejected', 'completed')", name="ck_privacy_requests_status"),
        sa.PrimaryKeyConstraint("id", name="pk_privacy_requests"),
        schema="app",
    )
    op.create_index("ix_privacy_requests_org_id", "privacy_requests", ["org_id"], unique=False, schema="app")

    op.create_table(
        "consent_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject_ref", sa.Text(), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("policy_version", sa.String(length=64), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("evidence_file_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_consent_records"),
        schema="app",
    )
    op.create_index("ix_consent_records_org_id", "consent_records", ["org_id"], unique=False, schema="app")

    op.create_table(
        "retention_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("data_type", sa.Text(), nullable=False),
        sa.Column("retention_days", sa.Integer(), nullable=False),
        sa.Column("legal_hold", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("data_type IN ('invoice_files', 'extracted_data', 'audit_logs', 'traces', 'vendor_messages', 'metrics')", name="ck_retention_policies_data_type"),
        sa.PrimaryKeyConstraint("id", name="pk_retention_policies"),
        schema="app",
    )
    op.create_index("ix_retention_policies_org_id", "retention_policies", ["org_id"], unique=False, schema="app")

    tables_with_org_id = [
        "alert_rules",
        "alerts",
        "calibration_snapshots",
        "drift_snapshots",
        "einvoice_evidence",
        "gstr2b_imports",
        "gstr2b_rows",
        "monitoring_settings",
        "notification_channels",
        "notification_log",
        "periods",
        "pipeline_metrics",
        "privacy_requests",
        "recon_matches",
        "recon_resolutions",
        "recon_runs",
        "register_imports",
        "register_rows",
        "retention_policies",
        "consent_records",
        "threat_signals",
        "whatif_scenarios",
    ]
    for table_name in tables_with_org_id:
        _apply_org_policy(table_name)

    _apply_join_policy("alert_events", "alert_id", "alerts")
    _apply_join_policy("signal_actions", "signal_id", "threat_signals")
    for table_name in ["calibration_snapshots", "drift_snapshots"]:
        _apply_global_policy(table_name)
    if _has_column("app", "sessions", "org_id"):
        _apply_org_policy("sessions")

    comments = {
        "app.alert_rules.name": "PII: Alert rule display name",
        "app.check_results.name": "PII: Validation rule name",
        "app.gstr2b_rows.supplier_gstin": "PII: Supplier GSTIN identifier",
        "app.gstr2b_rows.supplier_name": "PII: Supplier legal name",
        "app.recon_matches.supplier_gstin": "PII: Supplier GSTIN identifier",
        "app.register_rows.supplier_gstin": "PII: Supplier GSTIN identifier",
        "app.register_rows.supplier_name": "PII: Supplier legal name",
        "app.v_match_effective.supplier_gstin": "PII: Supplier GSTIN identifier",
        "app.whatif_scenarios.name": "PII: Scenario label",
    }
    op.execute("COMMENT ON VIEW app.v_match_effective IS 'PII: Reconciliation match view with supplier GSTIN metadata';")
    for qualified_name, text_value in comments.items():
        op.execute(f"COMMENT ON COLUMN {qualified_name} IS '{text_value}'")
    op.execute("COMMENT ON COLUMN app.v_match_effective.supplier_gstin IS 'PII: Supplier GSTIN identifier'")


def downgrade() -> None:
    bind = op.get_bind()

    for table_name in [
        "retention_policies",
        "consent_records",
        "privacy_requests",
    ]:
        if bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.tables WHERE table_schema = 'app' AND table_name = :table_name LIMIT 1;"
            ),
            {"table_name": table_name},
        ).scalar():
            op.drop_table(table_name, schema="app")

    existing_tables = bind.execute(
        sa.text(
            """
            SELECT c.relname
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'app'
              AND c.relkind = 'r'
            ORDER BY c.relname;
            """
        )
    ).fetchall()
    for (table_name,) in existing_tables:
        op.execute(f"DROP POLICY IF EXISTS {table_name}_isolation_policy ON app.{table_name};")
        op.execute(f"ALTER TABLE app.{table_name} DISABLE ROW LEVEL SECURITY;")
