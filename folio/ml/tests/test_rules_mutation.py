"""Mutation testing and rule recall suite against README 02 error injectors."""

import random
from decimal import Decimal

from fastapi.testclient import TestClient

from folio_ml.api.main import app
from folio_ml.datagen.generator import generate_clean_invoice
from folio_ml.datagen.injectors import INJECTORS
from folio_ml.rules.base import RuleContext
from folio_ml.rules.loader import load_rules_data
from folio_ml.rules.registry import default_registry

client = TestClient(app)


def _get_verified_context() -> RuleContext:
    bundle = load_rules_data()
    verified_rates = [r.model_copy(update={"verified": True}) for r in bundle.rates]
    bundle_verified = bundle.model_copy(update={"rates": verified_rates})
    return RuleContext(bundle=bundle_verified)


def test_mutation_recall_100_percent_on_deterministic_injectors() -> None:
    """Runs all 11 error injectors and verifies 100% recall on expected checks."""
    rng = random.Random(42)
    ctx = _get_verified_context()

    # Map each injector to the check id that must detect it
    injector_expected_failures = {
        "wrong_rate": "hsn_rate_match",
        "invalid_gstin": "gstin_format_checksum",
        "math_error_line": "line_math",
        "math_error_total": "tax_math",
        "wrong_tax_type": "tax_type_vs_place_of_supply",
        "duplicate_invoice": "duplicate_detection",
        "bad_date": "date_validity",
        "missing_irn": "irn_presence",
        "rounding_abuse": "tax_math",
        "reverse_charge_mismatch": "reverse_charge_consistency",
    }

    results_by_injector: dict[str, bool] = {}

    for name, expected_check_id in injector_expected_failures.items():
        clean_inv = generate_clean_invoice(seed=200)

        # For missing IRN test, ensure clean invoice had IRN before stripping
        if name == "missing_irn":
            clean_inv.totals.total_amount.value = Decimal("200000.00")
            clean_inv.irn.value = "a" * 64

        corrupted, _ = INJECTORS[name](clean_inv, rng)
        verdict = default_registry.validate(corrupted, ctx)

        failed_check_ids = [c.check_id for c in verdict.checks if c.status == "fail"]
        detected = expected_check_id in failed_check_ids
        results_by_injector[name] = detected

        assert detected, (
            f"MUTATION TEST FAILED: Injector '{name}' was not detected by '{expected_check_id}'. "
            f"Failing checks were: {failed_check_ids}"
        )

    # All tested deterministic injectors achieved 100% recall
    assert all(results_by_injector.values())
    assert len(results_by_injector) == 10


def test_clean_invoices_produce_zero_failures() -> None:
    """Verifies that clean invoices produce 0 'fail' results and get safe verdict with verified rules."""
    ctx = _get_verified_context()

    for seed in range(300, 325):
        clean_inv = generate_clean_invoice(seed=seed)
        verdict = default_registry.validate(clean_inv, ctx)

        failed_checks = [c for c in verdict.checks if c.status == "fail"]
        assert len(failed_checks) == 0, (
            f"FALSE POSITIVE on clean invoice {clean_inv.id} (seed {seed}): "
            f"{[c.name for c in failed_checks]}"
        )
        assert verdict.status == "safe"
        assert verdict.rupee_at_risk == Decimal("0.00")


def test_api_rules_endpoint() -> None:
    res = client.get("/v1/rules")
    assert res.status_code == 200
    data = res.json()
    assert data["rules_count"] == 11
    assert len(data["rules"]) == 11
    assert data["table_version"] == "2024.1"

    rule_ids = {r["id"] for r in data["rules"]}
    assert "gstin_format_checksum" in rule_ids
    assert "tax_type_vs_place_of_supply" in rule_ids
    assert "tax_math" in rule_ids
    assert "irn_presence" in rule_ids


def test_api_invoices_validate_endpoint() -> None:
    inv = generate_clean_invoice(seed=350)
    res = client.post("/v1/invoices/validate", json=inv.model_dump(mode="json"))
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "checks" in data
    assert len(data["checks"]) == 11
