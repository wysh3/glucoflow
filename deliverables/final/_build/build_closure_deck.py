from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "deliverables/final/Result_Ledger_Deck.pptx"
SCREENS = ROOT / "deliverables/final/screens"

CANVAS = RGBColor(0xF4, 0xF1, 0xEA)
INK = RGBColor(0x20, 0x3B, 0x38)
MUTED = RGBColor(0x5B, 0x70, 0x6B)
PRIMARY = RGBColor(0x1F, 0x6F, 0x5C)
ACCENT = RGBColor(0xA7, 0xD8, 0xC8)
REVIEW = RGBColor(0xB5, 0x47, 0x08)
DANGER = RGBColor(0xB4, 0x23, 0x18)
LINE = RGBColor(0xD8, 0xD2, 0xC4)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

W, H = 13.333, 7.5
L = 0.65


def rgb(hex_value):
    return RGBColor.from_string(hex_value.replace("#", ""))


def new_deck():
    prs = Presentation()
    prs.slide_width = Inches(W)
    prs.slide_height = Inches(H)
    return prs


def slide(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])


def rect(s, x, y, w, h, fill=None, line=None, weight=0.75, radius=False):
    shape = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    shp = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
        shp.line.width = Pt(weight)
    if radius:
        try:
            shp.adjustments[0] = 0.08
        except Exception:
            pass
    return shp


def rule(s, x, y, w, color=LINE, weight=0.9):
    return rect(s, x, y, w, weight / 72.0, fill=color)


def text(s, x, y, w, h, paras, anchor=MSO_ANCHOR.TOP):
    box = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    for i, p in enumerate(paras):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.alignment = p.get("align", PP_ALIGN.LEFT)
        para.space_before = Pt(p.get("space_before", 0))
        para.space_after = Pt(p.get("space_after", 0))
        para.line_spacing = p.get("line_spacing", 1.0)
        if p.get("bullet"):
            para.text = ""
            run = para.add_run()
            run.text = p.get("bullet_prefix", "•  ")
            run.font.name = "Inter"
            run.font.size = Pt(p.get("size", 14))
            run.font.color.rgb = p.get("bullet_color", PRIMARY)
        run = para.add_run()
        run.text = p["text"]
        run.font.name = "Inter"
        run.font.size = Pt(p.get("size", 14))
        run.font.bold = p.get("bold", False)
        run.font.italic = p.get("italic", False)
        run.font.color.rgb = p.get("color", INK)
    return box


def chrome(s, number, section):
    rect(s, 0, 0, W, H, fill=CANVAS)
    text(s, L, 0.32, 6.4, 0.25, [{"text": "GLUCOFLOW  /  DIABETES RESULT CLOSURE", "size": 9, "bold": True, "color": PRIMARY}])
    text(s, 8.0, 0.32, 4.68, 0.25, [{"text": section.upper(), "size": 9, "bold": True, "color": MUTED, "align": PP_ALIGN.RIGHT}])
    rule(s, L, 0.62, 12.03, color=LINE)
    rule(s, L, 6.98, 12.03, color=LINE)
    text(s, L, 7.08, 8.5, 0.22, [{"text": "Synthetic data. Administrative only. No clinical interpretation.", "size": 8.5, "color": MUTED}])
    text(s, 11.0, 7.08, 1.68, 0.22, [{"text": f"{number:02d} / 08", "size": 8.5, "color": MUTED, "align": PP_ALIGN.RIGHT}])


def label(s, x, y, text_value, color=PRIMARY):
    text(s, x, y, 5.0, 0.22, [{"text": text_value.upper(), "size": 9, "bold": True, "color": color}])


def title(s, x, y, w, value, size=34):
    text(s, x, y, w, 1.5, [{"text": value, "size": size, "bold": False, "color": INK, "line_spacing": 1.02}])


def stat(s, x, y, value, caption, color=PRIMARY, value_size=44):
    text(s, x, y, 2.7, 0.8, [{"text": value, "size": value_size, "bold": True, "color": color}])
    text(s, x, y + 0.88, 2.8, 0.55, [{"text": caption, "size": 9.5, "bold": True, "color": MUTED, "line_spacing": 1.15}])


def add_picture(s, path, x, y, w, h):
    s.shapes.add_picture(str(path), Inches(x), Inches(y), width=Inches(w), height=Inches(h))


def crop_image(src, dst, box):
    img = Image.open(src)
    img.crop(box).save(dst, format="PNG", optimize=True)
    return dst


def build():
    prs = new_deck()

    # 1. Title
    s = slide(prs)
    chrome(s, 1, "The thesis")
    label(s, L, 0.95, "The last mile")
    title(s, L, 1.28, 6.7, "The last mile of a diabetes result.", size=40)
    text(s, L, 2.74, 6.3, 1.1, [{"text": "The lab calls the doctor. Nobody calls the patient.", "size": 22, "color": PRIMARY, "line_spacing": 1.05}])
    text(s, L, 3.72, 6.1, 1.25, [{"text": "A patient-closure ledger for abnormal and critical diabetes results. A value echo, a documented contact, an unreachable disposition, a next step, and a receipt.", "size": 13.5, "color": MUTED, "line_spacing": 1.35}])
    text(s, L, 5.15, 6.0, 0.9, [{"text": "IIT Bombay Health-a-thon 2026", "size": 10, "bold": True, "color": MUTED}, {"text": "Diabetes track  ·  Build Sprint", "size": 10, "color": MUTED}])
    text(s, L, 6.25, 6.0, 0.3, [{"text": "The lab is done when it delivers. The clinic is done when the patient is reached.", "size": 9.5, "italic": True, "color": MUTED}])

    # receipt card
    rect(s, 7.45, 0.98, 5.2, 5.72, fill=INK, line=None, radius=True)
    text(s, 7.78, 1.22, 4.55, 0.25, [{"text": "CLOSURE RECEIPT", "size": 9, "bold": True, "color": ACCENT}])
    text(s, 7.78, 1.52, 4.55, 0.5, [{"text": "Asha Rao  ·  P0482", "size": 16, "bold": True, "color": WHITE}])
    text(s, 7.78, 1.92, 4.55, 0.3, [{"text": "Potassium 5.9 mmol/L  ·  ACE inhibitor start", "size": 10.5, "color": ACCENT}])
    rule(s, 7.78, 2.3, 4.55, color=rgb("#46655F"))
    steps = [
        ("03:10", "Lab releases the report", "Critical, lab flagged"),
        ("03:12", "Clinician echoes 5.9", "Lab notifier + read-back"),
        ("03:40", "Patient contacted in Hindi", "Call · caregiver confirmed"),
        ("03:55", "Next step: repeat potassium", "Teach-back recorded"),
    ]
    y = 2.48
    for index, (time_value, head, sub) in enumerate(steps):
        text(s, 7.78, y, 0.62, 0.3, [{"text": time_value, "size": 9.5, "bold": True, "color": ACCENT}])
        text(s, 8.45, y - 0.02, 3.9, 0.3, [{"text": head, "size": 11.5, "bold": True, "color": WHITE}])
        text(s, 8.45, y + 0.24, 3.9, 0.3, [{"text": sub, "size": 9.5, "color": rgb("#B7CEC7")}])
        if index < len(steps) - 1:
            rule(s, 8.45, y + 0.54, 3.65, color=rgb("#46655F"), weight=0.6)
        y += 0.68
    rect(s, 7.78, 5.38, 4.55, 0.82, fill=rgb("#173733"), line=rgb("#46655F"), radius=True)
    text(s, 7.98, 5.52, 2.8, 0.28, [{"text": "CLOSURE CERTIFICATE", "size": 8.5, "bold": True, "color": ACCENT}])
    text(s, 7.98, 5.76, 4.1, 0.3, [{"text": "Chain intact  ·  evidence present  ·  GLF-F656915ED9", "size": 9.5, "color": WHITE}])
    text(s, 7.78, 6.34, 4.55, 0.22, [{"text": "Unreachable is a disposition, not a false informed.", "size": 8.5, "italic": True, "color": rgb("#B7CEC7")}])

    # 2. Problem
    s = slide(prs)
    chrome(s, 2, "01 / The gap")
    label(s, L, 0.95, "The result stops at the doctor")
    title(s, L, 1.25, 8.4, "Only one in four critical values reached the treating clinician.", size=32)
    stat(s, L, 2.7, "25.8%", "critical values reached a clinician", color=PRIMARY, value_size=46)
    stat(s, 3.65, 2.7, "52.9%", "went to nursing staff", color=REVIEW, value_size=46)
    stat(s, 6.7, 2.7, "90%", "of never-notified values were outpatients", color=DANGER, value_size=46)
    text(s, L, 4.28, 11.9, 0.9, [{"text": "A 2015 audit of 1,187 critical values at an Indian tertiary hospital found a written policy, a log book and a read-back rule. The failure was not the rule. It was the last mile: the result reached a desk, not the person who could act. The same paper found 9 in 10 never-notified values were outpatients.", "size": 13, "color": MUTED, "line_spacing": 1.35}])
    # flow
    y = 5.45
    for i, (name, sub, color) in enumerate([
        ("LAB", "releases the report", PRIMARY),
        ("DOCTOR", "echoes the value", PRIMARY),
        ("PATIENT", "is contacted, or not", DANGER),
    ]):
        x = L + i * 3.55
        rect(s, x, y, 2.9, 0.9, fill=WHITE, line=LINE, radius=True)
        text(s, x + 0.2, y + 0.13, 2.5, 0.26, [{"text": name, "size": 10, "bold": True, "color": color}])
        text(s, x + 0.2, y + 0.42, 2.5, 0.3, [{"text": sub, "size": 11.5, "color": INK}])
        if i < 2:
            text(s, x + 2.98, y + 0.2, 0.45, 0.3, [{"text": "→", "size": 18, "color": MUTED}])
    text(s, L, 6.5, 11.8, 0.3, [{"text": "14% of positive results never returned (NMJI 2015). 6.8% to 62% of abnormal ambulatory results were not followed up (J Gen Intern Med 2012).", "size": 9.5, "color": MUTED}])

    # 3. Solution
    s = slide(prs)
    chrome(s, 3, "02 / The receipt")
    label(s, L, 0.95, "Close the last mile, not another inbox")
    title(s, L, 1.25, 8.6, "Four controls. One honest closure.", size=34)
    text(s, L, 2.15, 7.5, 0.7, [{"text": "The lab already notifies the doctor. We make the patient side visible, and we do not let a click stand in for a conversation.", "size": 14, "color": MUTED, "line_spacing": 1.3}])
    items = [
        ("01", "VALUE ECHO", "The clinician types the printed value and selects the printed flag. For a critical result, the lab caller and the value read back are recorded.", PRIMARY),
        ("02", "PATIENT CONTACT", "Patient or caregiver, channel, language, who was spoken to. Every failed attempt is a row, not a silent assumption.", PRIMARY),
        ("03", "AN HONEST DISPOSITION", "Informed, declined, unreachable, invalid number, deceased, transferred. Two attempts before an unreachable close. Never a false informed.", REVIEW),
        ("04", "NEXT STEP + PROOF", "Appointment, repeat test, specialist, collect report. Completion is tracked. The certificate maps evidence, not a compliance verdict.", REVIEW),
    ]
    y = 3.05
    for num, head, body, color in items:
        text(s, L, y, 0.5, 0.3, [{"text": num, "size": 10, "bold": True, "color": color}])
        text(s, L + 0.55, y - 0.02, 6.7, 0.3, [{"text": head, "size": 12, "bold": True, "color": color}])
        text(s, L + 0.55, y + 0.26, 6.7, 0.55, [{"text": body, "size": 11, "color": MUTED, "line_spacing": 1.25}])
        y += 0.86
    # certificate thumbnail
    cert = crop_image(SCREENS / "22_closure_certificate.png", Path("/tmp/deck-cert.png"), (270, 90, 1160, 1290))
    rect(s, 8.55, 2.78, 3.9, 3.62, fill=WHITE, line=LINE, radius=True)
    add_picture(s, cert, 8.9, 2.92, 3.2, 3.25)
    text(s, 8.7, 6.48, 3.6, 0.25, [{"text": "Closure certificate: evidence, timeline, section 63(4) draft.", "size": 8, "color": MUTED}])

    # 4. Product
    s = slide(prs)
    chrome(s, 4, "03 / What is built")
    label(s, L, 0.95, "The loop runs today")
    title(s, L, 1.22, 7.4, "A working closure ledger.", size=32)
    text(s, L, 1.95, 7.2, 0.55, [{"text": "Twelve synthetic diabetes receipts across nine patients and four labs. Five clinician-set monitoring protocols. The demo imports a lab feed and holds an unmatched report.", "size": 12, "color": MUTED, "line_spacing": 1.3}])
    # screenshot
    shot = crop_image(SCREENS / "20_closure_ledger.png", Path("/tmp/deck-ledger.png"), (250, 60, 1440, 1020))
    rect(s, L, 2.92, 7.25, 3.72, fill=WHITE, line=LINE, radius=True)
    add_picture(s, shot, L + 0.08, 3.0, 7.09, 3.56)
    # features
    features = [
        ("Lab feed", "CSV import; unmatched hold"),
        ("Identity", "name + clinic ID candidates"),
        ("Value echo", "printed value and flag"),
        ("Last mile", "attempts + unreachable close"),
        ("Escalation", "timer + queued notification"),
        ("Proof", "anchored chain + public stage"),
    ]
    x = 8.15
    y = 2.95
    for i, (head, body) in enumerate(features):
        col = i % 2
        row = i // 2
        xx = x + col * 2.35
        yy = y + row * 1.12
        text(s, xx, yy, 2.1, 0.28, [{"text": head.upper(), "size": 8.5, "bold": True, "color": PRIMARY}])
        text(s, xx, yy + 0.24, 2.1, 0.45, [{"text": body, "size": 10, "color": INK, "line_spacing": 1.2}])
    text(s, 8.15, 6.4, 4.5, 0.35, [{"text": "No live LIS or WhatsApp. The production adapter is the next gate.", "size": 8.5, "italic": True, "color": MUTED}])

    # 5. Diabetes loop
    s = slide(prs)
    chrome(s, 5, "04 / The diabetes wedge")
    label(s, L, 0.95, "The result a diabetes drug makes necessary")
    title(s, L, 1.22, 10.8, "Start with the potassium and eGFR after a new ACE inhibitor.", size=28)
    text(s, L, 2.42, 11.6, 0.55, [{"text": "The clinician sets the protocol. The lab flag sets criticality. The product does not infer a screening deadline or a clinical action.", "size": 12, "color": MUTED}])
    steps = [
        ("01", "START OR TITRATE", "ACE inhibitor or ARB", "The prescriber sets the monitoring protocol."),
        ("02", "2 TO 4 WEEKS", "Potassium + eGFR", "The due window is a protocol, not an inference."),
        ("03", "RESULT ARRIVES", "Lab flag copied", "Critical, abnormal or normal. No interpretation."),
        ("04", "CLOSE THE LOOP", "Value echo + contact", "Patient reached, or attempts documented."),
        ("05", "NEXT STEP", "Repeat, review, attend", "Tracked to completion; certificate ready."),
    ]
    x = L
    for i, (num, head, sub, body) in enumerate(steps):
        rect(s, x, 3.0, 2.2, 2.55, fill=WHITE, line=LINE, radius=True)
        text(s, x + 0.15, 3.14, 0.5, 0.25, [{"text": num, "size": 9, "bold": True, "color": PRIMARY}])
        text(s, x + 0.15, 3.45, 1.9, 0.5, [{"text": head, "size": 9, "bold": True, "color": MUTED}])
        text(s, x + 0.15, 3.82, 1.9, 0.55, [{"text": sub, "size": 12.5, "bold": True, "color": INK, "line_spacing": 1.1}])
        text(s, x + 0.15, 4.55, 1.9, 0.75, [{"text": body, "size": 9.5, "color": MUTED, "line_spacing": 1.2}])
        x += 2.38
    text(s, L, 5.95, 12.0, 0.65, [{"text": "The same receipt covers SGLT2i, MRA, annual uACR/eGFR, a critical potassium, or an abnormal HbA1c. 101 million people in India live with diabetes; the first market is the lab that already sends the report.", "size": 12, "color": INK, "line_spacing": 1.3}])

    # 6. Evidence
    s = slide(prs)
    chrome(s, 6, "05 / What we ran")
    label(s, L, 0.95, "Measured, and what is not")
    title(s, L, 1.22, 10.5, "The build is measured. The demand is not.", size=34)
    rect(s, L, 2.2, 5.75, 4.1, fill=WHITE, line=LINE, radius=True)
    text(s, L + 0.25, 2.42, 5.2, 0.3, [{"text": "WHAT WE RAN", "size": 9.5, "bold": True, "color": PRIMARY}])
    ran = [
        ("188", "unit and integration tests, 31 files", PRIMARY),
        ("12 / 12", "result and landing browser tests, desktop + mobile", PRIMARY),
        ("0", "lint findings on ledger, drawer, certificate, slip and verifier", PRIMARY),
        ("12", "synthetic receipts, 9 patients, 4 labs", PRIMARY),
        ("4", "new integration tests for value echo, unreachable close, chain and matching", PRIMARY),
    ]
    y = 2.85
    for value, caption, color in ran:
        text(s, L + 0.25, y, 1.35, 0.4, [{"text": value, "size": 22, "bold": True, "color": color}])
        text(s, L + 1.5, y + 0.03, 3.85, 0.45, [{"text": caption, "size": 9.5, "color": MUTED, "line_spacing": 1.2}])
        y += 0.64
    rect(s, 6.65, 2.2, 6.0, 4.1, fill=INK, line=None, radius=True)
    text(s, 6.9, 2.42, 5.4, 0.3, [{"text": "WHAT WE HAVE NOT VALIDATED", "size": 9.5, "bold": True, "color": ACCENT}])
    nots = [
        "No buyer interview, baseline audit, paid pilot or LOI.",
        "No live LIS, HL7/FHIR or WhatsApp send.",
        "No consent capture, DPA or retention runbook.",
        "No external anchor: the chain is tamper-evident inside one database.",
        "No clinical validation. No diagnosis, triage or treatment advice.",
    ]
    y = 2.95
    for item in nots:
        text(s, 6.9, y, 5.45, 0.5, [{"text": "—  " + item, "size": 10.5, "color": WHITE, "line_spacing": 1.25}])
        y += 0.62
    text(s, 6.9, 5.95, 5.4, 0.25, [{"text": "We will not claim these.", "size": 9.5, "italic": True, "color": ACCENT}])
    text(s, L, 6.45, 11.9, 0.25, [{"text": "The next number is a baseline audit, not a TAM.", "size": 9.5, "color": MUTED}])

    # 7. Business
    s = slide(prs)
    chrome(s, 7, "06 / Who pays")
    label(s, L, 0.95, "Sell the closure rate, not another seat")
    title(s, L, 1.22, 11.3, "One lab chain. Many clinics. A measurable last mile.", size=30)
    # left column
    rect(s, L, 2.15, 6.0, 3.9, fill=WHITE, line=LINE, radius=True)
    text(s, L + 0.25, 2.38, 5.5, 0.3, [{"text": "THE BUYER", "size": 9.5, "bold": True, "color": PRIMARY}])
    text(s, L + 0.25, 2.68, 5.5, 0.62, [{"text": "Lab chain quality head, or a hospital group quality cell.", "size": 15, "bold": True, "color": INK, "line_spacing": 1.15}])
    text(s, L + 0.25, 3.45, 5.4, 0.9, [{"text": "The lab already sends the report. It pays for proof that the last mile closed and for a differentiator to referring doctors. The clinic uses the inbox free; the diabetes clinician is the champion.", "size": 10.5, "color": MUTED, "line_spacing": 1.3}])
    text(s, L + 0.25, 4.55, 5.4, 0.3, [{"text": "PILOT", "size": 9.5, "bold": True, "color": REVIEW}])
    text(s, L + 0.25, 4.85, 5.4, 0.75, [{"text": "₹60,000 / 90 days. One lab, one diabetes OPD, one ward. 100 de-identified reports for the baseline.", "size": 11, "color": INK, "line_spacing": 1.25}])
    # right column
    rect(s, 6.9, 2.15, 5.75, 3.9, fill=INK, line=None, radius=True)
    text(s, 7.15, 2.38, 5.2, 0.3, [{"text": "THE METRIC", "size": 9.5, "bold": True, "color": ACCENT}])
    text(s, 7.15, 2.72, 5.2, 0.75, [{"text": "Closure rate within 7 days.", "size": 24, "bold": True, "color": WHITE, "line_spacing": 1.0}])
    metrics = [
        ("1", "Abnormal or critical result with a named owner"),
        ("2", "Value echo + lab read-back where critical"),
        ("3", "Patient contacted, or attempts documented"),
        ("4", "Next step recorded; completion tracked"),
    ]
    y = 3.78
    for num, cap in metrics:
        text(s, 7.15, y, 0.35, 0.3, [{"text": num, "size": 10, "bold": True, "color": ACCENT}])
        text(s, 7.55, y, 4.75, 0.45, [{"text": cap, "size": 10.5, "color": WHITE, "line_spacing": 1.2}])
        y += 0.55
    text(s, 6.9, 6.2, 5.75, 0.3, [{"text": "The network is the expansion, not the product.", "size": 9, "italic": True, "color": MUTED}])
    text(s, L, 6.35, 11.9, 0.3, [{"text": "No TAM claim. The first proof is one lab, one cohort, one signed continuation.", "size": 9.5, "color": MUTED}])

    # 8. Ask
    s = slide(prs)
    chrome(s, 8, "07 / The ask")
    label(s, L, 0.95, "Three sites. One measured closure rate")
    title(s, L, 1.22, 10.8, "A baseline audit, not a demo.", size=38)
    text(s, L, 2.25, 7.6, 0.7, [{"text": "100 consecutive abnormal or critical diabetes reports per site. Eight weeks. A baseline audit, then the closure workflow, then a paid continuation. If the first two gates fail, the thesis stops.", "size": 13, "color": MUTED, "line_spacing": 1.35}])
    asks = [
        ("01", "ONE LAB OR OPD SPONSOR", "A quality head who will share 100 de-identified reports."),
        ("02", "ONE CLINICAL LEAD", "A practising diabetes clinician who signs the protocol and the pilot."),
        ("03", "ONE HONEST NUMBER", "Closure rate within 7 days, unreachable documented, zero false informed."),
    ]
    y = 3.55
    for num, head, body in asks:
        text(s, L, y, 0.4, 0.3, [{"text": num, "size": 10, "bold": True, "color": PRIMARY}])
        text(s, L + 0.5, y - 0.02, 6.6, 0.3, [{"text": head, "size": 12, "bold": True, "color": INK}])
        text(s, L + 0.5, y + 0.26, 6.6, 0.4, [{"text": body, "size": 11, "color": MUTED}])
        y += 0.82
    rect(s, 8.35, 2.9, 4.35, 3.35, fill=INK, line=None, radius=True)
    text(s, 8.62, 3.15, 3.8, 0.3, [{"text": "THE CLOSING LINE", "size": 9, "bold": True, "color": ACCENT}])
    text(s, 8.62, 3.55, 3.8, 1.8, [{"text": "The lab is done when it delivers. The clinic is done when the patient is reached.", "size": 21, "bold": True, "color": WHITE, "line_spacing": 1.12}])
    text(s, 8.62, 5.45, 3.8, 0.4, [{"text": "The result nobody told.", "size": 12, "italic": True, "color": ACCENT}])
    text(s, L, 6.35, 7.4, 0.3, [{"text": "Synthetic demo. No real patient data. No diagnosis or treatment advice.", "size": 9, "color": MUTED}])

    prs.save(OUT)
    print(f"wrote {OUT} ({len(prs.slides)} slides)")


if __name__ == "__main__":
    build()
