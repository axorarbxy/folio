"""Session management, tenant RLS isolation, and keyset pagination helpers."""

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
import base64
import json
from typing import Any, Generator, Sequence, TypeVar, Optional
import uuid
from sqlalchemy import Engine, create_engine, text, tuple_
from sqlalchemy.orm import Session, sessionmaker, Query
from folio_db.config import Settings, get_settings
from folio_db.errors import TenantIsolationError, ValidationError


@dataclass(frozen=True)
class TenantContext:
    """Active tenant isolation context variables."""

    org_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    request_id: Optional[str] = None
    is_system: bool = False


@dataclass(frozen=True)
class KeysetCursor:
    """Cursor representing a position in an ordered dataset (created_at, id)."""

    created_at: datetime
    id: uuid.UUID

    def encode(self) -> str:
        """Encode cursor into a URL-safe base64 string."""
        payload = {
            "c": self.created_at.isoformat(),
            "i": str(self.id),
        }
        raw_bytes = json.dumps(payload).encode("utf-8")
        return base64.urlsafe_b64encode(raw_bytes).decode("ascii")

    @classmethod
    def decode(cls, token: str) -> "KeysetCursor":
        """Decode URL-safe base64 token into KeysetCursor."""
        try:
            raw_bytes = base64.urlsafe_b64decode(token.encode("ascii"))
            data = json.loads(raw_bytes.decode("utf-8"))
            dt = datetime.fromisoformat(data["c"])
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return cls(created_at=dt, id=uuid.UUID(data["i"]))
        except Exception as exc:
            raise ValidationError(f"Invalid keyset pagination cursor: {exc}") from exc


def create_engine_from_settings(settings: Settings | None = None) -> Engine:
    """Create a configured SQLAlchemy engine."""
    cfg = settings or get_settings()
    return create_engine(
        cfg.db_url,
        pool_size=cfg.pool_size,
        max_overflow=cfg.max_overflow,
        pool_timeout=cfg.pool_timeout,
        echo=cfg.echo,
    )


@contextmanager
def tenant_session(
    engine: Engine,
    org_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
    request_id: Optional[str] = None,
) -> Generator[Session, None, None]:
    """Provide a tenant-isolated transactional database session.

    Executes SET LOCAL configuration inside transaction so connection pooling
    (like PgBouncer in transaction mode) does not leak state between sessions.
    """
    if not isinstance(org_id, uuid.UUID):
        try:
            org_id = uuid.UUID(str(org_id))
        except (ValueError, TypeError) as err:
            raise TenantIsolationError(f"Invalid org_id: {err}") from err

    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session: Session = SessionLocal()
    try:
        # Set local role to folio_app to guarantee RLS is strictly enforced even if connecting as DB superuser
        session.execute(text("SET LOCAL ROLE folio_app"))
        session.execute(
            text("SELECT set_config('app.org_id', :org_id, true)"),
            {"org_id": str(org_id)},
        )
        session.execute(
            text("SELECT set_config('app.user_id', :user_id, true)"),
            {"user_id": str(user_id) if user_id else ""},
        )
        session.execute(
            text("SELECT set_config('app.request_id', :request_id, true)"),
            {"request_id": request_id or ""},
        )
        session.execute(text("SELECT set_config('app.is_system', 'false', true)"))

        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def system_session(
    engine: Engine,
    job_name: Optional[str] = None,
) -> Generator[Session, None, None]:
    """Provide a system administrative session for migrations or platform operations."""
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session: Session = SessionLocal()
    try:
        session.execute(text("SELECT set_config('app.is_system', 'true', true)"))
        session.execute(
            text("SELECT set_config('app.job_name', :job_name, true)"),
            {"job_name": job_name or "system_task"},
        )
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def paginate_by_keyset(
    query: Query,
    model_class: Any,
    limit: int = 50,
    cursor: Optional[str] = None,
    ascending: bool = False,
) -> tuple[list[Any], Optional[str], bool]:
    """Apply keyset cursor pagination to a SQLAlchemy Query.

    Sorts by (model.created_at, model.id).
    Returns (items, next_cursor_string, has_more).
    Avoids expensive OFFSET on high-volume tables.
    """
    if limit < 1 or limit > 200:
        limit = 50

    created_at_col = model_class.created_at
    id_col = model_class.id

    if cursor:
        decoded = KeysetCursor.decode(cursor)
        if ascending:
            query = query.filter(
                tuple_(created_at_col, id_col) > (decoded.created_at, decoded.id)
            )
        else:
            query = query.filter(
                tuple_(created_at_col, id_col) < (decoded.created_at, decoded.id)
            )

    if ascending:
        query = query.order_by(created_at_col.asc(), id_col.asc())
    else:
        query = query.order_by(created_at_col.desc(), id_col.desc())

    # Fetch limit + 1 to detect has_more
    rows = query.limit(limit + 1).all()
    has_more = len(rows) > limit
    items = rows[:limit]

    next_cursor = None
    if has_more and items:
        last_item = items[-1]
        next_cursor = KeysetCursor(
            created_at=last_item.created_at,
            id=last_item.id,
        ).encode()

    return items, next_cursor, has_more
