# Folio ML Engine

The machine learning and deterministic rule validation engine for **Folio**, a GST invoice validation product.

## Core Principle
> **The AI reads, rules decide, humans confirm.**

- **AI Reads**: Multimodal document processing and extraction (with two-pass agreement, box alignment, confidence calibration).
- **Rules Decide**: Deterministic, versioned, zero-hallucination GST compliance verification.
- **Humans Confirm**: Targeted routing of uncertain fields and high-risk invoices to human reviewers.

## Modes (`FOLIO_MODE`)
- `fake`: Completely offline, fixture-driven responses. Safe for demos, integration testing, and local development with zero external dependencies.
- `replay`: Replays pre-recorded real/synthetic traces for deterministic regression benchmarks.
- `live`: Active calls to configured OCR / LLM providers with safety guardrails and strict fallback.

## Quick Start
```bash
# Setup virtual environment and dependencies
make setup

# Run linter and tests
make lint
make test

# Export JSON schemas for frontend contract sync
make schema

# Start development API server
make run
```
