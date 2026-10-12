"""Identity, tenancy, roles, authentication, and integrations models."""

from datetime import datetime
import uuid
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    DateTime,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, CIDR, INET
from sqlalchemy.orm import Mapped, mapped_column, relationship
from folio_db.base import Base, UuidPk, Timestamps, TenantOwned


class Organization(Base, UuidPk, Timestamps):
    """Tenant organization model in app schema."""

    __tablename__ = "organizations"
    __table_args__ = (
        CheckConstraint(
            "filing_frequency IN ('monthly', 'quarterly')",
            name="ck_organizations_filing_frequency",
        ),
        CheckConstraint(
            "fy_start_month >= 1 AND fy_start_month <= 12",
            name="ck_organizations_fy_start_month",
        ),
        CheckConstraint(
            "plan IN ('starter', 'growth', 'enterprise')",
            name="ck_organizations_plan",
        ),
        CheckConstraint(
            "status IN ('active', 'suspended', 'archived')",
            name="ck_organizations_status",
        ),
        {"schema": "app"},
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="PII: Registered business entity display name",
    )
    legal_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="PII: Legal entity name as per GST certificate",
    )
    gstin: Mapped[Optional[str]] = mapped_column(
        String(15),
        nullable=True,
        index=True,
        comment="PII: 15-character Goods and Services Tax Identification Number",
    )
    state_code: Mapped[Optional[str]] = mapped_column(
        String(2),
        nullable=True,
    )
    filing_frequency: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="monthly",
    )
    fy_start_month: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=4,
    )
    plan: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="starter",
    )
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="active",
    )

    def __repr__(self) -> str:
        return f"<Organization id={self.id} name={self.name!r} gstin={self.gstin!r}>"


class User(Base, UuidPk):
    """Global user record across workspaces."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'suspended', 'invited')",
            name="ck_users_status",
        ),
        CheckConstraint(
            "locale IN ('en', 'hi', 'mr')",
            name="ck_users_locale",
        ),
        {"schema": "app"},
    )

    email: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False,
        index=True,
        comment="PII: User login email address",
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="PII: User full name",
    )
    phone: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="PII: User mobile phone number (encrypted)",
    )
    password_hash: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="active",
    )
    locale: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="en",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    memberships: Mapped[List["Membership"]] = relationship(
        "Membership",
        back_populates="user",
        foreign_keys="[Membership.user_id]",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} name={self.name!r}>"


class Permission(Base):
    """Reference table of system capabilities."""

    __tablename__ = "permissions"
    __table_args__ = {"schema": "app"}

    code: Mapped[str] = mapped_column(Text, primary_key=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    def __repr__(self) -> str:
        return f"<Permission code={self.code!r}>"


class Role(Base, UuidPk):
    """Workspace roles (built-in or custom)."""

    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("org_id", "name", name="uq_roles_org_name"),
        {"schema": "app"},
    )

    org_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="PII: Role display name",
    )
    builtin: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    permissions: Mapped[List["RolePermission"]] = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Role id={self.id} name={self.name!r} builtin={self.builtin}>"


class RolePermission(Base, UuidPk):
    """Mapping of role to permission with capability level."""

    __tablename__ = "role_permissions"
    __table_args__ = (
        CheckConstraint(
            "level IN ('none', 'view', 'edit', 'admin')",
            name="ck_role_permissions_level",
        ),
        UniqueConstraint("role_id", "permission_code", name="uq_role_permissions_role_code"),
        {"schema": "app"},
    )

    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission_code: Mapped[str] = mapped_column(
        ForeignKey("app.permissions.code", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    level: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="view",
    )

    role: Mapped["Role"] = relationship("Role", back_populates="permissions")

    def __repr__(self) -> str:
        return f"<RolePermission role_id={self.role_id} code={self.permission_code} level={self.level}>"


class Membership(Base, UuidPk, Timestamps):
    """User membership within an organization."""

    __tablename__ = "memberships"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'suspended', 'invited')",
            name="ck_memberships_status",
        ),
        UniqueConstraint("org_id", "user_id", name="uq_memberships_org_user"),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.roles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="active",
    )
    invited_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    mfa_required: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="memberships",
        foreign_keys=[user_id],
    )
    role: Mapped["Role"] = relationship("Role")

    def __repr__(self) -> str:
        return f"<Membership org={self.org_id} user={self.user_id} role={self.role_id} status={self.status}>"


class SeparationRule(Base, UuidPk):
    """Segregation of duties rule within an organization."""

    __tablename__ = "separation_rules"
    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_separation_rules_org_code"),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<SeparationRule org={self.org_id} code={self.code} enabled={self.enabled}>"


class Invitation(Base, UuidPk):
    """Pending invitations to join an organization."""

    __tablename__ = "invitations"
    __table_args__ = {"schema": "app"}

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True,
        comment="PII: Invited recipient email address",
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.roles.id", ondelete="RESTRICT"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    role: Mapped["Role"] = relationship("Role")

    def __repr__(self) -> str:
        return f"<Invitation org={self.org_id} email={self.email!r} role={self.role_id}>"


class MfaFactor(Base, UuidPk):
    """MFA factor registered for user."""

    __tablename__ = "mfa_factors"
    __table_args__ = (
        CheckConstraint(
            "type IN ('totp', 'sms', 'passkey')",
            name="ck_mfa_factors_type",
        ),
        {"schema": "app"},
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    secret: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class RecoveryCode(Base, UuidPk):
    """Account recovery code for emergency login."""

    __tablename__ = "recovery_codes"
    __table_args__ = {"schema": "app"}

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class Session(Base, UuidPk):
    """Active user session within an organization workspace."""

    __tablename__ = "sessions"
    __table_args__ = {"schema": "app"}

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
        index=True,
    )
    device: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    ip: Mapped[Optional[str]] = mapped_column(
        INET,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    user: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<Session id={self.id} user={self.user_id} org={self.org_id}>"


class LoginAttempt(Base, UuidPk):
    """Append-only audit log of login attempts."""

    __tablename__ = "login_attempts"
    __table_args__ = {"schema": "app"}

    email: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True,
        comment="PII: Login attempt email address",
    )
    ip: Mapped[Optional[str]] = mapped_column(
        INET,
        nullable=True,
    )
    method: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="password",
    )
    success: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
    )
    reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class TrustedDevice(Base, UuidPk):
    """Trusted hardware / browser device."""

    __tablename__ = "trusted_devices"
    __table_args__ = {"schema": "app"}

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    device_fingerprint: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True,
    )
    device_name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="PII: Trusted device user name / label",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )


class IpAllowlist(Base, UuidPk):
    """Allowed IP CIDR blocks for an organization."""

    __tablename__ = "ip_allowlist"
    __table_args__ = {"schema": "app"}

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    cidr: Mapped[str] = mapped_column(
        CIDR,
        nullable=False,
    )
    note: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )


class ApiKey(Base, UuidPk):
    """Scoped API keys for programmatic tenant access."""

    __tablename__ = "api_keys"
    __table_args__ = (
        CheckConstraint(
            "array_length(scopes, 1) > 0",
            name="ck_api_keys_scopes_non_empty",
        ),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="PII: API key friendly name",
    )
    prefix: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True,
    )
    key_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
    )
    scopes: Mapped[List[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("app.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    overlap_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ApiKey id={self.id} org={self.org_id} prefix={self.prefix!r}>"


class Integration(Base, UuidPk, Timestamps):
    """Connected ERP, WhatsApp, or cloud storage integrations."""

    __tablename__ = "integrations"
    __table_args__ = (
        CheckConstraint(
            "provider IN ('tally', 'zoho', 'gst_provider', 'whatsapp', 'email', 'drive')",
            name="ck_integrations_provider",
        ),
        CheckConstraint(
            "status IN ('connected', 'disconnected', 'error', 'pending')",
            name="ck_integrations_status",
        ),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="connected",
    )
    account_label: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    granted_scopes: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(Text),
        nullable=True,
    )
    tokens: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class Webhook(Base, UuidPk, Timestamps):
    """Outgoing webhooks triggered by workspace events."""

    __tablename__ = "webhooks"
    __table_args__ = (
        CheckConstraint(
            "url ~* '^https://'",
            name="ck_webhooks_url_https",
        ),
        CheckConstraint(
            "status IN ('active', 'disabled')",
            name="ck_webhooks_status",
        ),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    events: Mapped[List[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
    )
    signing_secret: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="active",
    )

    deliveries: Mapped[List["WebhookDelivery"]] = relationship("WebhookDelivery", back_populates="webhook", cascade="all, delete-orphan")


class WebhookDelivery(Base, UuidPk):
    """Append-only delivery attempt history for webhooks."""

    __tablename__ = "webhook_deliveries"
    __table_args__ = {"schema": "app"}

    webhook_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.webhooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    status_code: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    latency_ms: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    attempt: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    webhook: Mapped["Webhook"] = relationship("Webhook", back_populates="deliveries")


class InboundChannel(Base, UuidPk):
    """Inbound ingestion channel (email inbox or WhatsApp number)."""

    __tablename__ = "inbound_channels"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('email', 'whatsapp')",
            name="ck_inbound_channels_kind",
        ),
        {"schema": "app"},
    )

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    address: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="PII: Inbound email or channel address",
    )
    accept_only_allowlisted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    senders: Mapped[List["InboundSender"]] = relationship("InboundSender", back_populates="channel", cascade="all, delete-orphan")


class InboundSender(Base, UuidPk):
    """Allowlisted sender for inbound document processing."""

    __tablename__ = "inbound_senders"
    __table_args__ = {"schema": "app"}

    channel_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.inbound_channels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_address: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="PII: Allowlisted sender email or phone address",
    )
    note: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    channel: Mapped["InboundChannel"] = relationship("InboundChannel", back_populates="senders")


class QuarantinedMessage(Base, UuidPk):
    """Inbound message held in quarantine for security review."""

    __tablename__ = "quarantined_messages"
    __table_args__ = {"schema": "app"}

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    channel_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("app.inbound_channels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_address: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="PII: Quarantined sender email or phone address",
    )
    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    payload: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
