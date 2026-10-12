"""Versioned GST legal data loaders with strict verification schema."""

from decimal import Decimal
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field


class StateCodeEntry(BaseModel):
    code: str
    name: str
    verified: bool = False


class HsnRateEntry(BaseModel):
    hsn_prefix: str
    description: str
    rate_pct: Decimal
    effective_from: str
    effective_to: str | None = None
    conditions: str | None = None
    source_url: str
    verified: bool = False


class RuleDataBundle(BaseModel):
    version: str
    states: dict[str, StateCodeEntry] = Field(default_factory=dict)
    rates: list[HsnRateEntry] = Field(default_factory=list)
    thresholds: dict[str, Any] = Field(default_factory=dict)
    all_verified: bool = False


def load_rules_data(rules_dir: Path | None = None) -> RuleDataBundle:
    """Loads and validates versioned YAML rule tables from data/rules/."""
    if rules_dir is None:
        rules_dir = Path(__file__).resolve().parents[3] / "data" / "rules"

    # 1. State Codes
    state_file = rules_dir / "state_codes.yaml"
    states_dict: dict[str, StateCodeEntry] = {}
    table_version = "2024.1"

    if state_file.exists():
        with open(state_file, encoding="utf-8") as f:
            raw_states = yaml.safe_load(f)
            table_version = raw_states.get("version", table_version)
            for item in raw_states.get("states", []):
                entry = StateCodeEntry(
                    code=str(item["code"]).zfill(2),
                    name=item["name"],
                    verified=bool(item.get("verified", False)),
                )
                states_dict[entry.code] = entry

    # 2. HSN Rates
    hsn_file = rules_dir / "hsn_rates.yaml"
    rate_entries: list[HsnRateEntry] = []
    if hsn_file.exists():
        with open(hsn_file, encoding="utf-8") as f:
            raw_rates = yaml.safe_load(f)
            for item in raw_rates.get("rates", []):
                entry = HsnRateEntry(
                    hsn_prefix=str(item["hsn_prefix"]).strip(),
                    description=item.get("description", ""),
                    rate_pct=Decimal(str(item["rate_pct"])),
                    effective_from=item.get("effective_from", "2017-07-01"),
                    effective_to=item.get("effective_to"),
                    conditions=item.get("conditions"),
                    source_url=item.get("source_url", ""),
                    verified=bool(item.get("verified", False)),
                )
                rate_entries.append(entry)

    # 3. Thresholds
    thresh_file = rules_dir / "thresholds.yaml"
    thresholds: dict[str, Any] = {}
    if thresh_file.exists():
        with open(thresh_file, encoding="utf-8") as f:
            raw_thresh = yaml.safe_load(f)
            thresholds = raw_thresh.get("thresholds", {})

    all_verified = all(s.verified for s in states_dict.values()) and all(r.verified for r in rate_entries)

    return RuleDataBundle(
        version=table_version,
        states=states_dict,
        rates=rate_entries,
        thresholds=thresholds,
        all_verified=all_verified,
    )


def find_matching_hsn_entries(
    hsn_code: str | None, rates: list[HsnRateEntry]
) -> list[HsnRateEntry]:
    """Finds all rate entries matching the longest prefix (8, 6, 4, 2 digits)."""
    if not hsn_code:
        return []
    clean = str(hsn_code).strip()
    prefixes = [clean[:8], clean[:6], clean[:4], clean[:2]]

    for prefix in prefixes:
        matched = [e for e in rates if e.hsn_prefix == prefix]
        if matched:
            return matched
    return []


def match_hsn_rate(
    hsn_code: str | None,
    rates: list[HsnRateEntry],
    charged_rate: Decimal | None = None,
) -> HsnRateEntry | None:
    """Finds matching rate using longest prefix match (8, 6, 4, 2 digits).

    If multiple schedule entries exist for the longest prefix (e.g. 12% corrugated
    vs 18% non-corrugated cartons under HSN 4819), selects the entry matching the
    charged rate if provided.
    """
    candidates = find_matching_hsn_entries(hsn_code, rates)
    if not candidates:
        return None
    if charged_rate is not None:
        for entry in candidates:
            if abs(entry.rate_pct - charged_rate) <= Decimal("0.01"):
                return entry
    return candidates[0]
