"""Evaluate every detector on the independent sentence set (not written by the benchmark's author).

Input : data/independent/raw_submissions.txt  ("group|N/C|text"; supplied by the project author, 2026-10-25)
        group 1 = Roman Urdu, groups 2/3/5 = Urdu script, group 4 = English (5 = Urdu version of 4, 2 = of 1)
Output: results/independent.json (+ copy in public/data/), data/independent/{independent,stress}_scored.csv
        Also scores data/independent/stress_attacks.txt (attack-only, 100 Roman Urdu + 100 Urdu, categories A-J).

This set was collected after all models were trained and tuned, and is used for evaluation only.
Attack styles differ from the training data (few mention a "password"), so it is a test of generalisation.
"""
from __future__ import annotations

import common  # noqa: F401  -- must come first: sets HF_HOME before Hugging Face libraries load

import importlib
import json
import os
import shutil

import joblib
import numpy as np
import pandas as pd

from common import DATA, PUBLIC_DATA, RESEARCH, RESULTS, SEED, local_model_path

metrics_mod = importlib.import_module("09_metrics")
GROUP_LANG = {"1": "roman_ur", "2": "ur", "3": "ur", "4": "en", "5": "ur"}
SRC = DATA / "independent" / "raw_submissions.txt"
STRESS = DATA / "independent" / "stress_attacks.txt"
CATEGORIES = {"A": "Instruction override", "B": "Hidden prompt extraction", "C": "Fake authority", "D": "Role-play personas",
              "E": "Special modes", "F": "Indirect / encoded", "G": "Refusal manipulation", "H": "Multi-turn / context",
              "I": "Privacy questions", "J": "Tools / untrusted input"}


def load() -> pd.DataFrame:
    rows = []
    for line in SRC.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        g, lab, text = line.split("|", 2)
        rows.append({"group": g, "lang": GROUP_LANG[g], "label": 1 if lab.strip() == "C" else 0, "text": text.strip()})
    return pd.DataFrame(rows)


def score_all(df: pd.DataFrame) -> dict[str, np.ndarray]:
    import torch
    from sentence_transformers import SentenceTransformer
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    torch.set_num_threads(os.cpu_count() or 4)
    texts = df.text.tolist()
    out: dict[str, np.ndarray] = {}
    for key in ("baseline", "shield_lite", "char_en_only", "shield_lite_v2"):
        if (RESEARCH / "models" / f"{key}.joblib").exists():
            out[key] = joblib.load(RESEARCH / "models" / f"{key}.joblib").predict_proba(texts)[:, 1]
    path = local_model_path("protectai/deberta-v3-base-prompt-injection-v2")
    tok = AutoTokenizer.from_pretrained(path)
    model = AutoModelForSequenceClassification.from_pretrained(path).eval()
    inj = [i for i, l in model.config.id2label.items() if l.upper() == "INJECTION"][0]
    probs = []
    with torch.inference_mode():
        for i in range(0, len(texts), 16):  # batched: one big batch runs out of RAM on long texts
            enc = tok(texts[i : i + 16], return_tensors="pt", padding=True, truncation=True, max_length=512)
            probs.extend(model(**enc).logits.softmax(-1)[:, inj].tolist())
    out["protectai"] = np.asarray(probs)
    enc_model = SentenceTransformer(local_model_path("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"), device="cpu")
    X = enc_model.encode(texts, batch_size=32, normalize_embeddings=True, show_progress_bar=False)
    for key in ("minilm_lr", "minilm_en_only", "minilm_lr_v2"):
        if (RESEARCH / "models" / f"{key}.joblib").exists():
            out[key] = joblib.load(RESEARCH / "models" / f"{key}.joblib").predict_proba(X)[:, 1]
    return out


def stress(rng) -> dict:
    """Attack-only set: recall per detector x language x category (no benign rows, so no FPR)."""
    rows = []
    for line in STRESS.read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.startswith("#"):
            cat, no, lang, text = line.split("|", 3)
            rows.append({"category": cat, "item": int(no), "lang": lang, "label": 1, "text": text.strip()})
    df = pd.DataFrame(rows)
    scores = score_all(df)
    out = {"n": {l: int((df.lang == l).sum()) for l in ("roman_ur", "ur")}, "categories": CATEGORIES, "detectors": {}}
    for d in metrics_mod.DETECTORS:
        key = d["key"]
        if key not in scores:
            continue
        df[key] = scores[key]
        hit = df[key] >= metrics_mod.THRESHOLD
        per = {}
        for lang in ("roman_ur", "ur"):
            m = df.lang == lang
            boots = [hit[m].sample(frac=1, replace=True, random_state=int(rng.integers(1e9))).mean() for _ in range(metrics_mod.N_BOOT)]
            per[lang] = {"recall": float(hit[m].mean()), "ci": [float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))],
                         "by_category": {c: float(hit[m & (df.category == c)].mean()) for c in CATEGORIES}}
        out["detectors"][key] = {"id": d["id"], "name": d["name"], "by_lang": per}
    df.to_csv(DATA / "independent" / "stress_scored.csv", index=False, encoding="utf-8")
    return out


def hardneg(rng, file: str = "hardneg_test.csv") -> dict | None:
    """False-positive rate on held-out real-user benign prompts that mention admin/debug/mode/settings words."""
    path = DATA / "augment_v2" / file
    if not path.exists():
        return None
    df = pd.read_csv(path)
    scores = score_all(df)
    out = {"n": {l: int((df.lang == l).sum()) for l in ("en", "ur")}, "detectors": {}}
    for d in metrics_mod.DETECTORS:
        key = d["key"]
        if key not in scores:
            continue
        flag = scores[key] >= metrics_mod.THRESHOLD
        per = {}
        for lang in ("en", "ur"):
            m = (df.lang == lang).to_numpy()
            f = flag[m]
            boots = [f[rng.integers(0, len(f), len(f))].mean() for _ in range(metrics_mod.N_BOOT)]
            per[lang] = {"fpr": float(f.mean()), "flagged": int(f.sum()),
                         "ci": [float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))]}
        out["detectors"][key] = {"id": d["id"], "name": d["name"], "by_lang": per}
    return out


def main() -> None:
    df = load()
    scores = score_all(df)
    rng = np.random.default_rng(SEED)
    result = {"source": "Independent sentences supplied by the project author (not written by the benchmark's author); "
                        "collected after training; evaluation only.",
              "threshold": metrics_mod.THRESHOLD,
              "counts": {l: {"attack": int(((df.lang == l) & (df.label == 1)).sum()),
                             "benign": int(((df.lang == l) & (df.label == 0)).sum())} for l in ("en", "ur", "roman_ur")},
              "detectors": {}}
    for d in metrics_mod.DETECTORS:
        key = d["key"]
        if key not in scores:
            continue
        df[key] = scores[key]
        result["detectors"][key] = {"id": d["id"], "name": d["name"], "by_lang": {}}
        for lang in ("en", "ur", "roman_ur"):
            sub = df[df.lang == lang]
            y, s = sub.label.to_numpy(), sub[key].to_numpy()
            pm = metrics_mod.point_metrics(y, s)
            result["detectors"][key]["by_lang"][lang] = {
                "n": int(len(sub)), "recall": pm["recall"], "fpr": pm["fpr"], "f1": pm["f1"],
                "caught": pm["tp"], "missed": pm["fn"], "false_alarms": pm["fp"],
                "ci": {k: v for k, v in metrics_mod.bootstrap(y, s, rng).items() if k in ("recall", "fpr")},
            }
    result["stress"] = stress(rng)
    result["hardneg"] = hardneg(rng)
    result["hardneg_dev"] = hardneg(rng, "hardneg_dev.csv")
    result = metrics_mod.clean(result)
    (RESULTS / "independent.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    shutil.copy(RESULTS / "independent.json", PUBLIC_DATA / "independent.json")
    df.to_csv(DATA / "independent" / "independent_scored.csv", index=False, encoding="utf-8")

    print(f"{'detector':30s} " + "  ".join(f"{l:>22s}" for l in ("en", "ur", "roman_ur")))
    for key, d in result["detectors"].items():
        cells = []
        for l in ("en", "ur", "roman_ur"):
            r = d["by_lang"][l]
            cells.append(f"rec {100 * r['recall']:5.1f} fpr {100 * r['fpr']:5.1f}")
        print(f"{d['id'] + ' ' + d['name']:30.30s} " + "  ".join(f"{c:>22s}" for c in cells))
    print("counts:", result["counts"])
    for label, hn in (("DEV (inspected)", result.get("hardneg_dev")), ("TEST (fresh)", result.get("hardneg"))):
        if not hn:
            continue
        print()
        print(f"HARD NEGATIVES {label} (real benign prompts with admin/debug/mode words) FPR %:", hn["n"])
        for key, d in hn["detectors"].items():
            print(f"{d['id'] + ' ' + d['name']:30.30s} en {100 * d['by_lang']['en']['fpr']:5.1f}   ur {100 * d['by_lang']['ur']['fpr']:5.1f}")
    st = result["stress"]
    print()
    print("STRESS (attack-only) recall %:", st["n"])
    print(f"{'detector':30s} {'roman_ur':>9s} {'ur':>6s}   per-category roman_ur / ur")
    for key, d in st["detectors"].items():
        r, u = d["by_lang"]["roman_ur"], d["by_lang"]["ur"]
        cats = " ".join(f"{c}:{round(100 * r['by_category'][c]):3d}/{round(100 * u['by_category'][c]):3d}" for c in st["categories"])
        print(f"{d['id'] + ' ' + d['name']:30.30s} {100 * r['recall']:9.0f} {100 * u['recall']:6.0f}   {cats}")


if __name__ == "__main__":
    main()
