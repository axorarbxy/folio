"""Reconciliation schema for periods, GSTR-2B imports, matches, and evidence.

Revision ID: 0009_reconciliation_schema
Revises: 0008_rule_tables_validation
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0009_reconciliation_schema"
down_revision = "0008_rule_tables_validation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "periods",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("status", sa.Text(), server_default="open", nullable=False),
        sa.Column("due_dates", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("filed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("filed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL"), nullable=True),
        sa.CheckConstraint("status IN ('open', 'reconciling', 'ready', 'filed')", name="ck_periods_status"),
        sa.PrimaryKeyConstraint("id", name="pk_periods"),
        sa.UniqueConstraint("org_id", "year", "month", name="uq_periods_org_year_month"),
        schema="app",
    )
    op.create_index("ix_periods_org_id", "periods", ["org_id"], unique=False, schema="app")

    op.create_table(
        "gstr2b_imports",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.periods.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.files.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("adapter", sa.Text(), nullable=False),
        sa.Column("parsed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("record_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("status", sa.Text(), server_default="parsed", nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.CheckConstraint("status IN ('parsed', 'failed', 'superseded')", name="ck_gstr2b_imports_status"),
        sa.PrimaryKeyConstraint("id", name="pk_gstr2b_imports"),
        schema="app",
    )
    op.create_index("ix_gstr2b_imports_org_id", "gstr2b_imports", ["org_id"], unique=False, schema="app")
    op.create_index("ix_gstr2b_imports_period_id", "gstr2b_imports", ["period_id"], unique=False, schema="app")
    op.create_index("ix_gstr2b_imports_file_id", "gstr2b_imports", ["file_id"], unique=False, schema="app")

    op.create_table(
        "gstr2b_rows",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("import_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.gstr2b_imports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("supplier_gstin", sa.String(length=15), nullable=False),
        sa.Column("supplier_name", sa.Text(), nullable=False),
        sa.Column("doc_type", sa.Text(), nullable=False),
        sa.Column("invoice_no_raw", sa.Text(), nullable=False),
        sa.Column("invoice_no_norm", sa.Text(), nullable=False),
        sa.Column("invoice_date", sa.Date(), nullable=True),
        sa.Column("taxable", sa.Numeric(precision=18, scale=2), server_default="0", nullable=False),
        sa.Column("igst", sa.Numeric(precision=18, scale=2), server_default="0", nullable=False),
        sa.Column("cgst", sa.Numeric(precision=18, scale=2), server_default="0", nullable=False),
        sa.Column("sgst", sa.Numeric(precision=18, scale=2), server_default="0", nullable=False),
        sa.Column("cess", sa.Numeric(precision=18, scale=2), server_default="0", nullable=False),
        sa.Column("itc_available", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("itc_reason", sa.Text(), nullable=True),
        sa.Column("source_period", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_gstr2b_rows"),
        schema="app",
    )
    op.create_index("ix_gstr2b_rows_org_id", "gstr2b_rows", ["org_id"], unique=False, schema="app")
    op.create_index("ix_gstr2b_rows_import_id", "gstr2b_rows", ["import_id"], unique=False, schema="app")
    op.create_index("ix_gstr2b_rows_supplier_gstin", "gstr2b_rows", ["supplier_gstin"], unique=False, schema="app")
    op.create_index("ix_gstr2b_rows_invoice_no_norm", "gstr2b_rows", ["invoice_no_norm"], unique=False, schema="app")

    op.create_table(
        "register_imports",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.periods.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.files.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("adapter", sa.Text(), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("mapping", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("status", sa.Text(), server_default="parsed", nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_register_imports"),
        schema="app",
    )
    op.create_index("ix_register_imports_org_id", "register_imports", ["org_id"], unique=False, schema="app")
    op.create_index("ix_register_imports_period_id", "register_imports", ["period_id"], unique=False, schema="app")
    op.create_index("ix_register_imports_file_id", "register_imports", ["file_id"], unique=False, schema="app")

    op.create_table(
        "register_rows",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("import_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.register_imports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("supplier_gstin", sa.String(length=15), nullable=True),
        sa.Column("supplier_name", sa.Text(), nullable=True),
        sa.Column("invoice_no_raw", sa.Text(), nullable=True),
        sa.Column("invoice_no_norm", sa.Text(), nullable=True),
        sa.Column("invoice_date", sa.Date(), nullable=True),
        sa.Column("taxable", sa.Numeric(precision=18, scale=2), server_default="0", nullable=False),
        sa.Column("igst", sa.Numeric(precision=18, scale=2), server_default="0", nullable=False),
        sa.Column("cgst", sa.Numeric(precision=18, scale=2), server_default="0", nullable=False),
        sa.Column("sgst", sa.Numeric(precision=18, scale=2), server_default="0", nullable=False),
        sa.Column("cess", sa.Numeric(precision=18, scale=2), server_default="0", nullable=False),
        sa.Column("source_row", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_register_rows"),
        schema="app",
    )
    op.create_index("ix_register_rows_org_id", "register_rows", ["org_id"], unique=False, schema="app")
    op.create_index("ix_register_rows_import_id", "register_rows", ["import_id"], unique=False, schema="app")
    op.create_index("ix_register_rows_invoice_no_norm", "register_rows", ["invoice_no_norm"], unique=False, schema="app")

    op.create_table(
        "recon_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.periods.id", ondelete="CASCADE"), nullable=False),
        sa.Column("import_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.gstr2b_imports.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("params", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("engine_version", sa.Text(), server_default="folio-db", nullable=False),
        sa.Column("status", sa.Text(), server_default="pending", nullable=False),
        sa.Column("totals", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("itc_at_risk", sa.Numeric(precision=18, scale=2), server_default="0", nullable=False),
        sa.Column("is_latest", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'running', 'complete', 'failed')", name="ck_recon_runs_status"),
        sa.PrimaryKeyConstraint("id", name="pk_recon_runs"),
        schema="app",
    )
    op.create_index("ix_recon_runs_org_id", "recon_runs", ["org_id"], unique=False, schema="app")
    op.create_index("ix_recon_runs_period_id", "recon_runs", ["period_id"], unique=False, schema="app")
    op.create_index("ix_recon_runs_import_id", "recon_runs", ["import_id"], unique=False, schema="app")

    op.create_table(
        "recon_matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.recon_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.invoices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("gstr2b_row_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.gstr2b_rows.id", ondelete="SET NULL"), nullable=True),
        sa.Column("register_row_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.register_rows.id", ondelete="SET NULL"), nullable=True),
        sa.Column("bucket", sa.Text(), nullable=False),
        sa.Column("score", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("reasons", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("diff", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("amount_at_risk", sa.Numeric(precision=18, scale=2), server_default="0", nullable=False),
        sa.Column("supplier_gstin", sa.String(length=15), nullable=True),
        sa.CheckConstraint("bucket IN ('matched', 'value_mismatch', 'missing_in_2b', 'missing_in_books', 'vendor_not_filed', 'ineligible', 'duplicate', 'timing_difference')", name="ck_recon_matches_bucket"),
        sa.CheckConstraint("num_nonnulls(invoice_id, gstr2b_row_id, register_row_id) >= 1", name="ck_recon_matches_anchor"),
        sa.PrimaryKeyConstraint("id", name="pk_recon_matches"),
        schema="app",
    )
    op.create_index("ix_recon_matches_org_id", "recon_matches", ["org_id"], unique=False, schema="app")
    op.create_index("ix_recon_matches_run_id", "recon_matches", ["run_id"], unique=False, schema="app")

    op.create_table(
        "recon_resolutions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.recon_matches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("actor", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("action IN ('contact_vendor', 'defer', 'reverse_itc', 'accept_difference')", name="ck_recon_resolutions_action"),
        sa.PrimaryKeyConstraint("id", name="pk_recon_resolutions"),
        schema="app",
    )
    op.create_index("ix_recon_resolutions_org_id", "recon_resolutions", ["org_id"], unique=False, schema="app")
    op.create_index("ix_recon_resolutions_match_id", "recon_resolutions", ["match_id"], unique=False, schema="app")

    op.create_table(
        "einvoice_evidence",
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("irn", sa.Text(), nullable=True),
        sa.Column("ack_no", sa.Text(), nullable=True),
        sa.Column("ack_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("qr_payload", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("signature_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("source", sa.Text(), server_default="qr", nullable=False),
        sa.CheckConstraint("source IN ('qr', 'portal', 'upload')", name="ck_einvoice_evidence_source"),
        sa.PrimaryKeyConstraint("invoice_id", name="pk_einvoice_evidence"),
        sa.UniqueConstraint("org_id", "invoice_id", name="uq_einvoice_evidence_org_invoice"),
        schema="app",
    )
    op.create_index("ix_einvoice_evidence_org_id", "einvoice_evidence", ["org_id"], unique=False, schema="app")

    op.create_table(
        "whatif_scenarios",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.recon_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("vendors_not_filing", postgresql.ARRAY(sa.Text()), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("projected_loss", sa.Numeric(precision=18, scale=2), server_default="0", nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_whatif_scenarios"),
        schema="app",
    )
    op.create_index("ix_whatif_scenarios_org_id", "whatif_scenarios", ["org_id"], unique=False, schema="app")
    op.create_index("ix_whatif_scenarios_run_id", "whatif_scenarios", ["run_id"], unique=False, schema="app")

    op.execute("CREATE VIEW app.v_match_effective AS SELECT m.*, r.action AS effective_action, r.note AS effective_note, r.actor AS effective_actor, r.at AS effective_at FROM app.recon_matches m LEFT JOIN LATERAL (SELECT * FROM app.recon_resolutions WHERE match_id = m.id ORDER BY at DESC LIMIT 1) r ON true;")
    op.execute("CREATE VIEW app.v_recon_summary AS SELECT run_id, bucket, count(*) AS match_count, sum(amount_at_risk) AS amount_at_risk FROM app.recon_matches GROUP BY run_id, bucket;")


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS app.v_recon_summary;")
    op.execute("DROP VIEW IF EXISTS app.v_match_effective;")
    op.drop_table("whatif_scenarios", schema="app")
    op.drop_table("einvoice_evidence", schema="app")
    op.drop_table("recon_resolutions", schema="app")
    op.drop_table("recon_matches", schema="app")
    op.drop_table("recon_runs", schema="app")
    op.drop_table("register_rows", schema="app")
    op.drop_table("register_imports", schema="app")
    op.drop_table("gstr2b_rows", schema="app")
    op.drop_table("gstr2b_imports", schema="app")
    op.drop_table("periods", schema="app")
