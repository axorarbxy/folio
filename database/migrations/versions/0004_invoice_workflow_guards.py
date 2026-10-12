"""Add invoice idempotency and append-only database guards.

Revision ID: 0004_invoice_workflow_guards
Revises: 0003_invoices
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0004_invoice_workflow_guards"
down_revision: str | None = "0003_invoices"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_FORWARD_TRANSITIONS = (
    ("uploaded", "processing"),
    ("processing", "needs_review"),
    ("processing", "reviewed"),
    ("processing", "validated"),
    ("processing", "failed"),
    ("needs_review", "reviewed"),
    ("needs_review", "failed"),
    ("reviewed", "validated"),
    ("reviewed", "flagged"),
    ("validated", "flagged"),
    ("validated", "reconciled"),
    ("flagged", "fixed"),
    ("fixed", "validated"),
    ("reconciled", "closed"),
)


def upgrade() -> None:
    # One original file can produce only one invoice in a tenant.
    op.create_unique_constraint(
        "uq_invoices_file_id",
        "invoices",
        ["file_id"],
        schema="app",
    )
    op.execute(
        "COMMENT ON INDEX app.uq_invoices_file_id IS "
        "'Enforces idempotent invoice creation for a registered source file.'"
    )

    # The workflow document is absent from this repository; keep only forward
    # paths from the existing seed and make closed/failed terminal.
    op.execute("DELETE FROM app.invoice_transitions;")
    op.execute(
        "INSERT INTO app.invoice_transitions (from_status, to_status) VALUES "
        + ", ".join(f"('{source}', '{target}')" for source, target in _FORWARD_TRANSITIONS)
        + ";"
    )

    op.execute("""
        CREATE OR REPLACE FUNCTION app.reject_append_only_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            IF current_user = 'folio_app'
               AND current_setting('app.is_system', true) IS DISTINCT FROM 'true' THEN
                RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
                    USING ERRCODE = '23514';
            END IF;
            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_field_edits_append_only
        BEFORE UPDATE OR DELETE ON app.field_edits
        FOR EACH ROW EXECUTE FUNCTION app.reject_append_only_mutation();
    """)
    op.execute("""
        CREATE TRIGGER trg_files_immutable
        BEFORE UPDATE OR DELETE ON app.files
        FOR EACH ROW EXECUTE FUNCTION app.reject_append_only_mutation();
    """)
    op.execute("""
        CREATE TRIGGER trg_invoice_status_history_append_only
        BEFORE UPDATE OR DELETE ON app.invoice_status_history
        FOR EACH ROW EXECUTE FUNCTION app.reject_append_only_mutation();
    """)
    op.execute("REVOKE UPDATE, DELETE ON app.field_edits FROM folio_app;")
    op.execute("REVOKE UPDATE, DELETE ON app.files FROM folio_app;")
    op.execute("REVOKE UPDATE, DELETE ON app.invoice_status_history FROM folio_app;")

    # The history row has an FK to its invoice, so it must be written after
    # the new invoice row exists.
    op.execute("DROP TRIGGER trg_invoice_status_transition ON app.invoices;")
    op.execute("""
        CREATE TRIGGER trg_invoice_status_transition
        AFTER INSERT OR UPDATE ON app.invoices
        FOR EACH ROW
        EXECUTE FUNCTION app.check_invoice_status_transition();
    """)


def downgrade() -> None:
    op.execute("GRANT UPDATE, DELETE ON app.field_edits TO folio_app;")
    op.execute("GRANT UPDATE, DELETE ON app.files TO folio_app;")
    op.execute("GRANT UPDATE, DELETE ON app.invoice_status_history TO folio_app;")
    op.execute(
        "DROP TRIGGER IF EXISTS trg_invoice_status_history_append_only "
        "ON app.invoice_status_history;"
    )
    op.execute("DROP TRIGGER IF EXISTS trg_field_edits_append_only ON app.field_edits;")
    op.execute("DROP TRIGGER IF EXISTS trg_files_immutable ON app.files;")
    op.execute("DROP FUNCTION IF EXISTS app.reject_append_only_mutation();")
    op.execute("DROP TRIGGER trg_invoice_status_transition ON app.invoices;")
    op.execute("""
        CREATE TRIGGER trg_invoice_status_transition
        BEFORE INSERT OR UPDATE ON app.invoices
        FOR EACH ROW
        EXECUTE FUNCTION app.check_invoice_status_transition();
    """)
    op.execute("DELETE FROM app.invoice_transitions;")
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
    op.drop_constraint("uq_invoices_file_id", "invoices", schema="app", type_="unique")
