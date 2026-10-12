# Folio Database Conventions

## 1. Schema Separation
- **`app` schema**: Tenant data protected by Row-Level Security (`ENABLE` and `FORCE ROW LEVEL SECURITY`). Every business table must possess `org_id uuid not null references app.organizations(id)` and an active RLS policy.
- **`platform` schema**: Shared operational data (e.g. model registry, global telemetry, system incidents). No `org_id`.

## 2. Model Mixins & Primary Keys
- **Primary Keys**: Always UUID, generated via `UuidPk` mixin with `default=uuid.uuid4` and `server_default=func.gen_random_uuid()`.
- **Timestamps**: `Timestamps` mixin provides:
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()` with trigger `app.set_updated_at()`
- **Tenant Ownership**: `TenantOwned` mixin provides:
  - `org_id uuid not null references app.organizations(id)` with index.

## 3. Constraint & Index Naming Convention
All constraints and indexes must conform to the standard SQLAlchemy naming convention:
```python
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
```

## 4. Custom Postgres Domains
Data validation domains defined in the database:
- `gstin_t`: 15-character GSTIN with regex format `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`
- `hsn_t`: 2 to 8 digit HSN/SAC code with regex format `^[0-9]{2,8}$`
- `pan_t`: 10-character Income Tax PAN with regex format `^[A-Z]{5}[0-9]{4}[A-Z]{1}$`
- `state_code_t`: 2-digit Indian State / UT code with regex format `^[0-9]{2}$`

## 5. Numeric & Financial Data Types
- **Currency / Amounts**: Strictly `NUMERIC(18, 2)` (never `float` or `real`).
- **Tax Percentages**: Strictly `NUMERIC(5, 2)` (e.g., `18.00`, `28.00`, `0.25`).
- **Quantities**: `NUMERIC(14, 4)` where unit decimals are required.

## 6. PII Column Documentation
Any column that stores personal data (including phone, email, contact name, address, or bank account numbers) must include a column comment beginning with `PII:`.
This convention is strictly validated by `test_conventions.py`.

## 7. Tenancy & Session Isolation
- Application queries must execute inside a `tenant_session(engine, org_id, user_id, request_id)` context.
- Inside the transaction, connection variables are set using `SET LOCAL`:
  - `SET LOCAL app.org_id = '<uuid>';`
  - `SET LOCAL app.user_id = '<uuid>';`
  - `SET LOCAL app.request_id = '<id>';`
- RLS policies filter rows by matching `org_id = current_setting('app.org_id')::uuid`.
- System jobs execute inside `system_session(engine, job_name)` setting `SET LOCAL app.is_system = 'true';`.

## 8. Pagination Standard
All list repositories must use keyset pagination based on `(created_at, id)` cursors.
`OFFSET` pagination on high-volume business tables is prohibited.
