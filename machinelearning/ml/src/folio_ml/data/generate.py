"""Entrypoint for make data generating synthetic dataset, test manifest, and contact sheet."""

import argparse
from pathlib import Path

from folio_ml.datagen.splits import build_dataset_splits


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic dataset and test manifest")
    parser.add_argument("--refreeze", action="store_true", help="Force recalculation and refreeze of test manifest hash")
    args = parser.parse_args()

    ml_root = Path(__file__).resolve().parents[3]
    print(f"Generating synthetic datasets in {ml_root}...")
    manifest = build_dataset_splits(ml_root, refreeze=args.refreeze)
    print("Dataset generation complete!")
    print(f"Frozen test split hash: {manifest['test_split_hash']}")
    print(f"Total test files tracked: {manifest['total_test_files']}")


if __name__ == "__main__":
    main()
