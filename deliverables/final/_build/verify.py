"""Verify the three deliverables against the brief's hard constraints.

Checks are structural and reproducible: page counts from the exported PDFs,
section coverage and labels from the saved files, palette use, footer presence,
dash hygiene, and internal timing consistency of the video script.

Run: python3 verify.py
"""

import re
import subprocess
import sys
import zipfile
from pathlib import Path

from docx import Document
from pptx import Presentation

HERE = Path(__file__).resolve().parent
FINAL = HERE.parent

BRIEF = FINAL / "Delta_Solution_Brief.docx"
BRIEF_PDF = FINAL / "Delta_Solution_Brief.pdf"
DECK = FINAL / "Delta_Final_Presentation.pptx"
DECK_PDF = FINAL / "Delta_Final_Presentation.pdf"
SCRIPT = FINAL / "Delta_Demo_Video_Script.md"

PALETTE = ["26796E", "203B38", "5B706B", "F5F8F5", "DCE7E1", "A85B00"]
PAGE1 = ["Problem", "Who is affected", "Solution", "The moment", "Evidence", "KPI"]
PAGE2 = ["How it works", "AI and safety", "Market and business model", "Why now",
         "Why us", "The ask", "Team"]
SEQUENCE = ["Title", "Problem", "Solution", "Innovation", "Impact", "Feasibility",
            "Business model", "Team and ask"]

failures = []


def check(condition, message):
    print(("PASS  " if condition else "FAIL  ") + message)
    if not condition:
        failures.append(message)


def pdf_pages(path):
    out = subprocess.run(["pdfinfo", str(path)], capture_output=True, text=True,
                         check=True).stdout
    return int(re.search(r"^Pages:\s+(\d+)", out, re.M).group(1))


def pdf_size(path):
    out = subprocess.run(["pdfinfo", str(path)], capture_output=True, text=True,
                         check=True).stdout
    return re.search(r"^Page size:\s+([\d.]+) x ([\d.]+)", out, re.M).groups()


def docx_text(path):
    """Every w:t in the body, including text inside DrawingML text boxes."""
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml").decode("utf8")
    return " ".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", xml))


def docx_footer_text(path):
    with zipfile.ZipFile(path) as z:
        parts = [n for n in z.namelist()
                 if n.startswith("word/footer") and n.endswith(".xml")]
        return [" ".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>",
                                    z.read(n).decode("utf8"))) for n in parts]


def pptx_text(slide):
    chunks = []
    for shape in slide.shapes:
        if shape.has_text_frame:
            chunks.append(shape.text_frame.text)
    return "\n".join(chunks)


# ------------------------------------------------------------------ brief
print("\n== Brief ==")
check(BRIEF.exists(), f"{BRIEF.name} exists")
check(BRIEF_PDF.exists(), f"{BRIEF_PDF.name} exists")
pages = pdf_pages(BRIEF_PDF)
check(pages == 2, f"brief PDF is exactly 2 pages (got {pages})")
w, h = pdf_size(BRIEF_PDF)
check(abs(float(w) - 595.3) < 1.5 and abs(float(h) - 841.9) < 1.5,
      f"brief is A4 (got {w} x {h})")

text = docx_text(BRIEF)
for name in PAGE1 + PAGE2:
    check(name in text, f"brief section present: {name}")
for block in ("Changed", "Unresolved", "Conflicts", "What we do not know"):
    check(block in text, f"four-block diagram label present: {block}")
for source in ("IJCMH 2019", "BMC Infectious Diseases 2018",
               "Indian J Clin Biochem 2015", "J Gen Intern Med 2012",
               "NABL 112"):
    check(source in text, f"source cited: {source}")
check(text.count("TARGET") == 4, f"four KPI targets labelled (got {text.count('TARGET')})")
footers = docx_footer_text(BRIEF)
check(len(footers) == 2 and all(
    "Synthetic data. Assistive only. Human approval required." in f for f in footers),
    f"disclaimer footer on both pages (got {len(footers)} footer parts)")

with zipfile.ZipFile(BRIEF) as z:
    blob = " ".join(z.read(n).decode("utf8", "ignore") for n in z.namelist()
                    if n.endswith(".xml"))
check("wpg:wgp" in blob, "brief diagram is a native DrawingML shape group, not an image")
check("w:drawing" in blob and "r:embed" not in blob,
      "brief contains no embedded raster image")
for color in PALETTE:
    check(color in blob.upper(), f"palette colour used in brief: #{color}")
check("\u2014" not in blob and "\u2013" not in blob, "brief has no em or en dash")

# ------------------------------------------------------------------ deck
print("\n== Deck ==")
check(DECK.exists(), f"{DECK.name} exists")
check(DECK_PDF.exists(), f"{DECK_PDF.name} exists")
slides = len(Presentation(DECK).slides)
check(slides == 8, f"deck has exactly 8 slides (got {slides})")
p = pdf_pages(DECK_PDF)
check(p == 8, f"deck PDF is exactly 8 pages (got {p})")
w, h = pdf_size(DECK_PDF)
check(abs(float(w) / float(h) - 16 / 9) < 0.01, f"deck is 16:9 (got {w} x {h})")

prs = Presentation(DECK)
for index, slide in enumerate(prs.slides, start=1):
    body = pptx_text(slide)
    check("Synthetic data. Assistive only. Human approval required." in body,
          f"slide {index} carries the synthetic-data footer")
    check(f"{index:02d} / 08" in body, f"slide {index} carries its sequence number")
    if index > 1:
        check(SEQUENCE[index - 1].upper() in body.upper(),
              f"slide {index} labels the prescribed section: {SEQUENCE[index - 1]}")

title_slide = pptx_text(prs.slides[0])
check("The 60-second" in title_slide and "delta." in title_slide,
      "slide 1 title reads The 60-second delta.")
check("The doctor has two minutes." in title_slide
      and "We give back the first sixty seconds." in title_slide,
      "slide 1 carries the one sentence")

deck_body = "\n".join(pptx_text(s) for s in prs.slides)
with zipfile.ZipFile(DECK) as z:
    deck_blob = " ".join(z.read(n).decode("utf8", "ignore") for n in z.namelist()
                         if n.startswith("ppt/slides/slide") and n.endswith(".xml"))
for color in PALETTE:
    check(color in deck_blob.upper(), f"palette colour used in deck: #{color}")
check("\u2014" not in deck_blob, "deck has no em dash")
check("MEDIA" not in {n.split("/")[1].upper() for n in zipfile.ZipFile(DECK).namelist()
                      if n.startswith("ppt/") and n.count("/") > 2},
      "deck embeds no media files")

# ------------------------------------------------------------------ script
print("\n== Video script ==")
check(SCRIPT.exists(), f"{SCRIPT.name} exists")
md = SCRIPT.read_text()
check("## 0:00 to 0:40. Cold open" in md, "beat 1 cold open present")
check("## 0:40 to 1:40. The failure" in md, "beat 2 failure present")
check("## 1:40 to 2:20. The insight" in md, "beat 3 insight present")
check("## 2:20 to 4:30. The demo" in md, "beat 4 demo present")
check("## 4:30 to 5:35. The proof" in md, "beat 5 proof present")
check("## 5:35 to 6:25. Why now, why us, why not them" in md, "beat 6 why now present")
check("## 6:25 to 6:45. Close" in md, "beat 7 close present")
check("## Shots the team must film" in md, "film list section present")
check("## Screen recording checklist" in md, "screen recording checklist present")
for screen in ("Delta", "Source", "Unresolved", "Conflict", "What we do not know",
               "Visit note"):
    check(screen in md, f"app screen listed: {screen}")
for magic in ("Doctor at desk", "Clinic corridor", "Patient waiting area"):
    check(magic.lower() in md.lower(), f"required location listed: {magic}")


def seconds(stamp):
    minutes, secs = stamp.split(":")
    return int(minutes) * 60 + int(secs)


# Every shot table must chain contiguously from its beat start to beat end.
beat_re = re.compile(r"^## (\d+:\d\d) to (\d+:\d\d)\. (.+)$", re.M)
lines = md.splitlines()
beat_start = {}
current_beat = None
for line in lines:
    m = beat_re.match(line)
    if m:
        current_beat = (seconds(m.group(1)), seconds(m.group(2)))
        beat_start[current_beat] = []
        continue
    if line.startswith("## "):
        current_beat = None
    if current_beat and line.startswith("| ") and not line.startswith("| Shot") \
            and "In" not in line.split("|")[2]:
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) >= 3 and re.fullmatch(r"\d+:\d\d", cells[1]) \
                and re.fullmatch(r"\d+:\d\d", cells[2]):
            beat_start[current_beat].append((cells[1], cells[2]))

total = 0
for (start, end), shots in sorted(beat_start.items()):
    check(bool(shots), f"beat {start}s to {end}s has timed shots")
    if not shots:
        continue
    check(seconds(shots[0][0]) == start, f"beat {start}s starts on its first shot")
    check(seconds(shots[-1][1]) == end, f"beat {end}s ends on its last shot")
    for (_, out), (nxt, _) in zip(shots, shots[1:]):
        check(seconds(out) == seconds(nxt),
              f"shots chain without a gap at {nxt}")
    total += end - start
check(total == 405, f"beats total 405 seconds, 6:45 (got {total})")
check("\u2014" not in md and "\u2013" not in md, "script has no em or en dash")

print("\n== Result ==")
if failures:
    print(f"{len(failures)} check(s) failed")
    sys.exit(1)
print("all checks passed")
