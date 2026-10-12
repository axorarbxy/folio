"""Test database foundation, migrations cycle, domains, and base repository."""

import uuid
import time
import pytest
from sqlalchemy import text, Engine
from sqlalchemy.exc import DBAPIError
from alembic.config import Config
from alembic import command
from folio_db.models.identity import Organization
from folio_db.repositories.organizations import OrganizationRepository
from folio_db.session import system_session, tenant_session, KeysetCursor
from folio_db.errors import NotFoundError, ConflictError
from tests.factories import create_organization_factory


def test_migration_cycle(db_engine: Engine):
    """Ensure alembic upgrade head -> downgrade base -> upgrade head succeeds completely."""
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", db_engine.url.render_as_string(hide_password=False))

    # Downgrade to base
    command.downgrade(cfg, "base")

    # Verify tables dropped
    with db_engine.connect() as conn:
        res = conn.execute(
            text("SELECT 1 FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'organizations';")
        ).scalar()
        assert res is None

    # Upgrade back to head
    command.upgrade(cfg, "head")

    # Verify organizations exists again
    with db_engine.connect() as conn:
        res = conn.execute(
            text("SELECT 1 FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'organizations';")
        ).scalar()
        assert res == 1


def test_organization_crud_and_repository(db_engine: Engine):
    """Test typed Organization repository operations."""
    org_id = uuid.uuid4()
    with system_session(db_engine) as session:
        repo = OrganizationRepository(session)
        org = Organization(
            id=org_id,
            name="Alpha Steel Mills",
            legal_name="Alpha Steel Mills Pvt Ltd",
            gstin="27AABCA1234A1Z5",
            state_code="27",
            filing_frequency="monthly",
            plan="growth",
            status="active",
        )
        repo.add(org)

    with system_session(db_engine) as session:
        repo = OrganizationRepository(session)
        fetched = repo.get(org_id)
        assert fetched.name == "Alpha Steel Mills"
        assert fetched.gstin == "27AABCA1234A1Z5"

        # Lookup by GSTIN
        by_gstin = repo.find_by_gstin("27AABCA1234A1Z5")
        assert by_gstin is not None
        assert by_gstin.id == org_id

        # Update
        fetched.name = "Alpha Steel Mills International"
        repo.update(fetched)

    with system_session(db_engine) as session:
        repo = OrganizationRepository(session)
        assert repo.get(org_id).name == "Alpha Steel Mills International"

        # Not found error mapping
        with pytest.raises(NotFoundError):
            repo.get(uuid.uuid4())


def test_updated_at_trigger(db_engine: Engine):
    """Verify that updated_at trigger automatically updates clock_timestamp() on update."""
    org_id = uuid.uuid4()
    with system_session(db_engine) as session:
        org = Organization(
            id=org_id,
            name="Beta Electricals",
            gstin="29ABCDE1234F1Z5",
        )
        session.add(org)
        session.flush()
        first_created = org.created_at
        first_updated = org.updated_at

    # Small sleep to ensure distinct clock_timestamp
    time.sleep(0.05)

    with system_session(db_engine) as session:
        fetched = session.get(Organization, org_id)
        fetched.name = "Beta Electricals Ltd"
        session.flush()
        second_updated = fetched.updated_at
        assert second_updated > first_updated
        assert fetched.created_at == first_created


def test_postgres_domain_format_constraints(db_engine: Engine):
    """Verify custom Postgres DOMAIN checks enforce format on raw SQL inserts."""
    with system_session(db_engine) as session:
        # Invalid GSTIN (not 15 chars / wrong checksum structure)
        sp = session.begin_nested()
        with pytest.raises(DBAPIError):
            session.execute(
                text("SELECT 'INVALID_GSTIN_123'::app.gstin_t;")
            )
        sp.rollback()

        # Valid GSTIN
        val = session.execute(
            text("SELECT '27AABCU9603R1ZM'::app.gstin_t;")
        ).scalar()
        assert val == "27AABCU9603R1ZM"

        # Invalid State Code (non-digits 'AB')
        sp2 = session.begin_nested()
        with pytest.raises(DBAPIError):
            session.execute(
                text("SELECT 'AB'::app.state_code_t;")
            )
        sp2.rollback()

        # Valid State Code
        st = session.execute(
            text("SELECT '27'::app.state_code_t;")
        ).scalar()
        assert st == "27"



def test_keyset_cursor_pagination(db_engine: Engine):
    """Test Keyset pagination ordering by (created_at, id)."""
    with system_session(db_engine) as session:
        repo = OrganizationRepository(session)
        # Create 5 organizations
        for i in range(5):
            org = Organization(
                id=uuid.uuid4(),
                name=f"Batch Org {i:02d}",
                gstin=f"27AABCU960{i}R1ZM",
            )
            repo.add(org)

    with system_session(db_engine) as session:
        repo = OrganizationRepository(session)
        # Fetch page 1 with limit 2
        items, next_cursor, has_more = repo.list(limit=2)
        assert len(items) == 2
        assert has_more is True
        assert next_cursor is not None

        # Fetch page 2
        items_page2, next_cursor2, has_more2 = repo.list(limit=2, cursor=next_cursor)
        assert len(items_page2) == 2
        # No overlapping items
        assert {i.id for i in items}.isdisjoint({i.id for i in items_page2})
