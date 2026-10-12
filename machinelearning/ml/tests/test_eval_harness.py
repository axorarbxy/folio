"""Tests for evaluation harness, discipline guards, and baseline comparison."""

import random
from pathlib import Path

import pytest

from folio_ml.datagen.generator import generate_clean_invoice
from folio_ml.datagen.injectors import inject_invalid_gstin
from folio_ml.eval.baselines.single_prompt import BaselineComparator, FakeBaseline
from folio_ml.eval.harness import run_eval_harness
from folio_ml.eval.manifest_guard import (
    FROZEN_MANIFEST_HASH,
    guard_against_test_set_tuning,
    verify_frozen_manifest,
)
from folio_ml.eval.suites import (
    bootstrap_ci,
    run_baseline_comparison_suite,
    run_validation_suite,
)


def test_manifest_guard_success() -> None:
    """Confirms frozen test split manifest matches authoritative SHA-256 hash."""
    assert verify_frozen_manifest() is True


def test_manifest_guard_corruption(tmp_path: Path) -> None:
    """Verifies that corrupted manifest raises ValueError."""
    fake_manifest = tmp_path / "MANIFEST.json"
    fake_manifest.write_text('{"test_split_hash": "corrupted_hash"}', encoding="utf-8")

    with pytest.raises(ValueError, match="Frozen test split MANIFEST corruption"):
        verify_frozen_manifest(fake_manifest)


def test_guard_against_test_set_tuning() -> None:
    """Refuses tuning/training on frozen test split."""
    with pytest.raises(RuntimeError, match="DATA DISCIPLINE VIOLATION"):
        guard_against_test_set_tuning("test")

    with pytest.raises(RuntimeError, match="DATA DISCIPLINE VIOLATION"):
        guard_against_test_set_tuning("TEST ")

    # Train / Val splits are allowed
    guard_against_test_set_tuning("train")
    guard_against_test_set_tuning("val")
    guard_against_test_set_tuning("dev")


def test_bootstrap_ci() -> None:
    data = [0.95, 0.96, 0.94, 0.95, 0.97, 0.93]
    low, high = bootstrap_ci(data, n_resamples=100)
    assert 0.90 <= low <= high <= 1.0


def test_fake_baseline_and_comparator() -> None:
    baseline = FakeBaseline()
    clean = generate_clean_invoice(seed=42)
    b_res = baseline.evaluate_invoice(clean)
    assert "status" in b_res
    assert "arithmetic_correct" in b_res

    mutated, lbl = inject_invalid_gstin(clean, random.Random(42))
    comparator = BaselineComparator(baseline=baseline)
    res = comparator.compare_invoices([clean], [(mutated, lbl[0] if lbl else "invalid_gstin")])

    assert "folio_pipeline" in res
    assert "single_prompt_baseline" in res
    assert res["folio_pipeline"]["error_detection_recall"] >= 90.0


def test_validation_suite_smoke() -> None:
    res = run_validation_suite(mode="fake")
    assert res["suite"] == "validation"
    assert res["overall_detection_recall"] >= 90.0
    assert res["false_alarm_rate_on_clean"] <= 5.0


def test_run_eval_harness_smoke(tmp_path: Path) -> None:
    report = run_eval_harness(suite="validation", mode="fake", output_dir=tmp_path)
    assert report["mode"] == "fake"
    assert report["data_manifest_hash"] == FROZEN_MANIFEST_HASH
    assert (tmp_path / "report.json").exists()
    assert (tmp_path / "report.md").exists()
    assert (tmp_path / "summary.csv").exists()


def test_baseline_comparison_suite_generates_chart(tmp_path: Path) -> None:
    res = run_baseline_comparison_suite(output_dir=tmp_path)
    assert res["suite"] == "baseline_comparison"
    chart_file = tmp_path / "baseline_comparison.png"
    assert chart_file.exists()
    assert chart_file.stat().st_size > 1000
