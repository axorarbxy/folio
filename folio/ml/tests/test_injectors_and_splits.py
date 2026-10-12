"""Tests for error injectors, visual degradation, and frozen manifest integrity guard."""

import hashlib
import json
import random
from pathlib import Path

from PIL import Image

from folio_ml.datagen.degradation import apply_degradation
from folio_ml.datagen.generator import generate_clean_invoice
from folio_ml.datagen.injectors import INJECTORS


def test_all_11_injectors_flip_labeled_checks() -> None:
    rng = random.Random(42)
    clean_inv = generate_clean_invoice(seed=123)

    expected_checks_map = {
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
        "tampered_amount_after_render": "tamper_detection",
    }

    assert len(INJECTORS) == 11, f"Expected 11 injectors, got {len(INJECTORS)}"

    for name, injector in INJECTORS.items():
        corrupted, failing_checks = injector(clean_inv, rng)
        assert expected_checks_map[name] in failing_checks, (
            f"Injector {name} failed to label expected check {expected_checks_map[name]}"
        )
        assert corrupted is not clean_inv


def test_degradation_pipeline() -> None:
    img = Image.new("RGB", (200, 300), color="white")
    degraded, meta = apply_degradation(img, severity=2, seed=42)
    assert degraded.size == (200, 300)
    assert meta["severity"] == 2
    assert len(meta["effects"]) > 0


def test_frozen_manifest_integrity_guard() -> None:
    """Verifies that data/eval/MANIFEST.json hashes match files on disk exactly."""
    ml_root = Path(__file__).resolve().parents[1]
    manifest_path = ml_root / "data" / "eval" / "MANIFEST.json"
    assert manifest_path.exists(), "MANIFEST.json does not exist. Run make data first."

    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)

    test_files: dict[str, str] = manifest["files"]
    assert len(test_files) == 200, f"Expected 200 tracked test files, got {len(test_files)}"

    for rel_path, expected_hash in test_files.items():
        full_path = ml_root / rel_path
        assert full_path.exists(), f"Tracked test file {rel_path} is missing!"
        with open(full_path, "rb") as f:
            actual_hash = hashlib.sha256(f.read()).hexdigest()
        assert actual_hash == expected_hash, (
            f"FROZEN TEST FILE TAMPERED: {rel_path} hash changed!"
        )


def test_reconciliation_fixtures_exist() -> None:
    ml_root = Path(__file__).resolve().parents[1]
    gstr2b_path = ml_root / "data" / "synthetic" / "gstr2b_2024_04.json"
    register_path = ml_root / "data" / "synthetic" / "purchase_register_2024_04.csv"
    assert gstr2b_path.exists()
    assert register_path.exists()

    with open(gstr2b_path, encoding="utf-8") as f:
        gstr2b = json.load(f)
    assert len(gstr2b["records"]) >= 3


def test_data_preview_contact_sheet_exists() -> None:
    ml_root = Path(__file__).resolve().parents[1]
    preview_path = ml_root / "reports" / "data_preview.png"
    assert preview_path.exists()
    img = Image.open(preview_path)
    assert img.size[0] > 0 and img.size[1] > 0
