"""Bayesian Beta-smoothed transparent vendor risk scorer (README 08 Phase 1)."""

from typing import Literal

from scipy.stats import beta

from folio_ml.contracts.vendor import RiskContribution, VendorRisk
from folio_ml.vendor.contracts import VendorEvent
from folio_ml.vendor.features import FeatureExtractor, VendorFeatures
from folio_ml.vendor.store import InMemoryVendorStore, VendorStore

BASELINE_DEFECT_PRIOR = 0.25  # Neutral 25% defect rate prior
PRIOR_EFFECTIVE_N = 6.0       # Strength of prior pseudo-observations (alpha=1.5, beta=4.5)


class VendorRiskScorer:
    """Computes transparent, explainable vendor risk scores using Bayesian smoothing."""

    def __init__(
        self,
        store: VendorStore | None = None,
        feature_extractor: FeatureExtractor | None = None,
        reliable_cutoff: float = 25.0,
        high_risk_cutoff: float = 55.0,
    ) -> None:
        self.store = store or InMemoryVendorStore()
        self.extractor = feature_extractor or FeatureExtractor()
        self.reliable_cutoff = reliable_cutoff
        self.high_risk_cutoff = high_risk_cutoff

        # Feature weights summing to 100.0
        self.weights = {
            "late_filing_rate": 35.0,
            "mismatch_rate": 25.0,
            "rate_error_rate": 15.0,
            "math_error_rate": 15.0,
            "unresolved_issues": 5.0,
            "trend": 5.0,
        }
        # Baseline score when zero evidence is available
        self.baseline_score = sum(
            self.weights[k] * BASELINE_DEFECT_PRIOR
            for k in ["late_filing_rate", "mismatch_rate", "rate_error_rate", "math_error_rate"]
        )  # 90 * 0.25 = 22.5

    def _smooth_rate(self, observed_rate: float, effective_n: float) -> float:
        """Applies Beta prior smoothing: (k + alpha_0) / (n + alpha_0 + beta_0)."""
        alpha_0 = BASELINE_DEFECT_PRIOR * PRIOR_EFFECTIVE_N
        beta_0 = (1.0 - BASELINE_DEFECT_PRIOR) * PRIOR_EFFECTIVE_N

        k = observed_rate * effective_n
        alpha = alpha_0 + k
        beta_param = beta_0 + (effective_n - k)

        return float(alpha / (alpha + beta_param))

    def score_features(self, features: VendorFeatures, vendor_name: str | None = None) -> VendorRisk:
        """Evaluates features and constructs an explainable VendorRisk report."""
        # 1. Smooth binary rates with Beta priors
        p_late = self._smooth_rate(features.late_filing_rate, features.effective_filing_n)
        p_mismatch = self._smooth_rate(features.mismatch_rate, features.effective_invoice_n)
        p_rate_err = self._smooth_rate(features.rate_error_rate, features.effective_invoice_n)
        p_math_err = self._smooth_rate(features.math_error_rate, features.effective_invoice_n)

        # 2. Linear penalties for operational indicators
        unresolved_norm = min(1.0, features.unresolved_issues / 5.0)
        trend_norm = min(1.0, max(0.0, features.trend))

        # 3. Calculate effect points against baseline prior
        # effect_points = weight * (smoothed_value - baseline_prior)
        eff_late = round(self.weights["late_filing_rate"] * (p_late - BASELINE_DEFECT_PRIOR), 2)
        eff_mismatch = round(self.weights["mismatch_rate"] * (p_mismatch - BASELINE_DEFECT_PRIOR), 2)
        eff_rate_err = round(self.weights["rate_error_rate"] * (p_rate_err - BASELINE_DEFECT_PRIOR), 2)
        eff_math_err = round(self.weights["math_error_rate"] * (p_math_err - BASELINE_DEFECT_PRIOR), 2)
        eff_unresolved = round(self.weights["unresolved_issues"] * unresolved_norm, 2)
        eff_trend = round(self.weights["trend"] * trend_norm, 2)

        contributions = [
            RiskContribution(
                feature="late_filing_rate",
                weight=self.weights["late_filing_rate"],
                value=round(features.late_filing_rate, 4),
                effect_points=eff_late,
            ),
            RiskContribution(
                feature="mismatch_rate",
                weight=self.weights["mismatch_rate"],
                value=round(features.mismatch_rate, 4),
                effect_points=eff_mismatch,
            ),
            RiskContribution(
                feature="rate_error_rate",
                weight=self.weights["rate_error_rate"],
                value=round(features.rate_error_rate, 4),
                effect_points=eff_rate_err,
            ),
            RiskContribution(
                feature="math_error_rate",
                weight=self.weights["math_error_rate"],
                value=round(features.math_error_rate, 4),
                effect_points=eff_math_err,
            ),
            RiskContribution(
                feature="unresolved_issues",
                weight=self.weights["unresolved_issues"],
                value=features.unresolved_issues,
                effect_points=eff_unresolved,
            ),
            RiskContribution(
                feature="trend",
                weight=self.weights["trend"],
                value=features.trend,
                effect_points=eff_trend,
            ),
        ]

        total_effects = sum(c.effect_points for c in contributions)
        raw_score = self.baseline_score + total_effects
        final_score = round(max(0.0, min(100.0, raw_score)), 2)

        # 4. Bayesian credible interval estimation
        total_evidence = features.effective_filing_n + features.effective_invoice_n
        alpha_post = 1.5 + (final_score / 100.0) * total_evidence
        beta_post = 4.5 + (1.0 - (final_score / 100.0)) * total_evidence

        q_low = float(beta.ppf(0.025, alpha_post, beta_post)) * 100.0
        q_high = float(beta.ppf(0.975, alpha_post, beta_post)) * 100.0

        ci_low = round(max(0.0, min(final_score, q_low)), 1)
        ci_high = round(min(100.0, max(final_score, q_high)), 1)
        interval = (ci_low, ci_high)

        # Limited history when interval width > 25.0 points or fewer than 5 invoices observed
        limited_history = (ci_high - ci_low > 25.0) or (features.total_invoices < 5)

        # 5. Risk tag assignment
        tag: Literal["Reliable", "Watch", "High risk"] = "Watch"
        if final_score < self.reliable_cutoff:
            tag = "Reliable"
        elif final_score >= self.high_risk_cutoff:
            tag = "High risk"

        return VendorRisk(
            gstin=features.gstin,
            vendor_name=vendor_name,
            score=final_score,
            credible_interval=interval,
            limited_history=limited_history,
            tag=tag,
            contributions=contributions,
            filing_history=features.filing_history,
        )

    def evaluate_vendor(self, gstin: str, vendor_name: str | None = None) -> VendorRisk:
        """Fetches events from store, computes features, and scores the vendor."""
        events = self.store.get_events(gstin)
        features = self.extractor.extract_features(gstin, events)
        return self.score_features(features, vendor_name=vendor_name)

    def record_event(self, event: VendorEvent) -> VendorEvent:
        return self.store.record_event(event)

    def score_batch(self, gstins: list[str]) -> list[VendorRisk]:
        return [self.evaluate_vendor(g) for g in gstins]
