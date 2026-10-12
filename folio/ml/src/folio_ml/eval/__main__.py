"""CLI entry point for running evaluation suites."""

import argparse
from pathlib import Path

from folio_ml.eval.harness import run_eval_harness


def main() -> None:
    parser = argparse.ArgumentParser(description="Folio ML Benchmark & Evaluation Harness")
    subparsers = parser.add_subparsers(dest="command")

    run_parser = subparsers.add_parser("run", help="Execute evaluation suites")
    run_parser.add_argument(
        "--suite",
        default="all",
        choices=[
            "all",
            "extraction",
            "validation",
            "calibration",
            "recon",
            "reconciliation",
            "vendor",
            "guardrails",
            "latency",
            "baseline",
        ],
        help="Which benchmark suite to execute",
    )
    run_parser.add_argument(
        "--mode",
        default="fake",
        choices=["fake", "replay", "live"],
        help="Evaluation execution mode",
    )
    run_parser.add_argument(
        "--output-dir",
        default=None,
        type=str,
        help="Destination directory for reports and charts",
    )

    args = parser.parse_args()
    suite = getattr(args, "suite", "all") or "all"
    mode = getattr(args, "mode", "fake") or "fake"
    out_dir_str = getattr(args, "output_dir", None)
    output_dir = Path(out_dir_str) if out_dir_str else None

    report = run_eval_harness(suite=suite, mode=mode, output_dir=output_dir)
    print(f"Evaluation run completed. Run ID: {report['run_id']}")


if __name__ == "__main__":
    main()
