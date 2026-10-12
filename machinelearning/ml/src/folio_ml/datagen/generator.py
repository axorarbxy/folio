"""Synthetic invoice generator and visual renderer.

Generates structurally and mathematically valid GST invoices matching the Invoice contract.
Computes deterministic Decimal tax amounts, normalized bounding boxes, and IRN/QR codes.
Renders invoice images across 5 distinct visual layout templates using Pillow.
"""

import hashlib
import random
from decimal import Decimal

from PIL import Image, ImageDraw

from folio_ml.contracts.base import Box, Field
from folio_ml.contracts.invoice import Invoice, InvoiceTotals, LineItem
from folio_ml.datagen.catalog import CATALOG, CatalogItem
from folio_ml.datagen.layouts import DEVANAGARI_LABELS, LayoutType
from folio_ml.datagen.profiles import PROFILES, BusinessProfile
from folio_ml.utils.money import quantize_money


def generate_clean_invoice(
    seed: int = 100,
    layout_type: LayoutType = "simple",
    invoice_number: str | None = None,
    invoice_date: str | None = None,
) -> Invoice:
    """Generates a clean, schema-valid synthetic Invoice adhering to GST tax rules."""
    rng = random.Random(seed)

    supp: BusinessProfile = rng.choice(PROFILES)
    possible_buyers = [p for p in PROFILES if p["gstin"] != supp["gstin"]]
    buyer: BusinessProfile = rng.choice(possible_buyers)

    inv_num = invoice_number or f"INV-2024-{rng.randint(1000, 9999)}"
    inv_date = invoice_date or f"2024-{rng.randint(4, 9):02d}-{rng.randint(1, 28):02d}"

    # Intra-state vs Inter-state supply rule
    is_interstate = supp["state_code"] != buyer["state_code"]
    place_of_supply = buyer["state_code"]

    num_items = rng.randint(1, 4)
    catalog_sample: list[CatalogItem] = rng.sample(CATALOG, num_items)

    line_items: list[LineItem] = []
    tot_taxable = Decimal("0.00")
    tot_cgst = Decimal("0.00")
    tot_sgst = Decimal("0.00")
    tot_igst = Decimal("0.00")
    tot_cess = Decimal("0.00")

    y_start = 0.42
    row_height = 0.06

    for idx, cat_item in enumerate(catalog_sample):
        qty = Decimal(str(rng.randint(1, 50)))
        rate = cat_item["typical_price"]
        line_taxable = quantize_money(qty * rate)
        rate_pct = cat_item["rate_pct"]

        if is_interstate:
            cgst_pct = Decimal("0.00")
            sgst_pct = Decimal("0.00")
            igst_pct = rate_pct
            line_cgst = Decimal("0.00")
            line_sgst = Decimal("0.00")
            line_igst = quantize_money(line_taxable * igst_pct / Decimal("100"))
        else:
            cgst_pct = rate_pct / Decimal("2")
            sgst_pct = rate_pct / Decimal("2")
            igst_pct = Decimal("0.00")
            line_cgst = quantize_money(line_taxable * cgst_pct / Decimal("100"))
            line_sgst = quantize_money(line_taxable * sgst_pct / Decimal("100"))
            line_igst = Decimal("0.00")

        tot_taxable += line_taxable
        tot_cgst += line_cgst
        tot_sgst += line_sgst
        tot_igst += line_igst

        cur_y = y_start + (idx * row_height)
        item_box = Box(page=1, x0=0.08, y0=cur_y, x1=0.92, y1=cur_y + 0.05)

        line_items.append(
            LineItem(
                description=Field(value=cat_item["description"], confidence=0.98, box=item_box),
                hsn=Field(value=cat_item["hsn_sac"], confidence=0.97),
                qty=Field(value=qty, confidence=0.99),
                unit=Field(value=cat_item["unit"], confidence=0.99),
                rate=Field(value=rate, confidence=0.98),
                taxable=Field(value=line_taxable, confidence=0.99),
                cgst_pct=Field(value=cgst_pct, confidence=0.96),
                sgst_pct=Field(value=sgst_pct, confidence=0.96),
                igst_pct=Field(value=igst_pct, confidence=0.96),
                cess_pct=Field(value=Decimal("0.00"), confidence=0.99),
            )
        )

    tot_amount = tot_taxable + tot_cgst + tot_sgst + tot_igst + tot_cess

    totals = InvoiceTotals(
        taxable_amount=Field(
            value=tot_taxable,
            confidence=0.99,
            box=Box(page=1, x0=0.65, y0=0.72, x1=0.92, y1=0.75),
        ),
        cgst_amount=Field(
            value=tot_cgst,
            confidence=0.98,
            box=Box(page=1, x0=0.65, y0=0.75, x1=0.92, y1=0.78),
        ),
        sgst_amount=Field(
            value=tot_sgst,
            confidence=0.98,
            box=Box(page=1, x0=0.65, y0=0.78, x1=0.92, y1=0.81),
        ),
        igst_amount=Field(
            value=tot_igst,
            confidence=0.98,
            box=Box(page=1, x0=0.65, y0=0.81, x1=0.92, y1=0.84),
        ),
        cess_amount=Field(
            value=tot_cess,
            confidence=0.99,
            box=Box(page=1, x0=0.65, y0=0.84, x1=0.92, y1=0.86),
        ),
        total_amount=Field(
            value=tot_amount,
            confidence=0.99,
            box=Box(page=1, x0=0.65, y0=0.86, x1=0.92, y1=0.90),
        ),
    )

    # e-Invoice IRN presence (e-invoicing mandatory if turnover > 5 Cr)
    irn_val: str | None = None
    if supp["annual_turnover_cr"] >= 5.0:
        raw_irn_str = f"{supp['gstin']}{buyer['gstin']}{inv_num}{inv_date}"
        irn_val = hashlib.sha256(raw_irn_str.encode()).hexdigest()

    doc_hash = hashlib.sha256(f"{supp['gstin']}_{inv_num}_{seed}".encode()).hexdigest()

    return Invoice(
        id=inv_num,
        source_file_hash=doc_hash,
        supplier_name=Field(
            value=supp["name"],
            confidence=0.99,
            box=Box(page=1, x0=0.08, y0=0.10, x1=0.55, y1=0.14),
        ),
        supplier_gstin=Field(
            value=supp["gstin"],
            confidence=0.99,
            box=Box(page=1, x0=0.08, y0=0.14, x1=0.45, y1=0.17),
        ),
        supplier_state=Field(
            value=supp["state_code"],
            confidence=0.99,
            box=Box(page=1, x0=0.08, y0=0.17, x1=0.35, y1=0.20),
        ),
        buyer_name=Field(
            value=buyer["name"],
            confidence=0.99,
            box=Box(page=1, x0=0.08, y0=0.24, x1=0.55, y1=0.28),
        ),
        buyer_gstin=Field(
            value=buyer["gstin"],
            confidence=0.99,
            box=Box(page=1, x0=0.08, y0=0.28, x1=0.45, y1=0.31),
        ),
        buyer_state=Field(
            value=buyer["state_code"],
            confidence=0.99,
            box=Box(page=1, x0=0.08, y0=0.31, x1=0.35, y1=0.34),
        ),
        number=Field(
            value=inv_num,
            confidence=0.99,
            box=Box(page=1, x0=0.60, y0=0.10, x1=0.92, y1=0.14),
        ),
        date=Field(
            value=inv_date,
            confidence=0.99,
            box=Box(page=1, x0=0.60, y0=0.14, x1=0.92, y1=0.17),
        ),
        place_of_supply=Field(
            value=place_of_supply,
            confidence=0.99,
            box=Box(page=1, x0=0.60, y0=0.17, x1=0.92, y1=0.20),
        ),
        reverse_charge=Field(
            value=False,
            confidence=0.99,
            box=Box(page=1, x0=0.60, y0=0.20, x1=0.92, y1=0.23),
        ),
        irn=Field(
            value=irn_val,
            confidence=0.98 if irn_val else 0.90,
            box=Box(page=1, x0=0.08, y0=0.05, x1=0.92, y1=0.08) if irn_val else None,
        ),
        items=line_items,
        totals=totals,
        status="draft",
    )


def render_invoice_image(
    invoice: Invoice,
    layout_type: LayoutType = "simple",
    width: int = 800,
    height: int = 1100,
) -> Image.Image:
    """Renders visual representation of the invoice according to specified layout template."""
    img = Image.new("RGB", (width, height), color="white")
    draw = ImageDraw.Draw(img)

    # Header / Title
    title = "TAX INVOICE"
    if layout_type == "regional_mixed":
        title = DEVANAGARI_LABELS.get("TAX INVOICE", title)

    draw.text((width * 0.35, height * 0.02), title, fill="black")
    draw.line([(width * 0.05, height * 0.05), (width * 0.95, height * 0.05)], fill="gray", width=2)

    # IRN if present
    if invoice.irn.value:
        draw.text(
            (width * 0.08, height * 0.06),
            f"IRN: {invoice.irn.value[:32]}...",
            fill="black",
        )

    # Supplier details
    supp_label = "SUPPLIER:" if layout_type != "regional_mixed" else DEVANAGARI_LABELS["SUPPLIER"]
    draw.text((width * 0.08, height * 0.09), supp_label, fill="gray")
    draw.text((width * 0.08, height * 0.11), str(invoice.supplier_name.value), fill="black")
    draw.text(
        (width * 0.08, height * 0.14),
        f"GSTIN: {invoice.supplier_gstin.value} | State: {invoice.supplier_state.value}",
        fill="black",
    )

    # Invoice Meta
    draw.text((width * 0.60, height * 0.09), "INVOICE DETAILS:", fill="gray")
    draw.text((width * 0.60, height * 0.11), f"Invoice No: {invoice.number.value}", fill="black")
    draw.text((width * 0.60, height * 0.14), f"Date: {invoice.date.value}", fill="black")
    draw.text((width * 0.60, height * 0.17), f"Place of Supply: {invoice.place_of_supply.value}", fill="black")

    draw.line([(width * 0.05, height * 0.22), (width * 0.95, height * 0.22)], fill="lightgray", width=1)

    # Buyer details
    buyer_label = "BUYER / RECIPIENT:" if layout_type != "regional_mixed" else DEVANAGARI_LABELS["BUYER"]
    draw.text((width * 0.08, height * 0.24), buyer_label, fill="gray")
    draw.text((width * 0.08, height * 0.26), str(invoice.buyer_name.value), fill="black")
    draw.text(
        (width * 0.08, height * 0.29),
        f"GSTIN: {invoice.buyer_gstin.value} | State: {invoice.buyer_state.value}",
        fill="black",
    )

    # Table Header
    table_y = height * 0.38
    draw.rectangle([(width * 0.05, table_y), (width * 0.95, table_y + 30)], fill="#f0f0f0", outline="black")
    draw.text((width * 0.08, table_y + 8), "Description", fill="black")
    draw.text((width * 0.45, table_y + 8), "HSN", fill="black")
    draw.text((width * 0.58, table_y + 8), "Qty", fill="black")
    draw.text((width * 0.68, table_y + 8), "Rate", fill="black")
    draw.text((width * 0.80, table_y + 8), "Taxable Amt", fill="black")

    # Line items
    cur_y = table_y + 35
    for item in invoice.items:
        desc = (item.description.value or "")[:30]
        hsn = item.hsn.value or "-"
        qty_str = str(item.qty.value) if item.qty.value else "1"
        rate_str = f"{item.rate.value:.2f}" if item.rate.value else "0.00"
        taxable_str = f"{item.taxable.value:.2f}"

        draw.text((width * 0.08, cur_y), desc, fill="black")
        draw.text((width * 0.45, cur_y), hsn, fill="black")
        draw.text((width * 0.58, cur_y), qty_str, fill="black")
        draw.text((width * 0.68, cur_y), rate_str, fill="black")
        draw.text((width * 0.80, cur_y), taxable_str, fill="black")

        if layout_type == "tabular":
            draw.line([(width * 0.05, cur_y + 22), (width * 0.95, cur_y + 22)], fill="#e0e0e0")
        elif layout_type == "thermal_receipt":
            draw.text((width * 0.05, cur_y + 15), "-" * 60, fill="gray")

        cur_y += 30

    # Summary box
    sum_y = height * 0.72
    draw.rectangle([(width * 0.55, sum_y), (width * 0.95, sum_y + 150)], outline="black", width=1)
    draw.text((width * 0.58, sum_y + 10), f"Taxable Amount: ₹{invoice.totals.taxable_amount.value:.2f}", fill="black")
    draw.text((width * 0.58, sum_y + 35), f"CGST Amount:    ₹{invoice.totals.cgst_amount.value:.2f}", fill="black")
    draw.text((width * 0.58, sum_y + 60), f"SGST Amount:    ₹{invoice.totals.sgst_amount.value:.2f}", fill="black")
    draw.text((width * 0.58, sum_y + 85), f"IGST Amount:    ₹{invoice.totals.igst_amount.value:.2f}", fill="black")
    draw.text(
        (width * 0.58, sum_y + 115),
        f"Total Invoice:  ₹{invoice.totals.total_amount.value:.2f}",
        fill="black",
    )

    # Footer
    footer_text = "This is a computer generated invoice. No signature required."
    draw.text((width * 0.20, height * 0.93), footer_text, fill="gray")

    return img
