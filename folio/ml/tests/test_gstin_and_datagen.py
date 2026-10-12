"""Tests for GSTIN validation, profiles, catalog, and synthetic generator."""

import random
from decimal import Decimal

from folio_ml.datagen.catalog import CATALOG
from folio_ml.datagen.generator import generate_clean_invoice, render_invoice_image
from folio_ml.datagen.layouts import LayoutType
from folio_ml.datagen.profiles import PROFILES
from folio_ml.utils.gstin import (
    GSTIN_CHARS,
    compute_check_char,
    generate_synthetic_gstin,
    is_valid_format,
    is_valid_gstin,
    make_gstin,
)


def test_gstin_format_validation() -> None:
    assert is_valid_format("27AABCS1429B1ZB") is True
    assert is_valid_format("27AABCS1429B1Z") is False  # 14 chars
    assert is_valid_format("27AABCS1429B1ZBB") is False  # 16 chars
    assert is_valid_format("A7AABCS1429B1ZB") is False  # first char not digit


def test_gstin_check_character_and_single_char_flip() -> None:
    rng = random.Random(42)
    for _ in range(20):
        gstin = generate_synthetic_gstin(rng=rng)
        assert is_valid_gstin(gstin) is True

        # Flipping any single character must break validity
        for idx in range(15):
            orig_char = gstin[idx]
            alt_chars = [c for c in GSTIN_CHARS if c != orig_char]
            flipped_char = rng.choice(alt_chars)
            corrupted = gstin[:idx] + flipped_char + gstin[idx + 1:]
            assert is_valid_gstin(corrupted) is False, f"Flipped char at {idx} unexpectedly valid: {corrupted}"


def test_make_gstin_consistency() -> None:
    pan = "AABCS1429B"
    gstin = make_gstin("27", pan, 1)
    assert gstin.startswith("27AABCS1429B1Z")
    assert is_valid_gstin(gstin) is True
    assert compute_check_char(gstin[:14]) == gstin[14]


def test_profiles_meet_spec() -> None:
    assert len(PROFILES) == 40
    states = {p["state_code"] for p in PROFILES}
    assert len(states) >= 8, f"Expected at least 8 states, got {len(states)}"

    for p in PROFILES:
        assert is_valid_gstin(p["gstin"]) is True
        # Verify bank-detail-free footers
        footer_lower = p["footer"].lower()
        for forbidden in ["ifsc", "bank account", "a/c no", "swift"]:
            assert forbidden not in footer_lower


def test_catalog_meets_spec() -> None:
    assert len(CATALOG) == 60
    for item in CATALOG:
        assert item["generator_only"] is True
        assert len(item["hsn_sac"]) in (4, 6, 8)
        assert isinstance(item["typical_price"], Decimal)
        assert isinstance(item["rate_pct"], Decimal)


def test_invoice_generator_and_layouts() -> None:
    layouts: list[LayoutType] = [
        "simple",
        "tabular",
        "thermal_receipt",
        "two_column",
        "regional_mixed",
    ]

    for idx, layout in enumerate(layouts):
        inv = generate_clean_invoice(seed=100 + idx, layout_type=layout)
        assert inv.id.startswith("INV-")
        assert is_valid_gstin(inv.supplier_gstin.value)
        assert is_valid_gstin(inv.buyer_gstin.value)

        # Tax rules verification
        if inv.supplier_state.value == inv.buyer_state.value:
            assert inv.totals.igst_amount.value == Decimal("0.00")
            assert inv.totals.cgst_amount.value >= Decimal("0.00")
            assert inv.totals.sgst_amount.value >= Decimal("0.00")
        else:
            assert inv.totals.cgst_amount.value == Decimal("0.00")
            assert inv.totals.sgst_amount.value == Decimal("0.00")
            assert inv.totals.igst_amount.value >= Decimal("0.00")

        # Sum of parts matches total within tolerance
        calculated_sum = (
            inv.totals.taxable_amount.value
            + inv.totals.cgst_amount.value
            + inv.totals.sgst_amount.value
            + inv.totals.igst_amount.value
            + inv.totals.cess_amount.value
        )
        diff = abs(calculated_sum - inv.totals.total_amount.value)
        assert diff <= Decimal("0.02")

        # Render image
        img = render_invoice_image(inv, layout_type=layout)
        assert img.size == (800, 1100)
