"""Accessibility audit with axe-core (WCAG 2.0/2.1 A + AA rules) on every page, in both themes.

Usage: serve out/ on port 8765, then  research/.venv/Scripts/python qa/a11y.py [base_url]
Uses the installed Microsoft Edge (Playwright channel "msedge") and node_modules/axe-core/axe.min.js.
Exits non-zero if any violation is found.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765"
AXE = Path(__file__).resolve().parent.parent / "node_modules" / "axe-core" / "axe.min.js"
ROUTES = ["/", "/detector/", "/research/", "/dataset/", "/about/", "/missing-page/"]
TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]


def audit(page) -> list[dict]:
    page.add_script_tag(path=str(AXE))
    res = page.evaluate("tags => axe.run(document, {runOnly: {type: 'tag', values: tags}})", TAGS)
    return [{"id": v["id"], "impact": v["impact"], "help": v["help"],
             "nodes": [n["target"][0] if n["target"] else "" for n in v["nodes"][:5]],
             "summary": v["nodes"][0].get("failureSummary", "")[:200] if v["nodes"] else ""}
            for v in res["violations"]]


def main() -> int:
    found: dict[str, list] = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        for theme in ("light", "dark"):
            ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            ctx.add_init_script(f"try {{ localStorage.setItem('theme', '{theme}') }} catch (e) {{}}")
            page = ctx.new_page()
            for route in ROUTES:
                page.goto(BASE + route, wait_until="networkidle")
                found[f"{theme} {route}"] = audit(page)
            # Detector with a visible result (and compare panel) so result colours are audited too.
            page.goto(BASE + "/detector/", wait_until="networkidle")
            page.wait_for_function("() => !document.querySelector('button[disabled]')", timeout=15000)
            page.get_by_label("Compare models").check()
            page.get_by_role("button", name="Attack · Roman Urdu").click()
            page.get_by_role("button", name="Analyze").click()
            page.get_by_text("English-only baseline", exact=True).wait_for(timeout=15000)
            page.mouse.move(0, 0)  # leave the button so hover colour transitions finish before measuring
            page.wait_for_timeout(400)
            found[f"{theme} /detector/ (result)"] = audit(page)
            ctx.close()
        browser.close()
    total = sum(len(v) for v in found.values())
    for k, v in found.items():
        print(f"{k:32s} {len(v)} violation(s)")
        for x in v:
            print(f"    [{x['impact']}] {x['id']}: {x['help']} -> {x['nodes']}\n        {x['summary']}")
    print("A11Y: PASS" if total == 0 else f"A11Y: FAIL ({total})")
    (Path(__file__).resolve().parent / "a11y_report.json").write_text(json.dumps(found, indent=1), encoding="utf-8")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
