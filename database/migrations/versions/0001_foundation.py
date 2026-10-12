"""0001 Foundation migration: schemas, extensions, domains, trigger, organizations table with RLS

Revision ID: 0001_foundation
Revises: <base>
Create Date: 2026-10-12 10:45:00.000000+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001_foundation"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Schemas
    op.execute("CREATE SCHEMA IF NOT EXISTS app;")
    op.execute("CREATE SCHEMA IF NOT EXISTS platform;")

    # 2. Extensions (allowed: pgcrypto, pg_trgm, citext)
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    op.execute("CREATE EXTENSION IF NOT EXISTS citext;")

    # 3. Custom Postgres DOMAINs
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gstin_t') THEN
                CREATE DOMAIN app.gstin_t AS VARCHAR(15)
                CHECK (VALUE ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hsn_t') THEN
                CREATE DOMAIN app.hsn_t AS VARCHAR(8)
                CHECK (VALUE ~ '^[0-9]{2,8}$');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pan_t') THEN
                CREATE DOMAIN app.pan_t AS VARCHAR(10)
                CHECK (VALUE ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'state_code_t') THEN
                CREATE DOMAIN app.state_code_t AS VARCHAR(2)
                CHECK (VALUE ~ '^[0-9]{2}$');
            END IF;
        END $$;
    """)

    # 4. Updated At Trigger Function
    op.execute("""
        CREATE OR REPLACE FUNCTION app.set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = clock_timestamp();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 5. Organizations Table
    op.create_table(
        "organizations",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False, comment="PII: Registered business entity display name"),
        sa.Column("legal_name", sa.String(length=255), nullable=True, comment="PII: Legal entity name as per GST certificate"),
        sa.Column("gstin", sa.String(length=15), nullable=True, comment="PII: 15-character Goods and Services Tax Identification Number"),
        sa.Column("state_code", sa.String(length=2), nullable=True),
        sa.Column("filing_frequency", sa.Text(), server_default="monthly", nullable=False),
        sa.Column("fy_start_month", sa.Integer(), server_default="4", nullable=False),
        sa.Column("plan", sa.Text(), server_default="starter", nullable=False),
        sa.Column("status", sa.Text(), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("filing_frequency IN ('monthly', 'quarterly')", name="ck_organizations_filing_frequency"),
        sa.CheckConstraint("fy_start_month >= 1 AND fy_start_month <= 12", name="ck_organizations_fy_start_month"),
        sa.CheckConstraint("plan IN ('starter', 'growth', 'enterprise')", name="ck_organizations_plan"),
        sa.CheckConstraint("status IN ('active', 'suspended', 'archived')", name="ck_organizations_status"),
        sa.PrimaryKeyConstraint("id", name="pk_organizations"),
        schema="app",
    )

    op.create_index("ix_organizations_gstin", "organizations", ["gstin"], unique=False, schema="app")

    # 6. Trigger on app.organizations
    op.execute("""
        CREATE TRIGGER trg_organizations_updated_at
        BEFORE UPDATE ON app.organizations
        FOR EACH ROW
        EXECUTE FUNCTION app.set_updated_at();
    """)

    # 7. Enable and Force Row-Level Security
    op.execute("ALTER TABLE app.organizations ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE app.organizations FORCE ROW LEVEL SECURITY;")

    # Tenant isolation policy:
    # A tenant sees and modifies only their own organization record matching current_setting('app.org_id').
    # A system session (e.g. migrations or platform administrative jobs) bypasses with app.is_system = 'true'.
    op.execute("""
        CREATE POLICY org_isolation_policy ON app.organizations
        AS PERMISSIVE
        FOR ALL
        TO PUBLIC
        USING (
            current_setting('app.is_system', true) = 'true'
            OR id = NULLIF(current_setting('app.org_id', true), '')::uuid
        )
        WITH CHECK (
            current_setting('app.is_system', true) = 'true'
            OR id = NULLIF(current_setting('app.org_id', true), '')::uuid
        );
    """)

    # 8. Create non-superuser application role for enforcing RLS even under superuser connections
    op.execute("""
        DO $do$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'folio_app') THEN
                CREATE ROLE folio_app NOBYPASSRLS;
            END IF;
        END $do$;
        GRANT USAGE ON SCHEMA app TO folio_app;
        GRANT ALL ON ALL TABLES IN SCHEMA app TO folio_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO folio_app;
        GRANT USAGE ON SCHEMA platform TO folio_app;
        GRANT ALL ON ALL TABLES IN SCHEMA platform TO folio_app;
        ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON TABLES TO folio_app;
        ALTER DEFAULT PRIVILEGES IN SCHEMA platform GRANT ALL ON TABLES TO folio_app;
    """)



def downgrade() -> None:
    # 1. Drop RLS policy
    op.execute("DROP POLICY IF EXISTS org_isolation_policy ON app.organizations;")

    # 2. Drop trigger and table
    op.execute("DROP TRIGGER IF EXISTS trg_organizations_updated_at ON app.organizations;")
    op.drop_index("ix_organizations_gstin", table_name="organizations", schema="app")
    op.drop_table("organizations", schema="app")

    # 3. Drop trigger function
    op.execute("DROP FUNCTION IF EXISTS app.set_updated_at();")

    # 4. Drop DOMAINs
    op.execute("DROP DOMAIN IF EXISTS app.state_code_t CASCADE;")
    op.execute("DROP DOMAIN IF EXISTS app.pan_t CASCADE;")
    op.execute("DROP DOMAIN IF EXISTS app.hsn_t CASCADE;")
    op.execute("DROP DOMAIN IF EXISTS app.gstin_t CASCADE;")
