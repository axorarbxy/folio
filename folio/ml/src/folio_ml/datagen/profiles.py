"""Fictional business profiles for synthetic GST invoice generation.

Contains 40 distinct fictional Indian suppliers and buyers across 8+ states.
All GSTINs are mathematically valid using the Mod 36,36 algorithm.
Footers are strictly free of bank account details.
"""

import random
from typing import TypedDict

from folio_ml.utils.gstin import make_gstin

STATES_DATA = [
    ("27", "Maharashtra", "Mumbai"),
    ("27", "Maharashtra", "Pune"),
    ("24", "Gujarat", "Ahmedabad"),
    ("24", "Gujarat", "Surat"),
    ("29", "Karnataka", "Bengaluru"),
    ("33", "Tamil Nadu", "Chennai"),
    ("33", "Tamil Nadu", "Coimbatore"),
    ("07", "Delhi", "New Delhi"),
    ("09", "Uttar Pradesh", "Noida"),
    ("09", "Uttar Pradesh", "Kanpur"),
    ("19", "West Bengal", "Kolkata"),
    ("08", "Rajasthan", "Jaipur"),
    ("36", "Telangana", "Hyderabad"),
]

BUSINESS_NAMES = [
    # Maharashtra (27)
    ("Apex Precision Tools Pvt Ltd", "MIDC Industrial Area, Andheri East, Mumbai", "400093", 12.5),
    ("Sahyadri Agro Solutions LLP", "Shivajinagar, Senapati Bapat Road, Pune", "411016", 4.2),
    ("Western Engineering Components", "Bhosari Industrial Estate, Pune", "411026", 25.0),
    ("Kalyani Chemical Formulations", "Thane-Belapur Road, Navi Mumbai", "400705", 8.0),
    ("Maratha Logistics & Freight Hub", "Kalamboli Warehousing Zone, Navi Mumbai", "410218", 15.0),
    # Gujarat (24)
    ("Gujarat Polymer Industries", "GIDC Estate, Vatva, Ahmedabad", "382445", 35.0),
    ("Sabarmati Textile Printers", "Ring Road Textile Market, Surat", "395002", 6.5),
    ("Navrang Ceramic Tiles Pvt Ltd", "National Highway 8A, Morbi", "363642", 18.0),
    ("Baroda Precision Valves", "Makarpura GIDC, Vadodara", "390010", 9.2),
    ("Kutch Minerals & Refractories", "Gandhidham Port Road, Kutch", "370201", 3.8),
    # Karnataka (29)
    ("Silicon City Infotech Solutions", "Electronics City Phase 1, Bengaluru", "560100", 45.0),
    ("Mysore Paper & Packaging Ltd", "Hebbal Industrial Area, Mysuru", "570016", 7.5),
    ("Cauvery Hydraulics & Motors", "Peenya Industrial Area, Bengaluru", "560058", 22.0),
    ("Deccan Cloud Infrastructure", "Whitefield Main Road, Bengaluru", "560066", 60.0),
    ("Canara Marine Exports LLP", "Baikampady Industrial Area, Mangaluru", "575011", 14.0),
    # Tamil Nadu (33)
    ("Coromandel Auto Castings", "Ambattur Industrial Estate, Chennai", "600058", 32.0),
    ("Kongu Precision Spindles", "SIDCO Industrial Estate, Coimbatore", "641021", 8.5),
    ("Chola Logistics Solutions", "Harbour Expressway, Thoothukudi", "628004", 4.0),
    ("Pallava Leather Crafts Pvt Ltd", "SIPCOT Industrial Complex, Ranipet", "632403", 11.0),
    ("Madurai Organic Agro Processors", "Kappalur Industrial Estate, Madurai", "625008", 2.5),
    # Delhi (07)
    ("National Capital Office Systems", "Okhla Industrial Area Phase 3, New Delhi", "110020", 16.5),
    ("Indraprastha Electric Cables", "Mayapuri Industrial Area, New Delhi", "110064", 7.0),
    ("Connaught Legal & Advisory LLP", "Barakhamba Road, Connaught Place, New Delhi", "110001", 3.2),
    ("Yamuna Steel Trade Hub", "Naraina Industrial Area, New Delhi", "110028", 28.0),
    ("Chanakya Security Systems", "Patparganj Industrial Area, Delhi", "110092", 5.5),
    # Uttar Pradesh (09)
    ("Noida Advanced Automation Pvt Ltd", "Sector 62, Electronic City, Noida", "201309", 19.0),
    ("Ganga Basin Food Products", "Panki Industrial Area Site 1, Kanpur", "208022", 6.0),
    ("Taj Technical Glass Works", "Industrial Estate, Firozabad", "283203", 4.5),
    ("Awadh Medical Instruments", "Aishbagh Industrial Area, Lucknow", "226004", 8.2),
    ("NCR Heavy Cranes & Logistics", "Site IV Industrial Area, Sahibabad, Ghaziabad", "201010", 12.0),
    # West Bengal (19)
    ("Howrah Iron & Foundry Works", "Baltikuri, Howrah, Kolkata", "711113", 21.0),
    ("Bengal Specialty Chemicals Ltd", "Taratala Road, Kolkata", "700088", 14.5),
    ("Sundarban Tea Exporters", "Brabourne Road, BBD Bagh, Kolkata", "700001", 9.0),
    ("Hooghly River Transport Co", "Strand Road, Kolkata", "700007", 5.0),
    ("Asansol Refractory & Bricks", "GT Road, Asansol", "713301", 3.5),
    # Rajasthan (08)
    ("Jaipur Marble & Granites Ltd", "VKIA Area Road No. 9, Jaipur", "302013", 17.5),
    ("Thar Renewable Solar Systems", "Sitapura Industrial Area, Jaipur", "302022", 30.0),
    ("Marwar Heavy Engineering", "Basni Industrial Area Phase 2, Jodhpur", "342005", 10.0),
    ("Udaipur Mineral Powders", "MIA Industrial Area, Udaipur", "313003", 6.8),
    ("Aravalli Handicrafts Emporium", "Amber Road, Jaipur", "302002", 2.0),
]


class BusinessProfile(TypedDict):
    name: str
    state_code: str
    state_name: str
    city: str
    address: str
    pincode: str
    pan: str
    gstin: str
    footer: str
    annual_turnover_cr: float


def build_synthetic_profiles(seed: int = 42) -> list[BusinessProfile]:
    """Builds a deterministic catalog of 40 fictional business profiles."""
    rng = random.Random(seed)
    profiles: list[BusinessProfile] = []

    state_map = {
        "Apex Precision Tools Pvt Ltd": ("27", "Maharashtra", "Mumbai"),
        "Sahyadri Agro Solutions LLP": ("27", "Maharashtra", "Pune"),
        "Western Engineering Components": ("27", "Maharashtra", "Pune"),
        "Kalyani Chemical Formulations": ("27", "Maharashtra", "Navi Mumbai"),
        "Maratha Logistics & Freight Hub": ("27", "Maharashtra", "Navi Mumbai"),
        "Gujarat Polymer Industries": ("24", "Gujarat", "Ahmedabad"),
        "Sabarmati Textile Printers": ("24", "Gujarat", "Surat"),
        "Navrang Ceramic Tiles Pvt Ltd": ("24", "Gujarat", "Morbi"),
        "Baroda Precision Valves": ("24", "Gujarat", "Vadodara"),
        "Kutch Minerals & Refractories": ("24", "Gujarat", "Gandhidham"),
        "Silicon City Infotech Solutions": ("29", "Karnataka", "Bengaluru"),
        "Mysore Paper & Packaging Ltd": ("29", "Karnataka", "Mysuru"),
        "Cauvery Hydraulics & Motors": ("29", "Karnataka", "Bengaluru"),
        "Deccan Cloud Infrastructure": ("29", "Karnataka", "Bengaluru"),
        "Canara Marine Exports LLP": ("29", "Karnataka", "Mangaluru"),
        "Coromandel Auto Castings": ("33", "Tamil Nadu", "Chennai"),
        "Kongu Precision Spindles": ("33", "Tamil Nadu", "Coimbatore"),
        "Chola Logistics Solutions": ("33", "Tamil Nadu", "Thoothukudi"),
        "Pallava Leather Crafts Pvt Ltd": ("33", "Tamil Nadu", "Ranipet"),
        "Madurai Organic Agro Processors": ("33", "Tamil Nadu", "Madurai"),
        "National Capital Office Systems": ("07", "Delhi", "New Delhi"),
        "Indraprastha Electric Cables": ("07", "Delhi", "New Delhi"),
        "Connaught Legal & Advisory LLP": ("07", "Delhi", "New Delhi"),
        "Yamuna Steel Trade Hub": ("07", "Delhi", "New Delhi"),
        "Chanakya Security Systems": ("07", "Delhi", "New Delhi"),
        "Noida Advanced Automation Pvt Ltd": ("09", "Uttar Pradesh", "Noida"),
        "Ganga Basin Food Products": ("09", "Uttar Pradesh", "Kanpur"),
        "Taj Technical Glass Works": ("09", "Uttar Pradesh", "Firozabad"),
        "Awadh Medical Instruments": ("09", "Uttar Pradesh", "Lucknow"),
        "NCR Heavy Cranes & Logistics": ("09", "Uttar Pradesh", "Ghaziabad"),
        "Howrah Iron & Foundry Works": ("19", "West Bengal", "Howrah"),
        "Bengal Specialty Chemicals Ltd": ("19", "West Bengal", "Kolkata"),
        "Sundarban Tea Exporters": ("19", "West Bengal", "Kolkata"),
        "Hooghly River Transport Co": ("19", "West Bengal", "Kolkata"),
        "Asansol Refractory & Bricks": ("19", "West Bengal", "Asansol"),
        "Jaipur Marble & Granites Ltd": ("08", "Rajasthan", "Jaipur"),
        "Thar Renewable Solar Systems": ("08", "Rajasthan", "Jaipur"),
        "Marwar Heavy Engineering": ("08", "Rajasthan", "Jodhpur"),
        "Udaipur Mineral Powders": ("08", "Rajasthan", "Udaipur"),
        "Aravalli Handicrafts Emporium": ("08", "Rajasthan", "Jaipur"),
    }

    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"

    for name, addr, pincode, turnover in BUSINESS_NAMES:
        state_code, state_name, city = state_map[name]
        pan_prefix = "".join(rng.choice(letters) for _ in range(5))
        pan_num = f"{rng.randint(1000, 9999)}"
        pan_suffix = rng.choice(letters)
        pan = f"{pan_prefix}{pan_num}{pan_suffix}"
        gstin = make_gstin(state_code, pan, entity_no=1, rng=rng)

        profiles.append(
            BusinessProfile(
                name=name,
                state_code=state_code,
                state_name=state_name,
                city=city,
                address=addr,
                pincode=pincode,
                pan=pan,
                gstin=gstin,
                footer=f"Thank you for choosing {name}. Goods once sold will not be taken back without authorization. Subject to {city} jurisdiction.",
                annual_turnover_cr=turnover,
            )
        )

    return profiles


PROFILES: list[BusinessProfile] = build_synthetic_profiles()
