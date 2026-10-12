"""Multi-tier reconciliation matching engine with Hungarian bipartite assignment."""

import uuid
from collections import defaultdict
from datetime import datetime
from decimal import Decimal

import numpy as np
from rapidfuzz import fuzz
from scipy.optimize import linear_sum_assignment

from folio_ml.recon.contracts import (
    NormalizedRecord,
    ReconBucket,
    ReconMatch,
)


def _parse_iso_date(d_str: str) -> datetime | None:
    if not d_str:
        return None
    try:
        return datetime.strptime(d_str[:10], "%Y-%m-%d")
    except ValueError:
        return None


def _is_neighboring_period(date_str: str, period: str) -> bool:
    """Checks whether an invoice date falls into a neighboring tax period."""
    if not date_str or not period:
        return False
    dt = _parse_iso_date(date_str)
    if not dt:
        return False

    try:
        p_year, p_month = (int(x) for x in period.split("-"))
    except ValueError:
        return False

    inv_year = dt.year
    inv_month = dt.month

    # Check if exactly adjacent month (+/- 1 month)
    month_dist = (inv_year - p_year) * 12 + (inv_month - p_month)
    return abs(month_dist) == 1


class ReconciliationMatcher:
    """Reconciles internal purchase register records with GSTR-2B records."""

    def __init__(
        self,
        fuzzy_threshold: float = 75.0,
        amount_tolerance: Decimal = Decimal("1.00"),
        date_window_days: int = 30,
    ) -> None:
        self.fuzzy_threshold = fuzzy_threshold
        self.amount_tolerance = amount_tolerance
        self.date_window_days = date_window_days

    def match(
        self,
        period: str,
        books_records: list[NormalizedRecord],
        gstr2b_records: list[NormalizedRecord],
    ) -> list[ReconMatch]:
        """Executes full multi-tier reconciliation matching cascade."""
        matches: list[ReconMatch] = []

        # 1. Deduplicate check within books and within GSTR-2B
        books_valid, books_dupes = self._partition_duplicates(books_records)
        gstr2b_valid, gstr2b_dupes = self._partition_duplicates(gstr2b_records)

        for dup in books_dupes:
            matches.append(
                ReconMatch(
                    match_id=f"M-DUP-B-{uuid.uuid4().hex[:8]}",
                    bucket="duplicate",
                    supplier_gstin=dup.supplier_gstin,
                    invoice_number=dup.original_invoice_number,
                    book_amount=dup.total,
                    gstr2b_amount=None,
                    difference=dup.total,
                    score=1.0,
                    reasons=[f"Duplicate invoice entry in books for {dup.original_invoice_number}"],
                )
            )

        for dup in gstr2b_dupes:
            matches.append(
                ReconMatch(
                    match_id=f"M-DUP-2B-{uuid.uuid4().hex[:8]}",
                    bucket="duplicate",
                    supplier_gstin=dup.supplier_gstin,
                    invoice_number=dup.original_invoice_number,
                    book_amount=None,
                    gstr2b_amount=dup.total,
                    difference=dup.total,
                    score=1.0,
                    reasons=[f"Duplicate invoice entry in GSTR-2B for {dup.original_invoice_number}"],
                )
            )

        # 2. Group records by supplier GSTIN
        books_by_gstin: dict[str, list[NormalizedRecord]] = defaultdict(list)
        for r in books_valid:
            books_by_gstin[r.supplier_gstin].append(r)

        gstr2b_by_gstin: dict[str, list[NormalizedRecord]] = defaultdict(list)
        for r in gstr2b_valid:
            gstr2b_by_gstin[r.supplier_gstin].append(r)

        all_gstins = set(books_by_gstin.keys()) | set(gstr2b_by_gstin.keys())

        # 3. Process each supplier group
        for gstin in sorted(all_gstins):
            b_list = list(books_by_gstin.get(gstin, []))
            g_list = list(gstr2b_by_gstin.get(gstin, []))

            # Case A: Supplier present in books, but 0 filings in GSTR-2B
            if b_list and not g_list:
                for b in b_list:
                    matches.append(
                        ReconMatch(
                            match_id=f"M-NVF-{uuid.uuid4().hex[:8]}",
                            bucket="vendor_not_filed",
                            supplier_gstin=gstin,
                            invoice_number=b.original_invoice_number,
                            book_amount=b.total,
                            gstr2b_amount=None,
                            difference=b.total,
                            score=0.0,
                            reasons=[
                                f"Vendor {b.supplier_name or gstin} has not filed any returns in GSTR-2B for {period}"
                            ],
                        )
                    )
                continue

            # Case B: Supplier in GSTR-2B, but 0 entries in books
            if g_list and not b_list:
                for g in g_list:
                    bucket: ReconBucket = "missing_in_books"
                    reasons = ["Invoice appears in GSTR-2B but missing from purchase books"]
                    if not g.itc_available:
                        bucket = "ineligible"
                        reasons.append(f"Ineligible ITC: {g.itc_reason}")

                    matches.append(
                        ReconMatch(
                            match_id=f"M-MIB-{uuid.uuid4().hex[:8]}",
                            bucket=bucket,
                            supplier_gstin=gstin,
                            invoice_number=g.original_invoice_number,
                            book_amount=None,
                            gstr2b_amount=g.total,
                            difference=g.total,
                            score=0.0,
                            reasons=reasons,
                        )
                    )
                continue

            # Case C: Both books and GSTR-2B have records for this supplier
            matched_pairs, remaining_b, remaining_g = self._match_supplier_records(
                period, b_list, g_list
            )
            matches.extend(matched_pairs)

            # Process remaining unmatched books records
            for b in remaining_b:
                if _is_neighboring_period(b.invoice_date, period):
                    bucket = "timing_difference"
                    reasons = [
                        f"Invoice date {b.invoice_date} falls into neighboring period vs filing period {period}"
                    ]
                else:
                    bucket = "missing_in_2b"
                    reasons = [
                        f"Invoice {b.original_invoice_number} missing in GSTR-2B (vendor filed other invoices)"
                    ]

                matches.append(
                    ReconMatch(
                        match_id=f"M-M2B-{uuid.uuid4().hex[:8]}",
                        bucket=bucket,
                        supplier_gstin=gstin,
                        invoice_number=b.original_invoice_number,
                        book_amount=b.total,
                        gstr2b_amount=None,
                        difference=b.total,
                        score=0.0,
                        reasons=reasons,
                    )
                )

            # Process remaining unmatched GSTR-2B records
            for g in remaining_g:
                if _is_neighboring_period(g.invoice_date, period):
                    bucket = "timing_difference"
                    reasons = [
                        f"GSTR-2B invoice date {g.invoice_date} belongs to neighboring period"
                    ]
                else:
                    bucket = "missing_in_books"
                    reasons = [
                        f"Invoice {g.original_invoice_number} found in GSTR-2B but not in books"
                    ]

                matches.append(
                    ReconMatch(
                        match_id=f"M-MIB-{uuid.uuid4().hex[:8]}",
                        bucket=bucket,
                        supplier_gstin=gstin,
                        invoice_number=g.original_invoice_number,
                        book_amount=None,
                        gstr2b_amount=g.total,
                        difference=g.total,
                        score=0.0,
                        reasons=reasons,
                    )
                )

        return matches

    def _partition_duplicates(
        self, records: list[NormalizedRecord]
    ) -> tuple[list[NormalizedRecord], list[NormalizedRecord]]:
        seen: set[tuple[str, str]] = set()
        valid: list[NormalizedRecord] = []
        dupes: list[NormalizedRecord] = []

        for r in records:
            key = (r.supplier_gstin, r.normalized_invoice_number)
            if key in seen:
                dupes.append(r)
            else:
                seen.add(key)
                valid.append(r)

        return valid, dupes

    def _match_supplier_records(
        self,
        period: str,
        books_list: list[NormalizedRecord],
        gstr2b_list: list[NormalizedRecord],
    ) -> tuple[list[ReconMatch], list[NormalizedRecord], list[NormalizedRecord]]:
        """Matches invoices for a single supplier using exact match then Hungarian assignment."""
        matches: list[ReconMatch] = []
        remaining_books = list(books_list)
        remaining_gstr2b = list(gstr2b_list)

        # Step 1: Exact normalized invoice number matching
        exact_matched_b: set[str] = set()
        exact_matched_g: set[str] = set()

        # Build index for fast lookup
        g_by_norm = {g.normalized_invoice_number: g for g in remaining_gstr2b}

        for b in remaining_books:
            if b.normalized_invoice_number in g_by_norm:
                g = g_by_norm[b.normalized_invoice_number]
                if g.record_id not in exact_matched_g:
                    exact_matched_b.add(b.record_id)
                    exact_matched_g.add(g.record_id)
                    match_item = self._evaluate_matched_pair(
                        b, g, is_exact_invoice_num=True, rapidfuzz_ratio=100.0
                    )
                    matches.append(match_item)

        remaining_books = [b for b in remaining_books if b.record_id not in exact_matched_b]
        remaining_gstr2b = [g for g in remaining_gstr2b if g.record_id not in exact_matched_g]

        # Step 2: Fuzzy match with Hungarian assignment for remaining items
        if remaining_books and remaining_gstr2b:
            m = len(remaining_books)
            n = len(remaining_gstr2b)
            cost_matrix = np.full((m, n), 100000.0)
            ratio_matrix = np.zeros((m, n))

            for i, b in enumerate(remaining_books):
                b_date = _parse_iso_date(b.invoice_date)
                for j, g in enumerate(remaining_gstr2b):
                    ratio = float(
                        fuzz.ratio(b.normalized_invoice_number, g.normalized_invoice_number)
                    )
                    ratio_matrix[i, j] = ratio

                    g_date = _parse_iso_date(g.invoice_date)
                    date_diff = abs((b_date - g_date).days) if (b_date and g_date) else 0
                    amt_diff = float(abs(b.total - g.total))

                    # Eligible if ratio exceeds threshold, or small typo + identical amount
                    is_candidate = (
                        ratio >= self.fuzzy_threshold
                        or (amt_diff <= float(self.amount_tolerance) and ratio >= 60.0)
                    )

                    if is_candidate:
                        # Cost: lower is better
                        cost = (
                            (100.0 - ratio) * 2.0
                            + min(date_diff, self.date_window_days) * 1.5
                            + min(amt_diff, 100.0) * 0.5
                        )
                        cost_matrix[i, j] = cost

            row_ind, col_ind = linear_sum_assignment(cost_matrix)

            fuzzy_matched_b: set[str] = set()
            fuzzy_matched_g: set[str] = set()

            for r_idx, c_idx in zip(row_ind, col_ind, strict=False):
                if cost_matrix[r_idx, c_idx] < 10000.0:
                    b = remaining_books[r_idx]
                    g = remaining_gstr2b[c_idx]
                    ratio = ratio_matrix[r_idx, c_idx]

                    fuzzy_matched_b.add(b.record_id)
                    fuzzy_matched_g.add(g.record_id)

                    match_item = self._evaluate_matched_pair(
                        b, g, is_exact_invoice_num=False, rapidfuzz_ratio=ratio
                    )
                    matches.append(match_item)

            remaining_books = [b for b in remaining_books if b.record_id not in fuzzy_matched_b]
            remaining_gstr2b = [g for g in remaining_gstr2b if g.record_id not in fuzzy_matched_g]

        return matches, remaining_books, remaining_gstr2b

    def _evaluate_matched_pair(
        self,
        b: NormalizedRecord,
        g: NormalizedRecord,
        is_exact_invoice_num: bool,
        rapidfuzz_ratio: float,
    ) -> ReconMatch:
        """Determines bucket classification (matched, value_mismatch, ineligible) and diffs."""
        taxable_diff = abs(b.taxable_value - g.taxable_value)
        total_diff = abs(b.total - g.total)
        tax_diff = abs(b.tax_total - g.tax_total)

        reasons: list[str] = []
        if is_exact_invoice_num:
            score = 1.0
            inv_desc = "Exact invoice number match"
        else:
            score = round(max(0.60, rapidfuzz_ratio / 100.0), 3)
            inv_desc = (
                f"Fuzzy invoice match ({b.original_invoice_number} vs {g.original_invoice_number}, "
                f"similarity {rapidfuzz_ratio:.0f}%)"
            )

        # Check ITC eligibility first
        if not g.itc_available:
            reason_text = g.itc_reason or "Section 17(5) Blocked Credit"
            reasons.append(f"{inv_desc}; ITC is marked ineligible in GSTR-2B: {reason_text}")
            return ReconMatch(
                match_id=f"M-INEL-{uuid.uuid4().hex[:8]}",
                bucket="ineligible",
                supplier_gstin=b.supplier_gstin,
                invoice_number=b.original_invoice_number,
                book_amount=b.total,
                gstr2b_amount=g.total,
                difference=total_diff,
                score=score,
                reasons=reasons,
            )

        # Check value consistency within tolerance
        is_value_matched = (
            taxable_diff <= self.amount_tolerance
            and total_diff <= self.amount_tolerance
            and tax_diff <= self.amount_tolerance
        )

        if is_value_matched:
            reasons.append(f"{inv_desc}; values agree within ₹{self.amount_tolerance}")
            return ReconMatch(
                match_id=f"M-MATCH-{uuid.uuid4().hex[:8]}",
                bucket="matched",
                supplier_gstin=b.supplier_gstin,
                invoice_number=b.original_invoice_number,
                book_amount=b.total,
                gstr2b_amount=g.total,
                difference=total_diff,
                score=score,
                reasons=reasons,
            )

        # Value mismatch
        diff_breakdowns: list[str] = []
        if taxable_diff > self.amount_tolerance:
            diff_breakdowns.append(
                f"Taxable: Books ₹{b.taxable_value} vs 2B ₹{g.taxable_value} (diff ₹{taxable_diff})"
            )
        if tax_diff > self.amount_tolerance:
            diff_breakdowns.append(
                f"Tax: Books ₹{b.tax_total} vs 2B ₹{g.tax_total} (diff ₹{tax_diff})"
            )
        if total_diff > self.amount_tolerance:
            diff_breakdowns.append(
                f"Total: Books ₹{b.total} vs 2B ₹{g.total} (diff ₹{total_diff})"
            )

        reasons.append(f"{inv_desc}; Value discrepancy: {'; '.join(diff_breakdowns)}")

        return ReconMatch(
            match_id=f"M-MISMATCH-{uuid.uuid4().hex[:8]}",
            bucket="value_mismatch",
            supplier_gstin=b.supplier_gstin,
            invoice_number=b.original_invoice_number,
            book_amount=b.total,
            gstr2b_amount=g.total,
            difference=total_diff,
            score=min(score, 0.95),
            reasons=reasons,
        )
