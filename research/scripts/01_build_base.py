"""Phase 1, steps 1-3: build the English base set and split it by group_id.

Sources (verified to exist and load; licenses in DATA_CARD.md):
  - deepset/prompt-injections          (Apache-2.0)  attacks + benign
  - Lakera/gandalf_ignore_instructions (MIT)         attacks only
  - OpenAssistant/oasst1               (Apache-2.0)  benign filler (English root user prompts)

Output: data/processed/base_en.csv and data/processed/base_stats.json
"""
from __future__ import annotations

import common  # noqa: F401  -- must come first: sets HF_HOME before Hugging Face libraries load

import json
import re

import numpy as np
import pandas as pd
from datasets import load_dataset
from langdetect import DetectorFactory, detect_langs
from rapidfuzz import fuzz, process
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
from sklearn.model_selection import train_test_split

from common import PROCESSED, SEED, normalize

DetectorFactory.seed = 0  # langdetect is otherwise non-deterministic

MIN_CHARS, MAX_CHARS = 8, 600  # MAX keeps prompts within reliable machine-translation length
NEAR_DUP_THRESHOLD = 90  # rapidfuzz ratio (0-100) on normalized text
OASST_POOL = 1500  # oasst1 prompts considered before balancing

# Benign filler must not itself contain injection attempts.
INJECTION_HINTS = [
    "ignore previous", "ignore all previous", "ignore the above", "ignore your instructions",
    "disregard", "jailbreak", "dan mode", "do anything now", "system prompt", "pretend you are",
    "you are no longer", "forget all", "forget your", "developer mode",
]

stats: dict = {}


def load_sources() -> pd.DataFrame:
    frames = []
    d = load_dataset("deepset/prompt-injections")
    for split in d:
        df = d[split].to_pandas()[["text", "label"]]
        df["source"] = "deepset/prompt-injections"
        frames.append(df)

    g = load_dataset("Lakera/gandalf_ignore_instructions")
    for split in g:
        df = g[split].to_pandas()[["text"]]
        df["label"] = 1
        df["source"] = "Lakera/gandalf_ignore_instructions"
        frames.append(df)

    o = load_dataset("OpenAssistant/oasst1", split="train").to_pandas()
    o = o[o.parent_id.isna() & (o.lang == "en") & (o.role == "prompter") & (~o.deleted)]
    o = o[["text"]].copy()
    o["label"] = 0
    o["source"] = "OpenAssistant/oasst1"
    low = o.text.str.lower()
    o = o[~low.apply(lambda t: any(h in t for h in INJECTION_HINTS))]
    frames.append(o)

    df = pd.concat(frames, ignore_index=True)
    df["text"] = df["text"].astype(str).str.strip()
    df["label"] = df["label"].astype(int)
    stats["loaded"] = df.groupby(["source", "label"]).size().to_dict()
    return df


GERMAN_FUNCTION_WORDS = {
    "der", "die", "das", "und", "ist", "nicht", "ich", "wie", "ein", "eine", "mit", "für", "auf",
    "zu", "sie", "es", "den", "dem", "von", "bitte", "was", "wer", "wo", "warum", "oder", "auch",
    "du", "mir", "mich", "dich", "bin", "sind", "hat", "haben", "kann", "werden", "wird",
}
_TOKEN = re.compile(r"[a-zA-ZäöüÄÖÜß']+")


def is_english(text: str) -> bool:
    """langdetect is unreliable on short phrases, so add a conservative rule-based fallback."""
    try:
        langs = detect_langs(text)
    except Exception:
        return False
    top = langs[0]
    if top.lang == "en" and top.prob >= 0.70:
        return True
    tokens = [t.lower() for t in _TOKEN.findall(text)]
    if not tokens or not text.isascii():
        return False
    de_prob = next((l.prob for l in langs if l.lang == "de"), 0.0)
    return (
        de_prob < 0.20
        and not any(t in GERMAN_FUNCTION_WORDS for t in tokens)
        and any(t in ENGLISH_STOP_WORDS for t in tokens)
    )


def near_dedup(df: pd.DataFrame) -> pd.DataFrame:
    """Cluster near-duplicates (union-find); keep one per cluster; drop clusters with conflicting labels."""
    norms = df["norm"].tolist()
    n = len(norms)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    scores = process.cdist(norms, norms, scorer=fuzz.ratio, score_cutoff=NEAR_DUP_THRESHOLD, workers=-1)
    ii, jj = np.nonzero(scores)
    for i, j in zip(ii, jj):
        if i < j:
            ri, rj = find(i), find(j)
            if ri != rj:
                parent[rj] = ri
    df = df.copy()
    df["cluster"] = [find(i) for i in range(n)]
    conflict = df.groupby("cluster")["label"].nunique()
    bad = set(conflict[conflict > 1].index)
    stats["near_dup_conflicting_clusters_dropped"] = len(bad)
    df = df[~df.cluster.isin(bad)]
    before = len(df)
    df = df.drop_duplicates("cluster", keep="first").drop(columns="cluster")
    stats["near_duplicates_removed"] = before - len(df)
    return df


def main() -> None:
    df = load_sources()

    df = df[df.text.str.len().between(MIN_CHARS, MAX_CHARS)]
    stats["after_length_filter"] = len(df)

    df = df[df.text.apply(is_english)]
    stats["after_english_filter"] = df.groupby(["source", "label"]).size().to_dict()

    df["norm"] = df.text.apply(normalize)
    # Exact duplicates: drop texts whose copies disagree on label, then keep one copy.
    lab = df.groupby("norm")["label"].nunique()
    df = df[~df.norm.isin(lab[lab > 1].index)].drop_duplicates("norm")
    stats["after_exact_dedup"] = len(df)

    # Sample the large oasst1 pool down before the O(n^2) near-dup step.
    is_oa = df.source == "OpenAssistant/oasst1"
    oa = df[is_oa].sample(frac=1.0, random_state=SEED).head(OASST_POOL)
    df = pd.concat([df[~is_oa], oa]).reset_index(drop=True)
    df = near_dedup(df)

    # Balance classes using oasst1 benign filler only.
    n_attack = int((df.label == 1).sum())
    non_oa_benign = df[(df.label == 0) & (df.source != "OpenAssistant/oasst1")]
    need = max(0, n_attack - len(non_oa_benign))
    oa = df[df.source == "OpenAssistant/oasst1"].sample(frac=1.0, random_state=SEED).head(need)
    df = pd.concat([df[df.label == 1], non_oa_benign, oa])
    stats["final_by_source_label"] = df.groupby(["source", "label"]).size().to_dict()

    # One English source prompt = one group. Translations inherit its group_id later.
    df = df.sample(frac=1.0, random_state=SEED).reset_index(drop=True)
    df["group_id"] = [f"g{i:05d}" for i in range(len(df))]

    # 70/15/15 split by group_id, stratified by source x label, fixed seed.
    strat = df.source + "|" + df.label.astype(str)
    train, rest = train_test_split(df, test_size=0.30, stratify=strat, random_state=SEED)
    val, test = train_test_split(rest, test_size=0.50, stratify=strat.loc[rest.index], random_state=SEED)
    df.loc[train.index, "split"] = "train"
    df.loc[val.index, "split"] = "val"
    df.loc[test.index, "split"] = "test"
    assert df.group_id.is_unique

    df = df[["group_id", "split", "source", "label", "text"]].sort_values("group_id")
    df.to_csv(PROCESSED / "base_en.csv", index=False, encoding="utf-8")
    stats["split_by_label"] = df.groupby(["split", "label"]).size().to_dict()
    stats["total"] = len(df)

    printable = {k: ({str(kk): vv for kk, vv in v.items()} if isinstance(v, dict) else v) for k, v in stats.items()}
    (PROCESSED / "base_stats.json").write_text(json.dumps(printable, indent=2), encoding="utf-8")
    print(json.dumps(printable, indent=2))


if __name__ == "__main__":
    main()
