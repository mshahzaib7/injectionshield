# InjectionShield research pipeline

Run from `research/` with the virtual env (`.venv/Scripts/python` on Windows). Every step is deterministic (seed 42) and cached.

| Step | Script | Produces |
|---|---|---|
| 1 | `scripts/01_build_base.py` | English base set, grouped and split (`data/processed/base_en.csv`) |
| 2 | `scripts/02_translate_ur.py` | Urdu-script translations with NLLB-200 (`data/processed/ur_translations.csv`) |
| 3 | `scripts/03_select_manual.py` | Prompts chosen for Roman Urdu / code-mixed (`data/manual/to_write.csv`) |
| 4 | `scripts/04_compile_manual.py` | Manual CSVs from drafts (`data/manual/*_{test,train}_*.csv`) |
| 5 | `scripts/05_assemble.py` | Benchmark, QC, review sample (`data/benchmark/benchmark.csv`) |
| 6 | `scripts/06_data_card.py` | Counts table in `DATA_CARD.md` |
| 7 | `scripts/07_train_lite.py` | D2, D3, A1 models (`models/`) |
| 7b | `scripts/07b_train_embed.py` | D4, A2 (multilingual MiniLM) predictions |
| 8 | `scripts/08_predict.py` | Test-set scores for D1 (ProtectAI), D2, D3, A1 (`results/predictions/`) |
| 9 | `scripts/09_metrics.py` (run after 13, which it reads) | `results/{metrics,summary,errors}.json`, copied to `public/data/` |
| 10 | `scripts/10_report.py` | `REPORT.md` (keeps the "My Observations" section) |
| 11 | `scripts/11_export_browser.py` | Browser models `public/model/*.json` + parity fixture |
| 12 | `scripts/12_site_data.py` | Website example data + REPORT copy in `public/data/` |
| 14 | `scripts/14_build_v2.py` | v2 augmentation data + hard-negative dev/test sets (`data/augment_v2/`); then rerun 07 (shield_lite_v2), 07b, 08 |
| 15 | `scripts/15_readme.py` | Key-findings section of the root README |
| 13 | `scripts/13_eval_independent.py` | Independent, stress and hard-negative results (`results/independent.json`) |

Tests: `python -m pytest tests/`
