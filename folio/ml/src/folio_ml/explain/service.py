"""Core Explainer service generating plain-language findings and multilingual drafts guarded by NumberGuard."""

from typing import Any

from jinja2 import Template

from folio_ml.contracts.checks import CheckResult, Verdict
from folio_ml.contracts.invoice import Invoice
from folio_ml.explain.contracts import (
    ExplainResult,
    IssueExplanation,
    MessageVariant,
)
from folio_ml.explain.number_guard import NumberGuard
from folio_ml.explain.polisher import IdentityPolisher, Polisher
from folio_ml.explain.templates import (
    CHECK_EXPLANATION_TEMPLATES,
    FIX_CODE_INSTRUCTIONS,
    MESSAGE_TEMPLATES,
)
from folio_ml.explain.wa_link import build_whatsapp_link


class ExplainerService:
    """Explainer orchestrating template generation, multilingual drafts, and NumberGuard enforcement."""

    def __init__(self, polisher: Polisher | None = None) -> None:
        self.polisher = polisher or IdentityPolisher()
        self.number_guard = NumberGuard()

    def explain(
        self,
        invoice: Invoice,
        verdict: Verdict,
        checks: list[CheckResult],
        buyer_name: str = "Our Organization",
    ) -> ExplainResult:
        """Produces full plain-language explanations and multi-channel, multi-lingual communication drafts."""
        inv_num = str(invoice.number.value if invoice.number else "INV-UNKNOWN")
        inv_date = str(invoice.date.value if invoice.date else "")
        supp_name = str(invoice.supplier_name.value if invoice.supplier_name else "Valued Vendor")
        supp_gstin = str(invoice.supplier_gstin.value if invoice.supplier_gstin else "")

        total_amt = "0.00"
        if invoice.totals and invoice.totals.total_amount and invoice.totals.total_amount.value is not None:
            total_amt = f"{invoice.totals.total_amount.value:.2f}"

        # 1. Compile per-issue explanations
        failed_checks = [c for c in checks if c.status == "fail"]
        issue_explanations: list[IssueExplanation] = []
        issue_summaries_en: list[str] = []
        issue_summaries_hi: list[str] = []
        issue_summaries_mr: list[str] = []

        for c in failed_checks:
            tmpl_data = CHECK_EXPLANATION_TEMPLATES.get(c.check_id, {
                "what_we_found": f"Check {c.name} failed: found {c.found}.",
                "why_it_matters": c.why_it_matters or "Compliance verification failure.",
            })

            context = {
                "found": c.found or "",
                "expected": c.expected or "",
                "invoice_number": inv_num,
                "supplier_name": supp_name,
            }

            what_found = Template(tmpl_data["what_we_found"]).render(context)
            why_matters = Template(tmpl_data["why_it_matters"]).render(context)

            how_to_fix_list: list[str] = []
            for code in c.fixes:
                fix_dict = FIX_CODE_INSTRUCTIONS.get(code, {})
                how_to_fix_list.append(fix_dict.get("en", f"Resolve issue according to code {code}."))

            issue_explanations.append(
                IssueExplanation(
                    check_id=c.check_id,
                    name=c.name,
                    severity=c.severity,
                    what_we_found=what_found,
                    why_it_matters=why_matters,
                    how_to_fix=how_to_fix_list,
                    rule_table_version=c.rule_table_version,
                )
            )

            issue_summaries_en.append(c.name)
            # Add Hindi and Marathi summaries
            if c.fixes:
                first_fix = c.fixes[0]
                fix_dict = FIX_CODE_INSTRUCTIONS.get(first_fix, {})
                issue_summaries_hi.append(fix_dict.get("hi", c.name))
                issue_summaries_mr.append(fix_dict.get("mr", c.name))
            else:
                issue_summaries_hi.append(c.name)
                issue_summaries_mr.append(c.name)

        # 2. Extract allowed entities for NumberGuard verification
        allowed_entities = self.number_guard.extract_allowed_entities(
            invoice=invoice,
            verdict=verdict,
            checks=checks,
            extra_context={"buyer_name": buyer_name},
        )

        # 3. Generate message drafts
        issue_summary_en_str = "; ".join(issue_summaries_en) if issue_summaries_en else "compliance review required"
        issue_summary_hi_str = "; ".join(issue_summaries_hi) if issue_summaries_hi else "जीएसटी अनुपालन समीक्षा आवश्यक है"
        issue_summary_mr_str = "; ".join(issue_summaries_mr) if issue_summaries_mr else "जीएसटी पडताळणी आवश्यक आहे"

        issue_details_en_str = "\n".join(f"- {exp.name}: {exp.what_we_found}" for exp in issue_explanations)
        issue_details_hi_str = "\n".join(f"- {exp.name}: {exp.how_to_fix[0] if exp.how_to_fix else exp.what_we_found}" for exp in issue_explanations)
        issue_details_mr_str = "\n".join(f"- {exp.name}: {exp.how_to_fix[0] if exp.how_to_fix else exp.what_we_found}" for exp in issue_explanations)

        template_ctx: dict[str, Any] = {
            "supplier_name": supp_name,
            "invoice_number": inv_num,
            "invoice_date": inv_date,
            "total_amount": total_amt,
            "buyer_name": buyer_name,
            "issue_summary": issue_summary_en_str,
            "issue_summary_hi": issue_summary_hi_str,
            "issue_summary_mr": issue_summary_mr_str,
            "issue_details": issue_details_en_str,
            "issue_details_hi": issue_details_hi_str,
            "issue_details_mr": issue_details_mr_str,
        }

        messages: list[MessageVariant] = []

        channels: list[Any] = ["whatsapp", "email", "sms"]
        languages: list[Any] = ["en", "hi", "mr"]
        tones: list[Any] = ["polite", "firm"]

        for ch in channels:
            for lang in languages:
                for tone in tones:
                    tmpl = MESSAGE_TEMPLATES.get(ch, {}).get(lang, {}).get(tone)
                    if not tmpl:
                        continue

                    # Render deterministic Jinja2 template
                    base_text = tmpl.render(template_ctx)

                    # Optional AI Polish
                    final_text = base_text
                    polished_by_ai = False
                    number_guard_triggered = False

                    if not isinstance(self.polisher, IdentityPolisher):
                        polished_candidate = self.polisher.polish(base_text, template_ctx)
                        # Mandatory Number Guard check
                        is_valid, _violations = self.number_guard.verify_text(
                            polished_candidate, allowed_entities
                        )
                        if is_valid:
                            final_text = polished_candidate
                            polished_by_ai = True
                        else:
                            # Revert to deterministic Jinja2 template text!
                            final_text = base_text
                            number_guard_triggered = True

                    # Generate WhatsApp click-to-chat link
                    wa_link = build_whatsapp_link(final_text) if ch == "whatsapp" else None

                    messages.append(
                        MessageVariant(
                            channel=ch,
                            language=lang,
                            tone=tone,
                            content=final_text,
                            wa_link=wa_link,
                            needs_native_review=False,
                            polished_by_ai=polished_by_ai,
                            number_guard_triggered=number_guard_triggered,
                        )
                    )

        return ExplainResult(
            invoice_number=inv_num,
            supplier_name=supp_name,
            supplier_gstin=supp_gstin,
            verdict_status=verdict.status,
            rupee_at_risk=verdict.rupee_at_risk,
            explanations=issue_explanations,
            messages=messages,
        )
