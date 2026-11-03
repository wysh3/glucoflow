#!/usr/bin/env bash
# Rebuild the brief and deck, export both PDFs, print the page and slide counts.
set -euo pipefail
cd "$(dirname "$0")/.."

PY=/Users/wysh/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3
NODE="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/node/bin/node"
CLI="/Applications/DeepSeek Harness.app/Contents/Resources/app.asar.unpacked/dsh/node_modules/@deepseek-ai/libreoffice-kit/lib/cli.js"

target="${1:-all}"

build_doc() {
  local script="$1" docx="$2" pdf="$3" expect_pages="$4"
  "$PY" "_build/$script"
  rm -f "$pdf"
  "$NODE" "$CLI" convert --input "$docx" --output "$pdf"
  local pages
  pages=$(pdfinfo "$pdf" | awk '/^Pages:/ {print $2}')
  echo "PAGES $pdf = $pages (expected $expect_pages)"
  [ "$pages" = "$expect_pages" ] || { echo "FAIL: page count"; exit 1; }
}

if [ "$target" = "all" ] || [ "$target" = "brief" ]; then
  build_doc build_brief.py Delta_Solution_Brief.docx Delta_Solution_Brief.pdf 2
fi
if [ "$target" = "all" ] || [ "$target" = "deck" ]; then
  build_doc build_deck.py Delta_Final_Presentation.pptx Delta_Final_Presentation.pdf 8
fi
