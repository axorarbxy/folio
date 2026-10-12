"""Regression gate comparing benchmark evaluation metrics against baseline thresholds."""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from folio_ml.eval.harness import run_eval_harness


def load_baseline_metrics(baseline_path: Path | None = None) -> dict[str, Any]:
    if baseline_path is None:
        baseline_path = Path(__file__).resolve().parent.parent.parent.parent / "reports" / "baseline_metrics.json"

    if not baseline_path.exists():
        raise FileNotFoundError(f"Missing baseline_metrics.json at {baseline_path}")

    with open(baseline_path, encoding="utf-8") as f:
        return json.load(f)


def check_regression_gate(
    report: dict[str, Any],
    baseline: dict[str, Any] | None = None,
) -> tuple[bool, list[str]]:
    """Evaluates benchmark metrics against statutory minimum quality thresholds."""
    if baseline is None:
        baseline = load_baseline_metrics()

    targets = baseline.get("targets", {})
    failures: list[str] = []

    # 1. Validation error detection recall
    val = report.get("validation", {})
    if val:
        val_recall = float(val.get("overall_detection_recall", 0.0))
        min_recall = float(targets.get("validation_error_detection_recall_pct", {}).get("min_acceptable", 95.0))
        if val_recall < min_recall:
            failures.append(f"Validation recall regression: {val_recall}% < required {min_recall}%")

        clean_fp = float(val.get("false_alarm_rate_on_clean", 100.0))
        max_fp = float(targets.get("clean_invoice_false_alarm_rate_pct", {}).get("max_acceptable", 5.0))
        if clean_fp > max_fp:
            failures.append(f"Clean false alarm regression: {clean_fp}% > max allowed {max_fp}%")

    # 2. Calibration ECE and Brier
    cal = report.get("calibration", {})
    if cal:
        ece = float(cal.get("expected_calibration_error_ece", 1.0))
        max_ece = float(targets.get("calibration_ece", {}).get("max_acceptable", 0.05))
        if ece > max_ece:
            failures.append(f"Calibration ECE regression: {ece} > max allowed {max_ece}")

        brier = float(cal.get("brier_score", 1.0))
        max_brier = float(targets.get("calibration_brier", {}).get("max_acceptable", 0.05))
        if brier > max_brier:
            failures.append(f"Calibration Brier score regression: {brier} > max allowed {max_brier}")

    # 3. Reconciliation match precision and recall
    rec = report.get("reconciliation", {})
    if rec:
        rec_prec = float(rec.get("match_precision", 0.0))
        min_prec = float(targets.get("reconciliation_match_precision_pct", {}).get("min_acceptable", 98.0))
        if rec_prec < min_prec:
            failures.append(f"Reconciliation precision regression: {rec_prec}% < required {min_prec}%")

        rec_recall = float(rec.get("match_recall", 0.0))
        min_rec_recall = float(targets.get("reconciliation_match_recall_pct", {}).get("min_acceptable", 98.0))
        if rec_recall < min_rec_recall:
            failures.append(f"Reconciliation recall regression: {rec_recall}% < required {min_rec_recall}%")

    # 4. Guardrails injection recall and false positive rate
    gr = report.get("guardrails", {})
    if gr:
        gr_tpr = float(gr.get("true_positive_rate_tpr", 0.0))
        min_tpr = float(targets.get("guardrails_attack_recall_tpr_pct", {}).get("min_acceptable", 95.0))
        if gr_tpr < min_tpr:
            failures.append(f"Guardrails attack recall regression: {gr_tpr}% < required {min_tpr}%")

        gr_fpr = float(gr.get("false_positive_rate_fpr", 100.0))
        max_fpr = float(targets.get("guardrails_false_positive_rate_fpr_pct", {}).get("max_acceptable", 5.0))
        if gr_fpr > max_fpr:
            failures.append(f"Guardrails false positive rate regression: {gr_fpr}% > max allowed {max_fpr}%")

    # 5. Rule engine latency SLA
    lat = report.get("latency", {})
    if lat:
        p50 = float(lat.get("rule_engine_p50_ms", 100.0))
        max_p50 = float(targets.get("rule_engine_p50_latency_ms", {}).get("max_acceptable", 5.0))
        if p50 > max_p50:
            failures.append(f"Rule engine latency SLA breach: {p50} ms > max allowed {max_p50} ms")

    passed = len(failures) == 0
    return passed, failures


def promote_model(model_name: str, registry_path: Path | None = None) -> bool:
    """Updates model status to production in models/registry.json."""
    if registry_path is None:
        registry_path = Path(__file__).resolve().parent.parent.parent.parent / "models" / "registry.json"

    if not registry_path.exists():
        raise FileNotFoundError(f"Missing registry.json at {registry_path}")

    with open(registry_path, encoding="utf-8") as f:
        data = json.load(f)

    if model_name not in data.get("models", {}):
        raise KeyError(f"Model '{model_name}' not found in models/registry.json")

    data["models"][model_name]["status"] = "production"
    with open(registry_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Folio ML Regression Gate & Promotion Tool")
    parser.add_argument("--report", default=None, help="Path to report.json to evaluate")
    parser.add_argument("--baseline", default=None, help="Path to baseline_metrics.json")
    parser.add_argument("--promote", default=None, help="Model name to promote if regression gate passes")

    args = parser.parse_args()

    # Load report or run fresh evaluation
    if args.report and Path(args.report).exists():
        with open(args.report, encoding="utf-8") as f:
            report_data = json.load(f)
    else:
        print("No report specified; running evaluation suite in fake mode...")
        report_data = run_eval_harness(suite="all", mode="fake")

    baseline_data = load_baseline_metrics(Path(args.baseline) if args.baseline else None)
    passed, failures = check_regression_gate(report_data, baseline_data)

    if not passed:
        print("REGRESSION GATE FAILED:")
        for fail in failures:
            print(f"  [X] {fail}")
        sys.exit(1)

    print("REGRESSION GATE PASSED: All headline metrics satisfy statutory baselines.")

    if args.promote:
        promote_model(args.promote)
        print(f"Model '{args.promote}' promoted to production in registry.json.")


if __name__ == "__main__":
    main()
