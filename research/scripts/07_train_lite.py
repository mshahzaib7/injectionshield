"""Phase 2: train the lightweight detectors (TF-IDF + logistic regression).

  D2  baseline      word 1-2 gram TF-IDF + LR, trained on English train only      ("what most teams would ship")
  D3  shield_lite   char_wb 2-5 gram TF-IDF + LR, trained on en + ur + roman_ur + code_mixed train  (our fix)
  A1  char_en_only  ablation: D3's features but English-only training data
                    -> D2 vs A1 isolates the effect of character n-grams; A1 vs D3 isolates the effect of
                       multilingual augmented training data.

C (inverse regularisation) is tuned on the validation split only (F1 at threshold 0.5; ties -> smaller C).
The test split is never touched here. Outputs: research/models/{name}.joblib + {name}_meta.json      Usage: 07_train_lite.py [model names...]
"""
from __future__ import annotations

import json
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from sklearn.pipeline import Pipeline

from common import BENCHMARK, DATA, RESEARCH, SEED
from shield_features import char_wb_analyzer, word_analyzer

MODELS = RESEARCH / "models"
MODELS.mkdir(exist_ok=True)
C_GRID = [0.03, 0.1, 0.3, 1.0, 3.0, 10.0, 30.0, 100.0, 300.0, 1000.0]

SPECS = {
    "baseline": dict(analyzer=word_analyzer, max_features=20000, train_langs=["en"], val_langs=["en"]),
    "shield_lite": dict(analyzer=char_wb_analyzer, max_features=50000,
                        train_langs=["en", "ur", "roman_ur", "code_mixed"], val_langs=["en", "ur"]),
    "char_en_only": dict(analyzer=char_wb_analyzer, max_features=50000, train_langs=["en"], val_langs=["en"]),
    # v2: same features as D3, plus data/augment_v2 (new attack styles + hard negatives); see 14_build_v2.py.
    "shield_lite_v2": dict(analyzer=char_wb_analyzer, max_features=60000,
                           train_langs=["en", "ur", "roman_ur", "code_mixed"], val_langs=["en", "ur"], augment=True),
}
AUGMENT = DATA / "augment_v2"


def build(analyzer, max_features: int, C: float) -> Pipeline:
    return Pipeline([
        ("tfidf", TfidfVectorizer(analyzer=analyzer, lowercase=False, sublinear_tf=True, min_df=2,
                                  max_features=max_features, norm="l2", smooth_idf=True, use_idf=True,
                                  dtype=np.float64)),
        ("lr", LogisticRegression(C=C, max_iter=5000, solver="lbfgs", random_state=SEED)),
    ])


def main() -> None:
    only = sys.argv[1:]
    bench = pd.read_csv(BENCHMARK / "benchmark.csv")
    for name, spec in SPECS.items():
        if only and name not in only:
            continue
        tr = bench[(bench.split == "train") & bench.lang.isin(spec["train_langs"])]
        va = bench[(bench.split == "val") & bench.lang.isin(spec["val_langs"])]
        if spec.get("augment"):
            tr = pd.concat([tr, pd.read_csv(AUGMENT / "v2_train.csv")], ignore_index=True)
            va = pd.concat([va, pd.read_csv(AUGMENT / "v2_val.csv")], ignore_index=True)
        scores = {}
        for C in C_GRID:
            m = build(spec["analyzer"], spec["max_features"], C).fit(tr.text, tr.label)
            scores[C] = f1_score(va.label, m.predict(va.text))
        best_c = min(C for C, s in scores.items() if s == max(scores.values()))
        model = build(spec["analyzer"], spec["max_features"], best_c).fit(tr.text, tr.label)
        joblib.dump(model, MODELS / f"{name}.joblib")
        meta = {
            "name": name, "C": best_c, "val_f1_by_C": {str(k): round(v, 4) for k, v in scores.items()},
            "train_langs": spec["train_langs"], "val_langs": spec["val_langs"],
            "n_train": int(len(tr)), "n_val": int(len(va)),
            "n_features": int(len(model.named_steps["tfidf"].vocabulary_)),
            "analyzer": spec["analyzer"].__name__,
        }
        (MODELS / f"{name}_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
        print(f"{name:15s} C={best_c:<6} val_F1={scores[best_c]:.3f} features={meta['n_features']} n_train={len(tr)}")


if __name__ == "__main__":
    main()
