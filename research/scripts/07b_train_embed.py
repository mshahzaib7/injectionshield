"""Phase 2 (optional D4): multilingual sentence embeddings + logistic regression.

  D4  minilm_lr       sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 embeddings + LR,
                      trained on the same data as D3 (en + ur + roman_ur + code_mixed)
  A2  minilm_en_only  same embeddings, English-only training: does a multilingual encoder transfer to
                      Urdu-language attacks without any Urdu training data?

C tuned on validation only. Embeddings are cached in results/predictions/cache_minilm.npz.
Writes results/predictions/{minilm_lr,minilm_en_only}.csv (test split) like 08_predict.py.
Skipped with a message if the model is not available locally.
"""
from __future__ import annotations

import common  # noqa: F401  -- must come first: sets HF_HOME before Hugging Face libraries load

import hashlib
import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score

from common import BENCHMARK, RESEARCH, RESULTS, SEED, local_model_path

MODEL_ID = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
PRED = RESULTS / "predictions"
CACHE = PRED / "cache_minilm.npz"
C_GRID = [0.01, 0.03, 0.1, 0.3, 1.0, 3.0, 10.0, 30.0, 100.0]
SPECS = {"minilm_lr": (["en", "ur", "roman_ur", "code_mixed"], ["en", "ur"]), "minilm_en_only": (["en"], ["en"]),
         "minilm_lr_v2": (["en", "ur", "roman_ur", "code_mixed"], ["en", "ur"])}  # v2 adds data/augment_v2
AUGMENT_DIR = "augment_v2"


def embed(texts: list[str]) -> np.ndarray:
    import torch
    from sentence_transformers import SentenceTransformer

    torch.set_num_threads(os.cpu_count() or 4)
    cache = dict(np.load(CACHE)) if CACHE.exists() else {}
    keys = [hashlib.sha1(t.encode("utf-8")).hexdigest() for t in texts]
    todo = sorted({(k, t) for k, t in zip(keys, texts) if k not in cache})
    if todo:
        model = SentenceTransformer(local_model_path(MODEL_ID), device="cpu")
        vecs = model.encode([t for _, t in todo], batch_size=32, normalize_embeddings=True, show_progress_bar=False)
        for (k, _), v in zip(todo, vecs):
            cache[k] = v.astype(np.float32)
        np.savez(CACHE, **cache)
    return np.stack([cache[k] for k in keys])


def main() -> None:
    try:
        local_model_path(MODEL_ID)
    except Exception as e:
        print(f"skip D4: {MODEL_ID} not available locally ({type(e).__name__})")
        return
    bench = pd.read_csv(BENCHMARK / "benchmark.csv")
    aug_dir = BENCHMARK.parent / AUGMENT_DIR
    extra = [pd.read_csv(aug_dir / f).assign(split=sp, aug=True) for f, sp in (("v2_train.csv", "train"), ("v2_val.csv", "val"))
             if (aug_dir / f).exists()]
    bench = pd.concat([bench.assign(aug=False), *extra], ignore_index=True)
    bench["vec_idx"] = range(len(bench))
    X = embed(bench.text.tolist())
    test = bench[(bench.split == "test") & ~bench.aug]
    for name, (train_langs, val_langs) in SPECS.items():
        use = bench if name.endswith("_v2") else bench[~bench.aug]
        tr = use[(use.split == "train") & use.lang.isin(train_langs)]
        va = use[(use.split == "val") & use.lang.isin(val_langs)]
        scores = {}
        for C in C_GRID:
            m = LogisticRegression(C=C, max_iter=5000, random_state=SEED).fit(X[tr.vec_idx], tr.label)
            scores[C] = f1_score(va.label, m.predict(X[va.vec_idx]))
        best = min(C for C, s in scores.items() if s == max(scores.values()))
        m = LogisticRegression(C=best, max_iter=5000, random_state=SEED).fit(X[tr.vec_idx], tr.label)
        joblib.dump(m, RESEARCH / "models" / f"{name}.joblib")
        out = test[["group_id", "lang", "label"]].copy()
        out["score"] = m.predict_proba(X[test.vec_idx])[:, 1]
        out.to_csv(PRED / f"{name}.csv", index=False)
        (RESEARCH / "models" / f"{name}_meta.json").write_text(json.dumps(
            {"name": name, "C": best, "val_f1_by_C": {str(k): round(v, 4) for k, v in scores.items()},
             "train_langs": train_langs, "val_langs": val_langs, "n_train": int(len(tr)), "encoder": MODEL_ID},
            indent=2), encoding="utf-8")
        print(f"{name:15s} C={best:<6} val_F1={scores[best]:.3f} n_train={len(tr)}")


if __name__ == "__main__":
    main()
