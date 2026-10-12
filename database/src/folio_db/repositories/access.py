"""Access and RBAC repository: permissions, memberships, and role lifecycle."""

from datetime import datetime, timezone
from typing import List, Optional, Dict
import uuid
from sqlalchemy import select, and_, or_, func, delete, update
from sqlalchemy.orm import Session as OrmSession, joinedload
from folio_db.models.identity import Membership, Role, RolePermission, User, Session
from folio_db.errors import NotFoundError, ValidationError, TenantIsolationError
from folio_db.services.audit import audit_record

LEVEL_HIERARCHY: Dict[str, int] = {
    "none": 0,
    "view": 1,
    "edit": 2,
    "admin": 3,
}


class AccessRepo:
    """Repository managing tenant membership, permissions, and roles."""

    def __init__(self, session: OrmSession) -> None:
        self.session = session

    def get_role_by_name(self, name: str, org_id: Optional[uuid.UUID] = None) -> Optional[Role]:
        """Fetch built-in role or org-specific custom role by name."""
        stmt = select(Role).where(
            and_(
                Role.name == name,
                or_(
                    Role.builtin.is_(True),
                    Role.org_id == org_id,
                ),
            )
        )
        return self.session.execute(stmt).scalars().first()

    def get_membership(self, org_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Membership]:
        """Fetch membership of user within org."""
        return self.session.execute(
            select(Membership)
            .options(joinedload(Membership.user), joinedload(Membership.role))
            .where(
                and_(
                    Membership.org_id == org_id,
                    Membership.user_id == user_id,
                )
            )
        ).scalar_one_or_none()

    def count_active_owners(self, org_id: uuid.UUID) -> int:
        """Count active owners currently in the organization."""
        owner_role = self.session.execute(
            select(Role).where(and_(Role.name == "Owner", Role.builtin.is_(True)))
        ).scalar_one_or_none()
        if not owner_role:
            return 0

        return self.session.execute(
            select(func.count(Membership.id)).where(
                and_(
                    Membership.org_id == org_id,
                    Membership.role_id == owner_role.id,
                    Membership.status == "active",
                )
            )
        ).scalar_one()

    def has_permission(
        self,
        user_id: uuid.UUID,
        org_id: uuid.UUID,
        permission_code: str,
        min_level: str = "view",
    ) -> bool:
        """Evaluate if user possesses at least min_level for permission_code in org.

        Returns False if user is not active or level is insufficient.
        """
        membership = self.session.execute(
            select(Membership).where(
                and_(
                    Membership.user_id == user_id,
                    Membership.org_id == org_id,
                    Membership.status == "active",
                )
            )
        ).scalar_one_or_none()

        if not membership:
            return False

        if membership.expires_at and membership.expires_at < datetime.now(timezone.utc):
            return False

        # Query role permission
        rp = self.session.execute(
            select(RolePermission).where(
                and_(
                    RolePermission.role_id == membership.role_id,
                    RolePermission.permission_code == permission_code,
                )
            )
        ).scalar_one_or_none()

        if not rp:
            return False

        user_level_score = LEVEL_HIERARCHY.get(rp.level, 0)
        required_level_score = LEVEL_HIERARCHY.get(min_level, 1)
        return user_level_score >= required_level_score

    def list_members(
        self,
        org_id: uuid.UUID,
        status: Optional[str] = None,
        role_id: Optional[uuid.UUID] = None,
    ) -> List[Membership]:
        """List all members belonging to organization with filters."""
        stmt = (
            select(Membership)
            .options(joinedload(Membership.user), joinedload(Membership.role))
            .where(Membership.org_id == org_id)
        )
        if status:
            stmt = stmt.where(Membership.status == status)
        if role_id:
            stmt = stmt.where(Membership.role_id == role_id)

        stmt = stmt.order_by(Membership.created_at.asc())
        return self.session.execute(stmt).scalars().all()

    def add_member(
        self,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        role_id: uuid.UUID,
        invited_by: Optional[uuid.UUID] = None,
        mfa_required: bool = False,
        status: str = "active",
    ) -> Membership:
        """Add a member directly to organization."""
        existing = self.get_membership(org_id, user_id)
        if existing:
            raise ConflictError(f"User {user_id} is already a member of org {org_id}.")

        membership = Membership(
            id=uuid.uuid4(),
            org_id=org_id,
            user_id=user_id,
            role_id=role_id,
            status=status,
            invited_by=invited_by,
            mfa_required=mfa_required,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self.session.add(membership)
        self.session.flush()

        audit_record(
            session=self.session,
            org_id=org_id,
            user_id=invited_by,
            action="membership.added",
            resource_type="membership",
            resource_id=str(membership.id),
            payload={"user_id": str(user_id), "role_id": str(role_id)},
        )
        return membership

    def change_role(
        self,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        new_role_id: uuid.UUID,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> Membership:
        """Change a member's role, strictly guarding against removing the last active Owner."""
        membership = self.get_membership(org_id, user_id)
        if not membership:
            raise NotFoundError(f"Member with user_id {user_id} not found in org {org_id}.")

        # Check if user is currently the last active Owner
        owner_role = self.session.execute(
            select(Role).where(and_(Role.name == "Owner", Role.builtin.is_(True)))
        ).scalar_one_or_none()

        if owner_role and membership.role_id == owner_role.id and new_role_id != owner_role.id:
            if self.count_active_owners(org_id) <= 1:
                raise ValidationError("Cannot demote the last active Owner of the organization.")

        old_role_id = membership.role_id
        membership.role_id = new_role_id
        membership.updated_at = datetime.now(timezone.utc)
        self.session.flush()

        audit_record(
            session=self.session,
            org_id=org_id,
            user_id=actor_user_id,
            action="membership.role_changed",
            resource_type="membership",
            resource_id=str(membership.id),
            payload={"old_role_id": str(old_role_id), "new_role_id": str(new_role_id)},
        )
        return membership

    def suspend_member(
        self,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> Membership:
        """Suspend a member and revoke all their active sessions in this workspace."""
        membership = self.get_membership(org_id, user_id)
        if not membership:
            raise NotFoundError(f"Member with user_id {user_id} not found in org {org_id}.")

        owner_role = self.session.execute(
            select(Role).where(and_(Role.name == "Owner", Role.builtin.is_(True)))
        ).scalar_one_or_none()

        if owner_role and membership.role_id == owner_role.id and membership.status == "active":
            if self.count_active_owners(org_id) <= 1:
                raise ValidationError("Cannot suspend the last active Owner of the organization.")

        membership.status = "suspended"
        membership.updated_at = datetime.now(timezone.utc)

        # Revoke all active sessions for this user in this org
        self.session.execute(
            update(Session)
            .where(
                and_(
                    Session.org_id == org_id,
                    Session.user_id == user_id,
                    Session.revoked_at.is_(None),
                )
            )
            .values(revoked_at=datetime.now(timezone.utc))
        )
        self.session.flush()

        audit_record(
            session=self.session,
            org_id=org_id,
            user_id=actor_user_id,
            action="membership.suspended",
            resource_type="membership",
            resource_id=str(membership.id),
        )
        return membership

    def remove_member(
        self,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> bool:
        """Remove member from organization, guarded against removing the last active Owner."""
        membership = self.get_membership(org_id, user_id)
        if not membership:
            return False

        owner_role = self.session.execute(
            select(Role).where(and_(Role.name == "Owner", Role.builtin.is_(True)))
        ).scalar_one_or_none()

        if owner_role and membership.role_id == owner_role.id and membership.status == "active":
            if self.count_active_owners(org_id) <= 1:
                raise ValidationError("Cannot remove the last active Owner of the organization.")

        # Revoke sessions
        self.session.execute(
            update(Session)
            .where(
                and_(
                    Session.org_id == org_id,
                    Session.user_id == user_id,
                    Session.revoked_at.is_(None),
                )
            )
            .values(revoked_at=datetime.now(timezone.utc))
        )
        self.session.delete(membership)
        self.session.flush()

        audit_record(
            session=self.session,
            org_id=org_id,
            user_id=actor_user_id,
            action="membership.removed",
            resource_type="membership",
            resource_id=str(membership.id),
            payload={"removed_user_id": str(user_id)},
        )
        return True
