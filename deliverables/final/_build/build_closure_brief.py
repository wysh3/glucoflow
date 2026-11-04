from pathlib import Path
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "deliverables/final/Result_Ledger_Brief.docx"

INK = RGBColor(0x20, 0x3B, 0x38)
MUTED = RGBColor(0x5B, 0x70, 0x6B)
PRIMARY = RGBColor(0x1F, 0x6F, 0x5C)
REVIEW = RGBColor(0xB5, 0x47, 0x08)
DANGER = RGBColor(0xB4, 0x23, 0x18)
LINE = "D8D2C4"
CANVAS = "F4F1EA"


def shade(cell, hex_value):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), hex_value)
    tcPr.append(shd)


def border(paragraph, color=LINE, size=6, side="bottom"):
    pPr = paragraph._p.get_or_add_pPr()
    pBdr = pPr.find(qn("w:pBdr"))
    if pBdr is None:
        pBdr = OxmlElement("w:pBdr")
        pPr.append(pBdr)
    el = OxmlElement(f"w:{side}")
    el.set(qn("w:val"), "single")
    el.set(qn("w:sz"), str(size))
    el.set(qn("w:space"), "4")
    el.set(qn("w:color"), color)
    pBdr.append(el)


def cell_margins(cell, top=60, bottom=60, left=90, right=90):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement("w:tcMar")
    for name, value in (("top", top), ("bottom", bottom), ("left", left), ("right", right)):
        el = OxmlElement(f"w:{name}")
        el.set(qn("w:w"), str(value))
        el.set(qn("w:type"), "dxa")
        tcMar.append(el)
    tcPr.append(tcMar)


def p(doc, text="", size=9.4, color=INK, bold=False, italic=False, space_before=0, space_after=3, align=WD_ALIGN_PARAGRAPH.LEFT, line=1.15):
    para = doc.add_paragraph()
    para.alignment = align
    pf = para.paragraph_format
    pf.space_before = Pt(space_before)
    pf.space_after = Pt(space_after)
    pf.line_spacing = line
    run = para.add_run(text)
    run.font.name = "Inter"
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run.font.bold = bold
    run.font.italic = italic
    return para


def rich(doc, parts, size=9.4, space_before=0, space_after=3, line=1.15):
    para = doc.add_paragraph()
    pf = para.paragraph_format
    pf.space_before = Pt(space_before)
    pf.space_after = Pt(space_after)
    pf.line_spacing = line
    for text, color, bold in parts:
        run = para.add_run(text)
        run.font.name = "Inter"
        run.font.size = Pt(size)
        run.font.color.rgb = color
        run.font.bold = bold
    return para


def section(doc, text, number=None):
    para = p(doc, f"{number + '  ' if number else ''}{text.upper()}", size=8.6, color=PRIMARY, bold=True, space_before=8, space_after=3)
    border(para, "1F6F5C", 4)
    return para


def bullet(doc, text, color=INK, size=9.2):
    para = doc.add_paragraph(style=None)
    pf = para.paragraph_format
    pf.left_indent = Cm(0.42)
    pf.first_line_indent = Cm(-0.28)
    pf.space_before = Pt(0)
    pf.space_after = Pt(2)
    pf.line_spacing = 1.08
    run = para.add_run("•  ")
    run.font.name = "Inter"
    run.font.size = Pt(size)
    run.font.color.rgb = PRIMARY
    run.font.bold = True
    run = para.add_run(text)
    run.font.name = "Inter"
    run.font.size = Pt(size)
    run.font.color.rgb = color
    return para


def build():
    doc = Document()
    sec = doc.sections[0]
    sec.page_width = Cm(21.0)
    sec.page_height = Cm(29.7)
    sec.top_margin = Cm(1.35)
    sec.bottom_margin = Cm(1.25)
    sec.left_margin = Cm(1.55)
    sec.right_margin = Cm(1.55)

    style = doc.styles["Normal"]
    style.font.name = "Inter"
    style.font.size = Pt(9.4)
    style.paragraph_format.space_after = Pt(0)

    # Header
    hdr = doc.add_table(rows=1, cols=2)
    hdr.autofit = False
    hdr.columns[0].width = Cm(12.2)
    hdr.columns[1].width = Cm(5.6)
    c0, c1 = hdr.rows[0].cells
    c0.text = ""
    c1.text = ""
    for cell in (c0, c1):
        cell_margins(cell, 0, 20, 0, 0)
    r = c0.paragraphs[0].add_run("GLUCOFLOW  /  DIABETES RESULT CLOSURE")
    r.font.name = "Inter"; r.font.size = Pt(8.2); r.font.bold = True; r.font.color.rgb = PRIMARY
    r = c1.paragraphs[0].add_run("IIT BOMBAY HEALTH-A-THON 2026  ·  DIABETES TRACK")
    r.font.name = "Inter"; r.font.size = Pt(7.4); r.font.bold = True; r.font.color.rgb = MUTED
    c1.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    border(c0.paragraphs[0], LINE, 6)

    p(doc, "The last mile of a diabetes result.", size=23, color=INK, bold=False, space_before=8, space_after=2, line=0.98)
    p(doc, "The lab calls the doctor. Nobody calls the patient.", size=11.5, color=PRIMARY, space_after=6)

    # Two-column summary
    summary = doc.add_table(rows=1, cols=2)
    summary.autofit = False
    summary.columns[0].width = Cm(9.3)
    summary.columns[1].width = Cm(8.5)
    left, right = summary.rows[0].cells
    for cell in (left, right):
        cell_margins(cell, 40, 40, 110, 110)
    shade(right, CANVAS)
    left.text = ""
    right.text = ""

    lp = left.paragraphs[0]
    r = lp.add_run("A patient-closure ledger for abnormal and critical diabetes results. It records the printed value the clinician echoed, the lab notifier and read-back, the patient or caregiver contacted, the attempts that failed, the next administrative step, and a closure certificate.\n\n")
    r.font.name = "Inter"; r.font.size = Pt(9.2); r.font.color.rgb = INK
    r = lp.add_run("The product does not diagnose, triage or recommend treatment. The lab flag is the only source of criticality. The clinician sets the protocol and the action.\n\n")
    r.font.name = "Inter"; r.font.size = Pt(9.2); r.font.color.rgb = MUTED
    r = lp.add_run("Twelve synthetic receipts. Nine patients. Four labs. Five clinician-set monitoring protocols. CSV lab-feed import, patient matching, value echo, automatic escalation, an anchored audit chain and a public stage page.\n")
    r.font.name = "Inter"; r.font.size = Pt(9.2); r.font.color.rgb = INK

    rp = right.paragraphs[0]
    r = rp.add_run("THE PROBLEM IN ONE LINE\n")
    r.font.name = "Inter"; r.font.size = Pt(7.6); r.font.bold = True; r.font.color.rgb = PRIMARY
    r = rp.add_run("The lab is finished when it delivers. The clinic is not finished when it clicks acknowledge. The patient-side last mile is unowned.\n\n")
    r.font.name = "Inter"; r.font.size = Pt(9.1); r.font.color.rgb = INK
    r = rp.add_run("25.8%\n")
    r.font.name = "Inter"; r.font.size = Pt(18); r.font.bold = True; r.font.color.rgb = PRIMARY
    r = rp.add_run("of 1,187 critical values reached the treating clinician in an Indian tertiary hospital. 52.9% went to nursing staff. 90% of never-notified values were outpatients.\n\n")
    r.font.name = "Inter"; r.font.size = Pt(8.6); r.font.color.rgb = MUTED
    r = rp.add_run("Agarwal et al., Indian J Clin Biochem 2015 (PMC4310845).")
    r.font.name = "Inter"; r.font.size = Pt(7.6); r.font.color.rgb = MUTED; r.font.italic = True

    section(doc, "The gap is not notification. It is the last mile.", "01")
    rich(doc, [
        ("The 2015 audit found a written policy, a log book and a read-back rule. The failure was still the last mile: the result reached a desk, not the person who could act. ", MUTED, False),
        ("14% of positive results never returned", REVIEW, True),
        (" in an Indian secondary-care setting (NMJI 2015). A systematic review found ", MUTED, False),
        ("6.8% to 62% of abnormal ambulatory results were not followed up", REVIEW, True),
        (" (J Gen Intern Med 2012). The existing lab tools stop at clinician acknowledgement. The patient-side attempt, the unreachable outcome and the next step are the unclaimed record.", MUTED, False),
    ], size=9.2, space_after=4)

    section(doc, "Four controls make the closure honest.", "02")
    controls = [
        ("01", "VALUE ECHO", "The clinician types the printed value and selects the printed flag. For a critical result, the lab caller and the value read back are recorded. A wrong value is refused."),
        ("02", "PATIENT CONTACT", "Patient or caregiver, channel, language, who was spoken to. Every failed attempt is a row, not a silent assumption."),
        ("03", "AN HONEST DISPOSITION", "Informed, declined, unreachable, invalid number, deceased, transferred. Two attempts before an unreachable close. Never a false informed."),
        ("04", "NEXT STEP + PROOF", "Appointment, repeat test, specialist, collect report. Completion is tracked. The certificate maps evidence; it does not issue a compliance verdict."),
    ]
    for num, head, body in controls:
        hp = p(doc, f"{num}   {head}", size=8.8, color=REVIEW if num in ("03", "04") else PRIMARY, bold=True, space_before=4, space_after=1)
        p(doc, body, size=8.9, color=MUTED, space_after=1, line=1.12)

    # Compact receipt strip
    strip = doc.add_table(rows=1, cols=4)
    strip.autofit = False
    for idx, (num, head, body) in enumerate([
        ("01", "LAB RELEASE", "The clock starts at release, not at a WhatsApp folder."),
        ("02", "VALUE ECHO", "Printed value and flag. Lab notifier and read-back."),
        ("03", "PATIENT CONTACT", "Reached, or attempts. Unreachable is a disposition."),
        ("04", "NEXT STEP", "Recorded and tracked to completion."),
    ]):
        cell = strip.rows[0].cells[idx]
        cell.width = Cm(4.47)
        cell_margins(cell, 60, 60, 90, 90)
        shade(cell, "F4F1EA")
        cell.text = ""
        r = cell.paragraphs[0].add_run(num + "  ")
        r.font.name = "Inter"; r.font.size = Pt(7.6); r.font.bold = True; r.font.color.rgb = PRIMARY
        r = cell.paragraphs[0].add_run(head)
        r.font.name = "Inter"; r.font.size = Pt(7.6); r.font.bold = True; r.font.color.rgb = INK
        r = cell.add_paragraph().add_run(body)
        r.font.name = "Inter"; r.font.size = Pt(7.5); r.font.color.rgb = MUTED

    section(doc, "Why the diabetes track is the right first market.", "03")
    rich(doc, [
        ("The first protocol is the check a diabetes drug makes necessary: start or titrate an ACE inhibitor or ARB, then potassium and eGFR at two to four weeks. The same receipt covers SGLT2i, MRA, annual uACR/eGFR, a critical potassium, or an abnormal HbA1c. ", MUTED, False),
        ("101 million people in India live with diabetes", INK, True),
        (" (ICMR-INDIAB-17, 2023). The clinician sets the protocol; the lab flag sets criticality; the product never infers a screening deadline or a clinical action.", MUTED, False),
    ], size=9.1, space_after=2)

    # Page break
    doc.add_page_break()

    p(doc, "What we ran, what we have not, and what we need.", size=18, color=INK, space_before=0, space_after=2, line=1.0)
    p(doc, "A baseline audit, not a demo.", size=11, color=PRIMARY, space_after=6)

    section(doc, "Measured, and deliberately not claimed.", "04")
    two = doc.add_table(rows=1, cols=2)
    two.autofit = False
    two.columns[0].width = Cm(9.2)
    two.columns[1].width = Cm(8.6)
    a, b = two.rows[0].cells
    for cell in (a, b):
        cell_margins(cell, 60, 60, 110, 110)
    shade(a, "FFFFFF")
    shade(b, CANVAS)
    a.text = ""
    b.text = ""
    r = a.paragraphs[0].add_run("WHAT WE RAN\n")
    r.font.name = "Inter"; r.font.size = Pt(7.8); r.font.bold = True; r.font.color.rgb = PRIMARY
    for value, cap in [
        ("188", "unit and integration tests across 31 files."),
        ("12 / 12", "result and landing browser tests on desktop and mobile."),
        ("0", "lint findings on ledger, drawer, certificate, patient slip and public verifier."),
        ("4", "new integration tests: value echo, unreachable close, anchored chain, namesake matching."),
        ("12", "synthetic diabetes receipts across 9 patients and 4 labs; 5 monitoring protocols."),
    ]:
        para = a.add_paragraph()
        para.paragraph_format.space_before = Pt(3)
        para.paragraph_format.space_after = Pt(0)
        r = para.add_run(value + "  ")
        r.font.name = "Inter"; r.font.size = Pt(12.5); r.font.bold = True; r.font.color.rgb = PRIMARY
        r = para.add_run(cap)
        r.font.name = "Inter"; r.font.size = Pt(8.4); r.font.color.rgb = MUTED

    r = b.paragraphs[0].add_run("WHAT WE HAVE NOT VALIDATED\n")
    r.font.name = "Inter"; r.font.size = Pt(7.8); r.font.bold = True; r.font.color.rgb = REVIEW
    for item in [
        "No buyer interview, baseline audit, paid pilot or LOI.",
        "No live LIS, HL7/FHIR or WhatsApp send. The demo imports a CSV lab feed.",
        "No consent capture, DPA, retention runbook or independent security review.",
        "No external anchor. The chain is tamper-evident inside one database.",
        "No clinical validation. No diagnosis, triage, risk score or treatment advice.",
        "No NABL or NABH certification. The certificate maps evidence and leaves the verdict to the assessor.",
    ]:
        para = b.add_paragraph(style=None)
        para.paragraph_format.left_indent = Cm(0.35)
        para.paragraph_format.first_line_indent = Cm(-0.25)
        para.paragraph_format.space_before = Pt(2)
        para.paragraph_format.space_after = Pt(0)
        r = para.add_run("—  ")
        r.font.name = "Inter"; r.font.size = Pt(8.4); r.font.color.rgb = REVIEW; r.font.bold = True
        r = para.add_run(item)
        r.font.name = "Inter"; r.font.size = Pt(8.4); r.font.color.rgb = MUTED

    section(doc, "The buyer and the pilot.", "05")
    rich(doc, [
        ("The payer is the lab chain quality head or a hospital group quality cell; the user is the diabetes clinic; the champion is the endocrinologist or quality head. The lab already sends the report. It pays for proof that the last mile closed and for a differentiator to referring doctors. ", MUTED, False),
        ("Pilot: ₹60,000 for 90 days. One lab, one diabetes OPD, one ward. 100 de-identified reports for the baseline. Continuation is a signed decision, not a survey answer.", INK, True),
    ], size=9.1, space_after=3)

    # Pilot box
    box = doc.add_table(rows=1, cols=1)
    box.autofit = False
    box.columns[0].width = Cm(17.9)
    cell = box.rows[0].cells[0]
    cell_margins(cell, 100, 100, 140, 140)
    shade(cell, "203B38")
    cell.text = ""
    r = cell.paragraphs[0].add_run("THE ASK\n")
    r.font.name = "Inter"; r.font.size = Pt(7.6); r.font.bold = True; r.font.color.rgb = RGBColor(0xA7, 0xD8, 0xC8)
    r = cell.add_paragraph().add_run("Three sites. 100 consecutive abnormal or critical diabetes reports each. Eight weeks. A baseline audit, the closure workflow, then a paid continuation. If the first two gates fail, the thesis stops.\n")
    r.font.name = "Inter"; r.font.size = Pt(9.4); r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    r = cell.add_paragraph().add_run("What we need: one lab or OPD sponsor, one practising clinical lead, and 100 de-identified reports. What we will report: closure rate within 7 days, documented unreachable, zero false informed, and next-step completion.")
    r.font.name = "Inter"; r.font.size = Pt(8.8); r.font.color.rgb = RGBColor(0xD7, 0xE6, 0xE1)

    section(doc, "The line that matters.", "06")
    p(doc, "The lab is done when it delivers. The clinic is done when the patient is reached.", size=13.5, color=PRIMARY, space_after=3)
    p(doc, "The result nobody told.", size=10.5, color=MUTED, italic=True, space_after=4)

    section(doc, "What would make us stop.", "07")
    gates = doc.add_table(rows=1, cols=3)
    gates.autofit = False
    gate_items = [
        ("BASELINE", "100 consecutive reports per site. Count the results with no documented owner, no patient contact and no critical read-back. If the gap is under 30%, the site does not have the problem we are built for."),
        ("CONCIERGE", "20 receipts in week one. Measure staff minutes per report and audit every informed row against the phone record. Stop on any false informed or more than 3 minutes per report."),
        ("CONTINUATION", "Eight weeks. A signed paid continuation, not a survey answer. Closure rate within 7 days, unreachable documented, next step completed. No signature means stop."),
    ]
    for idx, (head, body) in enumerate(gate_items):
        cell = gates.rows[0].cells[idx]
        cell.width = Cm(5.96)
        cell_margins(cell, 70, 70, 100, 100)
        shade(cell, "F4F1EA")
        cell.text = ""
        r = cell.paragraphs[0].add_run(head)
        r.font.name = "Inter"; r.font.size = Pt(7.8); r.font.bold = True; r.font.color.rgb = REVIEW
        r = cell.add_paragraph().add_run(body)
        r.font.name = "Inter"; r.font.size = Pt(7.8); r.font.color.rgb = MUTED
    p(doc, "A pilot that cannot produce these numbers is a demo.", size=8.2, color=MUTED, italic=True, space_before=3, space_after=3)

    p(doc, "Sources: Agarwal et al., Indian J Clin Biochem 2015 (PMC4310845); Ganiyari et al., NMJI 2015; J Gen Intern Med 2012 systematic review; ICMR-INDIAB-17, Lancet Diabetes & Endocrinology 2023. Product measurements are from the current build. The receipt and patient records in this document are synthetic.", size=7.3, color=MUTED, line=1.1)
    p(doc, "Synthetic data. Administrative only. No clinical interpretation. This is a product and validation document, not legal or clinical advice.", size=7.3, color=MUTED, line=1.1)

    # Footer page numbers
    for i, paragraph in enumerate(doc.paragraphs):
        pass
    footer = sec.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = footer.add_run("Glucoflow  ·  Diabetes result closure  ·  page ")
    r.font.name = "Inter"; r.font.size = Pt(7); r.font.color.rgb = MUTED
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "PAGE")
    footer._p.append(fld)

    doc.save(OUT)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    build()
