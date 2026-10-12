"""Core deterministic GST compliance checks (Checks 1 to 6)."""

from decimal import Decimal

from folio_ml.contracts.checks import CheckResult
from folio_ml.contracts.invoice import Invoice
from folio_ml.rules.base import Rule, RuleContext
from folio_ml.rules.loader import match_hsn_rate
from folio_ml.utils.gstin import is_valid_gstin


class CheckGstinFormatChecksum(Rule):
    """Check 1: Verifies format and Mod 36,36 checksum for supplier and buyer GSTINs."""

    id = "gstin_format_checksum"
    name = "GSTIN Format & Checksum"
    severity = "critical"
    required = True

    def run(self, invoice: Invoice, ctx: RuleContext) -> CheckResult:
        supp_gstin = (invoice.supplier_gstin.value or "").strip()
        buyer_gstin = (invoice.buyer_gstin.value or "").strip()

        supp_ok = is_valid_gstin(supp_gstin)
        buyer_ok = is_valid_gstin(buyer_gstin) if buyer_gstin else True

        if not supp_ok:
            return CheckResult(
                check_id=self.id,
                name=self.name,
                status="fail",
                severity=self.severity,
                kind=self.kind,
                expected="Valid 15-char supplier GSTIN with valid checksum",
                found=supp_gstin,
                formula="ISO/IEC 7064 Mod 36,36 checksum algorithm",
                why_it_matters="Invalid supplier GSTIN makes the invoice legally void and blocks input tax credit.",
                fixes=["VERIFY_GSTIN_ON_PORTAL", "REQUEST_CORRECTED_INVOICE"],
                rule_table_version=ctx.version,
            )

        if not buyer_ok:
            return CheckResult(
                check_id=self.id,
                name=self.name,
                status="fail",
                severity="high",
                kind=self.kind,
                expected="Valid 15-char buyer GSTIN with valid checksum",
                found=buyer_gstin,
                formula="ISO/IEC 7064 Mod 36,36 checksum algorithm",
                why_it_matters="Buyer GSTIN error prevents ITC matching on GST portal.",
                fixes=["VERIFY_GSTIN_ON_PORTAL", "REQUEST_CORRECTED_INVOICE"],
                rule_table_version=ctx.version,
            )

        return CheckResult(
            check_id=self.id,
            name=self.name,
            status="pass",
            severity=self.severity,
            kind=self.kind,
            expected="Valid GSTIN checksums",
            found=f"Supplier: {supp_gstin}, Buyer: {buyer_gstin}",
            formula="ISO/IEC 7064 Mod 36,36 checksum algorithm",
            why_it_matters="Valid GSTINs ensure tax credit can be claimed without notice.",
            fixes=[],
            rule_table_version=ctx.version,
        )


class CheckGstinStateMatchesAddress(Rule):
    """Check 2: Verifies that the state code matches the first 2 digits of the GSTIN."""

    id = "gstin_state_matches_address"
    name = "GSTIN State Prefix Match"
    severity = "high"
    required = True

    def run(self, invoice: Invoice, ctx: RuleContext) -> CheckResult:
        supp_gstin = (invoice.supplier_gstin.value or "").strip()
        supp_state = (invoice.supplier_state.value or "").strip().zfill(2)

        if len(supp_gstin) >= 2 and supp_gstin[:2] != supp_state:
            return CheckResult(
                check_id=self.id,
                name=self.name,
                status="fail",
                severity=self.severity,
                kind=self.kind,
                expected=f"State prefix '{supp_gstin[:2]}' matching supplier state",
                found=f"State code '{supp_state}'",
                formula="gstin[:2] == supplier_state",
                why_it_matters="State mismatch causes GSTR-1 vs GSTR-3B jurisdiction discrepancies.",
                fixes=["CONFIRM_PLACE_OF_SUPPLY", "VERIFY_GSTIN_ON_PORTAL"],
                rule_table_version=ctx.version,
            )

        return CheckResult(
            check_id=self.id,
            name=self.name,
            status="pass",
            severity=self.severity,
            kind=self.kind,
            expected=f"State code '{supp_state}' matching GSTIN prefix",
            found=supp_gstin[:2] if len(supp_gstin) >= 2 else "N/A",
            formula="gstin[:2] == supplier_state",
            why_it_matters="Ensures invoice matches territorial tax registration.",
            fixes=[],
            rule_table_version=ctx.version,
        )


class CheckTaxTypeVsPlaceOfSupply(Rule):
    """Check 3: Verifies CGST+SGST vs IGST based on supplier state and place of supply."""

    id = "tax_type_vs_place_of_supply"
    name = "Tax Type vs Place of Supply"
    severity = "critical"
    required = True

    def run(self, invoice: Invoice, ctx: RuleContext) -> CheckResult:
        supp_state = (invoice.supplier_state.value or "").strip().zfill(2)
        pos = (invoice.place_of_supply.value or "").strip().zfill(2)

        cgst = invoice.totals.cgst_amount.value
        sgst = invoice.totals.sgst_amount.value
        igst = invoice.totals.igst_amount.value

        # Special economic zone / export / other territory
        if pos in {"97", "99"}:
            return CheckResult(
                check_id=self.id,
                name=self.name,
                status="inconclusive",
                severity="medium",
                kind=self.kind,
                expected="Standard Place of Supply",
                found=f"Special territorial code '{pos}'",
                formula="SEZ / Export / Other Territory exemption rules apply",
                why_it_matters="Requires checking SEZ LUT or bond status before deciding taxability.",
                fixes=["CONFIRM_PLACE_OF_SUPPLY", "CONFIRM_RATE_WITH_CA"],
                rule_table_version=ctx.version,
            )

        is_intrastate = supp_state == pos

        if is_intrastate:
            # Intra-state: Must be CGST + SGST; IGST must be 0
            if igst > Decimal("0.00") and (cgst == Decimal("0.00") or sgst == Decimal("0.00")):
                return CheckResult(
                    check_id=self.id,
                    name=self.name,
                    status="fail",
                    severity=self.severity,
                    kind=self.kind,
                    expected=f"Intra-state supply (state {supp_state}) requires CGST + SGST",
                    found=f"IGST ₹{igst} charged instead",
                    formula="supplier_state == place_of_supply -> CGST + SGST (IGST = 0)",
                    why_it_matters="Charging IGST on intra-state supply is incorrect law and disallows credit under Section 16(2).",
                    fixes=["REQUEST_CORRECTED_INVOICE", "CONFIRM_PLACE_OF_SUPPLY"],
                    rule_table_version=ctx.version,
                )
        else:
            # Inter-state: Must be IGST; CGST and SGST must be 0
            if (cgst > Decimal("0.00") or sgst > Decimal("0.00")) and igst == Decimal("0.00"):
                return CheckResult(
                    check_id=self.id,
                    name=self.name,
                    status="fail",
                    severity=self.severity,
                    kind=self.kind,
                    expected=f"Inter-state supply (state {supp_state} to {pos}) requires IGST",
                    found=f"CGST ₹{cgst} + SGST ₹{sgst} charged instead",
                    formula="supplier_state != place_of_supply -> IGST (CGST = SGST = 0)",
                    why_it_matters="Central & State tax cannot be claimed for cross-border transactions.",
                    fixes=["REQUEST_CORRECTED_INVOICE", "CONFIRM_PLACE_OF_SUPPLY"],
                    rule_table_version=ctx.version,
                )

        return CheckResult(
            check_id=self.id,
            name=self.name,
            status="pass",
            severity=self.severity,
            kind=self.kind,
            expected="Correct tax bifurcation matching POS",
            found=f"{'Intra-state (CGST+SGST)' if is_intrastate else 'Inter-state (IGST)'}",
            formula="supplier_state == place_of_supply ? (CGST+SGST) : IGST",
            why_it_matters="Ensures seamless ITC eligibility across states.",
            fixes=[],
            rule_table_version=ctx.version,
        )


class CheckHsnRateMatch(Rule):
    """Check 4: Matches HSN rate using longest prefix match.

    HARD RULE: Needs a verified rate entry to pass. An unverified entry must never produce a safe verdict.
    Unknown code gives inconclusive.
    """

    id = "hsn_rate_match"
    name = "HSN Rate Table Match"
    severity = "high"
    required = True

    def run(self, invoice: Invoice, ctx: RuleContext) -> CheckResult:
        if not invoice.items:
            return CheckResult(
                check_id=self.id,
                name=self.name,
                status="inconclusive",
                severity=self.severity,
                kind=self.kind,
                expected="Line items with HSN codes",
                found="No items present",
                formula="longest_prefix_match(hsn, rates)",
                why_it_matters="Cannot verify rates without line items.",
                fixes=["REQUEST_CORRECTED_INVOICE"],
                rule_table_version=ctx.version,
            )

        for idx, item in enumerate(invoice.items):
            hsn = item.hsn.value
            actual_rate = (
                (item.cgst_pct.value or Decimal("0.00"))
                + (item.sgst_pct.value or Decimal("0.00"))
                + (item.igst_pct.value or Decimal("0.00"))
            )
            matched_entry = match_hsn_rate(hsn, ctx.bundle.rates, charged_rate=actual_rate)

            if not matched_entry:
                return CheckResult(
                    check_id=self.id,
                    name=self.name,
                    status="inconclusive",
                    severity=self.severity,
                    kind=self.kind,
                    expected=f"HSN {hsn} in verified schedule",
                    found="Unknown HSN code",
                    formula="longest_prefix_match(8, 6, 4, 2 digits)",
                    why_it_matters="Unknown HSN code requires manual verification against latest CBIC rate schedule.",
                    fixes=["CONFIRM_RATE_WITH_CA"],
                    rule_table_version=ctx.version,
                )

            # HARD RULE: Unverified entries must NEVER yield pass!
            if not matched_entry.verified:
                return CheckResult(
                    check_id=self.id,
                    name=self.name,
                    status="inconclusive",
                    severity=self.severity,
                    kind=self.kind,
                    expected=f"Verified legal rate entry for HSN {hsn}",
                    found=f"Unverified entry: {matched_entry.rate_pct}% (TODO: legal signoff required)",
                    formula="rate_entry.verified == True",
                    why_it_matters="Rule table entry is unverified and cannot produce a safe verdict without human legal signoff.",
                    fixes=["CONFIRM_RATE_WITH_CA"],
                    rule_table_version=ctx.version,
                )

            # If verified, compare item charged rate against matched entry rate
            actual_rate = (item.cgst_pct.value or Decimal("0.00")) + (item.sgst_pct.value or Decimal("0.00")) + (item.igst_pct.value or Decimal("0.00"))
            if abs(actual_rate - matched_entry.rate_pct) > Decimal("0.01"):
                return CheckResult(
                    check_id=self.id,
                    name=self.name,
                    status="fail",
                    severity=self.severity,
                    kind=self.kind,
                    expected=f"HSN {hsn} rate of {matched_entry.rate_pct}%",
                    found=f"Charged {actual_rate}% on item #{idx+1}",
                    formula="charged_rate == schedule_rate",
                    why_it_matters="Incorrect rate leads to tax short-payment demand or excess input tax disallowance.",
                    fixes=["REQUEST_CORRECTED_INVOICE", "CONFIRM_RATE_WITH_CA"],
                    rule_table_version=ctx.version,
                )

        return CheckResult(
            check_id=self.id,
            name=self.name,
            status="pass",
            severity=self.severity,
            kind=self.kind,
            expected="All line item rates match verified HSN schedule",
            found="All rates match schedule",
            formula="charged_rate == schedule_rate",
            why_it_matters="Ensures correct tax computation.",
            fixes=[],
            rule_table_version=ctx.version,
        )


class CheckLineMath(Rule):
    """Check 5: Verifies quantity * rate == taxable for all line items."""

    id = "line_math"
    name = "Line Item Math"
    severity = "critical"
    required = True

    def run(self, invoice: Invoice, ctx: RuleContext) -> CheckResult:
        if not invoice.items:
            return CheckResult(
                check_id=self.id,
                name=self.name,
                status="inconclusive",
                severity=self.severity,
                kind=self.kind,
                expected="Line items",
                found="Empty",
                formula="qty * rate == taxable",
                why_it_matters="Cannot compute line items.",
                fixes=["REQUEST_CORRECTED_INVOICE"],
                rule_table_version=ctx.version,
            )

        for idx, item in enumerate(invoice.items):
            if item.qty.value is not None and item.rate.value is not None:
                expected_taxable = (item.qty.value * item.rate.value).quantize(Decimal("0.01"))
                actual_taxable = item.taxable.value.quantize(Decimal("0.01"))
                diff = abs(expected_taxable - actual_taxable)

                if diff > ctx.tolerance:
                    return CheckResult(
                        check_id=self.id,
                        name=self.name,
                        status="fail",
                        severity=self.severity,
                        kind=self.kind,
                        expected=f"Line #{idx+1} taxable: ₹{expected_taxable}",
                        found=f"Taxable: ₹{actual_taxable} (diff ₹{diff})",
                        formula="qty * rate == taxable",
                        why_it_matters="Line arithmetic mismatch invalidates document valuation.",
                        fixes=["REQUEST_CORRECTED_INVOICE"],
                        rule_table_version=ctx.version,
                    )

        return CheckResult(
            check_id=self.id,
            name=self.name,
            status="pass",
            severity=self.severity,
            kind=self.kind,
            expected="qty * rate == taxable within tolerance",
            found="All line item math verified",
            formula="qty * rate == taxable",
            why_it_matters="Mathematical accuracy.",
            fixes=[],
            rule_table_version=ctx.version,
        )


class CheckTaxMath(Rule):
    """Check 6: Verifies tax calculation and grand total reconciliation."""

    id = "tax_math"
    name = "Tax & Grand Total Math"
    severity = "critical"
    required = True

    def run(self, invoice: Invoice, ctx: RuleContext) -> CheckResult:
        taxable = invoice.totals.taxable_amount.value
        cgst = invoice.totals.cgst_amount.value
        sgst = invoice.totals.sgst_amount.value
        igst = invoice.totals.igst_amount.value
        cess = invoice.totals.cess_amount.value
        grand_total = invoice.totals.total_amount.value

        computed_total = taxable + cgst + sgst + igst + cess
        diff = abs(computed_total - grand_total)

        if diff > ctx.tolerance:
            return CheckResult(
                check_id=self.id,
                name=self.name,
                status="fail",
                severity=self.severity,
                kind=self.kind,
                expected=f"Total: ₹{computed_total} (taxable + taxes)",
                found=f"Found total: ₹{grand_total} (diff ₹{diff})",
                formula="taxable_amount + cgst + sgst + igst + cess == total_amount",
                why_it_matters="Reconciliation failure between components and total violates invoice rules.",
                fixes=["REQUEST_CORRECTED_INVOICE", "REQUEST_CREDIT_NOTE"],
                rule_table_version=ctx.version,
            )

        return CheckResult(
            check_id=self.id,
            name=self.name,
            status="pass",
            severity=self.severity,
            kind=self.kind,
            expected="Sum of parts equals grand total within ₹1.00 tolerance",
            found=f"Total ₹{grand_total} matches parts within ₹{diff}",
            formula="sum(parts) == total_amount",
            why_it_matters="Ensures invoice accounting consistency.",
            fixes=[],
            rule_table_version=ctx.version,
        )
