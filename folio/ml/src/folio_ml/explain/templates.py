"""Jinja2 templates for plain-language explanations and multilingual communication drafts."""

from jinja2 import Template

# Plain-language explanation templates for failed checks
CHECK_EXPLANATION_TEMPLATES: dict[str, dict[str, str]] = {
    "check_01": {
        "what_we_found": "Supplier GSTIN format or checksum validation failed (Found: {{ found }}).",
        "why_it_matters": "Invoices with invalid GSTINs cannot be processed on the GST portal and ITC will be disallowed under Section 16(2).",
    },
    "check_02": {
        "what_we_found": "Buyer GSTIN format or checksum validation failed (Found: {{ found }}).",
        "why_it_matters": "If buyer GSTIN does not match our registered entity, input tax credit will be credited to the wrong taxpayer.",
    },
    "check_03": {
        "what_we_found": "Invoice date issue: {{ found }} (Expected: {{ expected }}).",
        "why_it_matters": "Future-dated invoices or invoices older than statutory limits are legally invalid under GST invoicing rules.",
    },
    "check_04": {
        "what_we_found": "HSN/SAC code format issue: {{ found }}.",
        "why_it_matters": "Mandatory 4 to 8 digit HSN codes are required for B2B supplies under GST notification 78/2020.",
    },
    "check_05": {
        "what_we_found": "Tax calculation discrepancy: {{ found }} vs expected {{ expected }}.",
        "why_it_matters": "Arithmetic mismatch between taxable value and tax rate leads to tax audit demands and 18% p.a. interest.",
    },
    "check_06": {
        "what_we_found": "Inter-state vs Intra-state tax split mismatch: {{ found }}.",
        "why_it_matters": "Wrong tax head (e.g. charging IGST instead of CGST+SGST) cannot be adjusted across heads, requiring refund filing.",
    },
    "check_07": {
        "what_we_found": "Line-item sum does not match invoice total: {{ found }} vs {{ expected }}.",
        "why_it_matters": "Discrepancy between item sums and grand total creates accounting unreconciled differences and ERP booking errors.",
    },
    "check_08": {
        "what_we_found": "Mandatory e-invoice QR code is missing or signature verification failed.",
        "why_it_matters": "Under Rule 48(4), invoices from applicable taxpayers without a validated IRN QR code are treated as null and void.",
    },
    "check_09": {
        "what_we_found": "Invoice amount exceeds ₹50,000 without mandatory e-way bill reference.",
        "why_it_matters": "Goods movement without e-way bill is subject to seizure and penalty under Section 129.",
    },
    "check_10": {
        "what_we_found": "Tax rate exceeds standard GST rate schedule: {{ found }}.",
        "why_it_matters": "Non-standard tax rates indicate billing error or unverified HSN classification.",
    },
    "check_11": {
        "what_we_found": "Invoice date exceeds the statutory annual cutoff for ITC claim.",
        "why_it_matters": "Under Section 16(4), ITC on prior year invoices cannot be claimed after 30th November of subsequent financial year.",
    },
}

# Actionable fix guidelines for fix codes (hand-written trilingual)
FIX_CODE_INSTRUCTIONS: dict[str, dict[str, str]] = {
    "VERIFY_GSTIN_ON_PORTAL": {
        "en": "Verify supplier GSTIN on services.gst.gov.in and request a corrected invoice.",
        "hi": "जीएसटी पोर्टल services.gst.gov.in पर विक्रेता का जीएसटीएन सत्यापित करें और संशोधित बिल का अनुरोध करें।",
        "mr": "services.gst.gov.in या अधिकृत पोर्टलवर जीएसटीएन तपासा आणि दुरुस्त बीजक मागवा.",
    },
    "UPDATE_BUYER_GSTIN": {
        "en": "Request supplier to update buyer GSTIN to match registered business entity.",
        "hi": "विक्रेता से अनुरोध करें कि वह बिल पर खरीदार का सही पंजीकृत जीएसटीएन दर्ज करे।",
        "mr": "बीजकावर खरेदीदाराचा योग्य अधिकृत जीएसटीएन नोंदवण्याची विनंती करा.",
    },
    "CORRECT_INVOICE_DATE": {
        "en": "Ensure invoice date is not in the future and falls within the current financial year.",
        "hi": "सुनिश्चित करें कि बिल की तारीख भविष्य की न हो और चालू वित्तीय वर्ष के भीतर हो।",
        "mr": "बीजकाची तारीख भविष्यातील नसून चालू आर्थिक वर्षातील असल्याची खात्री करा.",
    },
    "CORRECT_HSN_LENGTH": {
        "en": "Provide valid 4, 6, or 8 digit HSN/SAC code as per GST turnover rules.",
        "hi": "जीएसटी नियमों के अनुसार 4, 6 या 8 अंकों का मान्य एचएसएन/एसएसी कोड प्रदान करें।",
        "mr": "जीएसटी नियमांनुसार 4, 6 किंवा 8 अंकांचा वैध एचएसएन/एसएसी कोड नमूद करा.",
    },
    "RECHECK_TAX_CALCULATION": {
        "en": "Recompute taxable amount × rate to match the recorded tax total exactly.",
        "hi": "कर योग्य राशि और कर दर की पुनर्गणना करें ताकि कुल कर राशि सही हो सके।",
        "mr": "करपात्र रक्कम आणि कराचा दर यांची अचूक पडताळणी करून कर दुरुस्त करा.",
    },
    "SWITCH_TO_IGST": {
        "en": "Inter-state supply requires IGST instead of CGST and SGST.",
        "hi": "अंतर-राज्य आपूर्ति के लिए सीजीएसटी और एसजीएसटी के स्थान पर आईजीएसटी लागू करें।",
        "mr": "आंतरराज्यीय पुरवठ्यासाठी सीजीएसटी आणि एसजीएसटी ऐवजी आयजीएसटी लावा.",
    },
    "SWITCH_TO_CGST_SGST": {
        "en": "Intra-state supply requires equal split of CGST and SGST instead of IGST.",
        "hi": "राज्य के भीतर आपूर्ति के लिए आईजीएसटी के स्थान पर सीजीएसटी और एसजीएसटी लागू करें।",
        "mr": "राज्यांतर्गत पुरवठ्यासाठी आयजीएसटी ऐवजी समान सीजीएसटी आणि एसजीएसटी लावा.",
    },
    "RECONCILE_LINE_ITEMS": {
        "en": "Ensure the sum of line-item taxable and tax values equals the grand total.",
        "hi": "सुनिश्चित करें कि सभी मदों का कुल योग और बिल की अंतिम कुल राशि एक समान हो।",
        "mr": "सर्व वस्तूंचे करपात्र मूल्य व कर यांची बेरीज अंतिम एकूण रकमेइतकी असल्याची खात्री करा.",
    },
    "OBTAIN_EINVOICE_QR": {
        "en": "Generate B2B e-invoice IRN and embed the signed QR code on the invoice.",
        "hi": "ई-चालान पोर्टल से आईआरएन जनरेट करें और हस्ताक्षरित क्यूआर कोड बिल पर लगाएं।",
        "mr": "ई-इनव्हॉइस पोर्टलवरून आयआरएन जनरेट करा आणि स्वाक्षरीकृत क्यूआर कोड बीजकावर जोडा.",
    },
    "GENERATE_EWAY_BILL": {
        "en": "Generate mandatory e-way bill for consignment value exceeding ₹50,000.",
        "hi": "₹50,000 से अधिक मूल्य के माल परिवहन के लिए अनिवार्य ई-वे बिल जनरेट करें।",
        "mr": "₹50,000 पेक्षा जास्त मूल्याच्या मालवाहतुकीसाठी अनिवार्य ई-वे बिल तयार करा.",
    },
    "VERIFY_RATE_NOTIFICATION": {
        "en": "Confirm HSN rate against official CBIC rate notifications.",
        "hi": "सीबीआईसी की आधिकारिक अधिसूचना से एचएसएन कर दर की पुष्टि करें।",
        "mr": "अधिकृत सीबीआयसी अधिसूचना तपासून एचएसएन कर दर निश्चित करा.",
    },
    "INSPECT_ANNUAL_CUTOFF": {
        "en": "Invoice exceeds 30th November statutory deadline; ITC cannot be claimed.",
        "hi": "बिल 30 नवंबर की वैधानिक समय सीमा पार कर चुका है; इस पर आईटीसी नहीं मिल सकता।",
        "mr": "बीजक 30 नोव्हेंबरच्या मुदतीनंतरचे आहे; यावर आयटीसी दावा करता येत नाही.",
    },
    "ISSUE_CREDIT_NOTE": {
        "en": "Request vendor to issue a credit note for the mismatch amount.",
        "hi": "अंतर राशि के समाधान के लिए विक्रेता से क्रेडिट नोट जारी करने का अनुरोध करें।",
        "mr": "तफावत दुरुस्तीसाठी विक्रेत्याकडून क्रेडिट नोट देण्याची विनंती करा.",
    },
}

# Hand-crafted Jinja2 message draft templates across Channels, Languages, and Tones
# Note: English, Hindi, and Marathi are hand-crafted, avoiding machine-translation degradation.

MESSAGE_TEMPLATES: dict[str, dict[str, dict[str, Template]]] = {
    "whatsapp": {
        "en": {
            "polite": Template(
                "Hello {{ supplier_name }}, regarding invoice {{ invoice_number }} dated {{ invoice_date }} for ₹{{ total_amount }}: "
                "our automated GST verification noted a small discrepancy ({{ issue_summary }}). "
                "Could you please review and share the updated invoice? Thank you for your cooperation! - {{ buyer_name }}"
            ),
            "firm": Template(
                "URGENT: Invoice {{ invoice_number }} dated {{ invoice_date }} for ₹{{ total_amount }} has failed statutory GST validation ({{ issue_summary }}). "
                "Under Section 16(2)(aa) of the CGST Act, ITC cannot be availed. Payment is currently on hold pending receipt of a corrected tax invoice or credit note. - {{ buyer_name }}"
            ),
        },
        "hi": {
            "polite": Template(
                "नमस्ते {{ supplier_name }}, बिल संख्या {{ invoice_number }} (दिनांक {{ invoice_date }}, राशि ₹{{ total_amount }}) के सत्यापन में: "
                "{{ issue_summary_hi }} पाया गया है। कृपया बिल की जांच कर संशोधित प्रति साझा करने की कृपा करें। धन्यवाद! - {{ buyer_name }}"
            ),
            "firm": Template(
                "अति आवश्यक: बिल संख्या {{ invoice_number }} (दिनांक {{ invoice_date }}, राशि ₹{{ total_amount }}) जीएसटी सत्यापन में विफल रहा है ({{ issue_summary_hi }})। "
                "धारा 16(2)(aa) के तहत आईटीसी अवरुद्ध होने के कारण संशोधित बिल या क्रेडिट नोट मिलने तक भुगतान स्थगित किया गया है। - {{ buyer_name }}"
            ),
        },
        "mr": {
            "polite": Template(
                "नमस्कार {{ supplier_name }}, बीजक क्र. {{ invoice_number }} (तारीख {{ invoice_date }}, रक्कम ₹{{ total_amount }}) च्या जीएसटी पडताळणीमध्ये: "
                "{{ issue_summary_mr }} आढळले आहे. कृपया पडताळणी करून सुधारित बीजक पाठवण्याची कृपा करावी. धन्यवाद! - {{ buyer_name }}"
            ),
            "firm": Template(
                "तातडीचे: बीजक क्र. {{ invoice_number }} (तारीख {{ invoice_date }}, रक्कम ₹{{ total_amount }}) जीएसटी नियमांनुसार अवैध ठरले आहे ({{ issue_summary_mr }}). "
                "कलम 16(2)(aa) अन्वये आयटीसी दावा करता येत नसल्याने सुधारित बीजक किंवा क्रेडिट नोट मिळेपर्यंत देयक रोखण्यात आले आहे. - {{ buyer_name }}"
            ),
        },
    },
    "email": {
        "en": {
            "polite": Template(
                "Dear {{ supplier_name }},\n\n"
                "We are writing regarding invoice {{ invoice_number }} dated {{ invoice_date }} for ₹{{ total_amount }}.\n\n"
                "During our automated pre-filing validation, our compliance engine noted the following item:\n"
                "{{ issue_details }}\n\n"
                "To ensure smooth input tax credit processing under GST regulations, kindly review and provide a rectified invoice or clarification at your earliest convenience.\n\n"
                "Warm regards,\nAccounts Team, {{ buyer_name }}"
            ),
            "firm": Template(
                "Dear {{ supplier_name }},\n\n"
                "NOTICE OF STATUTORY GST NON-COMPLIANCE: Invoice {{ invoice_number }} dated {{ invoice_date }} (₹{{ total_amount }}).\n\n"
                "The aforementioned invoice failed statutory validation due to:\n"
                "{{ issue_details }}\n\n"
                "In accordance with Section 16(2)(aa) of the CGST Act, our organization cannot claim input tax credit without valid documentation. Consequently, invoice disbursement has been put ON HOLD.\n\n"
                "Please furnish an amended tax invoice or credit note immediately to avoid payment delays.\n\n"
                "Finance & Compliance Division,\n{{ buyer_name }}"
            ),
        },
        "hi": {
            "polite": Template(
                "प्रिय {{ supplier_name }},\n\n"
                "हम बिल संख्या {{ invoice_number }} (दिनांक {{ invoice_date }}, राशि ₹{{ total_amount }}) के संदर्भ में लिख रहे हैं।\n\n"
                "हमारे स्वचालित जीएसटी सत्यापन में निम्नलिखित विसंगति पाई गई है:\n"
                "{{ issue_details_hi }}\n\n"
                "जीएसटी नियमों के तहत सुचारू आईटीसी प्रसंस्करण सुनिश्चित करने के लिए, कृपया संशोधित बिल साझा करें।\n\n"
                "सधन्यवाद,\nलेखा विभाग, {{ buyer_name }}"
            ),
            "firm": Template(
                "प्रिय {{ supplier_name }},\n\n"
                "वैधानिक जीएसटी गैर-अनुपालन सूचना: बिल संख्या {{ invoice_number }} (राशि ₹{{ total_amount }})।\n\n"
                "उक्त बिल निम्नलिखित कारणों से सत्यापन में विफल रहा है:\n"
                "{{ issue_details_hi }}\n\n"
                "सीजीएसटी अधिनियम की धारा 16(2)(aa) के तहत आईटीसी नहीं मिल सकता। अतः भुगतान स्थगित कर दिया गया है। कृपया तत्काल संशोधित बिल या क्रेडिट नोट जारी करें।\n\n"
                "वित्त एवं अनुपालन विभाग,\n{{ buyer_name }}"
            ),
        },
        "mr": {
            "polite": Template(
                "सस्नेह नमस्कार {{ supplier_name }},\n\n"
                "आम्ही बीजक क्र. {{ invoice_number }} (तारीख {{ invoice_date }}, रक्कम ₹{{ total_amount }}) बाबत कळवत आहोत.\n\n"
                "आमच्या संगणकीय जीएसटी पडताळणीमध्ये खालील त्रुटी आढळली आहे:\n"
                "{{ issue_details_mr }}\n\n"
                "नियमांनुसार सुरळीत आयटीसी जमा होण्यासाठी कृपया लवकरात लवकर सुधारित बीजक पाठवावे.\n\n"
                "आपले नम्र,\nलेखा विभाग, {{ buyer_name }}"
            ),
            "firm": Template(
                "प्रति {{ supplier_name }},\n\n"
                "वैधानिक जीएसटी त्रुटी सूचना: बीजक क्र. {{ invoice_number }} (रक्कम ₹{{ total_amount }}).\n\n"
                "सदर बीजक खालील कारणास्तव जीएसटी नियमांत अपात्र ठरले आहे:\n"
                "{{ issue_details_mr }}\n\n"
                "सीजीएसटी कायदा कलम 16(2)(aa) नुसार आयटीसी दावा करता येत नसल्याने देयक थांबवण्यात आले आहे. कृपया तातडीने सुधारित बीजक अथवा क्रेडिट नोट पाठवावी.\n\n"
                "वित्त व अनुपालन विभाग,\n{{ buyer_name }}"
            ),
        },
    },
    "sms": {
        "en": {
            "polite": Template(
                "{{ buyer_name }}: Discrepancy noted in invoice {{ invoice_number }} (₹{{ total_amount }}). Pls share revised bill to process payment."
            ),
            "firm": Template(
                "{{ buyer_name }}: ALERT: Invoice {{ invoice_number }} (₹{{ total_amount }}) failed GST validation. Payment held pending revised invoice."
            ),
        },
        "hi": {
            "polite": Template(
                "{{ buyer_name }}: बिल {{ invoice_number }} (₹{{ total_amount }}) में जीएसटी विसंगति है। भुगतान हेतु कृपया संशोधित बिल साझा करें।"
            ),
            "firm": Template(
                "{{ buyer_name }}: चेतावनी: बिल {{ invoice_number }} (₹{{ total_amount }}) जीएसटी सत्यापन में विफल। संशोधित बिल तक भुगतान स्थगित।"
            ),
        },
        "mr": {
            "polite": Template(
                "{{ buyer_name }}: बीजक {{ invoice_number }} (₹{{ total_amount }}) मध्ये त्रुटी आढळली. देयकासाठी कृपया दुरुस्त बीजक पाठवावे."
            ),
            "firm": Template(
                "{{ buyer_name }}: सावधान: बीजक {{ invoice_number }} (₹{{ total_amount }}) जीएसटी नियमांत अपात्र. दुरुस्त बीजकाशिवाय पेमेंट स्थगित."
            ),
        },
    },
}
