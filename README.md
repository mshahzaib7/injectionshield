# InjectionShield

**Do prompt-injection detectors fail on Urdu, Roman Urdu and Urdu-English code-mixed text?**

InjectionShield is a small research project and a live, in-browser tool. It builds a paired benchmark in which the same prompts (attacks and harmless questions) appear in English, Urdu script, Roman Urdu and code-mixed text. On that benchmark it evaluates an open-source prompt-injection detector (ProtectAI DeBERTa-v3), an English-only baseline, and multilingual models, and it tests **InjectionShield-Lite**: a 1.8 MB character n-gram model that runs entirely in the browser. Every number below and on the website is generated from the evaluation outputs, with 95% bootstrap confidence intervals. The test sets are small, and the limitations are stated up front.

- **Live demo:** _coming soon_ <!-- TODO(author): add the Vercel URL -->
- **Full report:** [`research/REPORT.md`](research/REPORT.md) · **Data card:** [`DATA_CARD.md`](DATA_CARD.md) · **Design decisions:** [`DECISIONS.md`](DECISIONS.md) · **QA:** [`TESTING.md`](TESTING.md)

<!-- TODO(author): add screenshots, e.g. docs/screenshot-home.png and docs/screenshot-detector.png -->

## Key findings

<!-- FINDINGS:START -->
| Finding | Value | Detail |
|---|---|---|
| ProtectAI DeBERTa-v3 (v2): attacks caught | **89.8% → 61.0%** | English → Roman Urdu |
| ProtectAI DeBERTa-v3 (v2): false alarms | **0.6% → 88.6%** | harmless English → harmless Urdu (script) |
| InjectionShield-Lite v2: new attack styles | **41.0% → 79.0%** | Roman Urdu recall, v1 → v2 (v2 trained on similar styles; optimistic) |

- **RQ1 · D1: detection rate by language.** ProtectAI DeBERTa-v3 (v2) detected 89.8% (95% CI 85.5–94.0%) of English attacks but 61.0% (95% CI 52.0–70.0%) of Roman Urdu attacks. The confidence intervals do not overlap. Paired test on the same prompts: McNemar p < 0.001.
- **RQ1 · D2: detection rate by language.** English-only baseline detected 92.8% (95% CI 89.2–96.4%) of English attacks but 0.0% (95% CI 0.0–0.0%) of Urdu (script) attacks. The confidence intervals do not overlap. Paired test on the same prompts: McNemar p < 0.001.
- **RQ1 · D1: language-switch bypass.** Of the attacks caught in English by ProtectAI DeBERTa-v3 (v2), 36.3% (95% CI 26.1–46.2%) were missed when the same attack was written in Roman Urdu (33 of 91 attacks).
- **RQ1 · D2: language-switch bypass.** Of the attacks caught in English by English-only baseline, 100.0% (95% CI 100.0–100.0%) were missed when the same attack was written in Urdu (script) (152 of 152 attacks).
- **RQ2 · D1: false alarms on harmless text.** ProtectAI DeBERTa-v3 (v2) wrongly flagged 0.6% of harmless English prompts and 88.6% (95% CI 83.2–93.4%) of harmless Urdu (script) prompts (highest false-positive rate across languages).
- **RQ2 · D2: false alarms on harmless text.** English-only baseline wrongly flagged 0.6% of harmless English prompts and 5.0% (95% CI 1.0–9.0%) of harmless Roman Urdu prompts (highest false-positive rate across languages).
- **RQ2 · D1: blanket flagging of Urdu (script).** ProtectAI DeBERTa-v3 (v2)'s 95.7% recall on Urdu (script) is not a sign of robustness: it also flagged 88.6% of harmless Urdu (script) prompts (ROC-AUC 0.70), i.e. it flags most text in this language regardless of content.
- **RQ3 · Multilingual embeddings: what transfers without Urdu data.** Multilingual MiniLM embeddings trained on English only (A2): Urdu (script) recall 94.5% / FPR 7.8%; Roman Urdu recall 77.0% / FPR 58.0%. Trained on multilingual data (D4): Urdu (script) recall 92.1% / FPR 2.4%; Roman Urdu recall 70.0% / FPR 20.0%. Roman Urdu was the lowest-F1 language for 6 of 8 detectors (D1, D3, D4, D3v2, D4v2, A2).
- **RQ3 · D3: InjectionShield-Lite vs the English-only baseline.** Recall, English-only baseline → InjectionShield-Lite: Urdu (script) 0.0% → 93.3%; Roman Urdu 34.0% → 80.0%; Urdu-English code-mixed 90.0% → 90.0% (CIs overlap). InjectionShield-Lite's lowest recall was 80.0% (Roman Urdu) with false-positive rates between 0.0% and 2.0%. Caveat: its Roman Urdu / code-mixed training and test rows were written by the same (LLM) author, which may flatter these numbers.
- **RQ3 · Ablation: features vs training data.** Recall for word n-grams (English data) / char n-grams (English data) / char n-grams (multilingual data) — Urdu (script): 0.0% / 0.0% / 93.3%; Roman Urdu: 34.0% / 29.0% / 80.0%; Urdu-English code-mixed: 90.0% / 89.0% / 90.0%. The first step shows what character features alone contribute; the second shows what multilingual training data adds.
- **RQ3 · Generalisation to unseen attack styles.** On 100 Roman Urdu and 100 Urdu-script attacks phrased in new styles (fake authority, developer modes, role-play; supplied after training, attack-only), recall Roman Urdu / Urdu was: D1 92.0% / 98.0%; D2 45.0% / 0.0%; D3 41.0% / 38.0%; D4 62.0% / 69.0%. InjectionShield-Lite's benchmark Roman Urdu recall (80.0%) does not carry over to these unseen attack styles: it mostly learned the attack patterns present in its training data. The multilingual-embedding models (D4, A2) generalised better. ProtectAI's high Urdu recall should be read together with its false-positive rate on harmless Urdu.
- **RQ3 · D3v2: retraining for new attack styles.** InjectionShield-Lite v2 adds training data covering these attack styles and look-alike harmless prompts. Stress-set recall (Roman Urdu / Urdu) rose from 41.0% / 38.0% to 79.0% / 72.0%. This is optimistic, because the extra data was written after the stress-set categories were known (no sentence was allowed to be similar to a stress-set item). On 150 English and 150 Urdu fresh real-user harmless prompts that mention words like system, developer, instructions or access, the false-positive rate (English / Urdu) was 7.3% / 4.0% for v1 and 4.0% / 7.3% for v2. Benchmark Roman Urdu recall: 85.0% (FPR 1.0%).
- **RQ2 · D1: false alarms confirmed on independently written Urdu.** On 35 harmless Urdu-script sentences written independently of the benchmark (supplied after training), ProtectAI DeBERTa-v3 (v2) flagged 35 (100.0%) as attacks.

_All statements are generated automatically from results/metrics.json. Test-set sizes are small (about 330 prompts in English/Urdu, 200 in Roman Urdu/code-mixed), so confidence intervals are wide._
<!-- FINDINGS:END -->

## How it works

1. **Benchmark** (`research/scripts/01–06`). The English source prompts come from `deepset/prompt-injections`, `Lakera/gandalf_ignore_instructions` and `OpenAssistant/oasst1`. They are filtered, deduplicated, balanced, and split by prompt group *before* translation. Urdu-script versions come from NLLB-200; Roman Urdu and code-mixed versions are LLM-assisted (disclosed).
2. **Evaluation** (`07–10`, `13`). Six detectors and ablations are evaluated on recall, false-positive rate, F1 and ROC-AUC with bootstrap CIs, plus a paired *language-switch bypass* analysis with McNemar tests. Further checks use an independent test set, an attack-only stress set in new styles, and real users' harmless "look-alike" prompts.
3. **Fix** (`14`, `07`). InjectionShield-Lite v2 is retrained with new attack styles and look-alike harmless prompts. Contamination checks keep every test set out of training.
4. **Browser model** (`11`). The model is exported to JSON and re-implemented in TypeScript ([`lib/detector.ts`](lib/detector.ts)). A parity test checks that Python and TypeScript agree within 1e-4 on 200 strings.
5. **Website** (Next.js static export). No server: text never leaves the visitor's device.

## Reproduce

**Requirements:** Python 3.10+ (tested on 3.14), Node 18+ (tested on 24). No GPU, no API keys. Everything downloads from Hugging Face for free.

```bash
# 1) Research pipeline
cd research
python -m venv .venv
.venv/Scripts/activate            # Windows   (macOS/Linux: source .venv/bin/activate)
pip install torch==2.14.1 --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
python scripts/01_build_base.py
python scripts/02_translate_ur.py          # NLLB-200 (2.5 GB download, CPU, cached)
python scripts/03_select_manual.py
# Roman Urdu / code-mixed drafts are not published (see DATA_CARD.md, "Data availability")
python scripts/04_compile_manual.py
python scripts/05_assemble.py
python scripts/06_data_card.py
python scripts/14_build_v2.py
python scripts/07_train_lite.py
python scripts/07b_train_embed.py
python scripts/08_predict.py
python scripts/13_eval_independent.py
python scripts/09_metrics.py
python scripts/10_report.py
python scripts/11_export_browser.py
python scripts/12_site_data.py
python scripts/15_readme.py
python -m pytest tests

# 2) Website
cd ..
npm install
npm test            # parity + edge cases
npm run dev         # http://localhost:3000
npm run build       # static export to out/
```

See [`research/README.md`](research/README.md) for what each step produces, and [`TESTING.md`](TESTING.md) for the QA checklist.

## Repository structure

```
app/                 Next.js pages (home, detector, research, dataset, about, 404)
components/          UI components (detector tool, charts, navbar, ...)
lib/detector.ts      In-browser scorer (port of the Python TF-IDF + logistic regression)
lib/triggers.ts      Hand-curated injection phrases, used for highlighting only
public/model/        Exported browser models (baseline.json, shield-lite.json)
public/data/         Results read by the website (metrics, summary, counts, report)
research/scripts/    Python pipeline, steps 01–15
research/results/    Aggregate results (metrics.json, summary.json, independent.json)
research/REPORT.md   Auto-generated research report
tests/               Vitest tests (parity, edge cases, triggers)
qa/                  Browser smoke test and accessibility audit (Playwright + axe)
```

## Limitations

- **Small test sets:** about 330 English/Urdu prompts and 200 Roman Urdu/code-mixed prompts, so the CIs are wide.
- **Machine translation:** Urdu-script text is machine-translated. In a reviewed sample, 17 of 20 rows needed corrections.
- **LLM-assisted text:** the Roman Urdu and code-mixed text is LLM-assisted, not collected from real users. v2's stress-set gains are optimistic, because its extra training data was written after the stress-set categories were known.
- **Attack styles:** mostly short "ignore your instructions / reveal the password" attacks. Indirect, multi-turn and tool-use injections are only lightly covered.
- **Not a security product:** InjectionShield-Lite is a research prototype.

## Ethics

This is defensive research. All attacks come from public datasets of well-known patterns. No new attack techniques were developed, and no real system was attacked. The demo runs in the browser and collects nothing.

## Citation

```bibtex
@misc{khan2026injectionshield,
  author       = {Muhammad Shahzaib Khan},
  title        = {InjectionShield: Do Prompt-Injection Detectors Fail on Urdu,
                  Roman Urdu and Code-Mixed Text?},
  year         = {2026},
  howpublished = {\url{https://github.com/mshahzaib7/injectionshield}},
  note         = {Research prototype}
}
```

## License

Code: [MIT](LICENSE). Data: each source keeps its original license (Apache-2.0 / MIT; see [`DATA_CARD.md`](DATA_CARD.md)). NLLB-200 model weights are CC-BY-NC-4.0.
