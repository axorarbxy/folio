"""Test entity factories producing realistic synthetic Indian GST entities."""

import random
import uuid
from folio_db.models.identity import Organization

SAMPLE_GSTINS = [
    ("27AABCU9603R1ZM", "27", "Acme Precision Engineering Pvt Ltd", "Acme Precision Engineering Private Limited"),
    ("29AABCB1234F1Z5", "29", "Bangalore Tech Solutions LLP", "Bangalore Tech Solutions Limited Liability Partnership"),
    ("07AAAAA0000A1Z5", "07", "Delhi Office Mart Supplies", "Delhi Office Mart Supplies Private Limited"),
    ("33AAACB5678C1Z2", "33", "Tamil Nadu Industrial Fasteners", "Tamil Nadu Fasteners Pvt Ltd"),
    ("06AAACR9876Q1Z3", "06", "Haryana Logistics Hub", "Haryana Logistics Hub Private Limited"),
]


def create_organization_factory(
    session,
    name: str | None = None,
    legal_name: str | None = None,
    gstin: str | None = None,
    state_code: str | None = None,
    filing_frequency: str = "monthly",
    plan: str = "starter",
    status: str = "active",
) -> Organization:
    """Instantiate and persist a valid Organization entity."""
    if not gstin:
        template = random.choice(SAMPLE_GSTINS)
        gstin = template[0]
        state_code = template[1]
        name = name or template[2]
        legal_name = legal_name or template[3]
    else:
        state_code = state_code or gstin[:2]
        name = name or "Test Enterprise Solutions"
        legal_name = legal_name or "Test Enterprise Solutions Pvt Ltd"

    org = Organization(
        id=uuid.uuid4(),
        name=name,
        legal_name=legal_name,
        gstin=gstin,
        state_code=state_code,
        filing_frequency=filing_frequency,
        plan=plan,
        status=status,
    )
    session.add(org)
    session.flush()
    return org
