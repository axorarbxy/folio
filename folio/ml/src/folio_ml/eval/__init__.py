"""Evaluation and benchmark harness package."""

from folio_ml.eval.harness import run_eval_harness
from folio_ml.eval.manifest_guard import guard_against_test_set_tuning, verify_frozen_manifest

__all__ = [
    "guard_against_test_set_tuning",
    "run_eval_harness",
    "verify_frozen_manifest",
]
