"""Require new invoices to enter the workflow at its initial statuses.

Revision ID: 0006_invoice_initial_status
Revises: 0005_party_pii_comments
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0006_invoice_initial_status"
down_revision: str | None = "0005_party_pii_comments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION app.check_invoice_status_transition()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                IF NEW.status NOT IN ('uploaded', 'needs_review') THEN
                    RAISE EXCEPTION 'Illegal initial invoice status: %', NEW.status
                        USING ERRCODE = '23514';
                END IF;
                INSERT INTO app.invoice_status_history (
                    id, org_id, invoice_id, from_status, to_status, actor, note, at
                ) VALUES (
                    gen_random_uuid(), NEW.org_id, NEW.id, NULL, NEW.status,
                    current_setting('app.user_id', true), 'Initial upload', clock_timestamp()
                );
            ELSIF OLD.status <> NEW.status THEN
                IF NOT EXISTS (
                    SELECT 1 FROM app.invoice_transitions
                    WHERE from_status = OLD.status AND to_status = NEW.status
                ) THEN
                    RAISE EXCEPTION 'Illegal invoice status transition from % to %',
                        OLD.status, NEW.status
                        USING ERRCODE = '23514';
                END IF;
                INSERT INTO app.invoice_status_history (
                    id, org_id, invoice_id, from_status, to_status, actor, note, at
                ) VALUES (
                    gen_random_uuid(), NEW.org_id, NEW.id, OLD.status, NEW.status,
                    current_setting('app.user_id', true), NULL, clock_timestamp()
                );
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("DROP TRIGGER trg_invoice_status_transition ON app.invoices;")
    op.execute("""
        CREATE TRIGGER trg_invoice_status_transition
        AFTER INSERT OR UPDATE ON app.invoices
        FOR EACH ROW
        EXECUTE FUNCTION app.check_invoice_status_transition();
    """)


def downgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION app.check_invoice_status_transition()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
                IF NOT EXISTS (
                    SELECT 1 FROM app.invoice_transitions
                    WHERE from_status = OLD.status AND to_status = NEW.status
                ) THEN
                    RAISE EXCEPTION 'Illegal invoice status transition from % to %',
                        OLD.status, NEW.status
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
    """)
    op.execute("DROP TRIGGER trg_invoice_status_transition ON app.invoices;")
    op.execute("""
        CREATE TRIGGER trg_invoice_status_transition
        AFTER INSERT OR UPDATE ON app.invoices
        FOR EACH ROW
        EXECUTE FUNCTION app.check_invoice_status_transition();
    """)
