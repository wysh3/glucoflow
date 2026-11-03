"""Build Delta_Solution_Brief.docx: A4, 1.6 cm margins, exactly two pages.

Content model: numbered sections, each rendered by one of four shapes (prose,
evidence table, KPI strip, vector block diagram). Every measured number carries
its source in the same block; every planned number is labelled Target.

Run: python3 build_brief.py
"""

from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
from docx.shared import Cm, Emu, Pt, RGBColor

OUT = Path(__file__).resolve().parent.parent / "Delta_Solution_Brief.docx"

# Palette from the product design tokens.
PRIMARY = "26796E"
INK = "203B38"
SOFT_INK = "5B706B"
CANVAS = "F5F8F5"
LINE = "DCE7E1"
ATTENTION = "A85B00"

BODY_PT = 9.5
LEADING = 1.15

# A4, 1.6 cm margins.
PAGE_W = Cm(21.0)
PAGE_H = Cm(29.7)
MARGIN = Cm(1.6)
CONTENT_W = Emu(PAGE_W - 2 * MARGIN)


def rgb(hex_value):
    return RGBColor.from_string(hex_value)


def set_run(run, size=None, bold=False, color=INK, caps=False,
            spacing_twips=None):
    font = run.font
    font.name = "Inter"
    run._element.rPr.rFonts.set(qn("w:cs"), "Inter")
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "Inter")
    if size:
        font.size = Pt(size)
    font.bold = bold
    font.color.rgb = rgb(color)
    if caps:
        font.all_caps = True
    if spacing_twips is not None:
        rpr = run._element.get_or_add_rPr()
        spacing = OxmlElement("w:spacing")
        spacing.set(qn("w:val"), str(spacing_twips))
        rpr.append(spacing)


def add_run(paragraph, text, **kwargs):
    run = paragraph.add_run(text)
    set_run(run, **kwargs)
    return run


def para(container, text="", size=BODY_PT, color=INK, bold=False, before=0,
         after=0, line=LEADING, align=None, left=None, first=None, keep=False):
    p = container.add_paragraph()
    fmt = p.paragraph_format
    fmt.space_before = Pt(before)
    fmt.space_after = Pt(after)
    fmt.line_spacing = line
    if align is not None:
        fmt.alignment = align
    if left is not None:
        fmt.left_indent = left
    if first is not None:
        fmt.first_line_indent = first
    fmt.keep_with_next = keep
    if text:
        add_run(p, text, size=size, color=color, bold=bold)
    return p


PPR_ORDER = [
    "pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr",
    "widowControl", "numPr", "suppressLineNumbers", "pBdr", "shd", "tabs",
    "suppressAutoHyphens", "kinsoku", "wordWrap", "overflowPunct",
    "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd",
    "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents",
    "suppressOverlap", "jc", "textDirection", "textAlignment",
    "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr",
]


def ppr_insert(ppr, element):
    rank = PPR_ORDER.index(element.tag.split("}")[1])
    for child in list(ppr):
        child_rank = PPR_ORDER.index(child.tag.split("}")[1])
        if child_rank > rank:
            child.addprevious(element)
            return
    ppr.append(element)


def edge_rule(paragraph, edge, color=LINE, size=6, space=4):
    ppr = paragraph._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    node = OxmlElement("w:" + edge)
    node.set(qn("w:val"), "single")
    node.set(qn("w:sz"), str(size))
    node.set(qn("w:space"), str(space))
    node.set(qn("w:color"), color)
    borders.append(node)
    ppr_insert(ppr, borders)


def bottom_rule(paragraph, color=LINE, size=6, space=4):
    edge_rule(paragraph, "bottom", color, size, space)


def top_rule(paragraph, color=LINE, size=6, space=4):
    edge_rule(paragraph, "top", color, size, space)


def set_tabs(paragraph, clear_positions, right_position):
    tabs = OxmlElement("w:tabs")
    for pos in clear_positions:
        node = OxmlElement("w:tab")
        node.set(qn("w:val"), "clear")
        node.set(qn("w:pos"), str(pos))
        tabs.append(node)
    node = OxmlElement("w:tab")
    node.set(qn("w:val"), "right")
    node.set(qn("w:pos"), str(int(right_position.pt * 20)))
    tabs.append(node)
    ppr_insert(paragraph._p.get_or_add_pPr(), tabs)


def section_heading(doc, number, title, before=7):
    p = para(doc, before=before, after=2, line=1.0, keep=True)
    add_run(p, number + "  ", size=7.5, color=PRIMARY, bold=True)
    add_run(p, title, size=11, color=INK, bold=True)
    return p


def bullet(container, text, size=8.5, color=SOFT_INK, before=0, after=2,
           indent=9.5):
    p = para(container, before=before, after=after, line=LEADING,
             left=Pt(indent), first=Pt(-indent))
    p.paragraph_format.tab_stops.add_tab_stop(Pt(indent), WD_TAB_ALIGNMENT.LEFT)
    add_run(p, "\u2022\t", size=size, color=PRIMARY, bold=True)
    add_run(p, text, size=size, color=color)
    return p


def strip_table_borders(table):
    tbl_pr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        node = OxmlElement("w:" + edge)
        node.set(qn("w:val"), "nil")
        borders.append(node)
    tbl_pr.append(borders)


def fix_widths(table, widths_pt):
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    tbl_pr = table._tbl.tblPr
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    tbl_pr.append(layout)
    tbl_w = OxmlElement("w:tblW")
    tbl_w.set(qn("w:w"), str(int(sum(widths_pt) * 20)))
    tbl_w.set(qn("w:type"), "dxa")
    tbl_pr.append(tbl_w)
    margins = OxmlElement("w:tblCellMar")
    for edge, value in (("top", 20), ("left", 0), ("bottom", 20), ("right", 90)):
        node = OxmlElement("w:" + edge)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")
        margins.append(node)
    tbl_pr.append(margins)
    grid = table._tbl.tblGrid
    for col, width in zip(grid.findall(qn("w:gridCol")), widths_pt):
        col.set(qn("w:w"), str(int(width * 20)))
    for row in table.rows:
        for index, cell in enumerate(row.cells):
            cell.width = Pt(widths_pt[index])


def cell_rule(cell, edge="bottom", color=LINE, size=6):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    node = OxmlElement("w:" + edge)
    node.set(qn("w:val"), "single")
    node.set(qn("w:sz"), str(size))
    node.set(qn("w:space"), "0")
    node.set(qn("w:color"), color)
    borders.append(node)
    tc_pr.append(borders)


def cell_para(cell, text="", size=8, color=INK, bold=False, before=0, after=0,
              line=1.12, align=None):
    first = cell.paragraphs[0]
    p = first if not first.runs and not first.text else cell.add_paragraph()
    fmt = p.paragraph_format
    fmt.space_before = Pt(before)
    fmt.space_after = Pt(after)
    fmt.line_spacing = line
    if align is not None:
        fmt.alignment = align
    if text:
        add_run(p, text, size=size, color=color, bold=bold)
    return p


# ---------------------------------------------------------------- vector blocks

BLOCK_NS = (
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" '
    'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"'
)


def block_shape(x, y, w, h, label, desc, accent):
    return f'''
<wps:wsp>
  <wps:cNvSpPr/>
  <wps:spPr>
    <a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm>
    <a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 5000"/></a:avLst></a:prstGeom>
    <a:solidFill><a:srgbClr val="{CANVAS}"/></a:solidFill>
    <a:ln w="6350"><a:solidFill><a:srgbClr val="{LINE}"/></a:solidFill></a:ln>
  </wps:spPr>
  <wps:txbx><w:txbxContent>
    <w:p>
      <w:pPr><w:spacing w:before="0" w:after="40" w:line="240" w:lineRule="auto"/></w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter" w:cs="Inter"/><w:b/><w:color w:val="{accent}"/><w:sz w:val="17"/></w:rPr>
        <w:t xml:space="preserve">{label}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:before="0" w:after="0" w:line="232" w:lineRule="auto"/></w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter" w:cs="Inter"/><w:color w:val="{SOFT_INK}"/><w:sz w:val="15"/></w:rPr>
        <w:t xml:space="preserve">{desc}</w:t>
      </w:r>
    </w:p>
  </w:txbxContent></wps:txbx>
  <wps:bodyPr rot="0" vert="horz" wrap="square" lIns="99060" tIns="60706" rIns="72000" bIns="40000" anchor="t" anchorCtr="0"><a:noAutofit/></wps:bodyPr>
</wps:wsp>'''


def four_block_group(anchor_paragraph, width_emu, height_emu, blocks, gap_emu):
    w = (width_emu - gap_emu * (len(blocks) - 1)) // len(blocks)
    parts = [block_shape(i * (w + gap_emu), 0, w, height_emu, label, desc, accent)
             for i, (label, desc, accent) in enumerate(blocks)]
    xml = f'''
<w:p {nsdecls("w")}>
  <w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>
  <w:r>
    <w:drawing {BLOCK_NS}>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="{width_emu}" cy="{height_emu}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="20" name="Four blocks"/>
        <a:graphic>
          <a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup">
            <wpg:wgp>
              <wpg:cNvGrpSpPr/>
              <wpg:grpSpPr>
                <a:xfrm>
                  <a:off x="0" y="0"/><a:ext cx="{width_emu}" cy="{height_emu}"/>
                  <a:chOff x="0" y="0"/><a:chExt cx="{width_emu}" cy="{height_emu}"/>
                </a:xfrm>
              </wpg:grpSpPr>
              {"".join(parts)}
            </wpg:wgp>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>'''
    anchor_paragraph._p.addnext(parse_xml(xml))


# ---------------------------------------------------------------- document

def build():
    doc = Document()

    normal = doc.styles["Normal"]
    normal.font.name = "Inter"
    normal.font.size = Pt(BODY_PT)
    normal.font.color.rgb = rgb(INK)
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(0)
    normal.paragraph_format.line_spacing = LEADING

    section = doc.sections[0]
    section.page_width = PAGE_W
    section.page_height = PAGE_H
    section.left_margin = MARGIN
    section.right_margin = MARGIN
    section.top_margin = MARGIN
    section.bottom_margin = MARGIN
    section.header_distance = Cm(0.75)
    section.footer_distance = Cm(0.7)

    header = section.header
    h = header.paragraphs[0]
    h.paragraph_format.space_after = Pt(3)
    set_tabs(h, (4680, 9360), CONTENT_W)
    add_run(h, "THE 60-SECOND DELTA", size=7, color=PRIMARY, bold=True,
            spacing_twips=24)
    add_run(h, "\tDoctor-side pre-visit brief  \u00b7  IITB Health Hackathon 2026",
            size=7, color=SOFT_INK)
    bottom_rule(h, size=4, space=3)

    def fill_footer(footer, page_text):
        f = footer.paragraphs[0]
        f.paragraph_format.space_before = Pt(3)
        set_tabs(f, (4680, 9360), CONTENT_W)
        add_run(f, "Synthetic data. Assistive only. Human approval required.",
                size=7, color=SOFT_INK)
        add_run(f, "\t" + page_text, size=7, color=SOFT_INK)
        top_rule(f, size=4, space=3)

    fill_footer(section.footer, "Page 1 of 2")

    # ------------------------------------------------------------ page 1
    eyebrow = para(doc, before=0, after=4, line=1.0)
    add_run(eyebrow, "A ONE-PAGE PRE-VISIT BRIEF FOR INDIAN FOLLOW-UP CLINICS",
            size=7.5, color=PRIMARY, bold=True, spacing_twips=20)

    title = para(doc, before=0, after=0, line=0.96)
    add_run(title, "The 60-second delta", size=25.5, color=INK, bold=True)

    sub = para(doc, before=0, after=4, line=1.12)
    add_run(sub, "The doctor has two minutes. ", size=12, color=INK)
    add_run(sub, "We give back the first sixty seconds.", size=12,
            color=PRIMARY, bold=True)

    desc = para(doc, before=0, after=0, line=1.2)
    add_run(desc,
            "Not a records dashboard. The delta is the unit: what changed, what is "
            "unresolved, where sources disagree, and what the record cannot say. "
            "Every line opens its source. The doctor decides.",
            size=9.5, color=SOFT_INK)

    section_heading(doc, "01", "Problem", before=6)
    para(doc,
         "A follow-up visit begins with a reconstruction. The doctor opens old reports, "
         "prescriptions, a discharge summary, the lab portal and a WhatsApp thread while "
         "the patient repeats the story. About two minutes decide what gets seen. When "
         "that reconstruction is skipped, a change is missed, a test is repeated, or a "
         "referral quietly lapses.")

    section_heading(doc, "02", "Who is affected")
    para(doc,
         "Follow-up doctors in Indian diabetes, maternal and cancer clinics, in a "
         "government OPD and a private hospital alike. The record is there. The two "
         "minutes are not, and the patient carries the cost of the miss.")

    section_heading(doc, "03", "Solution")
    para(doc,
         "One page before the patient sits down. Four blocks: what changed, what is "
         "unresolved, where two sources conflict, and what we do not know. The doctor "
         "accepts, edits or flags an item. Accepted items become the visit note; "
         "unresolved items stay flagged for follow-up. The AI reads, matches and reconciles. It does "
         "not diagnose, recommend or score.", after=4)
    diagram_anchor = para(doc, before=1, after=2, line=1.0)
    four_block_group(
        diagram_anchor,
        int(CONTENT_W * 0.985),
        int(Cm(2.3)),
        [
            ("Changed", "New results, new medicines, dose changes, new events. Each "
                        "with a date and a source.", PRIMARY),
            ("Unresolved", "Results not reviewed, referrals not completed, questions "
                           "no one answered. Each with an age.", PRIMARY),
            ("Conflicts", "The patient says one thing. The record says another. Both "
                          "are shown.", ATTENTION),
            ("What we do not know", "Missing pages, partial dates, units that cannot "
                                    "merge. No guessing.", ATTENTION),
        ],
        int(Cm(0.2)),
    )
    cap = para(doc, before=3, after=0, line=1.1)
    add_run(cap, "Figure 1. ", size=7.5, color=PRIMARY, bold=True)
    add_run(cap,
            "Native vector blocks, no image. Inside the product, every line beneath "
            "them opens its original page with the line highlighted.",
            size=7.5, color=SOFT_INK)

    section_heading(doc, "04", "The moment")
    para(doc,
         "The eGFR card opens its source in one click: 70 in April, 55 in July. The May "
         "2025 eye review asked for a review in 12 months, and no later ophthalmology "
         "record exists. The product shows the interval and does not call it overdue. "
         "On the synthetic case, the read is 42 seconds: demo evidence, not a "
         "measured average.")

    section_heading(doc, "05", "Evidence")
    evidence = [
        ("Follow-up visit", "2 minutes",
         " in a nine-clinic government OPD study", "IJCMH 2019"),
        ("Trackable by phone and address", "11.2%",
         " of 3,696 public-programme patients, Chennai audit",
         "BMC Infectious Diseases 2018"),
        ("Critical values notified late", "64.61%",
         " of 1,187, 30 to 120 minutes after sample arrival",
         "Indian J Clin Biochem 2015"),
        ("Missed abnormal results", "6.8% to 62%",
         " across the reviewed settings", "J Gen Intern Med 2012"),
        ("Critical alert requirements", "a register and a read-back",
         ", retention of at least one year", "NABL 112, NABH"),
    ]
    table = doc.add_table(rows=len(evidence) + 1, cols=2)
    strip_table_borders(table)
    fix_widths(table, [372, 132])
    head = table.rows[0]
    cell_para(head.cells[0], "WHAT THE EVIDENCE SHOWS, AND ITS SOURCE", size=6.8,
              color=SOFT_INK, bold=True, after=2)
    cell_para(head.cells[1], "SOURCE", size=6.8, color=SOFT_INK, bold=True, after=2)
    for cell in head.cells:
        cell_rule(cell, "bottom", color=INK, size=6)
    for row_index, (label, key, tail, source) in enumerate(evidence, start=1):
        row = table.rows[row_index]
        p = cell_para(row.cells[0], before=2.2, after=2.2)
        add_run(p, label + ": ", size=8, color=SOFT_INK)
        add_run(p, key, size=8, color=INK, bold=True)
        add_run(p, tail, size=8, color=SOFT_INK)
        cell_para(row.cells[1], source, size=8, color=PRIMARY, before=2.2, after=2.2)
        for cell in row.cells:
            cell_rule(cell)

    section_heading(doc, "06", "KPI", before=8)
    kpis = [
        ("Time to brief", "Under 60 seconds per patient"),
        ("Delta completeness", "Share of required delta items present, per case"),
        ("Unresolved closed", "Items closed within 7 days of the visit"),
        ("Doctor confidence", "Rated by the doctor after each brief"),
    ]
    kpi_table = doc.add_table(rows=1, cols=4)
    strip_table_borders(kpi_table)
    fix_widths(kpi_table, [126, 126, 126, 126])
    for index, (name, definition) in enumerate(kpis):
        cell = kpi_table.rows[0].cells[index]
        cell_rule(cell, "top", color=PRIMARY, size=12)
        p = cell_para(cell, name, size=9, color=INK, bold=True, before=5, after=1,
                      line=1.05)
        cell_para(cell, definition, size=7.5, color=SOFT_INK, after=2, line=1.1)
        cell_para(cell, "TARGET", size=6.8, color=ATTENTION, bold=True)
    note = para(doc, before=3, after=0, line=1.1)
    add_run(note,
            "All four are targets. None is measured yet. The pilot runs a manual "
            "baseline and the delta arm on the same cases, in balanced order.",
            size=7.5, color=SOFT_INK)

    closing = para(doc, before=20, after=0, line=1.15)
    top_rule(closing, color=LINE, size=6, space=6)
    add_run(closing,
            "The doctor sees one page, three decisions, and every source one click "
            "away. ", size=9.5, color=INK)
    add_run(closing, "The full ledger is there when they want it.", size=9.5,
            color=PRIMARY, bold=True)

    # ------------------------------------------------------------ page 2
    page2 = doc.add_section(WD_SECTION.NEW_PAGE)
    page2.page_width = PAGE_W
    page2.page_height = PAGE_H
    page2.left_margin = MARGIN
    page2.right_margin = MARGIN
    page2.top_margin = MARGIN
    page2.bottom_margin = MARGIN
    page2.header_distance = Cm(0.75)
    page2.footer_distance = Cm(0.7)
    page2.footer.is_linked_to_previous = False
    page2.header.is_linked_to_previous = True
    fill_footer(page2.footer, "Page 2 of 2")

    section_heading(doc, "07", "How it works", before=0)
    para(doc,
         "Five steps from a bag of paper to a draft note. The doctor sees only the "
         "brief.", after=5)
    steps = [
        ("Ingest", "PDFs, photos, WhatsApp forwards, lab portals"),
        ("Extract", "Facts, each with its evidence span"),
        ("Bind", "Every fact tied to a source line"),
        ("Reconcile", "Current against prior state"),
        ("Approve", "Doctor accepts, edits or flags"),
    ]
    step_table = doc.add_table(rows=1, cols=5)
    strip_table_borders(step_table)
    fix_widths(step_table, [101, 101, 101, 101, 100])
    for index, (name, detail) in enumerate(steps):
        cell = step_table.rows[0].cells[index]
        cell_rule(cell, "top", color=PRIMARY, size=10)
        cell_para(cell, f"0{index + 1}", size=6.8, color=PRIMARY, bold=True,
                  before=4, after=1)
        cell_para(cell, name, size=9, color=INK, bold=True, after=1, line=1.05)
        cell_para(cell, detail, size=7.5, color=SOFT_INK, line=1.1)

    section_heading(doc, "08", "AI and safety", before=24)
    ai_table = doc.add_table(rows=1, cols=2)
    strip_table_borders(ai_table)
    fix_widths(ai_table, [252, 252])
    does = ai_table.rows[0].cells[0]
    never = ai_table.rows[0].cells[1]
    cell_para(does, "WHAT THE MODEL DOES", size=6.8, color=PRIMARY, bold=True,
              after=2.5)
    for line in ("Extraction, entity resolution, reconciliation, delta generation.",
                 "Source binding on every generated line."):
        bullet(does, line)
    cell_para(never, "WHAT IT NEVER DOES", size=6.8, color=ATTENTION, bold=True,
              after=2.5)
    for line in ("No diagnosis, treatment advice or risk score.",
                 "No autonomous action. No imputation of a missing value."):
        bullet(never, line)
    note = para(doc, before=5, after=0, line=1.18)
    add_run(note,
            "The clinic is the data fiduciary; the product is the processor. DPDP "
            "consent, notice, retention and audit. No medical device claim. No ABDM or "
            "WhatsApp integration claim. Documentation and retrieval aid, with human "
            "approval before any note is signed.",
            size=8.8, color=SOFT_INK)

    section_heading(doc, "09", "Market and business model", before=24)
    rows = [
        ("Beachhead", "Diabetes follow-up in one Tier 2 cluster. One workflow, one "
                      "user, one outcome."),
        ("Buyer", "The clinic owner, or the hospital quality head who answers for "
                  "critical results."),
        ("Price", "₹1,500 per doctor per month; ₹3,000 per two-doctor clinic. The "
                  "pilot price is fixed for eight weeks."),
        ("Expansion", "Maternal, cancer, then government OPDs. Same delta, different "
                      "clinical vocabulary."),
    ]
    market = doc.add_table(rows=len(rows), cols=2)
    strip_table_borders(market)
    fix_widths(market, [96, 408])
    for index, (label, text) in enumerate(rows):
        row = market.rows[index]
        cell_para(row.cells[0], label, size=9.4, color=INK, bold=True, before=6,
                  after=6)
        cell_para(row.cells[1], text, size=9.4, color=SOFT_INK, before=6, after=6)
        for cell in row.cells:
            cell_rule(cell)

    two_up = doc.add_table(rows=1, cols=2)
    strip_table_borders(two_up)
    fix_widths(two_up, [252, 252])
    left, right = two_up.rows[0].cells
    head_l = cell_para(left, "", size=11, before=26, after=3, line=1.05)
    add_run(head_l, "10  ", size=7.5, color=PRIMARY, bold=True)
    add_run(head_l, "Why now", size=11, color=INK, bold=True)
    for line in ("Extraction is finally good enough for Indian paper, scans and "
                 "forwarded photographs.",
                 "Records are digitised but unusable at the point of care.",
                 "DPDP Rules make audit a requirement, not a feature. Cheap inference "
                 "makes it affordable."):
        bullet(left, line, size=9.2)

    head_r = cell_para(right, "", size=11, before=26, after=3, line=1.05)
    add_run(head_r, "11  ", size=7.5, color=PRIMARY, bold=True)
    add_run(head_r, "Why us", size=11, color=INK, bold=True)
    for line in ("A backend, worker, web client and Capacitor Android shell, already "
                 "in the product.",
                 "Versioned facts, evidence binding and an identity firewall in the "
                 "data model.",
                 "A clinical partner for the delta rubric, and a team that ships in "
                 "days."):
        bullet(right, line, size=9.2)

    two_up_2 = doc.add_table(rows=1, cols=2)
    strip_table_borders(two_up_2)
    fix_widths(two_up_2, [252, 252])
    ask_cell, team_cell = two_up_2.rows[0].cells
    head_a = cell_para(ask_cell, "", size=11, before=26, after=3, line=1.05)
    add_run(head_a, "12  ", size=7.5, color=PRIMARY, bold=True)
    add_run(head_a, "The ask", size=11, color=INK, bold=True)
    cell_para(ask_cell,
              "Three clinics, 100 follow-ups, eight weeks. A manual baseline and the "
              "delta arm on the same cases, in balanced order. A doctor partner to "
              "sign the delta rubric.", size=9, after=3, line=1.15)
    cell_para(ask_cell,
              "The pilot outputs the four KPIs, measured against a manual baseline.",
              size=8, color=SOFT_INK, after=0, line=1.15)

    head_t = cell_para(team_cell, "", size=11, before=26, after=3, line=1.05)
    add_run(head_t, "13  ", size=7.5, color=PRIMARY, bold=True)
    add_run(head_t, "Team", size=11, color=INK, bold=True)
    team_rows = [
        ("Clinical lead", "Clinical plausibility, the delta rubric, pilot sites."),
        ("Engineering lead", "Pipeline, evidence binding, pilot instrumentation."),
        ("Design and product", "The brief, the demo, the measurement."),
    ]
    for role, detail in team_rows:
        p = cell_para(team_cell, "", size=9, after=3, line=1.15)
        add_run(p, role + " ", size=9, color=INK, bold=True)
        add_run(p, detail, size=9, color=SOFT_INK)

    close = para(doc, before=52, after=0, line=1.2)
    top_rule(close, color=LINE, size=6, space=6)
    add_run(close, "The doctor has two minutes. ", size=12, color=INK)
    add_run(close, "We give back the first sixty seconds.", size=12,
            color=PRIMARY, bold=True)

    doc.save(OUT)
    print("saved", OUT)


if __name__ == "__main__":
    build()
