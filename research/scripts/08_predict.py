"""Phase 2: score every TEST row with every available detector and save the raw probabilities.

  D1  protectai     protectai/deberta-v3-base-prompt-injection-v2 (CPU, batched, cached per text)
  D2  baseline      research/models/baseline.joblib
  D3  shield_lite   research/models/shield_lite.joblib
  A1  char_en_only  research/models/char_en_only.joblib
  (D4 / A2 sentence-embedding detectors write their own predictions in 07b_train_embed.py)

Output: results/predictions/{detector}.csv with columns group_id, lang, label, score  (score = P(injection))
If a detector is unavailable (e.g. model not downloaded), it is skipped with a message, never faked.
"""
from __future__ import annotations

import common  # noqa: F401  -- must come first: sets HF_HOME before Hugging Face libraries load

import hashlib
import json
import os
import sys

import joblib
import pandas as pd

from common import BENCHMARK, RESEARCH, RESULTS, local_model_path

PRED = RESULTS / "predictions"
PRED.mkdir(parents=True, exist_ok=True)
MODELS = RESEARCH / "models"
D1_ID = "protectai/deberta-v3-base-prompt-injection-v2"
D1_CACHE = PRED / "cache_protectai.jsonl"


def test_rows() -> pd.DataFrame:
    b = pd.read_csv(BENCHMARK / "benchmark.csv")
    return b[b.split == "test"][["group_id", "lang", "label", "text"]].reset_index(drop=True)


def save(name: str, df: pd.DataFrame, scores) -> None:
    out = df[["group_id", "lang", "label"]].copy()
    out["score"] = [float(s) for s in scores]
    out.to_csv(PRED / f"{name}.csv", index=False)
    print(f"  wrote predictions/{name}.csv ({len(out)} rows)")


def predict_lite(df: pd.DataFrame) -> None:
    for name in ("baseline", "shield_lite", "char_en_only", "shield_lite_v2"):
        path = MODELS / f"{name}.joblib"
        if not path.exists():
            print(f"skip {name}: {path.name} missing (run 07_train_lite.py)")
            continue
        model = joblib.load(path)
        save(name, df, model.predict_proba(df.text)[:, 1])


def predict_protectai(df: pd.DataFrame) -> None:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    try:
        path = local_model_path(D1_ID)
    except Exception as e:  # not downloaded: document and skip, never fake
        print(f"skip protectai: model not available locally ({type(e).__name__})")
        return
    torch.set_num_threads(os.cpu_count() or 4)
    tok = AutoTokenizer.from_pretrained(path)
    model = AutoModelForSequenceClassification.from_pretrained(path).eval()
    inj = [i for i, lab in model.config.id2label.items() if lab.upper() == "INJECTION"]
    if len(inj) != 1:
        sys.exit(f"unexpected labels {model.config.id2label}")
    inj = int(inj[0])

    cache: dict[str, float] = {}
    if D1_CACHE.exists():
        for line in D1_CACHE.read_text(encoding="utf-8").splitlines():
            rec = json.loads(line)
            cache[rec["k"]] = rec["p"]
    key = {t: hashlib.sha1(t.encode("utf-8")).hexdigest() for t in df.text}
    todo = sorted({t for t in df.text if key[t] not in cache}, key=len)
    print(f"protectai: {len(todo)} uncached texts")
    with D1_CACHE.open("a", encoding="utf-8") as fh:
        for i in range(0, len(todo), 16):
            batch = todo[i : i + 16]
            enc = tok(batch, return_tensors="pt", padding=True, truncation=True, max_length=512)
            with torch.inference_mode():
                probs = model(**enc).logits.softmax(-1)[:, inj].tolist()
            for t, p in zip(batch, probs):
                cache[key[t]] = p
                fh.write(json.dumps({"k": key[t], "p": p}) + "\n")
            fh.flush()
            if (i // 16) % 10 == 0:
                print(f"  {min(i + 16, len(todo))}/{len(todo)}", flush=True)
    save("protectai", df, [cache[key[t]] for t in df.text])


def main() -> None:
    df = test_rows()
    predict_lite(df)
    predict_protectai(df)


if __name__ == "__main__":
    main()
