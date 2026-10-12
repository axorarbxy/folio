"""Reader adapters: FakeReader, ReplayReader, GeminiVisionReader, OpenAICompatReader, and IndicReader."""

import hashlib
import json
import time
from pathlib import Path
from typing import Any

from folio_ml.config import settings
from folio_ml.datagen.generator import generate_clean_invoice
from folio_ml.prep.contracts import PreparedDocument
from folio_ml.reader.base import parse_and_validate_invoice
from folio_ml.reader.contracts import RawExtraction, ReaderFailure


class NotConfiguredError(Exception):
    """Raised when an external model provider is called without required credentials/endpoints."""


class FakeReader:
    """Deterministic offline fake reader for unit tests and local synthetic execution."""

    provider_name: str = "fake"
    model_name: str = "folio-synthetic-v1"

    def __init__(
        self,
        fail_attempts: int = 0,
        always_fail: bool = False,
        canned_invoices: dict[str, Any] | None = None,
    ) -> None:
        self.fail_attempts: int = fail_attempts
        self.always_fail: bool = always_fail
        self.canned_invoices: dict[str, Any] = canned_invoices or {}
        self.call_count: int = 0

    def extract(self, doc: PreparedDocument) -> RawExtraction:
        self.call_count += 1
        start_time = time.perf_counter()

        # Simulate broken response for retry testing
        if self.always_fail or (self.fail_attempts > 0 and self.call_count <= self.fail_attempts):
            broken_raw = '{"id": "INVALID", "totals": "not_a_dict_corrupt_json"'
            # Schema validation fails
            raise ReaderFailure(
                doc_hash=doc.file_hash,
                error_type="SIMULATED_VLM_ERROR",
                error_message="Simulated malformed JSON response from fake provider",
                raw_response=broken_raw,
            )

        # Check canned invoice lookup
        if doc.file_hash in self.canned_invoices:
            inv = self.canned_invoices[doc.file_hash]
        else:
            # Generate deterministic synthetic invoice from file hash
            seed = int(hashlib.sha256(doc.file_hash.encode()).hexdigest()[:8], 16) % 1000
            inv = generate_clean_invoice(seed=seed)

        latency = (time.perf_counter() - start_time) * 1000.0

        return RawExtraction(
            invoice=inv,
            raw_response_text=inv.model_dump_json(indent=2),
            provider_name=self.provider_name,
            model_name=self.model_name,
            latency_ms=round(latency, 2),
            token_usage={"prompt_tokens": 1250, "completion_tokens": 380, "total_tokens": 1630},
            estimated_cost_usd=0.0,
            retries_attempted=0,
        )


class ReplayReader:
    """Returns recorded model responses keyed by file_hash + prompt_version."""

    provider_name: str = "replay"
    model_name: str = "replay-bundle"

    def __init__(
        self,
        replay_dir: Path | None = None,
        prompt_version: str = "v1",
    ) -> None:
        self.replay_dir: Path = (
            replay_dir or (Path(__file__).resolve().parents[3] / "data" / "replay")
        )
        self.prompt_version: str = prompt_version
        self.cache: dict[str, RawExtraction] = {}

    def extract(self, doc: PreparedDocument) -> RawExtraction:
        cache_key = f"{doc.file_hash}_{self.prompt_version}"
        if cache_key in self.cache:
            return self.cache[cache_key]

        replay_path = self.replay_dir / f"{cache_key}.json"
        if not replay_path.exists():
            raise ReaderFailure(
                doc_hash=doc.file_hash,
                error_type="REPLAY_NOT_FOUND",
                error_message=f"No recorded replay found for file hash {doc.file_hash} (prompt {self.prompt_version}) at {replay_path}",
                requires_human_review=True,
            )

        try:
            content = json.loads(replay_path.read_text(encoding="utf-8"))
            raw_text = content.get("raw_response_text", "")
            inv = parse_and_validate_invoice(raw_text, doc.file_hash)

            extraction = RawExtraction(
                invoice=inv,
                raw_response_text=raw_text,
                provider_name=self.provider_name,
                model_name=content.get("model_name", self.model_name),
                latency_ms=content.get("latency_ms", 120.0),
                token_usage=content.get("token_usage", {}),
                estimated_cost_usd=content.get("estimated_cost_usd", 0.0),
            )
            self.cache[cache_key] = extraction
            return extraction
        except Exception as e:
            raise ReaderFailure(
                doc_hash=doc.file_hash,
                error_type="REPLAY_PARSE_ERROR",
                error_message=f"Corrupt replay bundle: {e}",
            ) from e


class IndicReader:
    """Stub class for Indic-focused OCR / VLM service."""

    provider_name: str = "indic"
    model_name: str = "indic-ocr-v1"

    def __init__(self, endpoint: str | None = None) -> None:
        self.endpoint: str | None = endpoint

    def extract(self, doc: PreparedDocument) -> RawExtraction:
        if not self.endpoint:
            raise NotConfiguredError(
                "IndicReader requires INDIC_OCR_ENDPOINT environment variable to be configured."
            )
        raise NotImplementedError("Indic OCR integration requires active network endpoint.")


class GeminiVisionReader:
    """Google Gemini Vision extraction adapter."""

    provider_name: str = "gemini"
    model_name: str = "gemini-1.5-flash"

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key: str | None = api_key if api_key is not None else settings.gemini_api_key
        if model:
            self.model_name = model

    def extract(self, doc: PreparedDocument) -> RawExtraction:
        if not self.api_key or self.api_key in {"", "placeholder_key_not_real"}:
            raise NotConfiguredError(
                "GeminiVisionReader requires GEMINI_API_KEY environment variable to be configured."
            )
        # Network integration sits behind Protocol; unit tests run offline in FOLIO_MODE=fake
        raise NotImplementedError("Live Gemini API calls are disabled during offline unit tests.")


class OpenAICompatReader:
    """OpenAI-compatible vision reader for local Ollama or vLLM deployments."""

    provider_name: str = "openai_compat"
    model_name: str = "qwen2-vl-7b-instruct"

    def __init__(self, base_url: str | None = None, model: str | None = None) -> None:
        self.base_url: str | None = base_url
        if model:
            self.model_name = model

    def extract(self, doc: PreparedDocument) -> RawExtraction:
        if not self.base_url:
            raise NotConfiguredError(
                "OpenAICompatReader requires OPENAI_BASE_URL pointing to a local vLLM or Ollama instance."
            )
        raise NotImplementedError("Live vLLM/Ollama calls are disabled during offline unit tests.")
