"""Population Stability Index (PSI) drift detection across confidence distributions and input mix."""

from typing import Literal

import numpy as np
from pydantic import BaseModel, Field


class DriftSubgroupReport(BaseModel):
    """PSI metrics for a specific feature or distribution."""

    name: str
    psi: float = Field(..., ge=0.0)
    severity: Literal["low", "medium", "high"]
    message: str


class DriftReport(BaseModel):
    """Full population stability index report comparing baseline vs recent inference windows."""

    overall_psi: float
    severity: Literal["low", "medium", "high"]
    confidence_drift: DriftSubgroupReport
    quality_drift: DriftSubgroupReport
    source_mix_drift: DriftSubgroupReport
    messages: list[str]


def calculate_psi(
    baseline: np.ndarray | list[float],
    current: np.ndarray | list[float],
    n_bins: int = 10,
    min_val: float = 0.0,
    max_val: float = 1.0,
    epsilon: float = 1e-4,
) -> float:
    """Calculates continuous Population Stability Index (PSI) over numeric distribution."""
    b_arr = np.array(baseline, dtype=np.float32)
    c_arr = np.array(current, dtype=np.float32)

    if len(b_arr) == 0 or len(c_arr) == 0:
        return 0.0

    bins = np.linspace(min_val, max_val, n_bins + 1)
    b_counts, _ = np.histogram(b_arr, bins=bins)
    c_counts, _ = np.histogram(c_arr, bins=bins)

    b_probs = (b_counts + epsilon) / (np.sum(b_counts) + n_bins * epsilon)
    c_probs = (c_counts + epsilon) / (np.sum(c_counts) + n_bins * epsilon)

    psi_val = float(np.sum((c_probs - b_probs) * np.log(c_probs / b_probs)))
    return round(max(0.0, psi_val), 4)


def calculate_categorical_psi(
    baseline_counts: dict[str, int],
    current_counts: dict[str, int],
    epsilon: float = 1e-4,
) -> float:
    """Calculates PSI over discrete categorical distributions (e.g. source types, languages)."""
    all_categories = sorted(list(set(baseline_counts.keys()) | set(current_counts.keys())))
    k = len(all_categories)
    if k == 0:
        return 0.0

    b_total = sum(baseline_counts.values())
    c_total = sum(current_counts.values())
    if b_total == 0 or c_total == 0:
        return 0.0

    psi = 0.0
    for cat in all_categories:
        b_p = (baseline_counts.get(cat, 0) + epsilon) / (b_total + k * epsilon)
        c_p = (current_counts.get(cat, 0) + epsilon) / (c_total + k * epsilon)
        psi += (c_p - b_p) * np.log(c_p / b_p)

    return round(max(0.0, float(psi)), 4)


def get_drift_severity(psi: float) -> Literal["low", "medium", "high"]:
    """Maps PSI score to statutory drift severity."""
    if psi < 0.10:
        return "low"
    elif psi < 0.25:
        return "medium"
    return "high"


def evaluate_population_drift(
    baseline_confidences: list[float],
    current_confidences: list[float],
    baseline_qualities: list[float] | None = None,
    current_qualities: list[float] | None = None,
    baseline_sources: dict[str, int] | None = None,
    current_sources: dict[str, int] | None = None,
) -> DriftReport:
    """Computes comprehensive PSI report across confidence, image quality, and document source mix."""
    conf_psi = calculate_psi(baseline_confidences, current_confidences)
    conf_sev = get_drift_severity(conf_psi)

    conf_msg = "Confidence distribution is stable."
    if conf_sev == "medium":
        conf_msg = "Moderate shift in model confidence distribution."
    elif conf_sev == "high":
        conf_msg = "High confidence distribution drift detected (accuracy degradation risk)."

    # Quality drift
    b_q = baseline_qualities or [0.85] * max(len(baseline_confidences), 10)
    c_q = current_qualities or [0.85] * max(len(current_confidences), 10)
    qual_psi = calculate_psi(b_q, c_q)
    qual_sev = get_drift_severity(qual_psi)

    qual_msg = "Input document capture quality is stable."
    if qual_sev != "low":
        qual_msg = "Document capture quality dropped significantly (surge in blurry or degraded phone photos)."

    # Source mix drift
    b_s = baseline_sources or {"digital_pdf": 60, "phone_photo": 30, "scanner": 10}
    c_s = current_sources or {"digital_pdf": 60, "phone_photo": 30, "scanner": 10}
    src_psi = calculate_categorical_psi(b_s, c_s)
    src_sev = get_drift_severity(src_psi)

    src_msg = "Input source mix is consistent with baseline."
    if src_sev != "low":
        src_msg = "Source mix shifted noticeably (higher ratio of mobile uploads)."

    overall_psi = round(max(conf_psi, qual_psi, src_psi), 4)
    overall_sev = get_drift_severity(overall_psi)

    messages = [m for m in [conf_msg, qual_msg, src_msg] if "stable" not in m and "consistent" not in m]
    if not messages:
        messages.append("Inference population is stable; no significant drift detected.")

    return DriftReport(
        overall_psi=overall_psi,
        severity=overall_sev,
        confidence_drift=DriftSubgroupReport(
            name="confidence",
            psi=conf_psi,
            severity=conf_sev,
            message=conf_msg,
        ),
        quality_drift=DriftSubgroupReport(
            name="quality",
            psi=qual_psi,
            severity=qual_sev,
            message=qual_msg,
        ),
        source_mix_drift=DriftSubgroupReport(
            name="source_mix",
            psi=src_psi,
            severity=src_sev,
            message=src_msg,
        ),
        messages=messages,
    )
