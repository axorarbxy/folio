"""Export Pydantic JSON schemas for all contracts."""

import json
from pathlib import Path

from folio_ml.contracts.base import Box
from folio_ml.contracts.checks import CheckResult, Verdict
from folio_ml.contracts.invoice import Invoice, InvoiceTotals, LineItem
from folio_ml.contracts.recon import ReconMatch, ReconReport
from folio_ml.contracts.review import ReviewDecision
from folio_ml.contracts.signals import ThreatSignal
from folio_ml.contracts.vendor import VendorRisk

CONTRACT_MODELS = {
    "Box": Box,
    "LineItem": LineItem,
    "InvoiceTotals": InvoiceTotals,
    "Invoice": Invoice,
    "CheckResult": CheckResult,
    "Verdict": Verdict,
    "ReconMatch": ReconMatch,
    "ReconReport": ReconReport,
    "ReviewDecision": ReviewDecision,
    "ThreatSignal": ThreatSignal,
    "VendorRisk": VendorRisk,
}


def export_schemas(output_dir: Path | None = None) -> None:
    if output_dir is None:
        output_dir = Path(__file__).resolve().parents[3] / "contracts_schema"
    output_dir.mkdir(parents=True, exist_ok=True)

    for name, model_cls in CONTRACT_MODELS.items():
        schema_path = output_dir / f"{name}.json"
        schema_json = model_cls.model_json_schema()
        with open(schema_path, "w", encoding="utf-8") as f:
            json.dump(schema_json, f, indent=2)
        print(f"Exported {name} -> {schema_path}")


if __name__ == "__main__":
    export_schemas()
