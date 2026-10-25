# InjectionShield — Build Plan

Each phase ends with all checks passing, a short summary, and a stop for review.

| Phase | Goal | Key outputs |
|---|---|---|
| 0 | Environment check & skeleton | Python venv, pinned `research/requirements.txt`, Next.js static-export skeleton, this plan |
| 1 | Build the benchmark | English base set (deduped, grouped, split 70/15/15 by `group_id`), `ur` via NLLB, `roman_ur` + `code_mixed` (Claude-assisted, disclosed), quality checks, `verify_sample.csv`, `DATA_CARD.md` |
| 2 | Evaluate detectors | D1 ProtectAI DeBERTa v2, D2 English word TF-IDF+LR, D3 InjectionShield-Lite char TF-IDF+LR (multilingual train), optional D4 multilingual embeddings; metrics + bootstrap CIs, language-switch bypass rate, `errors.json`, `REPORT.md` |
| 3 | Export browser models | `public/model/baseline.json`, `public/model/shield-lite.json` (<4 MB each), `lib/detector.ts`, Python↔TS parity test (≤1e-4) |
| 4 | Website | Home, Detector, Research, Dataset, About; dark/light; RTL Urdu; error boundaries; "Results pending" states |
| 5 | QA | lint, `tsc --noEmit`, build, Vitest, local static serve of `out/`, responsive checks, `TESTING.md` |
| 6 | GitHub & Vercel ready | README, size/secret audit, push + Vercel instructions, `INTERVIEW_PREP.md` |

## Ground rules
- $0: only free Hugging Face downloads, GitHub, Vercel free tier. No API keys.
- No invented numbers: the site reads only JSON produced by `research/` scripts; otherwise it shows "Results pending".
- Static export only; user text never leaves the browser.
- Every resource is verified to exist and load before use, and recorded in `DATA_CARD.md`.
- Every major choice is explained in `DECISIONS.md`.
