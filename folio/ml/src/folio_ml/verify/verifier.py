"""Independent verifier recomputing arithmetic and statutory consistency without trusting reader totals."""

from datetime import UTC, datetime
from decimal import Decimal

from folio_ml.contracts.invoice import Invoice
from folio_ml.verify.contracts import VerifierFlag


class IndependentVerifier:
    """Independent verification engine checking math and consistency defensively."""

    def verify(self, invoice: Invoice) -> list[VerifierFlag]:
        flags: list[VerifierFlag] = []

        # 1. Line-item math: qty * rate vs taxable
        sum_line_taxable = Decimal("0.00")
        sum_line_cgst = Decimal("0.00")
        sum_line_sgst = Decimal("0.00")
        sum_line_igst = Decimal("0.00")

        if invoice.items:
            for idx, item in enumerate(invoice.items, start=1):
                qty = item.qty.value if item.qty and item.qty.value else None
                rate = item.rate.value if item.rate and item.rate.value else None
                taxable = item.taxable.value if item.taxable and item.taxable.value else None

                if qty is not None and rate is not None and taxable is not None:
                    expected_taxable = (qty * rate).quantize(Decimal("0.01"))
                    diff = abs(taxable - expected_taxable)
                    if diff > Decimal("0.10"):
                        flags.append(
                            VerifierFlag(
                                field=f"items[{idx}].taxable",
                                message=f"Line {idx} math discrepancy: qty ({qty}) * rate ({rate}) = ₹{expected_taxable}, but found ₹{taxable}",
                                severity="high",
                                expected=str(expected_taxable),
                                found=str(taxable),
                            )
                        )

                if taxable is not None:
                    sum_line_taxable += taxable

                # Check intra-state rate equality on line
                cgst_pct = item.cgst_pct.value if item.cgst_pct and item.cgst_pct.value else Decimal("0.00")
                sgst_pct = item.sgst_pct.value if item.sgst_pct and item.sgst_pct.value else Decimal("0.00")
                igst_pct = item.igst_pct.value if item.igst_pct and item.igst_pct.value else Decimal("0.00")

                if cgst_pct != sgst_pct:
                    flags.append(
                        VerifierFlag(
                            field=f"items[{idx}].cgst_sgst_rate",
                            message=f"Line {idx} intra-state tax rate asymmetry: CGST ({cgst_pct}%) != SGST ({sgst_pct}%)",
                            severity="critical",
                            expected=str(cgst_pct),
                            found=str(sgst_pct),
                        )
                    )

                if igst_pct > 0 and (cgst_pct > 0 or sgst_pct > 0):
                    flags.append(
                        VerifierFlag(
                            field=f"items[{idx}].tax_type_conflict",
                            message=f"Line {idx} simultaneously charges IGST ({igst_pct}%) and CGST/SGST",
                            severity="critical",
                            expected="Mutually exclusive tax types",
                            found="Simultaneous IGST and CGST/SGST",
                        )
                    )

                # Accumulate taxes
                if taxable is not None:
                    sum_line_cgst += (taxable * cgst_pct / Decimal("100")).quantize(Decimal("0.01"))
                    sum_line_sgst += (taxable * sgst_pct / Decimal("100")).quantize(Decimal("0.01"))
                    sum_line_igst += (taxable * igst_pct / Decimal("100")).quantize(Decimal("0.01"))

        # 2. Recompute grand totals vs header totals
        if invoice.totals:
            hdr_taxable = invoice.totals.taxable_amount.value if invoice.totals.taxable_amount else Decimal("0.00")
            hdr_cgst = invoice.totals.cgst_amount.value if invoice.totals.cgst_amount else Decimal("0.00")
            hdr_sgst = invoice.totals.sgst_amount.value if invoice.totals.sgst_amount else Decimal("0.00")
            hdr_igst = invoice.totals.igst_amount.value if invoice.totals.igst_amount else Decimal("0.00")
            hdr_cess = invoice.totals.cess_amount.value if invoice.totals.cess_amount else Decimal("0.00")
            hdr_total = invoice.totals.total_amount.value if invoice.totals.total_amount else Decimal("0.00")

            # Compare sum of lines taxable vs header taxable
            if invoice.items and abs(sum_line_taxable - hdr_taxable) > Decimal("1.00"):
                flags.append(
                    VerifierFlag(
                        field="totals.taxable_amount",
                        message=f"Header taxable amount (₹{hdr_taxable}) does not match sum of line items (₹{sum_line_taxable})",
                        severity="high",
                        expected=str(sum_line_taxable),
                        found=str(hdr_taxable),
                    )
                )

            # Independent grand total calculation
            recomputed_total = hdr_taxable + hdr_cgst + hdr_sgst + hdr_igst + hdr_cess
            total_diff = abs(hdr_total - recomputed_total)
            if total_diff > Decimal("1.00"):
                flags.append(
                    VerifierFlag(
                        field="totals.total_amount",
                        message=f"Grand total discrepancy: taxable + taxes = ₹{recomputed_total}, but invoice states ₹{hdr_total} (diff ₹{total_diff})",
                        severity="critical",
                        expected=str(recomputed_total),
                        found=str(hdr_total),
                    )
                )

        # 3. Supplier GSTIN vs State Code consistency
        supp_gstin = invoice.supplier_gstin.value if invoice.supplier_gstin else ""
        supp_state = invoice.supplier_state.value if invoice.supplier_state else ""
        if supp_gstin and len(supp_gstin) >= 2 and supp_state:
            gstin_state = supp_gstin[:2]
            if gstin_state != supp_state:
                flags.append(
                    VerifierFlag(
                        field="supplier_state",
                        message=f"Supplier state code ({supp_state}) does not match first 2 digits of supplier GSTIN ({gstin_state})",
                        severity="critical",
                        expected=gstin_state,
                        found=supp_state,
                    )
                )

        # 4. Date plausibility
        inv_date_str = invoice.date.value if invoice.date else ""
        if inv_date_str:
            try:
                inv_date = datetime.strptime(inv_date_str[:10], "%Y-%m-%d").date()
                today = datetime.now(UTC).date()
                if inv_date > today:
                    flags.append(
                        VerifierFlag(
                            field="date",
                            message=f"Invoice date {inv_date} is in the future (today is {today})",
                            severity="high",
                            expected=f"<= {today}",
                            found=str(inv_date),
                        )
                    )
                elif (today - inv_date).days > 365 * 6:
                    flags.append(
                        VerifierFlag(
                            field="date",
                            message=f"Invoice date {inv_date} exceeds 6-year statutory record retention limit",
                            severity="medium",
                            expected=f">= {today.year - 6}",
                            found=str(inv_date),
                        )
                    )
            except Exception:
                flags.append(
                    VerifierFlag(
                        field="date",
                        message=f"Malformed invoice date string: '{inv_date_str}'",
                        severity="high",
                        expected="YYYY-MM-DD",
                        found=inv_date_str,
                    )
                )

        return flags
