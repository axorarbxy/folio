"""Pytest fixtures for database tests running against real PostgreSQL."""

import os
import uuid
import pytest
from sqlalchemy import Engine, create_engine, text
from alembic.config import Config
from alembic import command
from folio_db.config import get_settings
from folio_db.session import tenant_session, system_session


@pytest.fixture(scope="session")
def db_engine() -> Engine:
    """Session-scoped real PostgreSQL engine."""
    settings = get_settings()
    # Use test db url if specified, else db url
    url = os.getenv("FOLIO_TEST_DB_URL", settings.test_db_url)
    engine = create_engine(url, echo=False)

    # Run migrations up to head on test database
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(alembic_cfg, "head")

    yield engine

    engine.dispose()


@pytest.fixture(autouse=True)
def clean_db(db_engine: Engine):
    """Clean tables between tests."""
    with system_session(db_engine) as session:
        has_table = session.execute(text(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'organizations';"
        )).scalar()
        if has_table:
            session.execute(text("DELETE FROM app.organizations;"))
            has_roles = session.execute(text(
                "SELECT 1 FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'roles';"
            )).scalar()
            if has_roles:
                session.execute(text("DELETE FROM app.roles WHERE builtin = false;"))
            has_users = session.execute(text(
                "SELECT 1 FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'users';"
            )).scalar()
            if has_users:
                session.execute(text("DELETE FROM app.users;"))
    yield
