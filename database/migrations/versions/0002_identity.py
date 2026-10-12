"""0002 Identity, Tenancy, RBAC, Sessions, Integrations, and Inbound Channels

Revision ID: 0002_identity
Revises: 0001_foundation
Create Date: 2026-10-12 11:15:00.000000+00:00

"""
from typing import Sequence, Union
import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0002_identity"
down_revision: Union[str, None] = "0001_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Global Users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("email", postgresql.CITEXT(), nullable=False, comment="PII: User login email address"),
        sa.Column("name", sa.String(255), nullable=False, comment="PII: User full name"),
        sa.Column("phone", sa.Text(), nullable=True, comment="PII: User mobile phone number (encrypted)"),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), server_default="active", nullable=False),
        sa.Column("locale", sa.Text(), server_default="en", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('active', 'suspended', 'invited')", name="ck_users_status"),
        sa.CheckConstraint("locale IN ('en', 'hi', 'mr')", name="ck_users_locale"),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
        schema="app",
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True, schema="app")

    # 2. Permissions reference table
    op.create_table(
        "permissions",
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("code", name="pk_permissions"),
        schema="app",
    )

    # 3. Roles table
    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_roles_org_id_organizations"), nullable=True),
        sa.Column("name", sa.Text(), nullable=False, comment="PII: Role display name"),
        sa.Column("builtin", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_roles"),
        sa.UniqueConstraint("org_id", "name", name="uq_roles_org_name"),
        schema="app",
    )
    op.create_index("ix_roles_org_id", "roles", ["org_id"], unique=False, schema="app")

    # 4. Role Permissions table
    op.create_table(
        "role_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.roles.id", ondelete="CASCADE", name="fk_role_permissions_role_id_roles"), nullable=False),
        sa.Column("permission_code", sa.Text(), sa.ForeignKey("app.permissions.code", ondelete="CASCADE", name="fk_role_permissions_permission_code_permissions"), nullable=False),
        sa.Column("level", sa.Text(), server_default="view", nullable=False),
        sa.CheckConstraint("level IN ('none', 'view', 'edit', 'admin')", name="ck_role_permissions_level"),
        sa.PrimaryKeyConstraint("id", name="pk_role_permissions"),
        sa.UniqueConstraint("role_id", "permission_code", name="uq_role_permissions_role_code"),
        schema="app",
    )
    op.create_index("ix_role_permissions_role_id", "role_permissions", ["role_id"], unique=False, schema="app")

    # 5. Memberships table
    op.create_table(
        "memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_memberships_org_id_organizations"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="CASCADE", name="fk_memberships_user_id_users"), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.roles.id", ondelete="RESTRICT", name="fk_memberships_role_id_roles"), nullable=False),
        sa.Column("status", sa.Text(), server_default="active", nullable=False),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL", name="fk_memberships_invited_by_users"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("mfa_required", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('active', 'suspended', 'invited')", name="ck_memberships_status"),
        sa.PrimaryKeyConstraint("id", name="pk_memberships"),
        sa.UniqueConstraint("org_id", "user_id", name="uq_memberships_org_user"),
        schema="app",
    )
    op.create_index("ix_memberships_org_id", "memberships", ["org_id"], unique=False, schema="app")
    op.create_index("ix_memberships_user_id", "memberships", ["user_id"], unique=False, schema="app")

    # 6. Separation Rules
    op.create_table(
        "separation_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_separation_rules_org_id_organizations"), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_separation_rules"),
        sa.UniqueConstraint("org_id", "code", name="uq_separation_rules_org_code"),
        schema="app",
    )
    op.create_index("ix_separation_rules_org_id", "separation_rules", ["org_id"], unique=False, schema="app")

    # 7. Invitations
    op.create_table(
        "invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_invitations_org_id_organizations"), nullable=False),
        sa.Column("email", postgresql.CITEXT(), nullable=False, comment="PII: Invited recipient email address"),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.roles.id", ondelete="RESTRICT", name="fk_invitations_role_id_roles"), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL", name="fk_invitations_created_by_users"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_invitations"),
        sa.UniqueConstraint("token_hash", name="uq_invitations_token_hash"),
        schema="app",
    )
    op.create_index("ix_invitations_org_id", "invitations", ["org_id"], unique=False, schema="app")

    # 8. MFA Factors & Recovery Codes
    op.create_table(
        "mfa_factors",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="CASCADE", name="fk_mfa_factors_user_id_users"), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("secret", sa.Text(), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("type IN ('totp', 'sms', 'passkey')", name="ck_mfa_factors_type"),
        sa.PrimaryKeyConstraint("id", name="pk_mfa_factors"),
        schema="app",
    )
    op.create_index("ix_mfa_factors_user_id", "mfa_factors", ["user_id"], unique=False, schema="app")

    op.create_table(
        "recovery_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="CASCADE", name="fk_recovery_codes_user_id_users"), nullable=False),
        sa.Column("code_hash", sa.Text(), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_recovery_codes"),
        schema="app",
    )
    op.create_index("ix_recovery_codes_user_id", "recovery_codes", ["user_id"], unique=False, schema="app")

    # 9. Sessions
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="CASCADE", name="fk_sessions_user_id_users"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_sessions_org_id_organizations"), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("device", sa.Text(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("ip", postgresql.INET(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_sessions"),
        sa.UniqueConstraint("token_hash", name="uq_sessions_token_hash"),
        schema="app",
    )
    op.create_index("ix_sessions_org_id", "sessions", ["org_id"], unique=False, schema="app")
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"], unique=False, schema="app")

    # 10. Login Attempts (Append-only)
    op.create_table(
        "login_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("email", postgresql.CITEXT(), nullable=False, comment="PII: Login attempt email address"),
        sa.Column("ip", postgresql.INET(), nullable=True),
        sa.Column("method", sa.Text(), server_default="password", nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_login_attempts"),
        schema="app",
    )
    op.create_index("ix_login_attempts_email", "login_attempts", ["email"], unique=False, schema="app")

    # 11. Trusted Devices & IP Allowlist
    op.create_table(
        "trusted_devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="CASCADE", name="fk_trusted_devices_user_id_users"), nullable=False),
        sa.Column("device_fingerprint", sa.Text(), nullable=False),
        sa.Column("device_name", sa.Text(), nullable=False, comment="PII: Trusted device user name / label"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_trusted_devices"),
        schema="app",
    )
    op.create_index("ix_trusted_devices_user_id", "trusted_devices", ["user_id"], unique=False, schema="app")

    op.create_table(
        "ip_allowlist",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_ip_allowlist_org_id_organizations"), nullable=False),
        sa.Column("cidr", postgresql.CIDR(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_ip_allowlist"),
        schema="app",
    )
    op.create_index("ix_ip_allowlist_org_id", "ip_allowlist", ["org_id"], unique=False, schema="app")

    # 12. API Keys
    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_api_keys_org_id_organizations"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False, comment="PII: API key friendly name"),
        sa.Column("prefix", sa.Text(), nullable=False),
        sa.Column("key_hash", sa.Text(), nullable=False),
        sa.Column("scopes", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="SET NULL", name="fk_api_keys_created_by_users"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("overlap_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("array_length(scopes, 1) > 0", name="ck_api_keys_scopes_non_empty"),
        sa.PrimaryKeyConstraint("id", name="pk_api_keys"),
        sa.UniqueConstraint("key_hash", name="uq_api_keys_key_hash"),
        schema="app",
    )
    op.create_index("ix_api_keys_org_id", "api_keys", ["org_id"], unique=False, schema="app")
    op.create_index("ix_api_keys_prefix", "api_keys", ["prefix"], unique=False, schema="app")

    # 13. Integrations
    op.create_table(
        "integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_integrations_org_id_organizations"), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="connected", nullable=False),
        sa.Column("account_label", sa.Text(), nullable=True),
        sa.Column("granted_scopes", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("tokens", sa.Text(), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("provider IN ('tally', 'zoho', 'gst_provider', 'whatsapp', 'email', 'drive')", name="ck_integrations_provider"),
        sa.CheckConstraint("status IN ('connected', 'disconnected', 'error', 'pending')", name="ck_integrations_status"),
        sa.PrimaryKeyConstraint("id", name="pk_integrations"),
        schema="app",
    )
    op.create_index("ix_integrations_org_id", "integrations", ["org_id"], unique=False, schema="app")

    # 14. Webhooks & Deliveries
    op.create_table(
        "webhooks",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_webhooks_org_id_organizations"), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("events", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("signing_secret", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("url ~* '^https://'", name="ck_webhooks_url_https"),
        sa.CheckConstraint("status IN ('active', 'disabled')", name="ck_webhooks_status"),
        sa.PrimaryKeyConstraint("id", name="pk_webhooks"),
        schema="app",
    )
    op.create_index("ix_webhooks_org_id", "webhooks", ["org_id"], unique=False, schema="app")

    op.create_table(
        "webhook_deliveries",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("webhook_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.webhooks.id", ondelete="CASCADE", name="fk_webhook_deliveries_webhook_id_webhooks"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_webhook_deliveries_org_id_organizations"), nullable=False),
        sa.Column("event", sa.Text(), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("attempt", sa.Integer(), server_default="1", nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_webhook_deliveries"),
        schema="app",
    )
    op.create_index("ix_webhook_deliveries_webhook_id", "webhook_deliveries", ["webhook_id"], unique=False, schema="app")
    op.create_index("ix_webhook_deliveries_org_id", "webhook_deliveries", ["org_id"], unique=False, schema="app")

    # 15. Inbound Channels, Senders & Quarantined Messages
    op.create_table(
        "inbound_channels",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_inbound_channels_org_id_organizations"), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("address", sa.Text(), nullable=False, comment="PII: Inbound email or channel address"),
        sa.Column("accept_only_allowlisted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("kind IN ('email', 'whatsapp')", name="ck_inbound_channels_kind"),
        sa.PrimaryKeyConstraint("id", name="pk_inbound_channels"),
        schema="app",
    )
    op.create_index("ix_inbound_channels_org_id", "inbound_channels", ["org_id"], unique=False, schema="app")

    op.create_table(
        "inbound_senders",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.inbound_channels.id", ondelete="CASCADE", name="fk_inbound_senders_channel_id_inbound_channels"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_inbound_senders_org_id_organizations"), nullable=False),
        sa.Column("sender_address", sa.Text(), nullable=False, comment="PII: Allowlisted sender email or phone address"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_inbound_senders"),
        schema="app",
    )
    op.create_index("ix_inbound_senders_channel_id", "inbound_senders", ["channel_id"], unique=False, schema="app")
    op.create_index("ix_inbound_senders_org_id", "inbound_senders", ["org_id"], unique=False, schema="app")

    op.create_table(
        "quarantined_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.organizations.id", ondelete="CASCADE", name="fk_quarantined_messages_org_id_organizations"), nullable=False),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app.inbound_channels.id", ondelete="CASCADE", name="fk_quarantined_messages_channel_id_inbound_channels"), nullable=False),
        sa.Column("sender_address", sa.Text(), nullable=False, comment="PII: Quarantined sender email or phone address"),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_quarantined_messages"),
        schema="app",
    )
    op.create_index("ix_quarantined_messages_org_id", "quarantined_messages", ["org_id"], unique=False, schema="app")

    # 16. Attach set_updated_at triggers
    for tbl in ["memberships", "integrations", "webhooks"]:
        op.execute(f"""
            CREATE TRIGGER trg_{tbl}_updated_at
            BEFORE UPDATE ON app.{tbl}
            FOR EACH ROW
            EXECUTE FUNCTION app.set_updated_at();
        """)

    # 17. Seed reference permissions
    op.execute("""
        INSERT INTO app.permissions (code, description) VALUES
        ('invoice.view', 'View invoice data and extract details'),
        ('invoice.edit', 'Upload, edit, and modify invoice fields'),
        ('validation.confirm', 'Override or confirm rule engine validation checks'),
        ('vendor.message', 'Send communication and dispute notices to vendors'),
        ('recon.manage', 'Execute and resolve GSTR-2B reconciliation runs'),
        ('monitoring.view', 'View monitoring dashboards and extraction latency'),
        ('security.manage', 'Manage members, roles, API keys, and security settings'),
        ('report.export', 'Export ITC and tax compliance audit reports'),
        ('billing.manage', 'Manage organization subscription and billing plan');
    """)

    # 18. Seed built-in roles
    owner_id = uuid.uuid4()
    admin_id = uuid.uuid4()
    accountant_id = uuid.uuid4()
    reviewer_id = uuid.uuid4()
    auditor_id = uuid.uuid4()

    op.execute(f"""
        INSERT INTO app.roles (id, org_id, name, builtin, description) VALUES
        ('{owner_id}', NULL, 'Owner', true, 'Full administrative ownership of the workspace and billing'),
        ('{admin_id}', NULL, 'Admin', true, 'Workspace administrator with security and rule configuration'),
        ('{accountant_id}', NULL, 'Accountant', true, 'Finance operations, ITC reconciliation, and invoice edits'),
        ('{reviewer_id}', NULL, 'Reviewer', true, 'Invoice verification and exception review'),
        ('{auditor_id}', NULL, 'Auditor', true, 'Read-only access for internal or statutory audit');
    """)

    # 19. Seed role permissions matrix
    # Owner gets all permissions at 'admin'
    op.execute(f"""
        INSERT INTO app.role_permissions (role_id, permission_code, level)
        SELECT '{owner_id}', code, 'admin' FROM app.permissions;
    """)

    # Admin gets all except billing.manage
    op.execute(f"""
        INSERT INTO app.role_permissions (role_id, permission_code, level)
        SELECT '{admin_id}', code, 'admin' FROM app.permissions WHERE code <> 'billing.manage';
        INSERT INTO app.role_permissions (role_id, permission_code, level) VALUES
        ('{admin_id}', 'billing.manage', 'none');
    """)

    # Accountant permissions
    op.execute(f"""
        INSERT INTO app.role_permissions (role_id, permission_code, level) VALUES
        ('{accountant_id}', 'invoice.view', 'admin'),
        ('{accountant_id}', 'invoice.edit', 'edit'),
        ('{accountant_id}', 'validation.confirm', 'edit'),
        ('{accountant_id}', 'recon.manage', 'admin'),
        ('{accountant_id}', 'vendor.message', 'edit'),
        ('{accountant_id}', 'report.export', 'admin'),
        ('{accountant_id}', 'monitoring.view', 'view'),
        ('{accountant_id}', 'security.manage', 'none'),
        ('{accountant_id}', 'billing.manage', 'none');
    """)

    # Reviewer permissions
    op.execute(f"""
        INSERT INTO app.role_permissions (role_id, permission_code, level) VALUES
        ('{reviewer_id}', 'invoice.view', 'view'),
        ('{reviewer_id}', 'invoice.edit', 'none'),
        ('{reviewer_id}', 'validation.confirm', 'edit'),
        ('{reviewer_id}', 'recon.manage', 'view'),
        ('{reviewer_id}', 'vendor.message', 'view'),
        ('{reviewer_id}', 'report.export', 'view'),
        ('{reviewer_id}', 'monitoring.view', 'view'),
        ('{reviewer_id}', 'security.manage', 'none'),
        ('{reviewer_id}', 'billing.manage', 'none');
    """)

    # Auditor (read-only)
    op.execute(f"""
        INSERT INTO app.role_permissions (role_id, permission_code, level) VALUES
        ('{auditor_id}', 'invoice.view', 'view'),
        ('{auditor_id}', 'invoice.edit', 'none'),
        ('{auditor_id}', 'validation.confirm', 'none'),
        ('{auditor_id}', 'recon.manage', 'view'),
        ('{auditor_id}', 'vendor.message', 'none'),
        ('{auditor_id}', 'report.export', 'view'),
        ('{auditor_id}', 'monitoring.view', 'view'),
        ('{auditor_id}', 'security.manage', 'view'),
        ('{auditor_id}', 'billing.manage', 'none');
    """)

    # 20. Database rule: Prevent removing or demoting the last active Owner of an organization
    op.execute("""
        CREATE OR REPLACE FUNCTION app.check_last_owner()
        RETURNS TRIGGER AS $$
        DECLARE
            v_owner_role_id uuid;
            v_remaining_owners integer;
        BEGIN
            -- If system session is performing administrative cleanup or org deletion, bypass check
            IF current_setting('app.is_system', true) = 'true' THEN
                RETURN COALESCE(NEW, OLD);
            END IF;

            SELECT id INTO v_owner_role_id FROM app.roles WHERE name = 'Owner' AND builtin = true LIMIT 1;

            IF (TG_OP = 'DELETE' AND OLD.role_id = v_owner_role_id AND OLD.status = 'active')
               OR (TG_OP = 'UPDATE' AND OLD.role_id = v_owner_role_id AND OLD.status = 'active'
                   AND (NEW.role_id <> v_owner_role_id OR NEW.status <> 'active')) THEN

                SELECT COUNT(*) INTO v_remaining_owners
                FROM app.memberships
                WHERE org_id = OLD.org_id
                  AND role_id = v_owner_role_id
                  AND status = 'active'
                  AND id <> OLD.id;

                IF v_remaining_owners = 0 THEN
                    RAISE EXCEPTION 'Cannot remove or demote the last active Owner of an organization'
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;


        CREATE TRIGGER trg_memberships_last_owner
        BEFORE UPDATE OR DELETE ON app.memberships
        FOR EACH ROW
        EXECUTE FUNCTION app.check_last_owner();
    """)

    # 21. Enable and Force Row-Level Security on all app tables created
    all_tables = [
        "users",
        "permissions",
        "roles",
        "role_permissions",
        "memberships",
        "separation_rules",
        "invitations",
        "mfa_factors",
        "recovery_codes",
        "sessions",
        "login_attempts",
        "trusted_devices",
        "ip_allowlist",
        "api_keys",
        "integrations",
        "webhooks",
        "webhook_deliveries",
        "inbound_channels",
        "inbound_senders",
        "quarantined_messages",
    ]
    for tbl in all_tables:
        op.execute(f"ALTER TABLE app.{tbl} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE app.{tbl} FORCE ROW LEVEL SECURITY;")

    # 22. Define RLS Policies for tenant isolation and membership security

    # Standard tenant-owned tables
    tenant_owned_tables = [
        "memberships",
        "separation_rules",
        "invitations",
        "sessions",
        "ip_allowlist",
        "api_keys",
        "integrations",
        "webhooks",
        "webhook_deliveries",
        "inbound_channels",
        "inbound_senders",
        "quarantined_messages",
    ]
    for tbl in tenant_owned_tables:
        op.execute(f"""
            CREATE POLICY org_isolation_policy ON app.{tbl}
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (
                current_setting('app.is_system', true) = 'true'
                OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
            )
            WITH CHECK (
                current_setting('app.is_system', true) = 'true'
                OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
            );
        """)

    # Roles policy: visible if built-in (org_id IS NULL) or belongs to current tenant
    op.execute("""
        CREATE POLICY roles_isolation_policy ON app.roles
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
            current_setting('app.is_system', true) = 'true'
            OR org_id IS NULL
            OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
        )
        WITH CHECK (
            current_setting('app.is_system', true) = 'true'
            OR (org_id IS NOT NULL AND org_id = NULLIF(current_setting('app.org_id', true), '')::uuid)
        );
    """)

    # Permissions reference policy: readable by all
    op.execute("""
        CREATE POLICY permissions_read_policy ON app.permissions
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (true)
        WITH CHECK (current_setting('app.is_system', true) = 'true');
    """)

    # Role permissions policy
    op.execute("""
        CREATE POLICY role_permissions_policy ON app.role_permissions
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
            current_setting('app.is_system', true) = 'true'
            OR role_id IN (
                SELECT id FROM app.roles
                WHERE org_id IS NULL OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
            )
        )
        WITH CHECK (
            current_setting('app.is_system', true) = 'true'
            OR role_id IN (
                SELECT id FROM app.roles
                WHERE org_id IS NOT NULL AND org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
            )
        );
    """)

    # Users policy: visible if current user, or member of the active organization workspace
    op.execute("""
        CREATE POLICY users_isolation_policy ON app.users
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
            current_setting('app.is_system', true) = 'true'
            OR id = NULLIF(current_setting('app.user_id', true), '')::uuid
            OR id IN (
                SELECT user_id FROM app.memberships
                WHERE org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
            )
        )
        WITH CHECK (
            current_setting('app.is_system', true) = 'true'
            OR id = NULLIF(current_setting('app.user_id', true), '')::uuid
        );
    """)

    # Login attempts policy
    op.execute("""
        CREATE POLICY login_attempts_policy ON app.login_attempts
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
            current_setting('app.is_system', true) = 'true'
            OR email = NULLIF(current_setting('app.user_email', true), '')
        )
        WITH CHECK (true);
    """)

    # User personal factors policies
    for tbl in ["mfa_factors", "recovery_codes", "trusted_devices"]:
        op.execute(f"""
            CREATE POLICY user_personal_policy ON app.{tbl}
            AS PERMISSIVE FOR ALL TO PUBLIC
            USING (
                current_setting('app.is_system', true) = 'true'
                OR user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
            )
            WITH CHECK (
                current_setting('app.is_system', true) = 'true'
                OR user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
            );
        """)

    # 23. Grant permissions to folio_app role
    op.execute("""
        GRANT ALL ON ALL TABLES IN SCHEMA app TO folio_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO folio_app;
    """)


def downgrade() -> None:
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS trg_memberships_last_owner ON app.memberships;")
    op.execute("DROP FUNCTION IF EXISTS app.check_last_owner();")
    for tbl in ["memberships", "integrations", "webhooks"]:
        op.execute(f"DROP TRIGGER IF EXISTS trg_{tbl}_updated_at ON app.{tbl};")

    # Drop tables in reverse order
    tables = [
        "quarantined_messages",
        "inbound_senders",
        "inbound_channels",
        "webhook_deliveries",
        "webhooks",
        "integrations",
        "api_keys",
        "ip_allowlist",
        "trusted_devices",
        "login_attempts",
        "sessions",
        "recovery_codes",
        "mfa_factors",
        "invitations",
        "separation_rules",
        "memberships",
        "role_permissions",
        "roles",
        "permissions",
        "users",
    ]
    for tbl in tables:
        op.execute(f"DROP TABLE IF EXISTS app.{tbl} CASCADE;")
