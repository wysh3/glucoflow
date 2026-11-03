"""Build Delta_Final_Presentation.pptx: 8 slides, 16:9, fixed organiser sequence.

One idea per slide. Shapes and type only, no photography. Palette comes from the
product design tokens. Every number is labelled measured, demo or target.

Run: python3 build_deck.py
"""

from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt

OUT = Path(__file__).resolve().parent.parent / "Delta_Final_Presentation.pptx"

PRIMARY = "26796E"
INK = "203B38"
SOFT_INK = "5B706B"
CANVAS = "F5F8F5"
LINE = "DCE7E1"
ATTENTION = "A85B00"
WHITE = "FFFFFF"

W = 13.333
H = 7.5
L = 0.9
CONTENT_W = W - 2 * L

FONT = "Inter"


def C(hex_value):
    return RGBColor.from_string(hex_value)


def no_shadow(shape):
    shape.shadow.inherit = False
    style = shape._element.find(qn("p:style"))
    if style is not None:
        shape._element.remove(style)


def add_run(paragraph, text, size=16, color=INK, bold=False, spacing=None):
    run = paragraph.add_run()
    run.text = text
    font = run.font
    font.name = FONT
    font.size = Pt(size)
    font.bold = bold
    font.color.rgb = C(color)
    if spacing is not None:
        font._rPr.set("spc", str(int(spacing * 100)))
    return run


def textbox(slide, x, y, w, h, paras, anchor=MSO_ANCHOR.TOP, align=PP_ALIGN.LEFT,
            wrap=True):
    """paras: list of dicts with runs=[(text, style)], optional space_before,
    space_after, line."""
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = wrap
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    for index, spec in enumerate(paras):
        p = tf.paragraphs[0] if index == 0 else tf.add_paragraph()
        p.alignment = align
        if "line" in spec:
            p.line_spacing = spec["line"]
        if "space_before" in spec:
            p.space_before = Pt(spec["space_before"])
        if "space_after" in spec:
            p.space_after = Pt(spec["space_after"])
        for text, style in spec["runs"]:
            add_run(p, text, **style)
    return box


def rect(slide, x, y, w, h, fill=None, line=None, weight=1.0,
         shape=MSO_SHAPE.RECTANGLE, radius=None):
    shp = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w),
                                 Inches(h))
    no_shadow(shp)
    if radius is not None and shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        shp.adjustments[0] = radius
    if fill:
        shp.fill.solid()
        shp.fill.fore_color.rgb = C(fill)
    else:
        shp.fill.background()
    if line:
        shp.line.color.rgb = C(line)
        shp.line.width = Pt(weight)
    else:
        shp.line.fill.background()
    shp.text_frame.text = ""
    return shp


def rule(slide, x, y, w, color=LINE, weight=0.9):
    return rect(slide, x, y, w, weight / 72.0, fill=color)


def background(slide):
    rect(slide, 0, 0, W, H, fill=CANVAS)


def chrome(slide, number, section):
    rule(slide, L, 6.98, CONTENT_W)
    textbox(slide, L, 7.06, 8.4, 0.24, [{
        "runs": [("Synthetic data. Assistive only. Human approval required.",
                  dict(size=9, color=SOFT_INK))]}])
    textbox(slide, W - L - 2.6, 7.06, 2.6, 0.24, [{
        "runs": [(f"{number or '01'} / 08", dict(size=9, color=SOFT_INK,
                                                 spacing=1.2))]}],
        align=PP_ALIGN.RIGHT)
    if number:
        textbox(slide, L, 0.5, 6.0, 0.24, [{
            "runs": [(section.upper(), dict(size=9.5, color=PRIMARY, bold=True,
                                            spacing=1.8))]}])


def heading(slide, title, lead=None):
    textbox(slide, L, 0.86, CONTENT_W, 0.72, [{
        "runs": [(title, dict(size=36, color=INK, bold=True))], "line": 0.95}])
    if lead:
        textbox(slide, L, 1.62, CONTENT_W, 0.4, [{
            "runs": [(lead, dict(size=19, color=SOFT_INK))], "line": 1.05}])


def blank(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])


def build():
    prs = Presentation()
    prs.slide_width = Inches(W)
    prs.slide_height = Inches(H)

    # ------------------------------------------------------------ 1 title
    s = blank(prs)
    background(s)
    textbox(s, L, 1.05, 7.6, 0.3, [{
        "runs": [("DOCTOR-SIDE PRE-VISIT BRIEF", dict(size=10, color=PRIMARY,
                                                      bold=True, spacing=2.4))]}])
    textbox(s, L, 1.5, 7.8, 2.0, [{
        "runs": [("The 60-second", dict(size=54, color=INK, bold=True))],
        "line": 0.92},
        {"runs": [("delta.", dict(size=54, color=PRIMARY, bold=True))],
         "line": 0.92}])
    textbox(s, L, 3.95, 7.1, 1.2, [{
        "runs": [("The doctor has two minutes.", dict(size=20, color=INK))],
        "line": 1.25},
        {"runs": [("We give back the first sixty seconds.",
                   dict(size=20, color=PRIMARY, bold=True))], "line": 1.25}])
    textbox(s, L, 5.35, 8.0, 0.4, [{
        "runs": [("A one-page pre-visit brief for Indian follow-up clinics. "
                  "Every line sourced.",
                  dict(size=13, color=SOFT_INK))], "line": 1.2}])

    ring_x, ring_y, ring = 9.35, 2.05, 3.05
    ring_shape = rect(s, ring_x, ring_y, ring, ring, fill=PRIMARY,
                      shape=MSO_SHAPE.DONUT)
    ring_shape.adjustments[0] = 0.175
    textbox(s, ring_x, ring_y + 1.12, ring, 0.9, [{
        "runs": [("60", dict(size=66, color=PRIMARY, bold=True))], "line": 1.0},
    ], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    textbox(s, ring_x, ring_y + 1.95, ring, 0.3, [{
        "runs": [("SECONDS", dict(size=10, color=SOFT_INK, bold=True,
                                  spacing=2.0))]}],
        align=PP_ALIGN.CENTER)
    textbox(s, ring_x - 0.6, ring_y + ring + 0.22, ring + 1.2, 0.4, [{
        "runs": [("From a bag of reports to a decision.",
                  dict(size=11, color=SOFT_INK))]}], align=PP_ALIGN.CENTER)
    chrome(s, None, "Title")

    # ------------------------------------------------------------ 2 problem
    s = blank(prs)
    background(s)
    chrome(s, "02", "Problem")
    heading(s, "The reconstruction",
            "Two minutes, a bag of reports, and a question the record does not "
            "answer.")

    line_y = 4.12
    rule(s, 2.0, line_y, 8.95, color=LINE, weight=1.4)
    stops = [
        ("0:00", "Open the reports"),
        ("0:20", "Patient repeats the story"),
        ("0:40", "Find the old value"),
        ("1:00", "Decide"),
    ]
    centers = [2.2, 5.05, 7.9, 10.75]
    for (time, label), cx in zip(stops, centers):
        textbox(s, cx - 0.9, 3.28, 1.8, 0.5, [{
            "runs": [(time, dict(size=26, color=PRIMARY, bold=True))]},
        ], align=PP_ALIGN.CENTER)
        dot = rect(s, cx - 0.075, line_y - 0.06, 0.15, 0.15, fill=PRIMARY,
                   shape=MSO_SHAPE.OVAL)
        textbox(s, cx - 1.25, line_y + 0.22, 2.5, 0.7, [{
            "runs": [(label, dict(size=15, color=INK))], "line": 1.15}],
            align=PP_ALIGN.CENTER)

    quote = ("The doctor should not have to reconstruct the record to see what changed.")
    textbox(s, L, 5.62, 10.6, 0.7, [{
        "runs": [(quote, dict(size=15, color=SOFT_INK))], "line": 1.25}])
    textbox(s, L, 6.38, 11.0, 0.3, [{
        "runs": [("Two minutes: nine-clinic government OPD study, IJCMH 2019.",
                  dict(size=11, color=SOFT_INK))]}])

    # ------------------------------------------------------------ 3 solution
    s = blank(prs)
    background(s)
    chrome(s, "03", "Solution")
    heading(s, "The delta", "Four blocks. Three decisions. One page. The doctor decides.")

    blocks = [
        ("01", "Changed", "7 items",
         "New results, new medicines, dose changes, new events."),
        ("02", "Unresolved", "3 items",
         "Results not reviewed, referrals open, questions unanswered."),
        ("03", "Conflicts", "2 items",
         "The patient says one thing. The record says another."),
        ("04", "What we do not know", "3 items",
         "Missing pages, partial dates, units that cannot merge."),
    ]
    gap = 0.22
    bw = (CONTENT_W - gap * 3) / 4
    for index, (num, label, count, desc) in enumerate(blocks):
        x = L + index * (bw + gap)
        rect(s, x, 2.42, bw, 3.45, fill=WHITE, line=LINE, weight=1.0,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.05)
        accent = ATTENTION if index >= 2 else PRIMARY
        textbox(s, x + 0.26, 2.62, bw - 0.4, 0.24, [{
            "runs": [(num, dict(size=10, color=accent, bold=True, spacing=1.6))]}])
        textbox(s, x + 0.26, 2.92, bw - 0.4, 0.95, [{
            "runs": [(label, dict(size=20, color=INK, bold=True))], "line": 1.05}])
        textbox(s, x + 0.26, 3.92, bw - 0.4, 0.3, [{
            "runs": [(count, dict(size=12, color=accent))]}])
        textbox(s, x + 0.26, 4.4, bw - 0.4, 1.3, [{
            "runs": [(desc, dict(size=14, color=SOFT_INK))], "line": 1.25}])

    textbox(s, L, 6.3, CONTENT_W, 0.3, [{
        "runs": [("Synthetic case. Inside a block, every line opens its original "
                  "page with the line highlighted.", dict(size=11,
                                                          color=SOFT_INK))]}])

    # ------------------------------------------------------------ 4 innovation
    s = blank(prs)
    background(s)
    chrome(s, "04", "Innovation")
    heading(s, "The delta, not the record",
            "Three things an EMR does not produce.")

    rows = [
        ("THE UNIT", "What changed, not everything that exists."),
        ("THE SOURCE", "Every line opens its original page."),
        ("THE REFUSAL", "What we do not know is a block, not a gap."),
    ]
    for index, (label, statement) in enumerate(rows):
        y = 2.5 + index * 1.18
        rule(s, L, y, CONTENT_W)
        textbox(s, L, y + 0.24, 1.75, 0.3, [{
            "runs": [(label, dict(size=9.5, color=PRIMARY, bold=True,
                                  spacing=1.8))]}])
        textbox(s, L + 1.95, y + 0.16, 9.4, 0.62, [{
            "runs": [(statement, dict(size=27, color=INK))], "line": 1.05}])

    textbox(s, L, 6.28, CONTENT_W, 0.34, [{
        "runs": [("A record stores. A summary narrates. A delta decides.",
                  dict(size=16, color=SOFT_INK))]}])

    # ------------------------------------------------------------ 5 impact
    s = blank(prs)
    background(s)
    chrome(s, "05", "Impact")
    heading(s, "Sixty seconds back",
            "What the doctor gets, and what we still have to measure.")

    textbox(s, L, 2.3, 5.6, 0.3, [{
        "runs": [("THE VISIT, ALL OF IT", dict(size=9.5, color=PRIMARY,
                                              bold=True, spacing=1.8))]}])
    textbox(s, L, 2.6, 5.6, 0.4, [{
        "runs": [("2 minutes", dict(size=30, color=INK, bold=True))]}])
    rect(s, L, 3.18, 5.0, 0.16, fill=INK)
    textbox(s, L, 3.42, 5.6, 0.5, [{
        "runs": [("Whole consultation. Nine-clinic government OPD study, "
                  "IJCMH 2019.", dict(size=11, color=SOFT_INK))], "line": 1.15}])

    textbox(s, L, 4.05, 5.6, 0.3, [{
        "runs": [("THE DELTA READ, INSIDE IT", dict(size=9.5, color=PRIMARY,
                                                bold=True, spacing=1.8))]}])
    textbox(s, L, 4.35, 5.6, 0.4, [{
        "runs": [("42 seconds", dict(size=30, color=PRIMARY, bold=True))]}])
    rect(s, L, 4.93, 5.0 * 42 / 120, 0.16, fill=PRIMARY)
    textbox(s, L, 5.17, 5.6, 0.9, [{
        "runs": [("One timed demo run on the synthetic case. It replaces the "
                  "reconstruction, not the visit. Target is under 60 seconds.",
                  dict(size=11, color=SOFT_INK))], "line": 1.15}])

    kpi_x, kpi_w = 7.05, 5.38
    rule(s, kpi_x, 2.3, kpi_w, color=PRIMARY, weight=1.6)
    kpis = [("Time to brief", "Under 60 seconds"),
            ("Delta completeness", "Share of required items"),
            ("Unresolved closed", "Within 7 days"),
            ("Doctor confidence", "Rated after each brief")]
    for index, (name, definition) in enumerate(kpis):
        col = index % 2
        row = index // 2
        x = kpi_x + col * (kpi_w / 2 + 0.1)
        y = 2.55 + row * 1.75
        textbox(s, x, y, kpi_w / 2 - 0.1, 0.32, [{
            "runs": [(name, dict(size=17, color=INK, bold=True))], "line": 1.05}])
        textbox(s, x, y + 0.42, kpi_w / 2 - 0.15, 0.3, [{
            "runs": [(definition, dict(size=12, color=SOFT_INK))], "line": 1.1}])
        textbox(s, x, y + 0.82, kpi_w / 2 - 0.15, 0.24, [{
            "runs": [("TARGET", dict(size=9, color=ATTENTION, bold=True,
                                     spacing=1.6))]}])

    textbox(s, L, 6.3, CONTENT_W, 0.3, [{
        "runs": [("All four are targets, not measured results. The pilot runs a "
                  "manual baseline and the delta arm on the same cases.",
                  dict(size=11, color=SOFT_INK))]}])

    # ------------------------------------------------------------ 6 feasibility
    s = blank(prs)
    background(s)
    chrome(s, "06", "Feasibility")
    heading(s, "Built, not mocked",
            "Ingest to approval, in five steps that exist in the product.")

    steps = [
        ("01", "Ingest", "PDFs, photos, forwards"),
        ("02", "Extract", "Facts with evidence spans"),
        ("03", "Bind evidence", "Every fact to a source line"),
        ("04", "Reconcile", "Current against prior state"),
        ("05", "Human approve", "Accept, edit or flag"),
    ]
    gap = 0.34
    bw = (CONTENT_W - gap * 4) / 5
    for index, (num, label, desc) in enumerate(steps):
        x = L + index * (bw + gap)
        rect(s, x, 2.62, bw, 1.95, fill=WHITE, line=LINE, weight=1.0,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.06)
        textbox(s, x + 0.2, 2.78, bw - 0.3, 0.24, [{
            "runs": [(num, dict(size=9.5, color=PRIMARY, bold=True,
                                spacing=1.6))]}])
        textbox(s, x + 0.2, 3.06, bw - 0.32, 0.6, [{
            "runs": [(label, dict(size=16, color=INK, bold=True))], "line": 1.05}])
        textbox(s, x + 0.2, 3.72, bw - 0.32, 0.66, [{
            "runs": [(desc, dict(size=11, color=SOFT_INK))], "line": 1.18}])
        if index < len(steps) - 1:
            arrow = rect(s, x + bw + 0.07, 3.5, gap - 0.14, 0.16,
                         fill=SOFT_INK, shape=MSO_SHAPE.RIGHT_ARROW)
            arrow.adjustments[0] = 0.5

    textbox(s, L, 5.05, CONTENT_W, 0.4, [{
        "runs": [("Existing backend, web and Android. Synthetic demo.",
                  dict(size=18, color=INK))]}])
    textbox(s, L, 5.55, CONTENT_W, 0.7, [{
        "runs": [("Versioned facts. Source binding on every line. Audit trail. "
                  "Identity firewall. Human approval before any note is signed.",
                  dict(size=13, color=SOFT_INK))], "line": 1.3}])
    textbox(s, L, 6.3, CONTENT_W, 0.3, [{
        "runs": [("No ABDM integration claim. No WhatsApp integration claim. "
                  "Documentation and retrieval aid.", dict(size=11,
                                                            color=SOFT_INK))]}])

    # ------------------------------------------------------------ 7 business
    s = blank(prs)
    background(s)
    chrome(s, "07", "Business model")
    heading(s, "One workflow, one buyer",
            "Diabetes follow-up in one Tier 2 cluster, then the rest.")

    cells = [
        ("BEACHHEAD", "Diabetes follow-up in one Tier 2 cluster."),
        ("BUYER", "Clinic owner, or hospital quality head."),
        ("PRICE", "₹1,500 per doctor / month."),
        ("EXPANSION", "Maternal, cancer, government OPD."),
    ]
    cw = (CONTENT_W - 0.34) / 2
    ch = 1.62
    for index, (label, value) in enumerate(cells):
        col = index % 2
        row = index // 2
        x = L + col * (cw + 0.34)
        y = 2.42 + row * (ch + 0.3)
        rect(s, x, y, cw, ch, fill=WHITE, line=LINE, weight=1.0,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.06)
        textbox(s, x + 0.3, y + 0.26, cw - 0.5, 0.26, [{
            "runs": [(label, dict(size=9.5, color=PRIMARY, bold=True,
                                  spacing=1.8))]}])
        textbox(s, x + 0.3, y + 0.62, cw - 0.55, 0.8, [{
            "runs": [(value, dict(size=21, color=INK))], "line": 1.12}])

    textbox(s, L, 6.3, CONTENT_W, 0.3, [{
        "runs": [("Pilot price fixed for eight weeks. At ₹1,500 per doctor per month, "
                  "flat clinic pricing is about US$25 to 50 million. Value-based and government "
                  "contracts are the larger path.", dict(size=11,
                                                        color=SOFT_INK))]}])

    # ------------------------------------------------------------ 8 team and ask
    s = blank(prs)
    background(s)
    chrome(s, "08", "Team and ask")
    heading(s, "Three roles, one ask",
            "Clinical access, a working build, a measurable pilot.")

    roles = [
        ("Clinical lead", "Clinical plausibility, the delta rubric, the pilot "
                          "sites."),
        ("Engineering lead", "Pipeline, evidence binding, pilot instrumentation."),
        ("Design and product", "The brief, the demo, the measurement."),
    ]
    for index, (role, detail) in enumerate(roles):
        y = 2.45 + index * 1.15
        rule(s, L, y, 6.7)
        textbox(s, L, y + 0.2, 2.6, 0.34, [{
            "runs": [(role, dict(size=16, color=INK, bold=True))]}])
        textbox(s, L + 2.75, y + 0.18, 4.0, 0.8, [{
            "runs": [(detail, dict(size=12, color=SOFT_INK))], "line": 1.25}])

    panel_x = 8.0
    rect(s, panel_x, 2.2, W - L - panel_x, 3.3, fill=INK,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.05)
    textbox(s, panel_x + 0.45, 2.5, W - L - panel_x - 0.8, 0.26, [{
        "runs": [("THE ASK", dict(size=9.5, color=WHITE, bold=True,
                                  spacing=1.8))]}])
    for index, line in enumerate(("Three clinics.", "100 follow-ups.",
                                  "Eight weeks.")):
        textbox(s, panel_x + 0.45, 2.92 + index * 0.72,
                W - L - panel_x - 0.8, 0.5, [{
            "runs": [(line, dict(size=25, color=WHITE, bold=True))]}])

    textbox(s, L, 6.05, CONTENT_W, 0.5, [{
        "runs": [("The doctor has two minutes. ", dict(size=17, color=INK)),
                 ("We give back the first sixty seconds.",
                  dict(size=17, color=PRIMARY, bold=True))]}])

    prs.save(OUT)
    print("saved", OUT, "slides", len(prs.slides))


if __name__ == "__main__":
    build()
