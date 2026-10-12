# Folio Database Layer (`folio_db`)

The system of record for Folio: tenants, invoices, rules, reconciliation, vendor risk, and immutable audit trails.

**Core Principle:** Data integrity and tenant isolation first, speed second.

---

## 1. Stack & Specifications
- **Database:** PostgreSQL 16+ (tested against PostgreSQL 18 with Row-Level Security)
- **ORM / Migrations:** SQLAlchemy 2.0 (fully typed `Mapped[...]`), Alembic
- **Driver:** `psycopg` 3 (`psycopg[binary]`)
- **Validation:** Pydantic v2, custom Postgres `DOMAIN` types
- **Isolation:** Row-Level Security (`ENABLE` and `FORCE ROW LEVEL SECURITY`) with `SET LOCAL` session variables

---

## 2. Directory Layout
```
database/
  pyproject.toml         # Package definition and dependencies
  docker-compose.yml     # Local PostgreSQL 16 container definition
  Makefile               # Standard dev commands (db-up, migrate, test, lint)
  alembic.ini            # Alembic configuration
  .env.example           # Environment variable template
  docs/
    conventions.md       # RLS, naming conventions, domain and PII rules
  src/folio_db/
    config.py            # Environment-aware settings
    clock.py             # UTC time provider
    types.py             # Money (NUMERIC 18,2), TaxRate (NUMERIC 5,2), regex domains
    errors.py            # Domain exceptions (NotFoundError, ConflictError, etc.)
    base.py              # DeclarativeBase, naming convention, mixins (UuidPk, Timestamps, TenantOwned)
    session.py           # tenant_session, system_session, Keyset pagination
    models/
      identity.py        # Organization model (app.organizations)
    repositories/
      base.py            # Generic typed BaseRepository
      organizations.py   # OrganizationRepository
    services/            # Multi-aggregate transactions
    adapters/            # ML service protocol adapters
  migrations/
    env.py
    script.py.mako
    versions/
      0001_foundation.py # Initial schemas, domains, trigger, organizations & RLS
  tests/
    conftest.py          # Real PostgreSQL test fixtures
    factories.py         # Synthetic organization generator
    test_foundation.py   # Migrations cycle, CRUD, triggers, domains, pagination
    test_conventions.py  # RLS verification and PII column comment enforcement
    test_tenancy.py      # Tenant isolation & cross-tenant access denial
```

---

## 3. Quickstart

### Environment Setup
```bash
# 1. Copy environment configuration
cp .env.example .env

# 2. Start PostgreSQL (or use existing local service)
make db-up
# Alternatively: docker compose up -d

# 3. Run migrations
make migrate
# Alternatively: alembic upgrade head

# 4. Execute test suite against real Postgres
make test
# Alternatively: pytest -v
```

---

## 4. Key Tenancy Guarantees
1. **Tenant Sessions**: All application queries execute in `tenant_session(engine, org_id)` which runs:
   ```sql
   SET LOCAL app.org_id = '<uuid>';
   SET LOCAL app.user_id = '<uuid>';
   SET LOCAL app.is_system = 'false';
   ```
2. **Postgres RLS**: Every tenant table in `app` has `FORCE ROW LEVEL SECURITY` enabled. Queries automatically filter to the current tenant even if application code omits `WHERE org_id = ...`.
3. **Audit Readiness**: Cryptographic timestamps, immutable history tables, and strict PII annotations (`PII:` column comments).

## 5. Documents, invoices, review, and traces

`folio_db.repositories.invoices` contains tenant-scoped `InvoiceRepo`, `ReviewRepo`,
and `TraceRepo` implementations. This package is installed editable in the local
Python environment; its repository code imports the Pydantic contracts from `folio_ml`.
Do not create a parallel copy of those contracts.

Register the uploaded source as an `app.files` row before calling
`InvoiceRepo.create_from_extraction(contract)`. Creation uses the tenant-scoped
original-file hash, stores invoice/line/current-field rows in the active transaction,
and returns the existing invoice on re-upload. When a `ReviewDecision` is supplied,
the repository records a review task when the decision routes the invoice to review.
`get_review_bundle` returns the original ML contract, field confidence/boxes, and
chronological edit history. `apply_edit` appends the prior and replacement values;
it recalculates totals only when `recompute_totals=True`.

`ReviewRepo` creates, assigns, completes, and monitors tasks. Queue age buckets are
under one day, one to three days, and over three days. `TraceRepo` records stage
attempts and durations and returns an invoice waterfall.

Migration `0004_invoice_workflow_guards` enforces one invoice per registered file,
protects files and field/status history from mutation by `folio_app`, and removes the
implicit `closed -> reconciled` reopen transition. Migration `0005_party_pii_comments`
labels the sensitive party columns required by the PII convention. Migration
`0006_invoice_initial_status` requires new invoices to start as `uploaded` or
`needs_review`. Migration `0007_invoice_party_domains` applies the shared GSTIN,
PAN, HSN, and state-code domains to invoice and party columns. The referenced
Project Workflow document is not present in this repository; the migration therefore
preserves the existing forward transitions and does not add undocumented paths.
Money values are validated as finite `Decimal` values with at most two fractional
digits in repository writes; PostgreSQL `NUMERIC(18,2)` itself rounds excess
fractional digits on direct SQL writes.

Run the database tests against PostgreSQL with `make migrate test lint` from the
[database/](C:/Users/becds/OneDrive/Documents/folio/database) folder.
The ML service's `make setup` installs both the database package and the ML package
in editable mode.
