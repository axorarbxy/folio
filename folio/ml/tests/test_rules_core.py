"""Tests for rule engine core framework, versioned data loaders, checks 1-6, and verdict."""

from decimal import Decimal

from hypothesis import given
from hypothesis import strategies as st

from folio_ml.contracts.base import Field
from folio_ml.contracts.invoice import Invoice, InvoiceTotals, LineItem
from folio_ml.datagen.generator import generate_clean_invoice
from folio_ml.rules.base import RuleContext
from folio_ml.rules.checks_core import (
    CheckGstinFormatChecksum,
    CheckGstinStateMatchesAddress,
    CheckHsnRateMatch,
    CheckLineMath,
    CheckTaxMath,
    CheckTaxTypeVsPlaceOfSupply,
)
from folio_ml.rules.loader import HsnRateEntry, load_rules_data, match_hsn_rate
from folio_ml.rules.registry import RuleRegistry
from folio_ml.rules.verdict import compute_verdict


def _make_deterministic_invoice(hsn: str = "7318", rate_pct: Decimal = Decimal("18.00")) -> Invoice:
    taxable = Decimal("1000.00")
    tax = taxable * rate_pct / Decimal("100")
    half_tax = tax / Decimal("2")
    item = LineItem(
        description=Field(value="Fastener Item"),
        hsn=Field(value=hsn),
        qty=Field(value=Decimal("10")),
        rate=Field(value=Decimal("100.00")),
        taxable=Field(value=taxable),
        cgst_pct=Field(value=rate_pct / Decimal("2")),
        sgst_pct=Field(value=rate_pct / Decimal("2")),
        igst_pct=Field(value=Decimal("0.00")),
        cess_pct=Field(value=Decimal("0.00")),
    )
    totals = InvoiceTotals(
        taxable_amount=Field(value=taxable),
        cgst_amount=Field(value=half_tax),
        sgst_amount=Field(value=half_tax),
        igst_amount=Field(value=Decimal("0.00")),
        cess_amount=Field(value=Decimal("0.00")),
        total_amount=Field(value=taxable + tax),
    )
    return Invoice(
        id="INV-TEST-001",
        source_file_hash="hash123",
        supplier_name=Field(value="Supplier Pvt Ltd"),
        supplier_gstin=Field(value="27AABCS1429B1ZB"),
        supplier_state=Field(value="27"),
        buyer_name=Field(value="Buyer Pvt Ltd"),
        buyer_gstin=Field(value="27AAACW1234A1ZV"),
        buyer_state=Field(value="27"),
        number=Field(value="INV-001"),
        date=Field(value="2024-05-10"),
        place_of_supply=Field(value="27"),
        reverse_charge=Field(value=False),
        irn=Field(value=None),
        items=[item],
        totals=totals,
        status="draft",
    )


def test_data_loader_and_schema() -> None:
    bundle = load_rules_data()
    assert len(bundle.states) >= 30
    assert len(bundle.rates) >= 10
    assert "e_invoice_turnover_threshold_cr" in bundle.thresholds

    # Hard rule: verify that all seeded sample entries have verified: False
    for state in bundle.states.values():
        assert isinstance(state.verified, bool)
    for rate in bundle.rates:
        assert isinstance(rate.verified, bool)
        assert rate.verified is False, "Seeded sample rate must have verified: False until human signoff"


def test_hsn_longest_prefix_matching() -> None:
    rates = [
        HsnRateEntry(
            hsn_prefix="7318",
            description="Fasteners",
            rate_pct=Decimal("18.00"),
            effective_from="2017-07-01",
            source_url="",
            verified=False,
        ),
        HsnRateEntry(
            hsn_prefix="731815",
            description="Specific Threaded Fasteners",
            rate_pct=Decimal("18.00"),
            effective_from="2017-07-01",
            source_url="",
            verified=False,
        ),
    ]

    # 6-digit should match 6-digit prefix first
    m6 = match_hsn_rate("73181500", rates)
    assert m6 is not None and m6.hsn_prefix == "731815"

    # 8-digit with unmatched 6-digit should fallback to 4-digit
    m4 = match_hsn_rate("73182200", rates)
    assert m4 is not None and m4.hsn_prefix == "7318"

    # Unknown code returns None
    assert match_hsn_rate("010101", rates) is None


def test_unverified_rate_never_yields_safe_verdict() -> None:
    """HARD RULE: An unverified rate entry must never produce a 'safe' verdict."""
    inv = _make_deterministic_invoice(hsn="7318", rate_pct=Decimal("18.00"))
    bundle = load_rules_data()
    # All seeded rates have verified: False
    ctx = RuleContext(bundle=bundle)

    rule = CheckHsnRateMatch()
    res = rule.run(inv, ctx)

    # Must be inconclusive, never pass!
    assert res.status == "inconclusive"
    assert "unverified" in res.why_it_matters.lower()

    # Verdict must be needs_review, never safe!
    verdict = compute_verdict(inv, [res], [rule])
    assert verdict.status == "needs_review"
    assert verdict.status != "safe"


def test_verified_rate_yields_pass() -> None:
    inv = _make_deterministic_invoice(hsn="7318", rate_pct=Decimal("18.00"))
    bundle = load_rules_data()

    # Mark rates verified for test scenario
    verified_rates = [
        r.model_copy(update={"verified": True}) for r in bundle.rates
    ]
    bundle_verified = bundle.model_copy(update={"rates": verified_rates})
    ctx = RuleContext(bundle=bundle_verified)

    rule = CheckHsnRateMatch()
    res = rule.run(inv, ctx)
    assert res.status == "pass"


def test_check_1_gstin_format_checksum() -> None:
    inv = generate_clean_invoice(seed=102)
    ctx = RuleContext()
    rule = CheckGstinFormatChecksum()

    # Clean invoice passes
    res = rule.run(inv, ctx)
    assert res.status == "pass"

    # Corrupt supplier GSTIN check char
    corrupted_inv = inv.model_copy(deep=True)
    corrupted_inv.supplier_gstin.value = "27AABCS1429B1Z0"  # Invalid checksum
    res_corrupt = rule.run(corrupted_inv, ctx)
    assert res_corrupt.status == "fail"
    assert "VERIFY_GSTIN_ON_PORTAL" in res_corrupt.fixes


def test_check_2_gstin_state_matches_address() -> None:
    inv = generate_clean_invoice(seed=103)
    ctx = RuleContext()
    rule = CheckGstinStateMatchesAddress()

    # Clean passes
    assert rule.run(inv, ctx).status == "pass"

    # Mismatch supplier state
    mismatched = inv.model_copy(deep=True)
    mismatched.supplier_state.value = "07"  # Delhi, while GSTIN starts with 27
    assert rule.run(mismatched, ctx).status == "fail"


def test_check_3_tax_type_vs_place_of_supply() -> None:
    ctx = RuleContext()
    rule = CheckTaxTypeVsPlaceOfSupply()

    # Intra-state clean invoice
    intra_inv = generate_clean_invoice(seed=104)
    intra_inv.supplier_state.value = "27"
    intra_inv.place_of_supply.value = "27"
    intra_inv.totals.cgst_amount.value = Decimal("900.00")
    intra_inv.totals.sgst_amount.value = Decimal("900.00")
    intra_inv.totals.igst_amount.value = Decimal("0.00")
    assert rule.run(intra_inv, ctx).status == "pass"

    # Intra-state wrongly charged IGST
    intra_wrong = intra_inv.model_copy(deep=True)
    intra_wrong.totals.cgst_amount.value = Decimal("0.00")
    intra_wrong.totals.sgst_amount.value = Decimal("0.00")
    intra_wrong.totals.igst_amount.value = Decimal("1800.00")
    res_wrong = rule.run(intra_wrong, ctx)
    assert res_wrong.status == "fail"
    assert "Intra-state" in res_wrong.expected

    # SEZ / other territory (97) returns inconclusive
    sez_inv = intra_inv.model_copy(deep=True)
    sez_inv.place_of_supply.value = "97"
    assert rule.run(sez_inv, ctx).status == "inconclusive"


def test_check_5_and_6_math_rules() -> None:
    inv = generate_clean_invoice(seed=105)
    ctx = RuleContext()
    line_rule = CheckLineMath()
    tax_rule = CheckTaxMath()

    assert line_rule.run(inv, ctx).status == "pass"
    assert tax_rule.run(inv, ctx).status == "pass"

    # Line math error
    bad_line_inv = inv.model_copy(deep=True)
    bad_line_inv.items[0].taxable.value += Decimal("50.00")
    assert line_rule.run(bad_line_inv, ctx).status == "fail"

    # Tax math error
    bad_total_inv = inv.model_copy(deep=True)
    bad_total_inv.totals.total_amount.value += Decimal("100.00")
    assert tax_rule.run(bad_total_inv, ctx).status == "fail"


def test_registry_defensive_crash_handling() -> None:
    """Verifies that an unhandled crash inside a rule yields inconclusive, never a silent pass."""
    inv = generate_clean_invoice(seed=106)

    class CrashingRule(CheckLineMath):
        def run(self, invoice: object, ctx: object) -> object:
            raise RuntimeError("Simulated crash")

    crashing_registry = RuleRegistry(rules=[CrashingRule()])
    verdict = crashing_registry.validate(inv)
    assert verdict.status == "needs_review"
    assert len(verdict.checks) == 1
    assert verdict.checks[0].status == "inconclusive"
    assert "Execution error: RuntimeError" in verdict.checks[0].found


@given(
    qty=st.decimals(min_value=Decimal("1.0"), max_value=Decimal("100.0"), places=2),
    rate=st.decimals(min_value=Decimal("1.0"), max_value=Decimal("1000.0"), places=2),
)
def test_hypothesis_line_math_property(qty: Decimal, rate: Decimal) -> None:
    expected_taxable = (qty * rate).quantize(Decimal("0.01"))
    item = LineItem(
        description=Field(value="Test Item"),
        qty=Field(value=qty),
        rate=Field(value=rate),
        taxable=Field(value=expected_taxable),
    )
    inv = generate_clean_invoice(seed=107)
    inv.items = [item]
    res = CheckLineMath().run(inv, RuleContext())
    assert res.status == "pass"
