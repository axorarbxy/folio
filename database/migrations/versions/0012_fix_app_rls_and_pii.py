"""Fix app-table RLS coverage and missing PII comments.

Revision ID: 0012_fix_app_rls_and_pii
Revises: 0011_privacy_retention_and_rls
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision = "0012_fix_app_rls_and_pii"
down_revision = "0011_privacy_retention_and_rls"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _apply_table_policy(table_name: str, has_org_id: bool) -> None:
    op.execute(f"ALTER TABLE app.{table_name} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"ALTER TABLE app.{table_name} FORCE ROW LEVEL SECURITY;")
    policy_name = f"{table_name}_isolation_policy"
    op.execute(f"DROP POLICY IF EXISTS {policy_name} ON app.{table_name};")
    if has_org_id:
        using_expr = "current_setting('app.is_system', true) = 'true' OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid"
    else:
        using_expr = "current_setting('app.is_system', true) = 'true' OR NULLIF(current_setting('app.org_id', true), '') IS NOT NULL"
    op.execute(
        f"""
        CREATE POLICY {policy_name} ON app.{table_name}
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING ({using_expr})
        WITH CHECK ({using_expr});
        """
    )


def upgrade() -> None:
    rows = op.get_bind().execute(
        sa.text(
            """
            SELECT c.relname, EXISTS (
                SELECT 1
                FROM information_schema.columns cols
                WHERE cols.table_schema = 'app'
                  AND cols.table_name = c.relname
                  AND cols.column_name = 'org_id'
            ) AS has_org_id
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'app'
              AND c.relkind = 'r'
            ORDER BY c.relname;
            """
        )
    ).fetchall()

    for relname, has_org_id in rows:
        _apply_table_policy(relname, bool(has_org_id))

    view_comment = "PII: Supplier GSTIN identifier"
    op.execute("COMMENT ON COLUMN app.v_match_effective.supplier_gstin IS 'PII: Supplier GSTIN identifier';")
    op.execute(f"COMMENT ON VIEW app.v_match_effective IS '{view_comment}';")


def downgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(
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
    for (relname,) in rows:
        op.execute(f"DROP POLICY IF EXISTS {relname}_isolation_policy ON app.{relname};")
        op.execute(f"ALTER TABLE app.{relname} DISABLE ROW LEVEL SECURITY;")

    if bind.execute(
        sa.text(
            "SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'app' AND c.relname = 'v_match_effective' LIMIT 1;"
        )
    ).scalar():
        op.execute("COMMENT ON COLUMN app.v_match_effective.supplier_gstin IS NULL;")
        op.execute("COMMENT ON VIEW app.v_match_effective IS NULL;")
