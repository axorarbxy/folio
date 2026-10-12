"""Calibration metrics: Expected Calibration Error (ECE), Brier score, reliability bins, and breakdowns."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from pydantic import BaseModel, Field


class ReliabilityBin(BaseModel):
    """Single probability bucket in a reliability diagram."""

    pred_mid: float = Field(..., description="Center of confidence bin [0..1]")
    actual: float = Field(..., description="Observed empirical accuracy in this bin [0..1]")
    n: int = Field(..., ge=0, description="Number of samples falling in this bin")


class AccuracyAtCoverage(BaseModel):
    threshold: float
    coverage: float  # Fraction of samples >= threshold
    accuracy: float  # Accuracy among samples >= threshold
    n_accepted: int


class CalibrationMetricsReport(BaseModel):
    """Full calibration report matching monitoring UI requirements."""

    ece: float = Field(..., ge=0.0, le=1.0, description="Expected Calibration Error across 10 bins")
    brier: float = Field(..., ge=0.0, description="Brier score (mean squared calibration error)")
    bins: list[ReliabilityBin] = Field(default_factory=list)
    accuracy_at_coverage: list[AccuracyAtCoverage] = Field(default_factory=list)
    by_field: dict[str, float] = Field(default_factory=dict)
    by_source: dict[str, float] = Field(default_factory=dict)
    by_language: dict[str, float] = Field(default_factory=dict)


def compute_calibration_metrics(
    y_true: np.ndarray | list[int] | list[bool],
    y_prob: np.ndarray | list[float],
    n_bins: int = 10,
    field_types: list[str] | None = None,
    source_types: list[str] | None = None,
    languages: list[str] | None = None,
) -> CalibrationMetricsReport:
    """Computes ECE, Brier score, reliability diagram bins, and subgroup breakdowns."""
    y_t = np.array(y_true, dtype=np.float32)
    y_p = np.clip(np.array(y_prob, dtype=np.float32), 0.0, 1.0)
    total_n = len(y_t)

    if total_n == 0:
        return CalibrationMetricsReport(ece=0.0, brier=0.0, bins=[])

    # 1. Brier score
    brier = float(np.mean((y_p - y_t) ** 2))

    # 2. 10 Reliability bins & ECE
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    bins_list: list[ReliabilityBin] = []
    ece = 0.0

    for i in range(n_bins):
        low, high = bin_edges[i], bin_edges[i + 1]
        if i == n_bins - 1:
            mask = (y_p >= low) & (y_p <= high)
        else:
            mask = (y_p >= low) & (y_p < high)

        count = int(np.sum(mask))
        mid = round(float((low + high) / 2.0), 3)

        if count > 0:
            actual_acc = float(np.mean(y_t[mask]))
            mean_conf = float(np.mean(y_p[mask]))
            ece += (count / total_n) * abs(actual_acc - mean_conf)
            bins_list.append(
                ReliabilityBin(pred_mid=mid, actual=round(actual_acc, 3), n=count)
            )
        else:
            bins_list.append(ReliabilityBin(pred_mid=mid, actual=mid, n=0))

    # 3. Accuracy at Coverage across 5 standard thresholds
    coverage_table: list[AccuracyAtCoverage] = []
    for thresh in [0.70, 0.80, 0.85, 0.90, 0.95]:
        acc_mask = y_p >= thresh
        n_acc = int(np.sum(acc_mask))
        cov = float(n_acc / total_n) if total_n > 0 else 0.0
        acc = float(np.mean(y_t[acc_mask])) if n_acc > 0 else 1.0
        coverage_table.append(
            AccuracyAtCoverage(
                threshold=thresh,
                coverage=round(cov, 3),
                accuracy=round(acc, 3),
                n_accepted=n_acc,
            )
        )

    # 4. Breakdowns
    by_field: dict[str, float] = {}
    if field_types and len(field_types) == total_n:
        for ftype in set(field_types):
            f_mask = np.array(field_types) == ftype
            by_field[ftype] = round(float(np.mean(y_t[f_mask])), 3)

    by_source: dict[str, float] = {}
    if source_types and len(source_types) == total_n:
        for stype in set(source_types):
            s_mask = np.array(source_types) == stype
            by_source[stype] = round(float(np.mean(y_t[s_mask])), 3)

    by_lang: dict[str, float] = {}
    if languages and len(languages) == total_n:
        for lang in set(languages):
            l_mask = np.array(languages) == lang
            by_lang[lang] = round(float(np.mean(y_t[l_mask])), 3)

    return CalibrationMetricsReport(
        ece=round(float(ece), 4),
        brier=round(brier, 4),
        bins=bins_list,
        accuracy_at_coverage=coverage_table,
        by_field=by_field,
        by_source=by_source,
        by_language=by_lang,
    )


def save_reliability_diagram_png(
    report: CalibrationMetricsReport,
    output_path: Path | str,
) -> None:
    """Renders and saves a reliability diagram PNG using Pillow."""
    width, height = 600, 600
    img = Image.new("RGB", (width, height), color="white")
    draw = ImageDraw.Draw(img)

    margin = 70
    plot_w = width - 2 * margin
    plot_h = height - 2 * margin

    # Draw coordinate frame
    draw.rectangle(
        [(margin, margin), (margin + plot_w, margin + plot_h)],
        outline="black",
        width=2,
    )

    # Title and metrics text
    title = f"Reliability Diagram (ECE: {report.ece:.3f}, Brier: {report.brier:.3f})"
    draw.text((margin, 25), title, fill="black")

    # Draw diagonal ideal calibration line y = x (dashed/light gray)
    draw.line(
        [(margin, margin + plot_h), (margin + plot_w, margin)],
        fill="gray",
        width=2,
    )

    # Plot empirical calibration bars / points
    for b in report.bins:
        if b.n == 0:
            continue
        px = margin + int(b.pred_mid * plot_w)
        py = margin + plot_h - int(b.actual * plot_h)
        # Draw calibration point and bar
        draw.ellipse([(px - 5, py - 5), (px + 5, py + 5)], fill="#1E88E5", outline="black")
        bar_x = margin + int((b.pred_mid - 0.04) * plot_w)
        bar_w = int(0.08 * plot_w)
        draw.rectangle(
            [(bar_x, py), (bar_x + bar_w, margin + plot_h)],
            outline="#90CAF9",
            fill=(30, 136, 229, 60),
        )

    # Axis labels
    draw.text((margin + plot_w // 2 - 50, height - 35), "Predicted Confidence", fill="black")
    draw.text((10, margin + plot_h // 2), "Empirical\nAccuracy", fill="black")

    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG")
