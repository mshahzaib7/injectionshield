"""Build the v2 augmentation data (new attack styles + hard negatives) and a held-out hard-negative test set.

Training additions (never evaluated on):
  - LLM-assisted drafts in data/augment_v2/drafts/{en,roman_ur,ur,code_mixed}.txt (A = attack, B = benign hard negative)
  - jackhhao/jailbreak-classification (Apache-2.0): short jailbreaks (attack) and role-play prompts (benign), English,
    plus their NLLB Urdu translations. (Excluded from the *test* data in Phase 1 because ProtectAI trained on it;
    using it for *training* our own model is fine.)
Contamination guard: any candidate whose normalised text is >= 75 (RapidFuzz ratio) similar to a benchmark TEST row,
an independent-set sentence, or a stress-set sentence is dropped, and the counts are reported.

Held-out hard-negative TEST set (real people, never trained on, never inspected; the first sample, which was
inspected during error analysis, is kept separately as data/augment_v2/hardneg_dev.csv): English OpenAssistant/oasst1 user messages that
mention words like admin / debug / mode / settings / rules / password but are ordinary requests, not used anywhere
else, plus their NLLB Urdu translations.

Outputs: data/augment_v2/{v2_train,v2_val,hardneg_test}.csv and data/augment_v2/v2_stats.json
"""
from __future__ import annotations

import common  # noqa: F401  -- must come first: sets HF_HOME before Hugging Face libraries load

import importlib
import json
import re

import pandas as pd
from datasets import load_dataset
from rapidfuzz import fuzz, process
from sklearn.model_selection import train_test_split

from common import BENCHMARK, DATA, SEED, local_model_path, normalize

OUT = DATA / "augment_v2"
DRAFTS = OUT / "drafts"
SIM_THRESHOLD = 75
HARDNEG_N = 150
KEYWORDS = re.compile(
    r"\b(developer|debug|admin|administrator|system|settings?|password|privacy|private|confidential|restrict\w*|"
    r"rules?|instructions?|mode|permission|config\w*|override|bypass|root|access|secret|hidden|ignore|forget)\b", re.I)
INJECTION_HINTS = re.compile(
    r"ignore (all |the |your )?(previous|prior|above)|disregard|jailbreak|\bdan\b|do anything now|no restrictions|"
    r"unfiltered|developer mode|pretend (you are|to be)|you are no longer|forget (all|everything|your)|system prompt|"
    r"act as (an? )?(ai|chatbot|assistant)", re.I)

translate = importlib.import_module("02_translate_ur")
stats: dict = {}


def drafts() -> pd.DataFrame:
    rows = []
    for path in sorted(DRAFTS.glob("*.txt")):
        lang = path.stem
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip() or line.startswith("#"):
                continue
            tag, _, text = line.partition("|")
            rows.append({"lang": lang, "label": 1 if tag.strip() == "A" else 0, "text": text.strip(), "source": "llm_v2"})
    df = pd.DataFrame(rows)
    stats["drafts"] = df.groupby(["lang", "label"]).size().to_dict()
    return df


def jackhhao() -> pd.DataFrame:
    j = pd.concat([load_dataset("jackhhao/jailbreak-classification", split=s).to_pandas() for s in ("train", "test")])
    j["label"] = (j["type"] == "jailbreak").astype(int)
    j = j[((j.label == 1) & (j.prompt.str.len() <= 600)) | ((j.label == 0) & (j.prompt.str.len() <= 400))]
    j = j.drop_duplicates("prompt")
    df = pd.DataFrame({"lang": "en", "label": j.label, "text": j.prompt.str.strip(), "source": "jackhhao"})
    stats["jackhhao"] = df.groupby("label").size().to_dict()
    return df


def hardneg_candidates(used: set[str]) -> pd.DataFrame:
    o = load_dataset("OpenAssistant/oasst1", split="train").to_pandas()
    o = o[(o.lang == "en") & (o.role == "prompter") & (~o.deleted)]
    t = o.text.str.strip()
    keep = t.str.len().between(15, 400) & t.str.contains(KEYWORDS) & ~t.str.contains(INJECTION_HINTS) & ~t.isin(used)
    df = pd.DataFrame({"lang": "en", "label": 0, "text": t[keep], "source": "oasst1_hardneg"}).drop_duplicates("text")
    return df.sample(n=min(HARDNEG_N, len(df)), random_state=SEED)


def add_urdu(df: pd.DataFrame, tag: str) -> pd.DataFrame:
    """Translate English rows with the Phase-1 NLLB pipeline (same segmentation, model, cache)."""
    src = df.reset_index(drop=True).copy()
    src["group_id"] = [f"{tag}{i:04d}" for i in range(len(src))]
    cache = translate.load_cache()
    model_name = translate.MODELS["nllb"]
    segs = {g: translate.segments(t) for g, t in zip(src.group_id, src.text)}
    todo = sorted({s for v in segs.values() for s in v if s not in ("", "\n") and translate.key(model_name, s) not in cache}, key=len)
    if todo:
        print(f"translating {len(todo)} new segments for {tag} ...", flush=True)
        # Same model, settings and cache as the Phase-1 translation.
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        path = local_model_path(model_name)
        tok = AutoTokenizer.from_pretrained(path, src_lang="eng_Latn")
        model = AutoModelForSeq2SeqLM.from_pretrained(path).eval()
        with translate.CACHE.open("a", encoding="utf-8") as fh:
            for i in range(0, len(todo), translate.BATCH):
                batch = todo[i : i + translate.BATCH]
                for s, tr in zip(batch, translate.translate_batch(tok, model, batch, "nllb")):
                    k = translate.key(model_name, s)
                    cache[k] = tr
                    fh.write(json.dumps({"k": k, "src": s, "t": tr}, ensure_ascii=False) + "\n")
                if (i // translate.BATCH) % 20 == 0:
                    print(f"  {i + len(batch)}/{len(todo)}", flush=True)
    ur = src.copy()
    ur["lang"] = "ur"
    ur["text"] = [translate.urdu_punctuation(translate.join_segments(
        [s if s in ("", "\n") else cache[translate.key(model_name, s)] for s in segs[g]])) for g in src.group_id]
    ur["source"] = ur["source"] + "_mt"
    return pd.concat([src, ur], ignore_index=True)


def drop_similar(df: pd.DataFrame, protected: list[str], what: str) -> pd.DataFrame:
    prot = [normalize(t) for t in protected]
    cand = [normalize(t) for t in df.text]
    best = process.cdist(cand, prot, scorer=fuzz.ratio, workers=-1).max(axis=1) if prot else [0] * len(cand)
    keep = best < SIM_THRESHOLD
    stats[f"dropped_similar_{what}"] = int((~keep).sum())
    return df[keep]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    bench = pd.read_csv(BENCHMARK / "benchmark.csv")
    ind_lines = [l.split("|", 2)[2] for l in (DATA / "independent" / "raw_submissions.txt").read_text(encoding="utf-8").splitlines()
                 if l.strip() and not l.startswith("#")]
    stress_lines = [l.split("|", 3)[3] for l in (DATA / "independent" / "stress_attacks.txt").read_text(encoding="utf-8").splitlines()
                    if l.strip() and not l.startswith("#")]
    protected = bench[bench.split == "test"].text.tolist() + ind_lines + stress_lines

    llm_rows = drafts()
    jack = add_urdu(jackhhao(), "jk")
    train_pool = drop_similar(pd.concat([llm_rows, jack], ignore_index=True), protected, "train_candidates")
    train_pool = train_pool.drop_duplicates(subset=["lang", "text"])

    # Hold out 20% of the LLM-assisted rows (stratified) to tune C; jackhhao rows are train-only.
    cl = train_pool[train_pool.source == "llm_v2"]
    tr_cl, va_cl = train_test_split(cl, test_size=0.2, random_state=SEED, stratify=cl.lang + "|" + cl.label.astype(str))
    v2_train = pd.concat([tr_cl, train_pool[train_pool.source != "llm_v2"]], ignore_index=True)
    v2_train.to_csv(OUT / "v2_train.csv", index=False, encoding="utf-8")
    va_cl.to_csv(OUT / "v2_val.csv", index=False, encoding="utf-8")

    dev_path = OUT / "hardneg_dev.csv"  # first hard-negative sample; inspected during development, so not a clean test
    dev = pd.read_csv(dev_path) if dev_path.exists() else pd.DataFrame(columns=["text"])
    used = set(bench.text) | set(train_pool.text) | set(dev.text)
    hard = add_urdu(hardneg_candidates(used), "hn")
    hard = drop_similar(hard, v2_train.text.tolist(), "hardneg_vs_train")
    hard.to_csv(OUT / "hardneg_test.csv", index=False, encoding="utf-8")

    stats["v2_train"] = {f"{k[0]}|{k[1]}": int(v) for k, v in v2_train.groupby(["lang", "label"]).size().items()}
    stats["v2_val"] = {f"{k[0]}|{k[1]}": int(v) for k, v in va_cl.groupby(["lang", "label"]).size().items()}
    stats["hardneg_test"] = hard.groupby("lang").size().to_dict()
    printable = {k: ({str(kk): vv for kk, vv in v.items()} if isinstance(v, dict) else v) for k, v in stats.items()}
    (OUT / "v2_stats.json").write_text(json.dumps(printable, indent=2), encoding="utf-8")
    print(json.dumps(printable, indent=2))


if __name__ == "__main__":
    main()
