"""Test compliance with Folio database core conventions."""

import pytest
from sqlalchemy import text, Engine


def test_row_level_security_enabled_and_forced_on_app_tables(db_engine: Engine):
    """Convention: Every table in 'app' schema must have RLS enabled and forced."""
    query = text("""
        SELECT
            c.relname AS table_name,
            c.relrowsecurity AS rls_enabled,
            c.relforcerowsecurity AS rls_forced
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'app'
          AND c.relkind = 'r';
    """)
    with db_engine.connect() as conn:
        tables = conn.execute(query).fetchall()

    assert len(tables) > 0, "Expected at least one table in 'app' schema"
    for row in tables:
        assert row.rls_enabled is True, f"Table app.{row.table_name} does not have RLS enabled!"
        assert row.rls_forced is True, f"Table app.{row.table_name} does not have RLS forced!"


def test_rls_policies_exist_on_app_tables(db_engine: Engine):
    """Convention: Every table in 'app' schema must have at least one RLS policy."""
    query = text("""
        SELECT
            c.relname AS table_name,
            count(p.polname) AS policy_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_policy p ON p.polrelid = c.oid
        WHERE n.nspname = 'app'
          AND c.relkind = 'r'
        GROUP BY c.relname;
    """)
    with db_engine.connect() as conn:
        results = conn.execute(query).fetchall()

    assert len(results) > 0
    for row in results:
        assert row.policy_count > 0, f"Table app.{row.table_name} has no RLS policies defined!"


def test_pii_column_comment_convention(db_engine: Engine):
    """Convention: Columns for phone, email, name, address, or bank must have a comment starting with 'PII:'."""
    query = text("""
        SELECT
            c.table_schema,
            c.table_name,
            c.column_name,
            pgd.description AS column_comment
        FROM information_schema.columns c
        JOIN pg_catalog.pg_class cls
            ON cls.relname = c.table_name
        JOIN pg_catalog.pg_namespace n
            ON n.oid = cls.relnamespace
           AND n.nspname = c.table_schema
        LEFT JOIN pg_catalog.pg_description pgd
            ON pgd.objoid = cls.oid AND pgd.objsubid = c.ordinal_position
        WHERE c.table_schema = 'app'
          AND (
            c.column_name ILIKE '%phone%'
            OR c.column_name ILIKE '%email%'
            OR c.column_name ILIKE '%name%'
            OR c.column_name ILIKE '%address%'
            OR c.column_name ILIKE '%bank%'
            OR c.column_name ILIKE '%gstin%'
          );
    """)
    with db_engine.connect() as conn:
        rows = conn.execute(query).fetchall()

    assert len(rows) > 0
    for row in rows:
        comment = row.column_comment or ""
        assert comment.startswith("PII:"), (
            f"Column {row.table_schema}.{row.table_name}.{row.column_name} is missing 'PII:' comment! "
            f"Found: '{comment}'"
        )
