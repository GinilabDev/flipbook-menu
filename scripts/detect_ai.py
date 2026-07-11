#!/usr/bin/env python3
"""
AI menu detector (prototype) — produces the SAME `Menu` JSON the flipbook
already consumes (lib/menu.ts), so the app needs no changes: the admin backend
runs this once per uploaded PDF and serves the result from /api/menu with
`autoDetect: false`.

Why AI instead of the pure-geometry heuristic in lib/detect.ts:
  The heuristic works well on the current menu, but every new layout quirk
  (split prices, wrapped titles, a centred SIDES block among 2-column sections)
  needs another hand-tuned rule. A vision model reasons about layout directly,
  so it generalises to *any* page — including image-only / scanned menus that
  have no text layer at all.

How it works, per page:
  1. Extract text tokens WITH bounding boxes via PyMuPDF (exact coordinates).
  2. Render the page to a PNG (so the model sees the real layout / columns).
  3. Ask Claude to group tokens into items and return name + price + a
     normalised rect, constrained by a JSON schema (structured outputs).
  The token boxes give pixel-accurate hotspots; the image gives layout
  understanding and a fallback when a page has little or no extractable text.

Usage:
  export ANTHROPIC_API_KEY=...        # or `ant auth login`
  python scripts/detect_ai.py path/to/menu.pdf --out menu.json \
      --title "Main Menu" --currency GBP --symbol £
"""

from __future__ import annotations

import argparse
import base64
import json
import sys

import fitz  # PyMuPDF
from anthropic import Anthropic

# Default to the most capable model; switch to claude-sonnet-5 to cut cost if
# accuracy holds on your menus.
MODEL = "claude-opus-4-8"

# JSON-schema-constrained output. Structured outputs guarantee valid JSON in
# this exact shape, so no defensive parsing is needed. (Numeric min/max aren't
# supported by structured outputs — coordinates are validated below instead.)
ITEM_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string"},
                    "price": {"type": "number"},
                    "x": {"type": "number"},
                    "y": {"type": "number"},
                    "w": {"type": "number"},
                    "h": {"type": "number"},
                },
                "required": ["name", "price", "x", "y", "w", "h"],
            },
        }
    },
    "required": ["items"],
}

PROMPT = """You are extracting purchasable menu items from ONE menu page.

You are given:
- An image of the page (authoritative for layout, columns and reading order).
- Text tokens with normalised bounding boxes: each line is
  "<x0>,<y0>,<x1>,<y1>\t<text>" where coordinates are fractions 0-1 of the
  page, origin at the TOP-LEFT.

For every item a customer can order (a dish/product that has its own price),
return:
- name: the item's full name, including a title that wraps onto two lines
  (e.g. "Banana &" above "Milk Chocolate (V/G)" is one name).
- price: the numeric price (no currency symbol).
- x, y, w, h: a tight rectangle (normalised 0-1) covering ONLY the item's name
  and its price — NOT the description paragraph beneath it. Derive it from the
  token boxes so it lines up exactly.

Rules:
- One entry per price. In a two-column row like "Chicken sausage 2.50 …
  Hollandaise 2.00", emit two separate items, each boxed over its own column.
- Ignore section headers (TENDERS, SIDES…), subtitles, allergen notes and
  description text.
- Do not invent items that have no price."""


def extract_page(page: fitz.Page) -> tuple[str, str]:
    """Return (token_text, base64_png) for a page, coordinates normalised 0-1."""
    w, h = page.rect.width, page.rect.height
    lines = []
    for x0, y0, x1, y1, word, *_ in page.get_text("words"):
        if not word.strip():
            continue
        lines.append(
            f"{x0 / w:.4f},{y0 / h:.4f},{x1 / w:.4f},{y1 / h:.4f}\t{word}"
        )
    png = page.get_pixmap(matrix=fitz.Matrix(2, 2)).tobytes("png")
    return "\n".join(lines), base64.standard_b64encode(png).decode()


def detect_page(client: Anthropic, page: fitz.Page) -> list[dict]:
    tokens, img_b64 = extract_page(page)
    resp = client.messages.create(
        model=MODEL,
        max_tokens=8000,
        thinking={"type": "adaptive"},
        output_config={"format": {"type": "json_schema", "schema": ITEM_SCHEMA}},
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": img_b64,
                        },
                    },
                    {"type": "text", "text": PROMPT},
                    {"type": "text", "text": f"Text tokens:\n{tokens}"},
                ],
            }
        ],
    )
    text = "".join(b.text for b in resp.content if b.type == "text")
    return json.loads(text)["items"]


def clamp01(v: float) -> float:
    return max(0.0, min(1.0, float(v)))


def build_menu(pdf_path: str, title: str, currency: str, symbol: str) -> dict:
    client = Anthropic()  # ANTHROPIC_API_KEY or an `ant auth login` profile
    doc = fitz.open(pdf_path)

    items, hotspots = [], []
    n = 0
    for page_index in range(doc.page_count):
        page = doc[page_index]
        page_number = page_index + 1
        try:
            found = detect_page(client, page)
        except Exception as exc:  # keep going; a bad page shouldn't sink the run
            print(f"  page {page_number}: detection failed ({exc})", file=sys.stderr)
            continue
        print(f"  page {page_number}: {len(found)} items", file=sys.stderr)
        for it in found:
            item_id = f"it_{page_number}_{n}"
            x, y = clamp01(it["x"]), clamp01(it["y"])
            items.append(
                {"id": item_id, "name": it["name"].strip(), "price": float(it["price"])}
            )
            hotspots.append(
                {
                    "id": f"hs_{page_number}_{n}",
                    "itemId": item_id,
                    "pageNumber": page_number,
                    "rect": {
                        "x": x,
                        "y": y,
                        "w": clamp01(it["w"]) if x + it["w"] <= 1 else 1 - x,
                        "h": clamp01(it["h"]) if y + it["h"] <= 1 else 1 - y,
                    },
                }
            )
            n += 1

    return {
        "menuId": "menu_demo",
        "title": title,
        "pdfUrl": pdf_path,  # replace with the served/proxied URL in production
        "currency": currency,
        "currencySymbol": symbol,
        "autoDetect": False,  # ship reviewed hotspots; skip client auto-detect
        "items": items,
        "hotspots": hotspots,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="AI menu detector (prototype)")
    ap.add_argument("pdf", help="path to the menu PDF")
    ap.add_argument("--out", default="menu.json", help="output JSON path")
    ap.add_argument("--title", default="Main Menu")
    ap.add_argument("--currency", default="GBP")
    ap.add_argument("--symbol", default="£")
    args = ap.parse_args()

    menu = build_menu(args.pdf, args.title, args.currency, args.symbol)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(menu, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(menu['items'])} items → {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
