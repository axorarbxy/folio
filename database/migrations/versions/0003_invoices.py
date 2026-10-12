"""0003 Invoices, Files, Parties, Line Items, Field Values, Review Tasks, and Traces

Revision ID: 0003_invoices
Revises: 0002_identity
Create Date: 2026-10-12 13:30:00.000000+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003_invoices"
down_revision: Union[str, None] = "0002_identity"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Files table (immutable uploaded files)
    op.create_table(
        "files",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_files_org_id_organizations"), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("mime", sa.Text(), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), server_default="original", nullable=False),
        sa.Column("source", sa.Text(), server_default="upload", nullable=False),
        sa.Column("scan_status", sa.Text(), server_default="pending", nullable=False),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL", name="fk_files_uploaded_by_users"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("kind IN ('original', 'derived', 'export')", name="ck_files_kind"),
        sa.CheckConstraint("source IN ('upload', 'camera', 'whatsapp', 'email', 'api')", name="ck_files_source"),
        sa.CheckConstraint("scan_status IN ('pending', 'clean', 'infected', 'error')", name="ck_files_scan_status"),
        sa.PrimaryKeyConstraint("id", name="pk_files"),
        sa.UniqueConstraint("org_id", "sha256", "kind", name="uq_files_org_sha256_kind"),
        schema="app",
    )
    op.create_index("ix_files_org_id", "files", ["org_id"], unique=False, schema="app")
    op.create_index("ix_files_sha256", "files", ["sha256"], unique=False, schema="app")

    # 2. Parties table (suppliers and buyers)
    op.create_table(
        "parties",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_parties_org_id_organizations"), nullable=False),
        sa.Column("gstin", sa.String(15), nullable=False, comment="PII: 15-character Goods and Services Tax Identification Number"),
        sa.Column("legal_name", sa.String(255), nullable=False, comment="PII: Legal entity or trade name"),
        sa.Column("state_code", sa.String(2), nullable=True),
        sa.Column("pan", sa.String(10), nullable=True),
        sa.Column("gstin_status", sa.Text(), server_default="unknown", nullable=False),
        sa.Column("status_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("gstin_status IN ('unknown', 'active', 'cancelled', 'suspended')", name="ck_parties_gstin_status"),
        sa.PrimaryKeyConstraint("id", name="pk_parties"),
        sa.UniqueConstraint("org_id", "gstin", name="uq_parties_org_gstin"),
        schema="app",
    )
    op.create_index("ix_parties_org_id", "parties", ["org_id"], unique=False, schema="app")
    op.create_index("ix_parties_gstin", "parties", ["gstin"], unique=False, schema="app")

    # Trigram GIN index on legal_name for fuzzy vendor matching
    op.execute("""
        CREATE INDEX ix_parties_legal_name_trgm ON app.parties USING gin (legal_name gin_trgm_ops);
    """)

    # 3. Invoice status transitions reference table
    op.create_table(
        "invoice_transitions",
        sa.Column("from_status", sa.Text(), nullable=False),
        sa.Column("to_status", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("from_status", "to_status", name="pk_invoice_transitions"),
        schema="app",
    )

    op.execute("""
        INSERT INTO app.invoice_transitions (from_status, to_status) VALUES
        ('uploaded', 'processing'),
        ('processing', 'needs_review'),
        ('processing', 'reviewed'),
        ('processing', 'validated'),
        ('processing', 'failed'),
        ('needs_review', 'reviewed'),
        ('needs_review', 'failed'),
        ('reviewed', 'validated'),
        ('reviewed', 'flagged'),
        ('validated', 'flagged'),
        ('validated', 'reconciled'),
        ('flagged', 'fixed'),
        ('flagged', 'needs_review'),
        ('fixed', 'validated'),
        ('fixed', 'needs_review'),
        ('reconciled', 'closed'),
        ('reconciled', 'flagged'),
        ('closed', 'reconciled');
    """)

    # 4. Invoices table
    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_invoices_org_id_organizations"), nullable=False),
        sa.Column("file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.files.id", ondelete="RESTRICT", name="fk_invoices_file_id_files"), nullable=False),
        sa.Column("direction", sa.Text(), server_default="purchase", nullable=False),
        sa.Column("status", sa.Text(), server_default="uploaded", nullable=False),
        sa.Column("number_raw", sa.Text(), nullable=False),
        sa.Column("number_norm", sa.Text(), nullable=False),
        sa.Column("invoice_date", sa.Date(), nullable=False),
        sa.Column("supplier_party_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.parties.id", ondelete="SET NULL", name="fk_invoices_supplier_party_id_parties"), nullable=True),
        sa.Column("buyer_party_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.parties.id", ondelete="SET NULL", name="fk_invoices_buyer_party_id_parties"), nullable=True),
        sa.Column("place_of_supply_state", sa.String(2), nullable=True),
        sa.Column("reverse_charge", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("irn", sa.Text(), nullable=True),
        sa.Column("taxable_total", sa.Numeric(18, 2), server_default="0.00", nullable=False),
        sa.Column("cgst_total", sa.Numeric(18, 2), server_default="0.00", nullable=False),
        sa.Column("sgst_total", sa.Numeric(18, 2), server_default="0.00", nullable=False),
        sa.Column("igst_total", sa.Numeric(18, 2), server_default="0.00", nullable=False),
        sa.Column("cess_total", sa.Numeric(18, 2), server_default="0.00", nullable=False),
        sa.Column("round_off", sa.Numeric(18, 2), server_default="0.00", nullable=False),
        sa.Column("grand_total", sa.Numeric(18, 2), server_default="0.00", nullable=False),
        sa.Column("quality_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("languages", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("fingerprint", sa.Text(), nullable=True),
        sa.Column("reader_version", sa.Text(), nullable=True),
        sa.Column("prompt_version", sa.Text(), nullable=True),
        sa.Column("raw_extraction", postgresql.JSONB(), nullable=True),
        sa.Column("period_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("direction IN ('purchase', 'sales')", name="ck_invoices_direction"),
        sa.CheckConstraint("status IN ('uploaded', 'processing', 'needs_review', 'reviewed', 'validated', 'flagged', 'fixed', 'reconciled', 'closed', 'failed')", name="ck_invoices_status"),
        sa.PrimaryKeyConstraint("id", name="pk_invoices"),
        schema="app",
    )

    # Indexes on invoices
    # 1. Primary list view pagination: (org_id, status, created_at desc)
    op.create_index("ix_invoices_org_status_created", "invoices", ["org_id", "status", sa.text("created_at DESC")], schema="app")
    # 2. Duplicate detection per supplier: (org_id, supplier_party_id, number_norm)
    op.create_index("ix_invoices_org_supplier_number", "invoices", ["org_id", "supplier_party_id", "number_norm"], schema="app")
    # 3. Content hash deduplication lookup: (org_id, fingerprint)
    op.create_index("ix_invoices_org_fingerprint", "invoices", ["org_id", "fingerprint"], schema="app")
    # 4. Tax filing date range queries: (org_id, invoice_date)
    op.create_index("ix_invoices_org_date", "invoices", ["org_id", "invoice_date"], schema="app")
    # 5. Fuzzy substring search on invoice number using Trigram GIN
    op.execute("""
        CREATE INDEX ix_invoices_number_norm_trgm ON app.invoices USING gin (number_norm gin_trgm_ops);
    """)

    # 5. Line Items table
    op.create_table(
        "line_items",
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.invoices.id", ondelete="CASCADE", name="fk_line_items_invoice_id_invoices"), nullable=False),
        sa.Column("line_no", sa.Integer(), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_line_items_org_id_organizations"), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("hsn", sa.String(8), nullable=True),
        sa.Column("qty", sa.Numeric(14, 4), nullable=True),
        sa.Column("unit", sa.Text(), nullable=True),
        sa.Column("rate", sa.Numeric(18, 2), nullable=True),
        sa.Column("discount", sa.Numeric(18, 2), server_default="0.00", nullable=False),
        sa.Column("taxable", sa.Numeric(18, 2), server_default="0.00", nullable=False),
        sa.Column("cgst_pct", sa.Numeric(5, 2), server_default="0.00", nullable=False),
        sa.Column("sgst_pct", sa.Numeric(5, 2), server_default="0.00", nullable=False),
        sa.Column("igst_pct", sa.Numeric(5, 2), server_default="0.00", nullable=False),
        sa.Column("cess_pct", sa.Numeric(5, 2), server_default="0.00", nullable=False),
        sa.Column("cgst_amount", sa.Numeric(18, 2), server_default="0.00", nullable=False),
        sa.Column("sgst_amount", sa.Numeric(18, 2), server_default="0.00", nullable=False),
        sa.Column("igst_amount", sa.Numeric(18, 2), server_default="0.00", nullable=False),
        sa.Column("cess_amount", sa.Numeric(18, 2), server_default="0.00", nullable=False),
        sa.PrimaryKeyConstraint("invoice_id", "line_no", name="pk_line_items"),
        schema="app",
    )
    op.create_index("ix_line_items_org_id", "line_items", ["org_id"], unique=False, schema="app")

    # 6. Field Values table (current extracted / human values)
    op.create_table(
        "field_values",
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.invoices.id", ondelete="CASCADE", name="fk_field_values_invoice_id_invoices"), nullable=False),
        sa.Column("field_path", sa.Text(), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_field_values_org_id_organizations"), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("value_norm", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Numeric(5, 4), server_default="1.0000", nullable=False),
        sa.Column("calibrated_confidence", sa.Numeric(5, 4), nullable=True),
        sa.Column("box", postgresql.JSONB(), nullable=True),
        sa.Column("source", sa.Text(), server_default="reader", nullable=False),
        sa.Column("edited", sa.Boolean(), server_default="false", nullable=False),
        sa.CheckConstraint("source IN ('reader', 'human', 'rule')", name="ck_field_values_source"),
        sa.PrimaryKeyConstraint("invoice_id", "field_path", name="pk_field_values"),
        schema="app",
    )
    op.create_index("ix_field_values_org_id", "field_values", ["org_id"], unique=False, schema="app")

    # 7. Field Edits table (append-only human correction log)
    op.create_table(
        "field_edits",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_field_edits_org_id_organizations"), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.invoices.id", ondelete="CASCADE", name="fk_field_edits_invoice_id_invoices"), nullable=False),
        sa.Column("field_path", sa.Text(), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("edited_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL", name="fk_field_edits_edited_by_users"), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_field_edits"),
        schema="app",
    )
    op.create_index("ix_field_edits_org_id", "field_edits", ["org_id"], unique=False, schema="app")
    op.create_index("ix_field_edits_invoice_id", "field_edits", ["invoice_id"], unique=False, schema="app")

    # 8. Invoice Status History table (append-only state transitions)
    op.create_table(
        "invoice_status_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_invoice_status_history_org_id_organizations"), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.invoices.id", ondelete="CASCADE", name="fk_invoice_status_history_invoice_id_invoices"), nullable=False),
        sa.Column("from_status", sa.Text(), nullable=True),
        sa.Column("to_status", sa.Text(), nullable=False),
        sa.Column("actor", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_invoice_status_history"),
        schema="app",
    )
    op.create_index("ix_invoice_status_history_org_id", "invoice_status_history", ["org_id"], unique=False, schema="app")
    op.create_index("ix_invoice_status_history_invoice_id", "invoice_status_history", ["invoice_id"], unique=False, schema="app")

    # 9. Review Tasks table
    op.create_table(
        "review_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_review_tasks_org_id_organizations"), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.invoices.id", ondelete="CASCADE", name="fk_review_tasks_invoice_id_invoices"), nullable=False),
        sa.Column("reasons", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("priority", sa.Text(), server_default="normal", nullable=False),
        sa.Column("status", sa.Text(), server_default="open", nullable=False),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL", name="fk_review_tasks_assignee_id_users"), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("breached_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("priority IN ('low', 'normal', 'high', 'urgent')", name="ck_review_tasks_priority"),
        sa.CheckConstraint("status IN ('open', 'in_progress', 'done', 'cancelled')", name="ck_review_tasks_status"),
        sa.PrimaryKeyConstraint("id", name="pk_review_tasks"),
        schema="app",
    )
    op.create_index("ix_review_tasks_org_id", "review_tasks", ["org_id"], unique=False, schema="app")
    op.create_index("ix_review_tasks_invoice_id", "review_tasks", ["invoice_id"], unique=False, schema="app")
    # Partial index on open review tasks for rapid verification queue retrieval
    op.execute("""
        CREATE INDEX ix_review_tasks_open ON app.review_tasks (org_id, priority, due_at) WHERE status = 'open';
    """)

    # 10. Processing Stages table (pipeline traces)
    op.create_table(
        "processing_stages",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_processing_stages_org_id_organizations"), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.invoices.id", ondelete="CASCADE", name="fk_processing_stages_invoice_id_invoices"), nullable=False),
        sa.Column("stage", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="pending", nullable=False),
        sa.Column("attempt", sa.Integer(), server_default="1", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("model_version", sa.Text(), nullable=True),
        sa.Column("error_code", sa.Text(), nullable=True),
        sa.Column("error_detail", sa.Text(), nullable=True),
        sa.Column("meta", postgresql.JSONB(), nullable=True),
        sa.CheckConstraint("stage IN ('ingest', 'preprocess', 'read', 'validate', 'reconcile', 'notify')", name="ck_processing_stages_stage"),
        sa.CheckConstraint("status IN ('pending', 'running', 'success', 'failed', 'skipped')", name="ck_processing_stages_status"),
        sa.PrimaryKeyConstraint("id", name="pk_processing_stages"),
        schema="app",
    )
    op.create_index("ix_processing_stages_org_id", "processing_stages", ["org_id"], unique=False, schema="app")
    # Compound index on invoice_id and stage for fast waterfall lookup
    op.create_index("ix_processing_stages_invoice_stage", "processing_stages", ["invoice_id", "stage"], unique=False, schema="app")

    # 11. Triggers
    op.execute("""
        CREATE TRIGGER trg_invoices_updated_at
        BEFORE UPDATE ON app.invoices
        FOR EACH ROW
        EXECUTE FUNCTION app.set_updated_at();
    """)

    # Invoice state transition enforcement trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION app.check_invoice_status_transition()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
                IF NOT EXISTS (
                    SELECT 1 FROM app.invoice_transitions
                    WHERE from_status = OLD.status AND to_status = NEW.status
                ) THEN
                    RAISE EXCEPTION 'Illegal invoice status transition from % to %', OLD.status, NEW.status
                        USING ERRCODE = '23514';
                END IF;

                INSERT INTO app.invoice_status_history (
                    id, org_id, invoice_id, from_status, to_status, actor, note, at
                ) VALUES (
                    gen_random_uuid(), NEW.org_id, NEW.id, OLD.status, NEW.status,
                    current_setting('app.user_id', true), NULL, clock_timestamp()
                );
            ELSIF TG_OP = 'INSERT' THEN
                INSERT INTO app.invoice_status_history (
                    id, org_id, invoice_id, from_status, to_status, actor, note, at
                ) VALUES (
                    gen_random_uuid(), NEW.org_id, NEW.id, NULL, NEW.status,
                    current_setting('app.user_id', true), 'Initial upload', clock_timestamp()
                );
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trg_invoice_status_transition
        BEFORE INSERT OR UPDATE ON app.invoices
        FOR EACH ROW
        EXECUTE FUNCTION app.check_invoice_status_transition();
    """)

    # 12. Enable and Force Row-Level Security
    all_tables = [
        "files",
        "parties",
        "invoices",
        "line_items",
        "field_values",
        "field_edits",
        "invoice_status_history",
        "review_tasks",
        "processing_stages",
    ]
    for tbl in all_tables:
        op.execute(f"ALTER TABLE app.{tbl} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE app.{tbl} FORCE ROW LEVEL SECURITY;")
        op.execute(f"""
            CREATE POLICY org_isolation_policy ON app.{tbl}
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (
                current_setting('app.is_system', true) = 'true'
                OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
            )
            WITH CHECK (
                current_setting('app.is_system', true) = 'true'
                OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
            );
        """)

    # Reference table policy for transitions
    op.execute("ALTER TABLE app.invoice_transitions ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE app.invoice_transitions FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY invoice_transitions_read_policy ON app.invoice_transitions
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (true)
        WITH CHECK (current_setting('app.is_system', true) = 'true');
    """)

    # 13. Grants for folio_app role
    op.execute("""
        GRANT ALL ON ALL TABLES IN SCHEMA app TO folio_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO folio_app;
    """)


def downgrade() -> None:
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS trg_invoice_status_transition ON app.invoices;")
    op.execute("DROP FUNCTION IF EXISTS app.check_invoice_status_transition();")
    op.execute("DROP TRIGGER IF EXISTS trg_invoices_updated_at ON app.invoices;")

    # Drop tables in reverse order
    tables = [
        "processing_stages",
        "review_tasks",
        "invoice_status_history",
        "field_edits",
        "field_values",
        "line_items",
        "invoices",
        "invoice_transitions",
        "parties",
        "files",
    ]
    for tbl in tables:
        op.execute(f"DROP TABLE IF EXISTS app.{tbl} CASCADE;")
