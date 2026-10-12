"""Evaluation benchmark harness for prompt injection screener on trilingual corpus."""

import json
from pathlib import Path
from typing import Any

from folio_ml.guardrails.screen import InjectionScreener


def evaluate_injection_screener(corpus_path: Path | None = None) -> dict[str, Any]:
    """Runs InjectionScreener over the evaluation corpus and calculates TPR, FPR, Precision, and Recall."""
    if corpus_path is None:
        corpus_path = (
            Path(__file__).resolve().parent.parent.parent.parent
            / "data"
            / "eval"
            / "injection"
            / "corpus.json"
        )

    with open(corpus_path, encoding="utf-8") as f:
        data = json.load(f)

    samples = data.get("samples", [])
    screener = InjectionScreener()

    tp = 0  # Malicious correctly flagged (risk == "high" or "medium")
    fn = 0  # Malicious missed (risk == "low")
    fp = 0  # Benign incorrectly flagged (risk != "low")
    tn = 0  # Benign correctly allowed (risk == "low")

    by_language: dict[str, dict[str, int]] = {}

    for s in samples:
        is_mal = bool(s.get("is_malicious", False))
        lang = str(s.get("language", "en"))
        if lang not in by_language:
            by_language[lang] = {"tp": 0, "fn": 0, "fp": 0, "tn": 0}

        text = s.get("text", "")
        result = screener.screen(text)
        flagged = result.risk in {"high", "medium"}

        if is_mal:
            if flagged:
                tp += 1
                by_language[lang]["tp"] += 1
            else:
                fn += 1
                by_language[lang]["fn"] += 1
        else:
            if flagged:
                fp += 1
                by_language[lang]["fp"] += 1
            else:
                tn += 1
                by_language[lang]["tn"] += 1

    total_malicious = tp + fn
    total_benign = fp + tn

    tpr = tp / total_malicious if total_malicious > 0 else 0.0
    fnr = fn / total_malicious if total_malicious > 0 else 0.0
    fpr = fp / total_benign if total_benign > 0 else 0.0
    tnr = tn / total_benign if total_benign > 0 else 0.0

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    accuracy = (tp + tn) / (total_malicious + total_benign) if (total_malicious + total_benign) > 0 else 0.0
    f1 = 2 * precision * tpr / (precision + tpr) if (precision + tpr) > 0 else 0.0

    return {
        "total_samples": len(samples),
        "total_malicious": total_malicious,
        "total_benign": total_benign,
        "true_positives": tp,
        "false_negatives": fn,
        "false_positives": fp,
        "true_negatives": tn,
        "tpr_recall": round(tpr, 4),
        "fnr": round(fnr, 4),
        "fpr": round(fpr, 4),
        "tnr": round(tnr, 4),
        "precision": round(precision, 4),
        "accuracy": round(accuracy, 4),
        "f1_score": round(f1, 4),
        "by_language": by_language,
    }


if __name__ == "__main__":
    metrics = evaluate_injection_screener()
    print("=== Injection Screener Evaluation Report ===")
    print(f"Total Samples: {metrics['total_samples']} (Malicious: {metrics['total_malicious']}, Benign: {metrics['total_benign']})")
    print(f"True Positive Rate (Recall): {metrics['tpr_recall'] * 100:.2f}% ({metrics['true_positives']}/{metrics['total_malicious']})")
    print(f"False Positive Rate: {metrics['fpr'] * 100:.2f}% ({metrics['false_positives']}/{metrics['total_benign']})")
    print(f"Precision: {metrics['precision'] * 100:.2f}%")
    print(f"Accuracy: {metrics['accuracy'] * 100:.2f}%")
    print(f"F1 Score: {metrics['f1_score']:.4f}")
    print("\nBreakdown by Language:")
    for lang, counts in metrics["by_language"].items():
        print(f"  {lang.upper()}: TP={counts['tp']}, FN={counts['fn']}, FP={counts['fp']}, TN={counts['tn']}")
