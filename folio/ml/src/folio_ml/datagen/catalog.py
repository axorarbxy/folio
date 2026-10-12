"""Synthetic products and services catalog.

Contains 60 items with plausible HSN/SAC codes and rates.
All rates are explicitly marked `generator_only: True` — they serve as
synthetic test ground truth and MUST NOT be used as the authoritative legal rate table.
"""

from decimal import Decimal
from typing import TypedDict


class CatalogItem(TypedDict):
    hsn_sac: str
    description: str
    unit: str
    typical_price: Decimal
    rate_pct: Decimal
    generator_only: bool


CATALOG: list[CatalogItem] = [
    # Manufacturing & Fasteners (HSN 7318) - 18%
    {"hsn_sac": "7318", "description": "Hex Bolt High Tensile M10x50mm", "unit": "NOS", "typical_price": Decimal("14.50"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "7318", "description": "Stainless Steel Washer SS304 M12", "unit": "NOS", "typical_price": Decimal("3.20"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "7318", "description": "Nylon Lock Nut M8 Grade 8", "unit": "NOS", "typical_price": Decimal("2.80"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "7318", "description": "Socket Head Cap Screw M6x25", "unit": "NOS", "typical_price": Decimal("8.50"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "7318", "description": "Threaded Rod Zinc Plated 1 Meter M16", "unit": "NOS", "typical_price": Decimal("240.00"), "rate_pct": Decimal("18.00"), "generator_only": True},

    # Iron & Steel Raw Materials (HSN 7208) - 18%
    {"hsn_sac": "7208", "description": "Hot Rolled Mild Steel Sheet 2.5mm", "unit": "KGS", "typical_price": Decimal("62.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "7208", "description": "Cold Rolled Steel Strip Coil 1.2mm", "unit": "KGS", "typical_price": Decimal("74.50"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "7214", "description": "TMT Rebars Fe500D 12mm", "unit": "KGS", "typical_price": Decimal("58.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "7216", "description": "Mild Steel Angle 50x50x5mm", "unit": "MTR", "typical_price": Decimal("285.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "7306", "description": "Galvanized ERW Hollow Pipe 2 Inch", "unit": "MTR", "typical_price": Decimal("320.00"), "rate_pct": Decimal("18.00"), "generator_only": True},

    # Machinery & Mechanical Components (HSN 8481, 8483) - 18%
    {"hsn_sac": "8481", "description": "Cast Iron Ball Valve 2-Way 25mm", "unit": "NOS", "typical_price": Decimal("1250.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "8481", "description": "Pneumatic Solenoid Valve 24V DC", "unit": "NOS", "typical_price": Decimal("2850.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "8482", "description": "Deep Groove Ball Bearing 6205-2RS", "unit": "NOS", "typical_price": Decimal("380.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "8483", "description": "Flexible Jaw Coupling Spider Size 95", "unit": "SET", "typical_price": Decimal("850.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "8413", "description": "Centrifugal Monoblock Water Pump 2HP", "unit": "NOS", "typical_price": Decimal("8400.00"), "rate_pct": Decimal("18.00"), "generator_only": True},

    # Electrical & Electronics (HSN 8544, 8536) - 18%
    {"hsn_sac": "8544", "description": "Copper Armoured Power Cable 4 Core 16sqmm", "unit": "MTR", "typical_price": Decimal("480.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "8544", "description": "Flexible Single Core Wire 2.5sqmm Red", "unit": "MTR", "typical_price": Decimal("28.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "8536", "description": "Miniature Circuit Breaker MCB 32A TP C-Curve", "unit": "NOS", "typical_price": Decimal("680.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "8536", "description": "Industrial Power Contactor 3P 25A 220V", "unit": "NOS", "typical_price": Decimal("1450.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "8504", "description": "Industrial SMPS Power Supply 24V 10A", "unit": "NOS", "typical_price": Decimal("2100.00"), "rate_pct": Decimal("18.00"), "generator_only": True},

    # Polymers & Plastics (HSN 3901, 3902, 3923) - 18%
    {"hsn_sac": "3901", "description": "HDPE Granules Extrusion Grade Resin", "unit": "KGS", "typical_price": Decimal("108.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "3902", "description": "Polypropylene Homopolymer Pellets", "unit": "KGS", "typical_price": Decimal("98.50"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "3923", "description": "Corrugated Plastic Storage Bins 40L", "unit": "NOS", "typical_price": Decimal("420.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "3917", "description": "Flexible Pneumatic PU Tube 8mm Blue", "unit": "MTR", "typical_price": Decimal("35.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "3926", "description": "Nylon Cable Tie 300mm Black 100pk", "unit": "PKT", "typical_price": Decimal("160.00"), "rate_pct": Decimal("18.00"), "generator_only": True},

    # Chemicals (HSN 2806, 2905, 3814) - 18%
    {"hsn_sac": "2806", "description": "Hydrochloric Acid Commercial Grade 33%", "unit": "KGS", "typical_price": Decimal("18.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "2815", "description": "Caustic Soda Flakes Rayon Grade", "unit": "KGS", "typical_price": Decimal("48.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "2905", "description": "Isopropyl Alcohol IPA 99.8% Solvent", "unit": "LTR", "typical_price": Decimal("125.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "3814", "description": "Industrial Paint Thinner General Purpose", "unit": "LTR", "typical_price": Decimal("85.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "3824", "description": "Silica Gel Desiccant Pouches 50g", "unit": "PKT", "typical_price": Decimal("90.00"), "rate_pct": Decimal("18.00"), "generator_only": True},

    # Construction & Tiles (HSN 6907, 2523) - 18% & 28%
    {"hsn_sac": "6907", "description": "Vitrified Floor Tiles 600x600mm Box", "unit": "SET", "typical_price": Decimal("750.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "6907", "description": "Glazed Ceramic Wall Tiles 300x450mm", "unit": "SET", "typical_price": Decimal("480.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "2523", "description": "Portland Pozzolana Cement PPC 50kg", "unit": "PKT", "typical_price": Decimal("385.00"), "rate_pct": Decimal("28.00"), "generator_only": True},
    {"hsn_sac": "6802", "description": "Polished Granite Slab Rajnagar White", "unit": "SET", "typical_price": Decimal("2400.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "2517", "description": "Crushed Stone Aggregate 20mm", "unit": "KGS", "typical_price": Decimal("1.80"), "rate_pct": Decimal("5.00"), "generator_only": True},

    # Textiles & Yarns (HSN 5205, 5402) - 5% & 12%
    {"hsn_sac": "5205", "description": "Cotton Combed Yarn 30s Count", "unit": "KGS", "typical_price": Decimal("290.00"), "rate_pct": Decimal("5.00"), "generator_only": True},
    {"hsn_sac": "5208", "description": "Bleached Plain Cotton Fabric 60s", "unit": "MTR", "typical_price": Decimal("85.00"), "rate_pct": Decimal("5.00"), "generator_only": True},
    {"hsn_sac": "5402", "description": "Polyester Filament Yarn 150D", "unit": "KGS", "typical_price": Decimal("135.00"), "rate_pct": Decimal("12.00"), "generator_only": True},
    {"hsn_sac": "6109", "description": "Cotton Knit Crewneck T-Shirts Pack of 10", "unit": "SET", "typical_price": Decimal("1400.00"), "rate_pct": Decimal("5.00"), "generator_only": True},
    {"hsn_sac": "6203", "description": "Industrial Workwear Overalls Cotton", "unit": "NOS", "typical_price": Decimal("750.00"), "rate_pct": Decimal("12.00"), "generator_only": True},

    # Packaging Materials (HSN 4819, 4821) - 12% & 18%
    {"hsn_sac": "4819", "description": "Corrugated 5-Ply Shipping Cartons 40x30x30", "unit": "NOS", "typical_price": Decimal("38.00"), "rate_pct": Decimal("12.00"), "generator_only": True},
    {"hsn_sac": "4819", "description": "Rigid Printed Mono Cartons", "unit": "NOS", "typical_price": Decimal("12.50"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "4821", "description": "Self-Adhesive Barcode Labels 50x25 Roll", "unit": "SET", "typical_price": Decimal("220.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "3919", "description": "BOPP Packaging Tape 2 Inch 65m Brown", "unit": "NOS", "typical_price": Decimal("48.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "4802", "description": "A4 Copier Paper 75GSM 500 Sheets Ream", "unit": "PKT", "typical_price": Decimal("260.00"), "rate_pct": Decimal("12.00"), "generator_only": True},

    # Food & Agro Products (HSN 0902, 1006, 1512) - 5%
    {"hsn_sac": "0902", "description": "Assam Orthodox Black Tea CTC Blend 1kg", "unit": "PKT", "typical_price": Decimal("360.00"), "rate_pct": Decimal("5.00"), "generator_only": True},
    {"hsn_sac": "1006", "description": "Premium Basmati Rice 1121 Steam 25kg", "unit": "PKT", "typical_price": Decimal("2150.00"), "rate_pct": Decimal("5.00"), "generator_only": True},
    {"hsn_sac": "1512", "description": "Refined Sunflower Cooking Oil 15L Tin", "unit": "NOS", "typical_price": Decimal("1950.00"), "rate_pct": Decimal("5.00"), "generator_only": True},
    {"hsn_sac": "0910", "description": "Organic Ground Turmeric Powder 500g", "unit": "PKT", "typical_price": Decimal("95.00"), "rate_pct": Decimal("5.00"), "generator_only": True},
    {"hsn_sac": "2106", "description": "Natural Mineral Water 1L Case of 12", "unit": "SET", "typical_price": Decimal("180.00"), "rate_pct": Decimal("18.00"), "generator_only": True},

    # IT, Software & Cloud Services (SAC 9983) - 18%
    {"hsn_sac": "998313", "description": "Cloud Hosting & Dedicated Server Maintenance", "unit": "HRS", "typical_price": Decimal("3500.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "998314", "description": "Software Application Architecture Consulting", "unit": "HRS", "typical_price": Decimal("4200.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "998319", "description": "Annual Software License Maintenance AMC", "unit": "SET", "typical_price": Decimal("45000.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "998311", "description": "Cybersecurity Vulnerability & Pen Testing", "unit": "SET", "typical_price": Decimal("65000.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "998312", "description": "Database Optimization & Migration Support", "unit": "HRS", "typical_price": Decimal("3800.00"), "rate_pct": Decimal("18.00"), "generator_only": True},

    # Logistics, Transport & Freight Services (SAC 9965, 9967) - 18% & 5%
    {"hsn_sac": "996511", "description": "Road Freight Goods Transport Full Truck Load", "unit": "SET", "typical_price": Decimal("38500.00"), "rate_pct": Decimal("5.00"), "generator_only": True},
    {"hsn_sac": "996719", "description": "Warehousing & Material Handling Services Month", "unit": "SET", "typical_price": Decimal("24000.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "996519", "description": "Container Haulage & Drayage Port Movement", "unit": "SET", "typical_price": Decimal("16500.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "996711", "description": "Cargo Palletization & Shrink Wrap Services", "unit": "SET", "typical_price": Decimal("4500.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
    {"hsn_sac": "998717", "description": "Preventive Maintenance of Overhead EOT Cranes", "unit": "SET", "typical_price": Decimal("12500.00"), "rate_pct": Decimal("18.00"), "generator_only": True},
]
