# Testing & QA

Last full run: Phase 5, 2026-10-25, Windows 10 · Node 24.17 · Python 3.14.6 · Microsoft Edge (headless, via Playwright).

## How to re-run everything

```bash
# Automated checks
npm run lint
npx tsc --noEmit
npm test                                   # Vitest: parity + edge cases (19 tests)
research/.venv/Scripts/python -m pytest research/tests   # analyzer == scikit-learn (3 tests)
npm run build                              # static export to out/

# Browser checks (serve the static build first)
research/.venv/Scripts/python -m http.server 8765 --bind 127.0.0.1 --directory out
research/.venv/Scripts/python qa/smoke.py http://127.0.0.1:8765   # routes, layout, detector, theme
research/.venv/Scripts/python qa/a11y.py  http://127.0.0.1:8765   # axe-core WCAG 2.1 A/AA, both themes
```

## Results summary

| Check | Result |
|---|---|
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run build` (static export) | ✅ 6 routes + 404, `out/` = 4.5 MB |
| Vitest | ✅ 19/19 (2 files) |
| pytest | ✅ 3/3 |
| Python ↔ TypeScript parity (200 strings × 2 models, tolerance 1e-4) | ✅ all match |
| Whitespace set Python vs TS, all 1,114,112 code points | ✅ identical |
| Smoke test, 5 routes × 4 widths (360 / 768 / 1024 / 1440) | ✅ HTTP 200, 0 console errors/warnings, 0 px horizontal overflow |
| Unknown route | ✅ HTTP 404 with the custom 404 page |
| axe-core WCAG 2.1 A/AA, 6 routes + detector result × 2 themes | ✅ 0 violations (3 consecutive runs) |
| Missing JSON (all `public/data/*.json` removed) | ✅ build passes; every results area shows "Results pending"; 0 numbers rendered |
| Malformed JSON (invalid syntax / wrong types) | ✅ build passes; "Results pending" shown |
| Partial JSON (missing CI, missing metric, missing detector block) | ✅ build passes; missing values render as "–" |
| `dangerouslySetInnerHTML` anywhere | ✅ none |
| API routes / server code | ✅ none (`output: "export"`) |
| Model file sizes (limit 4 MB) | ✅ `baseline.json` 140 KB, `shield-lite.json` 1.8 MB |

## Unit tests (Vitest)

- **Parity:** 200 fixture strings (45 test rows per language plus 20 edge cases) for both browser models. TypeScript probability = scikit-learn probability ± 1e-4.
- **Preprocessing:** NFKC + lowercase + whitespace collapsing; `char_wb` n-grams identical to scikit-learn; word unigrams and bigrams.
- **Edge cases:**
  - Empty and whitespace-only input → model prior, never NaN.
  - Emoji-only input.
  - 5,000+ characters: truncated to exactly 5,000 code points without splitting an emoji.
  - HTML input scored as plain text.
  - Obvious attacks in English, Urdu, Roman Urdu and code-mixed text are flagged, and a benign question is not.
- **Explanations:** per-word contributions add up to the logit and keep the original character offsets. Script detection (Latin / Arabic / Mixed / None). Risk bands.
- **Trigger highlighting:** the longest match wins; Urdu and Roman Urdu use flexible whitespace; segments rebuild the original text exactly; benign and empty text produce no highlights.

## Browser smoke test (`qa/smoke.py`)

| Scenario | Expected | Result |
|---|---|---|
| Example "Attack · Roman Urdu" → Analyze | High/Medium risk | ✅ 100/100, High |
| Example "Benign · Urdu" → Ctrl+Enter | Low risk; shortcut works | ✅ 1/100, Low |
| Compare models toggle | Baseline and Lite scores side by side | ✅ |
| Whitespace-only input → Analyze | "Please enter some text first." | ✅ |
| Emoji-only input | Explains there are no letters to analyze | ✅ |
| `<img src=x onerror=alert(1)>…` | Shown as text; no `<img>` element created | ✅ |
| Paste of 5,200 characters | Truncated to 5,000 with a notice | ✅ |
| Clear button | Empties the input | ✅ |
| Theme toggle, then reload | Dark theme persists and is applied before first paint | ✅ |

## Colour contrast (WCAG 2.1 AA)

axe could not measure text inside the SVG charts or the "→" arrow glyphs, so every colour pairing used on the site was also computed by hand:

| Theme | Pairing | Colours | Ratio | Requirement | Result |
|---|---|---|---|---|---|
| light | ink on yellow background | `#171717` on `#FFF21A` | 15.3:1 | text 4.5:1 | ✅ |
| light | ink on off-white cards | `#171717` on `#FFFBE6` | 17.2:1 | text 4.5:1 | ✅ |
| light | muted text on yellow | `#6B6B6B` on `#FFF21A` | 4.6:1 | text 4.5:1 | ✅ |
| light | muted text on cards | `#6B6B6B` on `#FFFBE6` | 5.1:1 | text 4.5:1 | ✅ |
| light | deep-purple accent text on yellow | `#5B21B6` on `#FFF21A` | 7.7:1 | text 4.5:1 | ✅ |
| light | deep-purple accent text on cards | `#5B21B6` on `#FFFBE6` | 8.6:1 | text 4.5:1 | ✅ |
| both | charcoal on lavender (hover buttons, highlights) | `#171717` on `#A66BFF` | 5.3:1 | text 4.5:1 | ✅ |
| light | yellow on charcoal (solid buttons) | `#FFF21A` on `#171717` | 15.3:1 | text 4.5:1 | ✅ |
| both | off-white on red ("High risk" badge, bold) | `#FFFBE6` on `#DC2626` | 4.6:1 | 4.5:1 | ✅ |
| both | off-white on green ("Low risk" badge) | `#FFFBE6` on `#15803D` | 4.8:1 | text 4.5:1 | ✅ |
| dark | off-white on charcoal | `#FFFBE6` on `#171717` | 17.2:1 | text 4.5:1 | ✅ |
| dark | grey muted text on charcoal | `#D4D4D4` on `#171717` | 12.1:1 | text 4.5:1 | ✅ |
| dark | yellow headings on charcoal | `#FFF21A` on `#171717` | 15.3:1 | text 4.5:1 | ✅ |
| dark | lavender accent text on charcoal | `#A66BFF` on `#171717` | 5.3:1 | text 4.5:1 | ✅ |
| dark | grey chart bar on charcoal | `#6B6B6B` on `#171717` | 3.4:1 | graphic 3:1 | ✅ |
| light | lavender shield on yellow (home hero) | `#A66BFF` on `#FFF21A` | 2.9:1 | decorative, exempt | ℹ️ decorative only (`aria-hidden`) |

## Problems found and fixed during QA

| Problem | Found by | Fix |
|---|---|---|
| Navbar 4 px wider than the viewport at 768 px | smoke test (overflow check) | Desktop menu from 1024 px; hamburger below |
| Chart legend and tooltip text drawn in series colours (lavender on off-white ≈ 3:1) | manual contrast check of SVG text | Legend/tooltip text in ink colour; colour kept on the swatch |
| A result-panel contrast flag captured mid-hover-transition | axe (flaky) | Test moves the mouse away and waits before auditing; the at-rest colours pass (5.3:1) |
| Missing optional fields in a valid JSON file could break the build | partial-JSON test | Optional chaining for confidence intervals; missing values show "–" |
| Escape sequences turned into literal invisible characters in source (regex broke) | Vitest transform error | Whitespace set built from numeric code points |

## Manual checklist (for a human before each release)

- [ ] Open `/detector`, try each of the 6 example chips; Urdu renders in Nastaliq, right to left.
- [ ] Type in Urdu with an English word mixed in; the script shows as "Mixed".
- [ ] Turn on Compare models; both bars appear; the explanation mentions the baseline when they disagree.
- [ ] Keyboard only: Tab through the navbar, textarea, buttons, chips and checkbox; the focus ring is always visible.
- [ ] Switch theme, reload, open another page; no flash of the wrong theme.
- [ ] Phone (≈360 px): hamburger menu opens/closes; tables scroll inside their cards, not the page.
- [ ] `/research`: charts render in both themes; the error browser filters change the list.
- [ ] Download links (report, metrics, summary) download files.
- [ ] `/about`: replace the TODO text and fill `lib/site.ts` (GitHub, email, live URL) before sharing.

## Known, accepted items

- `npm audit` reports advisories in build-time tooling only (see DECISIONS D-005). Nothing ships to visitors.
- The Research page is long (12 generated findings). This is intentional: every finding comes from the data.
