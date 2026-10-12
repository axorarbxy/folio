"""Annotate sensitive party columns consistently with the PII convention.

Revision ID: 0005_party_pii_comments
Revises: 0004_invoice_workflow_guards
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_party_pii_comments"
down_revision: str | None = "0004_invoice_workflow_guards"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "parties",
        "pan",
        schema="app",
        existing_type=sa.String(length=10),
        existing_nullable=True,
        comment="PII: Permanent Account Number associated with this GSTIN",
    )
    op.alter_column(
        "parties",
        "gstin_status",
        schema="app",
        existing_type=sa.Text(),
        existing_nullable=False,
        comment="PII: GSTIN registration status",
    )


def downgrade() -> None:
    op.alter_column(
        "parties",
        "gstin_status",
        schema="app",
        existing_type=sa.Text(),
        existing_nullable=False,
        comment=None,
    )
    op.alter_column(
        "parties",
        "pan",
        schema="app",
        existing_type=sa.String(length=10),
        existing_nullable=True,
        comment=None,
    )
