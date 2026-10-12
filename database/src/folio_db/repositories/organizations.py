"""Repository for tenant organizations."""

from typing import Optional
import uuid
from sqlalchemy.orm import Session
from folio_db.models.identity import Organization
from folio_db.repositories.base import BaseRepository


class OrganizationRepository(BaseRepository[Organization]):
    """Typed repository for Organization entities."""

    def __init__(self, session: Session) -> None:
        super().__init__(session, Organization)

    def find_by_gstin(self, gstin: str) -> Optional[Organization]:
        """Lookup organization by its 15-character GSTIN."""
        return (
            self.session.query(Organization)
            .filter(Organization.gstin == gstin.strip())
            .first()
        )
