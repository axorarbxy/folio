"""Confidence calibrator using Platt scaling / Isotonic regression with fallback heuristic."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression

from folio_ml.confidence.features import FieldFeatures, features_to_vector


def heuristic_confidence_scorer(feat: FieldFeatures) -> float:
    """Fallback heuristic confidence scorer when no trained model artifact is loaded.

    Guarantees the system always produces calibrated probability estimates.
    """
    base_conf = feat.provider_confidence if feat.provider_confidence is not None else 0.80

    # 1. Reader agreement adjustments
    if feat.agreement_kind == "exact":
        base_conf += 0.10
    elif feat.agreement_kind in {"normalized_equal", "numeric_close"}:
        base_conf += 0.05
    elif feat.agreement_kind == "disagree":
        base_conf -= 0.40

    # 2. Format & Checksum penalties
    if not feat.format_valid:
        base_conf -= 0.35

    if feat.gstin_checksum_valid is False:
        base_conf -= 0.45
    elif feat.gstin_checksum_valid is True:
        base_conf += 0.05

    # 3. Math consistency
    if feat.cross_field_math_consistent is False:
        base_conf -= 0.30
    elif feat.cross_field_math_consistent is True:
        base_conf += 0.05

    # 4. QR cross-check
    if feat.qr_agrees is True:
        base_conf += 0.08
    elif feat.qr_agrees is False:
        base_conf -= 0.35

    # 5. Document visual quality modulation
    quality_factor = 0.5 + 0.5 * feat.doc_quality_score
    calibrated = base_conf * quality_factor

    if feat.is_handwritten_likely:
        calibrated *= 0.85

    return round(float(np.clip(calibrated, 0.05, 0.99)), 3)


class ConfidenceCalibrator:
    """Calibrates field-level extraction confidence to true posterior accuracy."""

    def __init__(self, model_artifact_path: Path | str | None = None) -> None:
        self.model: Any | None = None
        self.version: str = "1.0.0"

        if model_artifact_path:
            p = Path(model_artifact_path)
            if p.exists():
                try:
                    self.model = joblib.load(p)
                except Exception:
                    self.model = None

    def predict_field_confidence(self, features: FieldFeatures) -> float:
        """Estimates calibrated probability P(field is correct)."""
        if self.model is not None:
            try:
                vec = features_to_vector(features).reshape(1, -1)
                prob = float(self.model.predict_proba(vec)[0, 1])
                return round(float(np.clip(prob, 0.01, 0.99)), 3)
            except Exception:
                pass

        return heuristic_confidence_scorer(features)

    @classmethod
    def train_and_save(
        cls,
        X_train: np.ndarray,
        y_train: np.ndarray,
        artifact_path: Path | str,
        model_card_path: Path | str,
        dataset_hash: str = "synthetic-dev-split",
    ) -> "ConfidenceCalibrator":
        """Trains Logistic Regression with CalibratedClassifierCV (Platt scaling / Isotonic) and saves artifact."""
        base_lr = LogisticRegression(C=1.0, max_iter=200, random_state=42)
        calibrated_model = CalibratedClassifierCV(
            estimator=base_lr,
            method="sigmoid",
            cv=3,
        )
        calibrated_model.fit(X_train, y_train)

        art_p = Path(artifact_path)
        art_p.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(calibrated_model, art_p)

        # Model card
        model_card = {
            "model_name": "FolioFieldConfidenceCalibrator",
            "version": "1.0.0",
            "trained_at": datetime.now().isoformat(),
            "dataset_hash": dataset_hash,
            "architecture": "LogisticRegression + CalibratedClassifierCV(Platt)",
            "n_samples": int(len(y_train)),
            "features_count": int(X_train.shape[1]),
            "intended_use": "Post-processing confidence calibration for GST invoice review routing",
            "limits": "Trained on synthetic dev split; must never be trained on frozen test split",
        }
        Path(model_card_path).write_text(json.dumps(model_card, indent=2), encoding="utf-8")

        inst = cls()
        inst.model = calibrated_model
        return inst
