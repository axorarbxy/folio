"""Seed script creating the 9 workspace members across the 5 roles matching the Security UI mock story."""

from datetime import datetime, timezone
from typing import List
import uuid
from sqlalchemy import select, and_
from sqlalchemy.orm import Session
from folio_db.models.identity import Organization, User, Role, Membership, MfaFactor
from folio_db.security.crypto import hash_password, encrypt_value

MOCK_MEMBERS = [
    {"name": "Aditi Mehta", "email": "aditi.mehta@folio-tax.in", "role": "Owner", "mfa": True, "status": "active"},
    {"name": "Rohan Shah", "email": "rohan.shah@folio-tax.in", "role": "Admin", "mfa": True, "status": "active"},
    {"name": "Priya Nair", "email": "priya.nair@folio-tax.in", "role": "Accountant", "mfa": True, "status": "active"},
    {"name": "Kavita Nair", "email": "kavita.nair@folio-tax.in", "role": "Accountant", "mfa": True, "status": "active"},
    {"name": "Vikas Rao", "email": "vikas.rao@folio-tax.in", "role": "Reviewer", "mfa": True, "status": "active"},
    {"name": "Ananya Sharma", "email": "ananya.sharma@folio-tax.in", "role": "Reviewer", "mfa": False, "status": "active"},
    {"name": "P. K. Singhania & Co.", "email": "audit.lead@pksinghania.com", "role": "Auditor", "mfa": True, "status": "active"},
    {"name": "Devendra Kulkarni", "email": "devendra.k@folio-tax.in", "role": "Reviewer", "mfa": False, "status": "invited"},
    {"name": "Siddharth Varma", "email": "siddharth.v@folio-tax.in", "role": "Accountant", "mfa": True, "status": "suspended"},
]


def seed_security_mock_story(session: Session, org: Organization) -> List[Membership]:
    """Seed the 9 members across 5 roles matching the Security UI mock dataset."""
    # Fetch built-in roles
    roles = session.execute(
        select(Role).where(Role.builtin.is_(True))
    ).scalars().all()
    role_map = {r.name: r for r in roles}

    memberships: List[Membership] = []
    now = datetime.now(timezone.utc)

    for spec in MOCK_MEMBERS:
        clean_email = spec["email"].lower()
        role_obj = role_map.get(spec["role"])
        if not role_obj:
            raise ValueError(f"Built-in role '{spec['role']}' not found in database.")

        # Find or create user
        user = session.execute(
            select(User).where(User.email == clean_email)
        ).scalar_one_or_none()

        if not user:
            user = User(
                id=uuid.uuid4(),
                email=clean_email,
                name=spec["name"],
                phone=encrypt_value("+91 98200 12345"),
                password_hash=hash_password("FolioSecure2026!"),
                status=spec["status"] if spec["status"] != "invited" else "invited",
                locale="en",
                created_at=now,
                last_login_at=now if spec["status"] == "active" else None,
            )
            session.add(user)
            session.flush()

            if spec["mfa"]:
                mfa = MfaFactor(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    type="totp",
                    secret=encrypt_value("JBSWY3DPEHPK3PXP"),
                    verified_at=now,
                    created_at=now,
                )
                session.add(mfa)

        # Create membership
        mem = session.execute(
            select(Membership).where(
                and_(
                    Membership.org_id == org.id,
                    Membership.user_id == user.id,
                )
            )
        ).scalar_one_or_none()

        if not mem:
            mem = Membership(
                id=uuid.uuid4(),
                org_id=org.id,
                user_id=user.id,
                role_id=role_obj.id,
                status=spec["status"],
                mfa_required=spec["mfa"],
                created_at=now,
                updated_at=now,
            )
            session.add(mem)
            session.flush()

        memberships.append(mem)

    session.flush()
    return memberships
