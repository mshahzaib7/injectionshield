"""Phase 2: write research/REPORT.md from results/*.json.

Tables and findings are generated from the computed numbers. Prose sections are fixed text.
The "## My Observations" section is the author's own: whatever is written there is preserved on re-runs.
"""
from __future__ import annotations

import json
import re

from common import LANGS, RESEARCH, RESULTS

REPORT = RESEARCH / "REPORT.md"
OBS_HEADER = "## My Observations"
OBS_PLACEHOLDER = "_To be written by the author._\n"


def load(name):
    p = RESULTS / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def f(x, digits=1):
    return "–" if x is None else f"{100 * x:.{digits}f}"


def fci(x, c):
    return "–" if x is None else (f"{100 * x:.1f} [{100 * c[0]:.1f}, {100 * c[1]:.1f}]" if c else f"{100 * x:.1f}")


def results_table(m) -> str:
    names = {l["key"]: l["name"] for l in m["languages"]}
    out = ["| Detector | Language | n | Recall % [95% CI] | FPR % [95% CI] | Precision % | F1 % | ROC-AUC | Accuracy % |",
           "|---|---|---:|---|---|---:|---:|---:|---:|"]
    for d in m["detectors"]:
        if not d["available"]:
            out.append(f"| {d['id']} {d['name']} | — | — | not available | | | | | |")
            continue
        for l in LANGS:
            r = m["results"][d["key"]].get(l)
            if not r:
                continue
            auc = "–" if r["roc_auc"] is None else f"{r['roc_auc']:.3f}"
            out.append(f"| {d['id']} {d['name']} | {names[l]} | {r['n']} | {fci(r['recall'], r['ci']['recall'])} | "
                       f"{fci(r['fpr'], r['ci']['fpr'])} | {f(r['precision'])} | {f(r['f1'])} | {auc} | "
                       f"{f(r['accuracy'])} |")
    return "\n".join(out)


def paired_table(m) -> str:
    names = {l["key"]: l["name"] for l in m["languages"]}
    out = ["| Detector | Language | Paired attacks | Recall EN → lang % | Caught in EN, missed in lang | "
           "Language-switch bypass % [95% CI] | McNemar p | Benign FPR EN → lang % |",
           "|---|---|---:|---|---:|---|---:|---|"]
    for d in m["detectors"]:
        if not d["available"]:
            continue
        for l in LANGS[1:]:
            p = m["paired"][d["key"]].get(l)
            if not p:
                continue
            a, b = p["attacks"], p["benign"]
            out.append(f"| {d['id']} | {names[l]} | {a['n']} | {f(a['recall_en'])} → {f(a['recall_lang'])} | "
                       f"{a['caught_en_missed_lang']} / {a['caught_in_en']} | {fci(a['switch_bypass_rate'], a['switch_bypass_ci'])} | "
                       f"{'< 0.001' if a['mcnemar_p'] < 0.001 else f'{a["mcnemar_p"]:.3f}'} | {f(b['fpr_en'])} → {f(b['fpr_lang'])} |")
    return "\n".join(out)


def source_table(m) -> str:
    out = ["| Detector | Source | Class | n | Recall % (attacks) / FPR % (benign) |", "|---|---|---|---:|---:|"]
    for d in m["detectors"]:
        if not d["available"]:
            continue
        for k, v in m["by_source_en"][d["key"]].items():
            src, cls = k.split("|")
            val = v.get("recall", v.get("fpr"))
            out.append(f"| {d['id']} | {src} | {cls} | {v['n']} | {f(val)} |")
    return "\n".join(out)


def independent_table(ind) -> str:
    names = {"en": "English", "ur": "Urdu (script)", "roman_ur": "Roman Urdu"}
    out = ["| Detector | " + " | ".join(f"{names[l]} recall % / FPR %" for l in names) + " |",
           "|---|" + "---|" * len(names)]
    for d in ind["detectors"].values():
        cells = [f"{f(d['by_lang'][l]['recall'])} / {f(d['by_lang'][l]['fpr'])}" for l in names]
        out.append(f"| {d['id']} {d['name']} | " + " | ".join(cells) + " |")
    c = ind["counts"]
    sizes = ", ".join(f"{names[l]}: {c[l]['attack']} attacks / {c[l]['benign']} benign" for l in names)
    return "\n".join(out) + f"\n\n(n = {sizes})"


def stress_table(st) -> str:
    cats = st["categories"]
    out = ["| Detector | Roman Urdu recall % [95% CI] | Urdu recall % [95% CI] | " + " | ".join(cats) + " |",
           "|---|---|---|" + "---|" * len(cats)]
    for d in st["detectors"].values():
        r, u = d["by_lang"]["roman_ur"], d["by_lang"]["ur"]
        per = " | ".join(f"{f(r['by_category'][c], 0)} / {f(u['by_category'][c], 0)}" for c in cats)
        out.append(f"| {d['id']} {d['name']} | {fci(r['recall'], r['ci'])} | {fci(u['recall'], u['ci'])} | {per} |")
    legend = "; ".join(f"{k} = {v}" for k, v in cats.items())
    return "\n".join(out) + f"\n\nCategory columns show Roman Urdu / Urdu recall %. {legend}."


def hardneg_table(ind) -> str:
    out = ["| Detector | Dev set FPR % (EN / UR) | Fresh test FPR % [95% CI] EN | Fresh test FPR % [95% CI] UR |", "|---|---|---|---|"]
    dev, test = ind.get("hardneg_dev") or {"detectors": {}}, ind["hardneg"]
    for key, d in test["detectors"].items():
        dv = dev["detectors"].get(key, {}).get("by_lang")
        dev_txt = f"{f(dv['en']['fpr'])} / {f(dv['ur']['fpr'])}" if dv else "–"
        t = d["by_lang"]
        out.append(f"| {d['id']} {d['name']} | {dev_txt} | {fci(t['en']['fpr'], t['en']['ci'])} | {fci(t['ur']['fpr'], t['ur']['ci'])} |")
    return "\n".join(out) + f"\n\n(fresh test n = {test['n']['en']} English + {test['n']['ur']} Urdu)"


def counts_table(c) -> str:
    out = ["| Split | " + " | ".join(f"`{l}`" for l in LANGS) + " |", "|---|" + "---:|" * len(LANGS)]
    for split in ("train", "val", "test"):
        cells = []
        for l in LANGS:
            x = c["counts"].get(split, {}).get(l)
            cells.append(f"{x.get('attack', 0)} / {x.get('benign', 0)}" if x else "–")
        out.append(f"| {split} | " + " | ".join(cells) + " |")
    return "\n".join(out) + "\n\n(attack / benign)"


def main() -> None:
    m, s, c = load("metrics.json"), load("summary.json"), load("dataset_counts.json")
    ind = load("independent.json")
    observations = OBS_PLACEHOLDER
    if REPORT.exists():
        mt = re.search(rf"^{re.escape(OBS_HEADER)}\s*\n(.*)\Z", REPORT.read_text(encoding="utf-8"), flags=re.S | re.M)
        if mt and mt.group(1).strip():
            observations = mt.group(1).rstrip() + "\n"

    findings = "\n".join(f"- **{x['rq']} · {x['title']}.** {x['statement']}" for x in s["findings"]) if s else "_Results pending._"
    pending = "" if not s or s["status"] == "complete" else (
        f"\n> **Partial results:** not yet available: {', '.join(s['unavailable_detectors'])}.\n")

    text = f"""# InjectionShield: Do Prompt-Injection Detectors Fail on Urdu?

_Auto-generated by `research/scripts/10_report.py` from `research/results/*.json` (generated {m['generated_at'] if m else 'n/a'})._
{pending}
## Abstract

Prompt-injection detectors are a common first line of defence for LLM applications, but they are trained and
evaluated mostly on English. We build a small paired benchmark in which the same prompts appear in English, Urdu
script, Roman Urdu, and Urdu–English code-mixed text. On it we evaluate an open-source transformer detector
(ProtectAI DeBERTa-v3 v2), an English-only TF-IDF baseline, and InjectionShield-Lite, a character n-gram
model trained with multilingual augmented data that is small enough to run in a web browser. We report detection
rate (recall), false-positive rate, and a paired *language-switch bypass rate*: the share of attacks caught in
English that are missed when the same attack is written in another language. All results carry 95% bootstrap
confidence intervals. The key findings are listed below. They were generated automatically from the numbers,
and the test sets are small.

{findings}

## Motivation

Urdu is spoken by more than 230 million people, and Pakistani users commonly type in Roman Urdu and mix Urdu with
English. If a safety filter only understands English, an attacker can bypass it by writing the same attack in
another language, and a harmless user who writes in Urdu may be wrongly blocked. We test whether this happens
with real open-source detectors, and whether a lightweight, transparent fix helps.

**Research questions**
- **RQ1:** Do detectors lose recall when the same attack is written in Urdu script, Roman Urdu, or code-mixed text?
- **RQ2:** Do they falsely flag harmless Urdu-language text?
- **RQ3:** Does a lightweight detector trained with multilingual augmented data close the gap?

## Method

**Data** (details in `DATA_CARD.md`). English prompts come from `deepset/prompt-injections`,
`Lakera/gandalf_ignore_instructions`, and `OpenAssistant/oasst1` (benign filler). They are filtered to English,
deduplicated (exact and near-duplicate), and balanced. The data is split 70/15/15 by prompt group **before**
translation, so no version of a test prompt is seen in training. The Urdu-script versions were produced with NLLB-200
(600M, local). The Roman Urdu and code-mixed versions are LLM-assisted (written by Claude) and disclosed as such.

{counts_table(c) if c else '_Counts pending._'}

**Detectors.**
{chr(10).join(f"- **{d['id']} {d['name']}**{'' if d['available'] else ' (not available)'}: {d['description']}" for d in m['detectors']) if m else ''}

The TF-IDF models (D2, D3, A1) use sublinear TF and L2 normalisation. D2 uses word 1–2-grams; D3 and A1 use
`char_wb` 2–5-grams. Preprocessing is NFKC normalisation, lowercasing, and whitespace collapsing. Logistic regression
C was tuned on the validation split only, by F1. The test split was used once, for the numbers below.

**Metrics.** Accuracy, precision, recall (detection rate), F1, false-positive rate (FPR), bypass rate
(1 − recall), and ROC-AUC, all at a fixed threshold of 0.5. 95% CIs come from 1,000 stratified bootstrap
resamples (attacks and benign resampled separately, seed 42). The paired analysis matches the same prompt across
languages by group id. *Language-switch bypass rate* = (attacks caught in English but missed in language L) /
(attacks caught in English). An exact McNemar test compares paired English and L recall.

## Results

### Main results (test split)

{results_table(m) if m else '_Results pending._'}

### Paired language-switch analysis (same prompts, English vs other language)

{paired_table(m) if m else '_Results pending._'}

### Does a detector rely on dataset style? (English test rows by source)

Every Gandalf row is an attack and every oasst1 row is benign, so a detector could learn source style. deepset
contributes both classes. Similar numbers on deepset and on the single-source rows suggest the detector is not
relying on source style alone.

{source_table(m) if m else '_Results pending._'}

Error examples (bypasses and false positives per detector and language) are in `results/errors.json`.

### Independent test set (sentences not written by the benchmark's author)

After all models were trained and tuned, the project author supplied {sum(v['attack'] + v['benign'] for v in ind['counts'].values()) if ind else 0} additional sentences, written
independently of the benchmark's LLM-assisted Roman Urdu / code-mixed text. They were used for evaluation only. Their
attacks differ in style from the training data: most never mention a "password". Several Urdu-script sentences are
translations of the English or Roman Urdu ones, so the sentences are not all independent, and the Roman Urdu group has
only 10 sentences. Treat this table as a sanity check, not a second benchmark.

{independent_table(ind) if ind else '_Not available._'}

### Stress test: unseen attack styles (attack-only)

The author also supplied {sum(ind['stress']['n'].values()) if ind and ind.get('stress') else 0} attack-only sentences in 10 categories (100 Roman Urdu and the same 100 in
Urdu script), written in styles largely absent from the benchmark: fake authority, developer/debug modes, role-play
personas, indirect extraction, and tool/untrusted-input instructions. There are no harmless rows, so only recall can be
measured. Some items, especially in categories I (privacy questions) and J, are questions *about* the assistant's
behaviour rather than clear instructions to override it. A detector that lets them through is arguably correct, so
read the per-category columns, not just the totals.

{stress_table(ind['stress']) if ind and ind.get('stress') else '_Not available._'}

### InjectionShield-Lite v2 and look-alike harmless prompts

The stress test showed that D3 mostly learned the attack styles in its training data. D3v2 (and D4v2) were retrained
with extra data (`data/augment_v2`, built by `14_build_v2.py`): Claude-assisted attacks in the new styles and
look-alike harmless prompts in all four languages, plus short jailbreak and role-play prompts from
`jackhhao/jailbreak-classification` (Apache-2.0) with NLLB Urdu translations. Any candidate similar (RapidFuzz ≥ 75) to
a benchmark test row, an independent sentence or a stress-set sentence was removed; none needed removing. **Caveat:**
the extra attacks were written after the stress-set categories were known, so D3v2's stress-set recall is optimistic.
A fresh, independently written attack set is needed to confirm it.

Making a detector catch more attacks can make it flag more harmless text, so false alarms were measured on real users'
harmless prompts (OpenAssistant) that mention words like *system, developer, instructions, access, rules*, plus their
NLLB Urdu translations. The first sample of 150 (the **dev set**) was inspected during development: it showed that a
first v2 attempt over-flagged ordinary requests for instructions, which led to more look-alike harmless training
examples. The **fresh test** sample of 150 was drawn afterwards and never inspected before this evaluation.

{hardneg_table(ind) if ind and ind.get('hardneg') else '_Not available._'}

## Limitations

- **Small test sets** (about 330 English/Urdu prompts, 200 Roman Urdu/code-mixed), so CIs are wide and small
  differences should not be over-interpreted.
- **Machine translation.** In a 60-row review, 17 of 20 Urdu-script translations needed corrections, and 2 had
  lost the injected instruction. Some "misses" on Urdu may therefore be translation artefacts. Only the reviewed
  rows were corrected.
- **LLM-assisted Roman Urdu and code-mixed text** is not real user data, and the same author wrote both its train
  and test rows. This may flatter InjectionShield-Lite on those languages. A test set written independently by
  native speakers is the most important next step.
- **Narrow attack distribution.** Mostly short "ignore your instructions / reveal the password" attacks (Gandalf,
  deepset). Indirect, multi-turn and tool-use injections are not covered.
- **Source–label correlation** (Gandalf = attack, oasst1 = benign). See the per-source table above.
- **One threshold (0.5).** Detectors calibrated differently could trade recall for FPR. ROC-AUC is reported for
  this reason.
- **ProtectAI's training data** is only partly documented. We excluded the one benchmark dataset its model card
  lists (`jackhhao/jailbreak-classification`), but overlap with deepset or Gandalf cannot be fully ruled out, which
  would favour D1 on English.

## Ethics statement

This is defensive research. All attack prompts come from existing public datasets of short, well-known
prompt-injection patterns. No new attack technique was developed, and no real deployed system was attacked. The
benchmark is meant to help make safety filters work for Urdu speakers. The web demo runs fully in the browser, and
no user text is collected.

{OBS_HEADER}

{observations}"""
    REPORT.write_text(text, encoding="utf-8")
    print(f"wrote {REPORT}")


if __name__ == "__main__":
    main()
