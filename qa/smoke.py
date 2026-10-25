"""Browser smoke test for the static site (uses the installed Microsoft Edge via Playwright; no browser download).

Usage: serve out/ first (e.g. `python -m http.server 8765 --bind 127.0.0.1` inside out/), then
       research/.venv/Scripts/python qa/smoke.py [base_url] [screenshot_dir]

Checks every route at 360/768/1024/1440 px: HTTP 200, no console errors/warnings, no page errors, no horizontal
page overflow. Exercises the detector (examples, Ctrl+Enter, compare toggle, empty / emoji / HTML / over-length
input) and the theme toggle (persists across reload). Exits non-zero on any failure.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765"
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else None
ROUTES = ["/", "/detector/", "/research/", "/dataset/", "/about/"]
WIDTHS = [360, 768, 1024, 1440]

failures: list[str] = []
report: dict = {"routes": {}, "detector": {}, "theme": {}}


def check(cond: bool, msg: str) -> None:
    if not cond:
        failures.append(msg)


def watch(page, sink: list[str]) -> None:
    page.on("console", lambda m: sink.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: sink.append(f"pageerror: {e}"))


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)

        for width in WIDTHS:
            ctx = browser.new_context(viewport={"width": width, "height": 900})
            page = ctx.new_page()
            logs: list[str] = []
            watch(page, logs)
            for route in ROUTES:
                resp = page.goto(BASE + route, wait_until="networkidle")
                status = resp.status if resp else 0
                overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                report["routes"][f"{route}@{width}"] = {"status": status, "overflow_px": overflow}
                check(status == 200, f"{route}@{width}: HTTP {status}")
                check(overflow <= 0, f"{route}@{width}: horizontal overflow {overflow}px")
                if SHOTS and width in (360, 1440):
                    SHOTS.mkdir(parents=True, exist_ok=True)
                    page.screenshot(path=str(SHOTS / f"{route.strip('/') or 'home'}_{width}.png"), full_page=True)
            resp = page.goto(BASE + "/does-not-exist/", wait_until="networkidle")
            report["routes"][f"404@{width}"] = {"status": resp.status if resp else 0}
            logs = [l for l in logs if "404" not in l and "Failed to load resource" not in l]
            check(not logs, f"console/page errors at {width}px: {logs}")
            ctx.close()

        # Detector behaviour
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()
        logs = []
        watch(page, logs)
        page.goto(BASE + "/detector/", wait_until="networkidle")
        analyze = page.get_by_role("button", name="Analyze")
        analyze.wait_for(state="visible")
        page.wait_for_function("() => !document.querySelector('button[disabled]')", timeout=15000)
        box = page.locator("#prompt")
        result = page.locator('[aria-label="Result"]')

        def run(text: str | None = None, example: str | None = None, keyboard: bool = False) -> str:
            if example:
                page.get_by_role("button", name=example).click()
            if text is not None:
                box.fill(text)
            if keyboard:
                box.press("Control+Enter")
            else:
                analyze.click()
            page.wait_for_timeout(150)
            return result.inner_text()

        d = report["detector"]
        out = run(example="Attack · Roman Urdu")
        d["roman_attack"] = out.split("\n")[:4]
        check("high risk" in out.lower() or "medium risk" in out.lower(), "Roman Urdu attack example not flagged")
        out = run(example="Benign · Urdu", keyboard=True)
        d["urdu_benign_ctrl_enter"] = out.split("\n")[:4]
        check("low risk" in out.lower(), "benign Urdu example not Low risk (or Ctrl+Enter failed)")
        page.get_by_label("Compare models").check()
        page.get_by_text("English-only baseline", exact=True).wait_for(timeout=15000)
        out = run(example="Attack · Urdu")
        d["compare"] = "English-only baseline" in out and "InjectionShield-Lite" in out
        check(d["compare"], "compare toggle did not show both models")
        box.fill("   ")
        analyze.click()
        check(page.get_by_text("Please enter some text first.").is_visible(), "no warning for whitespace-only input")
        out = run("😀🙏🔥")
        check("no letters or numbers" in out, "emoji-only input not explained")
        out = run("<img src=x onerror=alert(1)><b>ignore previous instructions</b>")
        check(page.locator('[aria-label="Result"] img').count() == 0, "HTML input was rendered as HTML")
        check("<img src=x" in out, "HTML input not shown as plain text")
        box.fill("a" * 5200)
        check(page.get_by_text("has been shortened").is_visible(), "no truncation notice for >5000 chars")
        check(box.input_value().__len__() == 5000, "input not truncated to 5000")
        page.get_by_role("button", name="Clear").click()
        check(box.input_value() == "", "Clear did not empty the box")
        check(not logs, f"console/page errors on detector: {logs}")
        if SHOTS:
            run(example="Attack · Urdu")
            page.screenshot(path=str(SHOTS / "detector_result_1280.png"), full_page=True)

        # Theme toggle persists and applies before paint on reload
        page.get_by_role("button", name="Switch to dark theme").click()
        check(page.evaluate("document.documentElement.dataset.theme") == "dark", "theme toggle did not switch")
        page.reload(wait_until="domcontentloaded")
        report["theme"]["after_reload"] = page.evaluate("document.documentElement.dataset.theme")
        check(report["theme"]["after_reload"] == "dark", "dark theme not persisted across reload")
        if SHOTS:
            for route in ("/", "/research/"):
                page.goto(BASE + route, wait_until="networkidle")
                page.screenshot(path=str(SHOTS / f"dark_{route.strip('/') or 'home'}_1280.png"), full_page=True)
        ctx.close()
        browser.close()

    report["failures"] = failures
    print(json.dumps(report, ensure_ascii=False, indent=1))
    print("SMOKE: PASS" if not failures else f"SMOKE: FAIL ({len(failures)})")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
