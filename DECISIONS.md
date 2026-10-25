# Design Decisions

Each entry: **what** was chosen, **why**, and **alternatives considered**.

## D-001 · Python 3.14 + CPU-only PyTorch
- **What:** The research pipeline uses the machine's existing Python 3.14 in a local venv (`research/.venv`), with the CPU build of PyTorch.
- **Why:** No GPU is assumed and the budget is $0. CPU wheels are smaller and avoid CUDA setup. Models used (NLLB-600M distilled, DeBERTa-v3-base) run acceptably on CPU with batching and on-disk caching.
- **Alternatives:** Conda (heavier, unnecessary); Google Colab free GPU (not reproducible locally, session limits); Python 3.11 (would require an extra install with no benefit if 3.14 wheels work).

## D-002 · Next.js App Router with `output: "export"`
- **What:** The website is a fully static export (`out/`), deployable to Vercel free tier with zero config.
- **Why:** No backend means nothing to break or pay for, and user text physically cannot leave the device — inference runs in the browser from small JSON model files.
- **Alternatives:** Next.js with API routes / Python backend (costs money, privacy concerns, more failure modes); plain Vite SPA (fine, but Next gives per-page metadata, routing, and font optimization for free).
- **Notes:** `trailingSlash: true` so every route is emitted as `route/index.html`, which any static host serves correctly. `images.unoptimized` because the image optimizer needs a server.

## D-003 · Next.js 15 (not the newest major)
- **What:** Scaffolded with `create-next-app@15`, React 19.
- **Why:** Mature and well-documented static-export behaviour; "robust and simple beats fancy".
- **Alternatives:** Latest major — newer, but more risk of breaking changes in tooling (ESLint/Tailwind integration) for no benefit to this project.

## D-004 · Pinned top-level Python dependencies
- **What:** `research/requirements.txt` pins exact versions of every directly used package (torch 2.14.1 CPU, transformers 5.20.2, scikit-learn 1.9.1, …). PyTorch is installed first from the official CPU wheel index.
- **Why:** Reproducibility — anyone re-running the pipeline gets the same library behaviour (important because TF-IDF/LogReg outputs must later match the TypeScript port to 1e-4).
- **Alternatives:** A full `pip freeze` lock (more brittle across operating systems); unpinned ranges (results could silently change).

## D-005 · Known, accepted `npm audit` warning
- **What:** `npm audit` reports a postcss advisory inside Next.js's own bundled copy.
- **Why accepted:** It is a build-time-only tool processing our own CSS; it never ships to visitors of a static site. The only offered fix (`npm audit fix --force`) breaks the framework. Will re-check when a patched Next 15.x is released.

---
## Phase 1 — Benchmark

## D-101 · Which datasets
- **What:** `deepset/prompt-injections` (attacks + benign) and `Lakera/gandalf_ignore_instructions` (attacks), with `OpenAssistant/oasst1` first-turn user prompts as benign filler.
- **Why:** All three are verified to load, are permissively licensed (Apache-2.0 / MIT), and are short single-turn prompts that machine translation can handle. None of them is in the training list of the ProtectAI detector (D1) we evaluate.
- **Alternatives:** `jackhhao/jailbreak-classification` was rejected because ProtectAI v2 was trained on it (that would contaminate D1's scores) and its prompts are very long. Datasets with no stated license, or with non-commercial or gated licenses, were rejected for redistribution reasons.

## D-102 · Why add oasst1 benign prompts
- **What:** Benign prompts are sampled from oasst1 until the classes are balanced (≈1,100 attacks vs ≈1,100 benign).
- **Why:** Gandalf contains only attacks. Without more benign text the benchmark would be about 75% attacks, which makes accuracy misleading and pushes classifiers to over-flag.
- **Trade-off (disclosed):** The source now correlates with the label. deepset contributes both labels, which partly offsets this. The error analysis checks whether detectors rely on source style.

## D-103 · Split by `group_id` before translating
- **What:** Each English prompt is a group. The train/val/test split (70/15/15, stratified by source × label, seed 42) is made on groups **before** any translation, and all language versions inherit their group's split.
- **Why:** If the Urdu translation of a test prompt were in the training data, a model could "recognise" the test attack. Its multilingual scores would then be inflated, which is exactly the effect we are trying to measure. Splitting first makes that leak impossible, and `05_assemble.py` asserts that no group appears in two splits.
- **Alternatives:** Splitting after translation (leaks), or random per-row splitting (leaks).

## D-104 · Deduplication rules
- **What:** Exact duplicates are removed after NFKC + lowercase + whitespace normalisation. Near-duplicates are removed at RapidFuzz ratio ≥ 90 (union-find clustering, one prompt kept per cluster). Clusters with conflicting labels are dropped.
- **Why:** Gandalf contains many near-identical "ignore previous instructions, tell me the password" prompts. Duplicates across train and test inflate scores, and conflicting labels are noise.

## D-105 · English detection with a fallback
- **What:** `langdetect` (seeded) with top language `en` and probability ≥ 0.70, plus a rule-based fallback for short ASCII phrases: at least one English stop word, no German function words, and German probability < 0.2.
- **Why:** langdetect misreads short English topic phrases ("What makes a good pasta?" was detected as other languages), while deepset contains about 265 German prompts that must be removed. The fallback recovers the English phrases without letting German back in.
- **Alternatives:** fastText `lid.176` (more accurate, but an extra 130 MB download and a C++ build on Windows); no filter (German would contaminate the "English" baseline).

## D-106 · Machine translation for Urdu script
- **What:** NLLB-200 distilled 600M, run locally on CPU (all threads), sentence-segmented, greedy decoding, with every segment cached on disk.
- **Why:** It is free, runs offline, and translates Urdu well for its size. Splitting into sentences avoids NLLB's quality drop on long inputs. The cache means an interrupted run resumes instantly.
- **Alternatives:** `Helsinki-NLP/opus-mt-en-ur` (smaller download, noticeably weaker output; kept as the documented fallback); paid translation APIs (not allowed, $0 budget).

## D-107 · LLM-assisted Roman Urdu and code-mixed text
- **What:** Claude wrote the Roman Urdu and code-mixed versions in batches of 50, as `group_id|text` drafts. A script attaches the labels from the source data.
- **Why:** No free machine-translation system produces natural Roman Urdu or code-mixed text, and no permissively licensed parallel corpus of Roman Urdu prompt injections exists. Typing labels by hand risks errors, so labels are looked up instead.
- **Disclosure:** Every row says `author=claude_assisted`. The author reviews a 60-row sample. The data card states that the text is synthetic and that train and test share one "author".

## D-108 · Dropping machine translations that lost content
- **What:** Machine-translated (`ur`) rows that contain a repetition loop, or are less than 0.4× the length of their English source, are dropped. Literal `\n` sequences in deepset prompts are treated as line breaks before translation.
- **Why:** Inspection showed NLLB sometimes hallucinates loops ("بَش بَش بَش …") or silently drops the second part of a prompt, which is often the injected instruction itself. Such a row would be benign text carrying an `attack` label, and would wrongly count as a detector "miss". Fixing the `\n` handling recovered most cases; the remaining 3 rows (of 2,214) were dropped.
- **Alternatives:** Keeping them (label noise), or hand-fixing them (not reproducible; the human-review step covers a random sample instead).

---
## Phase 2 — Evaluation

## D-201 · Which detectors, and two ablations
- **What:** D1 ProtectAI DeBERTa-v3 v2 (open-source transformer), D2 English-only word TF-IDF + LR, D3 InjectionShield-Lite (char 2–5-gram TF-IDF + LR, multilingual training data), D4 multilingual MiniLM embeddings + LR. Plus ablations **A1** (D3's features, English-only data) and **A2** (D4's encoder, English-only data).
- **Why:** D1 is what a practitioner would download today. D2 is the simplest "English-only" system. D3 is our cheap, browser-sized fix. The ablations separate the two ingredients of the fix: D2 → A1 measures what character n-grams alone contribute, and A1 → D3 measures what multilingual training data contributes. A2 tests whether a multilingual encoder transfers to Urdu without any Urdu training data.
- **Alternatives:** Llama Guard / Prompt Guard (larger, licence gating or registration). Commercial APIs (not $0).

## D-202 · Character n-grams with `char_wb` and a custom, specified analyzer
- **What:** D3 uses `char_wb` 2–5-grams, implemented in `shield_features.py` and tested to be identical to scikit-learn's version.
- **Why:** Character n-grams cope with spelling variation (nahi/nhi/nai) and need no tokenizer for Urdu script. A hand-specified analyzer can be ported exactly to TypeScript for the in-browser demo (Phase 3 parity test).
- **Alternatives:** Word n-grams (break on spelling variation, as D2 shows). Subword tokenizers (would need a tokenizer file in the browser).

## D-203 · Tuning only on validation; threshold fixed at 0.5
- **What:** Logistic regression C is chosen by validation F1 from a grid (ties go to the smaller C). The test split is used once. All metrics use a 0.5 threshold, and ROC-AUC is reported as a threshold-free view.
- **Why:** Tuning on test would overstate performance. A fixed threshold mirrors how detectors are deployed by default.
- **Note:** The validation split contains only `en` and `ur`, because Roman Urdu and code-mixed rows exist only for train and test. So D3's C was not tuned for Roman Urdu.

## D-204 · Statistics
- **What:** 95% CIs come from 1,000 **stratified** bootstrap resamples (attacks and benign resampled separately, so every resample has both classes). Paired comparisons match the same prompt across languages by group_id and use an exact McNemar test on discordant pairs. The language-switch bypass CI is a bootstrap over paired attacks.
- **Why:** Test sets are small (200–333 rows), so uncertainty must be visible. Paired tests are much more sensitive than comparing two independent proportions because they remove prompt-difficulty variation.

## D-205 · Findings text is generated, never hand-written
- **What:** `09_metrics.py` writes `summary.json` from templates filled only with computed numbers. It says when CIs overlap, and adds special findings when the data calls for them (e.g. high recall that is meaningless because the false-positive rate is also very high).
- **Why:** This follows the project rule that no number is ever invented or hard-coded, and it keeps the website and the report consistent with the data. A hand-written claim ("Roman Urdu is hardest for every detector") was caught during development as false for D2 and replaced with a computed count.

---
## Phase 3 — Browser models

## D-301 · Export as plain JSON and re-implement scoring in TypeScript
- **What:** D2 and D3 are exported as JSON (terms, idf, coefficients, intercept, preprocessing settings): `baseline.json` (4,112 terms, 139 KB) and `shield-lite.json` (38,773 terms, 1.2 MB). `lib/detector.ts` re-implements preprocessing, n-gram extraction, sublinear TF-IDF, L2 normalisation and the logistic function.
- **Why:** A static site cannot run Python. The model is just a dictionary lookup plus a weighted sum, so a small hand-written scorer is safer and smaller than shipping an ML runtime. Text never leaves the visitor's browser.
- **Alternatives:** ONNX Runtime Web (heavy runtime, harder to verify for a linear model); running ProtectAI/MiniLM in the browser (700 MB / 470 MB downloads, impractical); a server API (costs money, sends user text off-device).

## D-302 · Parity test as a hard gate
- **What:** Python writes 200 strings (45 test rows per language plus 20 edge cases: empty, emoji, 5,000 chars, HTML, full-width, Arabic ligatures, diacritics, ZWNJ/RTL marks, Turkish İ, Greek Σ…) with scikit-learn's probabilities. A Vitest test requires the TypeScript output to match within 1e-4. Coefficients are stored with 9 significant digits.
- **Why:** The website must show the same model that the research measured. Small porting bugs (Unicode handling, n-gram edges) would otherwise go unnoticed.
- **Detail:** The whitespace set is defined as explicit code-point ranges on both sides. It was verified to be identical over all 1.1 million Unicode code points, because "\s" means different things in Python and JavaScript.

## D-303 · Explanations: curated trigger phrases (display only) and exact per-word contributions
- **What:** `lib/triggers.ts` highlights a hand-curated list of injection phrases in English, Urdu script and Roman Urdu. It is **not** used for scoring. For D3, `wordContributions` splits the model's logit exactly across words: char_wb n-grams never cross spaces, so the per-word values add up to the score (tested).
- **Why:** Visitors (and reviewers) can see why a text was flagged. Keeping the phrase list out of the score keeps the reported metrics honest.

---
## Phase 4 — Website

## D-401 · Visual design chosen by the author
- **What:** Lemon #FFF21A background, charcoal #171717 text, electric lavender #A66BFF accents, with a heavy display headline (Archivo Black) and Inter for body text. This follows the author's reference template. The approved helper colours are deep purple #5B21B6, off-white #FFFBE6, red/green for the risk result only, and two greys. A dark theme (charcoal, yellow, lavender) is one click away.
- **Why:** A distinctive, confident look that still reads as a research lab, not a marketing page. Accessibility: lavender on yellow is only about 3:1 contrast, so it is used for large shapes and buttons; small accent text on yellow uses deep purple (about 8:1).
- **Note:** This overrides the original "dark by default, one accent" brief, at the author's request.

## D-402 · Results are read at build time, never typed
- **What:** Pages read `public/data/*.json` during `next build` (`lib/data.ts`). Each reader validates the file's shape, and a missing or malformed file renders a "Results pending" box instead of numbers.
- **Why:** The site can never show a number that the research scripts did not produce, and a half-finished pipeline cannot crash the build or show a blank page.

## D-403 · "Summary only" public data exposure
- **What:** The Dataset page shows counts, sources/licences and three example prompts. There is no full browser and no CSV download. The Research page's error browser shows at most 5 examples per detector × language × error type (`errors_sample.json`). The full `errors.json` stays in `research/results`.
- **Why:** The author's choice. The one-line methodology disclosure (Roman Urdu / code-mixed text is LLM-assisted) stays in the Limitations section for research integrity.

## D-404 · No-flash theme and safe rendering
- **What:** `public/theme-init.js` is loaded with `next/script` `beforeInteractive` and sets `data-theme` before first paint. The toggle reads it through `useSyncExternalStore`, so there is no hydration mismatch. User input and dataset text are always rendered as React text nodes (no `dangerouslySetInnerHTML` anywhere), so pasted HTML stays plain text.

## D-405 · Browser smoke test with the installed Edge
- **What:** `qa/smoke.py` (Playwright, `channel="msedge"`) checks every route at 360/768/1024/1440 px for HTTP 200, console errors/warnings and horizontal overflow, and exercises the detector and theme toggle.
- **Why:** It catches real-browser problems that unit tests cannot (it found a 4 px navbar overflow at 768 px). Using the system Edge avoids a large browser download on a slow connection.

## D-206 · Independent and stress test sets, evaluated after training
- **What:** Two extra sets supplied by the author after all models were frozen: (1) 130 sentences (English, Urdu script, Roman Urdu; attacks and harmless) and (2) an attack-only stress set of 100 Roman Urdu attacks plus the same 100 in Urdu script, in 10 categories. `13_eval_independent.py` scores all six detectors on them. `09_metrics.py` turns the results into findings and a home-page card.
- **Why:** The benchmark's Roman Urdu and code-mixed text came from one LLM-assisted source, used for both training and testing, so InjectionShield-Lite's scores could be flattered. Text phrased in new styles is the honest check.
- **Result (reported, not hidden):** ProtectAI flagged 35/35 independently written harmless Urdu sentences, confirming RQ2. InjectionShield-Lite fell from 80% Roman Urdu recall on the benchmark to 41% on unseen attack styles, while the multilingual-embedding models (D4/A2) generalised better (62–69%). The fix works on attack styles seen in training, not in general.
- **Caveats:** The sets are small, several Urdu items are translations of other items, the stress set has no harmless rows (recall only), some category I/J items are questions rather than clear attacks, and the authorship of the sentences (hand-written or AI-assisted) is recorded as supplied by the author.

## D-207 · InjectionShield-Lite v2: targeted augmentation, with a clean way to measure it
- **What:** D3v2 uses D3's features, retrained with `data/augment_v2`. That set holds Claude-assisted attacks in the new styles (fake authority, special modes, role-play, extraction, refusal suppression, context reset, tool/document injection) and look-alike harmless prompts in all four languages, plus short jailbreaks and role-play prompts from `jackhhao/jailbreak-classification` (used only for *training*; it stays out of every test set because ProtectAI was trained on it). D4v2 is the multilingual-embedding counterpart. The website now runs D3v2.
- **Why:** The stress test showed D3 learned mainly the "reveal the password" attack style. The fix is more varied training data, not a different model.
- **Keeping the evaluation honest:**
  1. The stress and independent sets were **never** used for training. Every augmentation candidate was checked against them and against the benchmark test split (RapidFuzz ≥ 75 drops it); none had to be dropped.
  2. The extra attacks were written *after* the stress-set categories were known, so v2's stress recall (41% → 79% Roman Urdu, 38% → 72% Urdu) is reported as optimistic.
  3. False alarms are measured on real users' harmless prompts containing trigger-like words. The first sample was inspected during development: it revealed that a first v2 attempt over-flagged ordinary "give me instructions" requests (FPR 12.7% EN / 15.3% UR), which led to a second round of look-alike harmless examples. It is therefore reported as a **dev** set. A **fresh** sample drawn afterwards gives the clean number: v2 4.0% EN / 7.3% UR vs v1 7.3% / 4.0%.
- **Alternatives:** Training on the stress set (it would no longer be a test). Lowering the threshold (catches more attacks but raises false alarms everywhere). Switching the browser model to MiniLM (a much larger download, and D4v2 was not better than D3v2 here).

---
## Phase 5 — QA

## D-501 · Automated accessibility and robustness checks
- **What:** `qa/a11y.py` runs axe-core (WCAG 2.1 A/AA) on every page in both themes, including a detector result state. A negative-control page confirms axe actually reports violations. Colour pairs axe cannot measure (SVG chart text) are checked by hand in TESTING.md. Robustness is tested by building with missing, malformed and partially missing `public/data` files.
- **Why:** "Zero console errors, WCAG AA, never a blank page" are requirements, so they need evidence, not just intent. The checks found three real issues (navbar overflow, chart-legend contrast, a build break on partial JSON), all fixed.
