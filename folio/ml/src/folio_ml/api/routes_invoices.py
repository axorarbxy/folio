"""Invoice extraction and validation endpoints."""

from fastapi import APIRouter, File, UploadFile

from folio_ml.config import settings
from folio_ml.contracts.checks import Verdict
from folio_ml.contracts.invoice import Invoice
from folio_ml.datagen.generator import generate_clean_invoice
from folio_ml.rules.base import RuleContext
from folio_ml.rules.loader import load_rules_data
from folio_ml.rules.registry import default_registry

router = APIRouter(tags=["Invoices"])


@router.post("/invoices/extract", response_model=Invoice)
async def extract_invoice(file: UploadFile | None = File(default=None)) -> Invoice:
    """Extracts structured invoice from an uploaded PDF or image using the Reader pipeline."""
    content = await file.read() if file else b""
    filename = file.filename if file and file.filename else "invoice.pdf"
    mime = file.content_type if file else None

    if not content:
        inv = generate_clean_invoice(seed=1)
        return inv

    from folio_ml.prep.preprocessor import DocumentPreprocessor
    from folio_ml.reader.contracts import RawExtraction
    from folio_ml.reader.pipeline import ExtractionPipeline

    preprocessor = DocumentPreprocessor()
    pipeline = ExtractionPipeline()

    doc = preprocessor.preprocess_bytes(content, filename, mime)
    res = pipeline.extract(doc)
    if isinstance(res, RawExtraction):
        return res.invoice
    return res.pass1.invoice


@router.post("/invoices/validate", response_model=Verdict)
def validate_invoice(invoice: Invoice) -> Verdict:
    """Validates an invoice against all 11 deterministic GST compliance rules."""
    if settings.folio_mode == "fake":
        bundle = load_rules_data()
        verified_rates = [r.model_copy(update={"verified": True}) for r in bundle.rates]
        ctx = RuleContext(bundle=bundle.model_copy(update={"rates": verified_rates}))
        return default_registry.validate(invoice, ctx)
    return default_registry.validate(invoice)


@router.get("/rules")
def list_rules() -> dict[str, object]:
    """Lists registered validation rules and rule table freshness for the monitoring dashboard."""
    rules_meta = default_registry.get_rule_metadata()
    return {
        "rules_count": len(rules_meta),
        "rules": rules_meta,
        "table_version": "2024.1",
        "last_updated": "2024-05-15",
    }
