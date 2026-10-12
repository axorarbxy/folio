"""Layout specifications and coordinate mappers for synthetic invoices.

Supports 5 distinct visual structures:
  1. simple: Standard B2B invoice
  2. tabular: Heavy boxed grid layout
  3. thermal_receipt: POS / retail narrow slip layout
  4. two_column: Split side-by-side corporate layout
  5. regional_mixed: Bilingual English + Hindi/Marathi (Devanagari) layout
"""

from typing import Literal

LayoutType = Literal[
    "simple",
    "tabular",
    "thermal_receipt",
    "two_column",
    "regional_mixed",
]

LAYOUT_DESCRIPTIONS = {
    "simple": "Standard modern B2B invoice with clean typography and subtle borders",
    "tabular": "Formal corporate grid with explicit boxed cells for all columns",
    "thermal_receipt": "Narrow format thermal receipt with dashed separators",
    "two_column": "Consulting and services layout with side-by-side metadata panels",
    "regional_mixed": "Bilingual invoice with Hindi/Marathi tax terminology",
}

# Regional label mappings (English -> Hindi/Marathi)
DEVANAGARI_LABELS = {
    "TAX INVOICE": "कर बीजक / TAX INVOICE",
    "SUPPLIER": "आपूर्तिकर्ता / SUPPLIER",
    "BUYER": "प्राप्तकर्ता / BUYER",
    "GSTIN": "जीएसटीआयएन / GSTIN",
    "INVOICE NO": "बीजक क्र. / INVOICE NO",
    "DATE": "दिनांक / DATE",
    "PLACE OF SUPPLY": "पुरवठा ठिकाण / PLACE OF SUPPLY",
    "DESCRIPTION": "तपशील / DESCRIPTION",
    "HSN": "एचएसएन / HSN",
    "TAXABLE AMOUNT": "करपात्र मूल्य / TAXABLE AMOUNT",
    "CGST": "केंद्रीय कर / CGST",
    "SGST": "राज्य कर / SGST",
    "IGST": "एकात्मिक कर / IGST",
    "TOTAL": "एकूण रक्कम / TOTAL",
}
