# Interview prep: InjectionShield

These are the twelve questions a professor is most likely to ask, with short answers grounded in the actual results (`research/results/*.json`, `research/REPORT.md`) and the design decisions (`DECISIONS.md`). If the pipeline is re-run, re-check the numbers against `research/results/summary.json`.

---

### 1. In one minute: what did you do and what did you find?
Prompt-injection detectors are trained mostly on English. I built a paired benchmark: the same ~2,200 prompts in English, Urdu script, Roman Urdu and code-mixed text. I tested an open-source detector (ProtectAI DeBERTa-v3) on it and found two failures:
- **It misses Roman Urdu attacks.** Recall fell from 89.8% in English to 61.0% in Roman Urdu. 36% of the attacks it caught in English slipped through once rewritten in Roman Urdu (McNemar p < 0.001).
- **It blocks harmless Urdu.** It flagged 88.6% of harmless Urdu-script prompts as attacks, and 35 of 35 on independently written Urdu sentences.

I then built InjectionShield-Lite, a 1.8 MB character n-gram model that runs in the browser. It closes most of the gap on the benchmark. I also showed honestly where it fails: unseen attack styles. A second version improved those.

### 2. Why does this problem matter?
Urdu has well over 200 million speakers, and many people type in Roman Urdu or mix it with English. A safety filter that only understands English fails these users in both directions:
- **Security:** attackers bypass it simply by switching language.
- **Usability:** ordinary users get blocked. A detector that flags 9 in 10 harmless Urdu questions is unusable for Urdu speakers.

### 3. How did you make sure the evaluation is fair and not leaking?
- **Split before translating.** I split by prompt group (70/15/15, seeded) *before* translating, so no version of a test prompt is ever seen in training.
- **Tuning on validation only.** C is chosen on validation. The test split was used once.
- **No contaminated test data.** I excluded `jackhhao/jailbreak-classification` from testing because ProtectAI was trained on it.
- **v2 data checked against every test set.** Every new training sentence was compared with all test sets (fuzzy match ≥ 75 drops it), and none matched.
- **Dev/test separation for false alarms.** The false-alarm test set I inspected during development is reported as a dev set. The clean number comes from a fresh sample I never looked at.

### 4. Where did the Urdu and Roman Urdu data come from, and how good is it?
- **Urdu script:** NLLB-200, translated locally. A line-by-line review of 20 rows found that 17 needed corrections, and 2 had lost the injected instruction. That is a disclosed limitation and one of my findings: free MT for Urdu is weak.
- **Roman Urdu and code-mixed:** LLM-assisted, disclosed in the data card. Because the same "author" wrote both their train and test rows, I expected the benchmark to flatter my model, so I tested it on independently supplied sentences as well.

### 5. Why character n-grams instead of a big transformer?
Three reasons:
- **Spelling:** Roman Urdu has no standard spelling (nahi / nhi / nai). Character n-grams share most features across those variants; word features don't.
- **Size:** the model must run in a browser with no server, so it had to be small. It is a dictionary plus a weighted sum, 1.8 MB.
- **Transparency:** I can show exactly which words pushed a score up.

The ablation separates the two ingredients. Character features *alone* did not help: Roman Urdu recall was 34% → 29%. Multilingual training data is what helped: 29% → 80%.

### 6. Your baseline got 0% on Urdu script. Isn't that trivial?
It's expected. An English word model has no Urdu vocabulary. I included it as a floor, and the result itself isn't the interesting part. The interesting contrast is ProtectAI: a strong transformer that *does* react to Urdu, but almost indiscriminately. Its Urdu ROC-AUC is only 0.70, so its 95.7% Urdu recall is meaningless when it also flags 88.6% of harmless Urdu.

### 7. What surprised you?
Two things:
- **The failure direction.** I expected ProtectAI to *miss* Urdu-script attacks. Instead it flags almost everything in Urdu script; it fails on false alarms, not misses. The miss problem showed up in Roman Urdu instead, where there's no foreign script to trigger it.
- **My own model's limits.** It scored 80–93% on the benchmark, but only 41% (Roman Urdu) on 100 attacks phrased in new styles such as fake authority and "developer mode". It had mostly learned the "reveal the password" style in its training data. A multilingual-embedding model generalised better (62–69%), even though it was worse on the benchmark.

### 8. How did you fix the generalisation problem, and is the fix real?
v2 adds training data covering the new attack styles, plus "look-alike" harmless prompts, such as "how do I turn on developer mode on Android?". Results:
- **Stress set:** recall rose from 41% → 79% (Roman Urdu) and 38% → 72% (Urdu).
- **Independent sentences:** 96–100% recall with 0% false alarms.
- **Fresh real users' harmless prompts:** false alarms of 4.0% (English) and 7.3% (Urdu).

I report the stress gain as **optimistic**: I wrote the extra data after seeing the stress categories, even though no sentence overlaps. The first v2 attempt over-flagged harmless "give me instructions" requests (15% false alarms in Urdu). I caught that on the dev set, fixed it, and confirmed the fix on a fresh sample.

### 9. How confident are you in these numbers?
- **CIs:** every metric has a 95% stratified-bootstrap confidence interval, and paired comparisons use McNemar tests.
- **Strong claims:** the ProtectAI findings have non-overlapping CIs and p < 0.001.
- **Weaker claims:** the test sets are small (200–333 rows per language, and only 10 Roman Urdu sentences in one independent set), so some differences overlap, and the report says so where it happens. All findings text is generated from the numbers, so I couldn't overstate them by hand.

### 10. What are the main limitations?
- Machine-translated and LLM-assisted text instead of real user data.
- Small test sets.
- Mostly short, direct injections; indirect, multi-turn and tool-use attacks are barely covered.
- A single 0.5 threshold.
- ProtectAI's training data is only partly documented.
- My model is a research prototype, not a security product.

### 11. What would you do next?
1. **Real data:** collect a native-speaker Roman Urdu and code-mixed test set from several people, with attacks they invent themselves. That is the most important missing piece.
2. **Indirect injection:** test attacks hidden in documents, web pages and tool outputs, in Urdu.
3. **Stronger multilingual models:** fine-tune a small multilingual encoder (or distil one into a browser-sized model), since embeddings generalised best.
4. **Calibration:** per-language thresholds and calibration, to trade misses against false alarms explicitly.
5. **Other languages:** extend to other South Asian languages written in both native and Latin scripts (Hindi/Hinglish, Bengali, Punjabi).

### 12. How does the in-browser demo work, and how do you know it matches the research?
The trained model is exported as JSON (terms, IDF weights, coefficients), and [`lib/detector.ts`](lib/detector.ts) re-implements the preprocessing, n-grams, TF-IDF and logistic function. A parity test checks 200 strings against scikit-learn's probabilities within 1e-4. Unicode details matter here: I verified the whitespace set is identical across all 1.1 million code points, because "\s" means different things in Python and JavaScript. The site is a static export with no server, so nothing typed into it leaves the device.

---

**Tip:** for "walk me through a result", open [`research/REPORT.md`](research/REPORT.md), section *Paired language-switch analysis*, and explain one row: 91 English-caught attacks, of which 33 were missed in Roman Urdu.
