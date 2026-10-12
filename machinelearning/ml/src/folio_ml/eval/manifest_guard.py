"""Discipline guard enforcing the sanctity of the frozen test split."""

import json
from pathlib import Path

FROZEN_MANIFEST_HASH = "4db5a2d5cfbf7c6e323ff9d1d7e547d91a75bfba8d8da267507ec072168caf5d"


def get_manifest_path() -> Path:
    return Path(__file__).resolve().parent.parent.parent.parent / "data" / "eval" / "MANIFEST.json"


def verify_frozen_manifest(manifest_path: Path | None = None) -> bool:
    """Verifies that MANIFEST.json matches the frozen authoritative SHA-256 hash."""
    if manifest_path is None:
        manifest_path = get_manifest_path()

    if not manifest_path.exists():
        raise FileNotFoundError(f"Missing MANIFEST.json at {manifest_path}")

    with open(manifest_path, encoding="utf-8") as f:
        data = json.load(f)

    actual_hash = data.get("test_split_hash")

    if actual_hash != FROZEN_MANIFEST_HASH:
        raise ValueError(
            f"Frozen test split MANIFEST corruption! "
            f"Expected {FROZEN_MANIFEST_HASH}, but got {actual_hash}. "
            f"Tuning against or altering the frozen test set is strictly prohibited."
        )

    return True


def guard_against_test_set_tuning(split_name: str) -> None:
    """Refuses execution if a training/tuning job attempts to consume the test split."""
    if split_name.strip().lower() == "test":
        raise RuntimeError(
            "DATA DISCIPLINE VIOLATION: Attempted to tune, calibrate, or train against the frozen test split. "
            "The test split must only be accessed by the final benchmark evaluation suite."
        )
