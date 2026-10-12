"""Base generic repository with typed CRUD and keyset pagination."""

from typing import Generic, TypeVar, Type, Optional, Sequence
import uuid
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from folio_db.base import Base
from folio_db.errors import NotFoundError, ConflictError
from folio_db.session import paginate_by_keyset

T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    """Generic repository providing tenant-aware operations inside an active Session."""

    def __init__(self, session: Session, model_class: Type[T]) -> None:
        self.session = session
        self.model_class = model_class

    def get(self, entity_id: uuid.UUID) -> T:
        """Fetch entity by primary key or raise NotFoundError."""
        obj = self.session.get(self.model_class, entity_id)
        if obj is None:
            raise NotFoundError(self.model_class.__name__, entity_id)
        return obj

    def get_optional(self, entity_id: uuid.UUID) -> Optional[T]:
        """Fetch entity by primary key or return None."""
        return self.session.get(self.model_class, entity_id)

    def list(
        self,
        limit: int = 50,
        cursor: Optional[str] = None,
        ascending: bool = False,
    ) -> tuple[list[T], Optional[str], bool]:
        """Fetch items using keyset cursor pagination."""
        query = self.session.query(self.model_class)
        return paginate_by_keyset(
            query=query,
            model_class=self.model_class,
            limit=limit,
            cursor=cursor,
            ascending=ascending,
        )

    def add(self, entity: T) -> T:
        """Add and flush entity to detect database constraints immediately."""
        try:
            self.session.add(entity)
            self.session.flush()
            return entity
        except IntegrityError as exc:
            self.session.rollback()
            raise ConflictError(
                f"Failed to add {self.model_class.__name__}: constraint violation",
                {"orig": str(exc.orig)},
            ) from exc

    def update(self, entity: T) -> T:
        """Flush changes to detect constraints immediately."""
        try:
            self.session.flush()
            return entity
        except IntegrityError as exc:
            self.session.rollback()
            raise ConflictError(
                f"Failed to update {self.model_class.__name__}: constraint violation",
                {"orig": str(exc.orig)},
            ) from exc

    def delete(self, entity: T) -> None:
        """Remove entity from database."""
        self.session.delete(entity)
        self.session.flush()
