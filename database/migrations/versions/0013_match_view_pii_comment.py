"""Add the required PII comment to the reconciliation match view.

Revision ID: 0013_match_view_pii_comment
Revises: 0012_fix_app_rls_and_pii
"""

from collections.abc import Sequence

from alembic import op

revision = "0013_match_view_pii_comment"
down_revision = "0012_fix_app_rls_and_pii"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("COMMENT ON VIEW app.v_match_effective IS 'PII: Reconciliation match view with supplier GSTIN metadata';")
    op.execute("COMMENT ON COLUMN app.v_match_effective.supplier_gstin IS 'PII: Supplier GSTIN identifier';")


def downgrade() -> None:
    op.execute("COMMENT ON COLUMN app.v_match_effective.supplier_gstin IS NULL;")
    op.execute("COMMENT ON VIEW app.v_match_effective IS NULL;")
