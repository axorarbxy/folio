"""Use the shared GSTIN, PAN, HSN, and state-code domain types.

Revision ID: 0007_invoice_party_domains
Revises: 0006_invoice_initial_status
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import DOMAIN

revision: str = "0007_invoice_party_domains"
down_revision: str | None = "0006_invoice_initial_status"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "parties",
        "gstin",
        schema="app",
        existing_type=sa.String(length=15),
        type_=DOMAIN("gstin_t", sa.String(length=15), schema="app", create_type=False),
        postgresql_using="gstin::app.gstin_t",
    )
    op.alter_column(
        "parties",
        "state_code",
        schema="app",
        existing_type=sa.String(length=2),
        type_=DOMAIN("state_code_t", sa.String(length=2), schema="app", create_type=False),
        postgresql_using="state_code::app.state_code_t",
    )
    op.alter_column(
        "parties",
        "pan",
        schema="app",
        existing_type=sa.String(length=10),
        type_=DOMAIN("pan_t", sa.String(length=10), schema="app", create_type=False),
        postgresql_using="pan::app.pan_t",
    )
    op.alter_column(
        "invoices",
        "place_of_supply_state",
        schema="app",
        existing_type=sa.String(length=2),
        type_=DOMAIN("state_code_t", sa.String(length=2), schema="app", create_type=False),
        postgresql_using="place_of_supply_state::app.state_code_t",
    )
    op.alter_column(
        "line_items",
        "hsn",
        schema="app",
        existing_type=sa.String(length=8),
        type_=DOMAIN("hsn_t", sa.String(length=8), schema="app", create_type=False),
        postgresql_using="hsn::app.hsn_t",
    )


def downgrade() -> None:
    op.alter_column(
        "line_items",
        "hsn",
        schema="app",
        existing_type=DOMAIN("hsn_t", sa.String(length=8), schema="app", create_type=False),
        type_=sa.String(length=8),
        postgresql_using="hsn::varchar(8)",
    )
    op.alter_column(
        "invoices",
        "place_of_supply_state",
        schema="app",
        existing_type=DOMAIN("state_code_t", sa.String(length=2), schema="app", create_type=False),
        type_=sa.String(length=2),
        postgresql_using="place_of_supply_state::varchar(2)",
    )
    op.alter_column(
        "parties",
        "pan",
        schema="app",
        existing_type=DOMAIN("pan_t", sa.String(length=10), schema="app", create_type=False),
        type_=sa.String(length=10),
        postgresql_using="pan::varchar(10)",
    )
    op.alter_column(
        "parties",
        "state_code",
        schema="app",
        existing_type=DOMAIN("state_code_t", sa.String(length=2), schema="app", create_type=False),
        type_=sa.String(length=2),
        postgresql_using="state_code::varchar(2)",
    )
    op.alter_column(
        "parties",
        "gstin",
        schema="app",
        existing_type=DOMAIN("gstin_t", sa.String(length=15), schema="app", create_type=False),
        type_=sa.String(length=15),
        postgresql_using="gstin::varchar(15)",
    )
