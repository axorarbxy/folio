"""Prompt injection screener with multilingual heuristic detection and hidden-text checks."""

import re
from typing import Any

from folio_ml.guardrails.contracts import InjectionSpan, ScreenResult

# 1. Role markers and prompt delimiter spoofing
ROLE_MARKER_REGEX = re.compile(
    r"(?:\[\s*(?:SYSTEM|ASSISTANT|USER|HUMAN|AI)\s*\]|<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|user\|>|###\s*(?:System|Instruction|Assistant):?)",
    re.IGNORECASE,
)

# 2. Direct prompt override and instruction injection in English
INSTRUCTION_OVERRIDE_EN = re.compile(
    r"\b(?:ignore|disregard|forget|bypass|override)\s+(?:all\s+)?(?:previous|prior|above|existing|system)\s+(?:instructions?|prompts?|rules?|directives?)\b|"
    r"\b(?:new\s+instructions?|system\s+override|jailbreak|developer\s+mode|unrestricted\s+mode)\b|"
    r"\b(?:from\s+now\s+on\s+you\s+are|you\s+are\s+now\s+in\s+developer|act\s+as\s+an\s+unrestricted)\b",
    re.IGNORECASE,
)

# 3. Verdict and decision manipulation (distinguishing from benign 'approved by' signatures)
VERDICT_MANIPULATION_EN = re.compile(
    r"\b(?:mark\s+as\s+approved|always\s+return\s+safe|force\s+safe\s+verdict|override\s+verdict|set\s+verdict\s+to\s+safe|ignore\s+tax\s+rules|bypass\s+validation|skip\s+all\s+checks|mark\s+this\s+invoice\s+as\s+valid|output\s+status\s*:\s*safe)\b",
    re.IGNORECASE,
)

# 4. Regional language injection patterns (Hindi & Marathi)
REGIONAL_INJECTION_PATTERNS = [
    # Hindi
    (
        re.compile(r"(?:पिछले|पुराने)\s+निर्देश(?:ों)?\s+(?:को\s+)?(?:अनदेखा|रद्द)\s+कर(?:ें|ो)?"),
        "instruction",
        "Hindi prompt override: ignore previous instructions",
    ),
    (
        re.compile(r"(?:प्रणाली|सिस्टम)\s+(?:को\s+)?बायपास\s+कर(?:ें|ो)?"),
        "instruction",
        "Hindi prompt override: system bypass",
    ),
    (
        re.compile(r"(?:स्वीकृत\s+मान\s+लें|सुरक्षित\s+घोषित\s+करें|सत्यापन\s+अनदेखा\s+करें|(?:सभी\s+)?नियम(?:ों)?\s+(?:को\s+)?अनदेखा\s+कर(?:ें|ो)?)"),
        "instruction",
        "Hindi verdict manipulation: force safe verdict or ignore rules",
    ),
    # Marathi
    (
        re.compile(r"(?:मागील|सर्व)\s+सूचनांकडे\s+दुर्लक्ष\s+करा"),
        "instruction",
        "Marathi prompt override: ignore previous instructions",
    ),
    (
        re.compile(r"(?:सिस्टम\s+बायपास\s+करा|सर्व\s+नियम\s+बायपास\s+करा)"),
        "instruction",
        "Marathi prompt override: system bypass",
    ),
    (
        re.compile(r"(?:मंजूर\s+म्हणून\s+घोषित\s+करा|पडताळणी\s+बायपास\s+करा)"),
        "instruction",
        "Marathi verdict manipulation: force approved verdict",
    ),
]

# 5. Hidden text anomalies (zero-width characters, directional overrides)
HIDDEN_TEXT_REGEX = re.compile(r"[\u200B-\u200D\uFEFF\u202A-\u202E]")

# 6. Imperative commands directing model behavior
IMPERATIVE_COMMAND_REGEX = re.compile(
    r"\b(?:do\s+not\s+validate|never\s+flag\s+errors|pretend\s+you\s+are|respond\s+only\s+with\s+valid)\b",
    re.IGNORECASE,
)

# Benign pattern whitelist (e.g. "Approved by John", "Terms and conditions approved")
BENIGN_APPROVED_REGEX = re.compile(
    r"\bapproved\s+by\s+[A-Za-z0-9\s\.\-]{2,40}\b",
    re.IGNORECASE,
)


class InjectionScreener:
    """Heuristic prompt injection screener analyzing untrusted invoice text layers."""

    def screen(self, text: str, metadata: dict[str, Any] | None = None) -> ScreenResult:
        """Evaluates text for instruction overrides, role spoofing, hidden text, and imperative density."""
        if not text:
            return ScreenResult(text="", risk="low", action="allow", score=0.0, spans=[])

        spans: list[InjectionSpan] = []

        # Check 1: Role Markers
        for m in ROLE_MARKER_REGEX.finditer(text):
            spans.append(
                InjectionSpan(
                    start=m.start(),
                    end=m.end(),
                    text=m.group(),
                    reason="Synthetic role marker or prompt delimiter detected",
                    category="role_marker",
                )
            )

        # Check 2: Direct English Instructions
        for m in INSTRUCTION_OVERRIDE_EN.finditer(text):
            spans.append(
                InjectionSpan(
                    start=m.start(),
                    end=m.end(),
                    text=m.group(),
                    reason="Direct prompt injection instruction detected",
                    category="instruction",
                )
            )

        # Check 3: English Verdict Manipulation
        for m in VERDICT_MANIPULATION_EN.finditer(text):
            # Check if it was merely a benign "approved by" signature
            span_text = m.group()
            surrounding = text[max(0, m.start() - 10) : min(len(text), m.end() + 30)]
            if not BENIGN_APPROVED_REGEX.search(surrounding):
                spans.append(
                    InjectionSpan(
                        start=m.start(),
                        end=m.end(),
                        text=span_text,
                        reason="Attempted decision/verdict manipulation detected",
                        category="instruction",
                    )
                )

        # Check 4: Regional Language Injections
        for pattern, cat, reason in REGIONAL_INJECTION_PATTERNS:
            for m in pattern.finditer(text):
                spans.append(
                    InjectionSpan(
                        start=m.start(),
                        end=m.end(),
                        text=m.group(),
                        reason=reason,
                        category=cat,
                    )
                )

        # Check 5: Hidden text unicode anomalies
        for m in HIDDEN_TEXT_REGEX.finditer(text):
            spans.append(
                InjectionSpan(
                    start=m.start(),
                    end=m.end(),
                    text=m.group(),
                    reason="Hidden zero-width unicode character or directional override detected",
                    category="hidden_text",
                )
            )

        # Check 6: Imperative Commands
        for m in IMPERATIVE_COMMAND_REGEX.finditer(text):
            spans.append(
                InjectionSpan(
                    start=m.start(),
                    end=m.end(),
                    text=m.group(),
                    reason="Imperative model directive detected in invoice text",
                    category="imperative",
                )
            )

        # Deduplicate overlapping spans
        spans = self._deduplicate_spans(spans)

        # Determine risk, action, and score
        if not spans:
            return ScreenResult(
                text=text,
                risk="low",
                action="allow",
                score=0.0,
                spans=[],
                cleaned_text=text,
            )

        has_high_risk = any(
            s.category in {"role_marker", "instruction"} for s in spans
        )

        if has_high_risk or len(spans) >= 2:
            risk = "high"
            action = "block"
            score = min(0.85 + (len(spans) * 0.05), 1.0)
        else:
            risk = "medium"
            action = "review"
            score = 0.55

        # Create cleaned text by stripping flagged spans
        cleaned = self._strip_spans(text, spans)

        return ScreenResult(
            text=text,
            risk=risk,
            action=action,
            score=score,
            spans=spans,
            cleaned_text=cleaned,
        )

    def _deduplicate_spans(self, spans: list[InjectionSpan]) -> list[InjectionSpan]:
        if not spans:
            return []
        spans.sort(key=lambda s: (s.start, -s.end))
        deduped: list[InjectionSpan] = []
        for s in spans:
            if not deduped:
                deduped.append(s)
            else:
                last = deduped[-1]
                if s.start >= last.end:
                    deduped.append(s)
                elif s.end > last.end:
                    # Extend or keep longest
                    pass
        return deduped

    def _strip_spans(self, text: str, spans: list[InjectionSpan]) -> str:
        """Removes flagged spans from text."""
        result = []
        last_idx = 0
        for s in spans:
            result.append(text[last_idx : s.start])
            last_idx = s.end
        result.append(text[last_idx:])
        return "".join(result).strip()
