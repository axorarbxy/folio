"""Verification, anomaly, and tamper detection package."""

from folio_ml.verify.anomaly import AnomalyDetector
from folio_ml.verify.contracts import ScanRequest, ScanResponse, VerificationResult, VerifierFlag
from folio_ml.verify.duplicates import DuplicateDetector
from folio_ml.verify.judge import FakeJudge, SmallJudge
from folio_ml.verify.scanner import DocumentScanner
from folio_ml.verify.tamper import TamperDetector
from folio_ml.verify.verifier import IndependentVerifier

__all__ = [
    "AnomalyDetector",
    "DocumentScanner",
    "DuplicateDetector",
    "FakeJudge",
    "IndependentVerifier",
    "ScanRequest",
    "ScanResponse",
    "SmallJudge",
    "TamperDetector",
    "VerificationResult",
    "VerifierFlag",
]
