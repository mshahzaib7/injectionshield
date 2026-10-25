"""Phase 1, steps 5-7: assemble the benchmark, run quality checks, build the human-review sample.

Inputs : data/processed/base_en.csv, data/processed/ur_translations.csv, data/manual/*_{test,train}_*.csv,
         optionally data/manual/verify_sample.csv (after human review)
Outputs: data/benchmark/benchmark.csv         all rows (group_id, split, lang, label, text, source, origin, verified)
         data/processed/qc_flags.csv          rows flagged by quality checks
         results/dataset_counts.json          split x lang x label counts (feeds DATA_CARD.md and the website)
         data/manual/verify_sample.csv        60 non-English rows for human review (created once, never overwritten)

Human review: in verify_sample.csv set ok = y / n. For n, put a corrected text in fixed_text (or leave it empty
to drop the row). Re-running this script applies the fixes and marks reviewed rows verified=true, both in the
benchmark and in the manual/ur source files.
"""
from __future__ import annotations

import json
import re

import pandas as pd

from common import BENCHMARK, MANUAL, PROCESSED, RESULTS, SEED, has_arabic_script

VERIFY = MANUAL / "verify_sample.csv"
UR_FILE = PROCESSED / "ur_translations.csv"
MANUAL_FILES = sorted(p for p in MANUAL.glob("*.csv") if re.match(r"^(roman_ur|code_mixed)_(test|train)_\d+\.csv$", p.name))
SAMPLE_PER_LANG = 20
REPEAT = re.compile(r"(\b\S+\b)(?:\s+\1\b){3,}")  # same token 4+ times in a row = likely MT hallucination loop


def load_rows() -> pd.DataFrame:
    base = pd.read_csv(PROCESSED / "base_en.csv")
    meta = base.set_index("group_id")[["split", "source", "label"]]
    frames = [base.assign(lang="en", origin="original", verified=True)]

    ur = pd.read_csv(UR_FILE)
    if "verified" not in ur.columns:
        ur["verified"] = False
    ur = ur.rename(columns={"text_ur": "text"}).join(meta, on="group_id")
    frames.append(ur.assign(lang="ur", origin="mt_nllb200_distilled_600m"))

    for path in MANUAL_FILES:
        m = pd.read_csv(path)
        m = m.drop(columns=["label"]).join(meta, on="group_id")
        frames.append(m.assign(origin="llm_assisted"))

    cols = ["group_id", "split", "lang", "label", "text", "source", "origin", "verified"]
    df = pd.concat([f[cols] for f in frames], ignore_index=True)
    df["text"] = df["text"].fillna("").astype(str)
    df["verified"] = df["verified"].astype(bool)
    return df


def quality_flags(df: pd.DataFrame) -> pd.DataFrame:
    en_len = df[df.lang == "en"].set_index("group_id")["text"].str.len()
    flags = []
    for r in df.itertuples():
        reasons = []
        t = r.text.strip()
        if not t:
            reasons.append("empty")
        if r.lang == "ur" and not has_arabic_script(t):
            reasons.append("ur_without_arabic_script")
        if r.lang in ("roman_ur", "code_mixed") and has_arabic_script(t):
            reasons.append("roman_with_arabic_script")
        if r.lang != "en" and t:
            ratio = len(t) / max(1, en_len.get(r.group_id, len(t)))
            if ratio < 0.4:
                reasons.append(f"suspiciously_short(ratio={ratio:.2f})")
            elif ratio > 3.0:
                reasons.append(f"suspiciously_long(ratio={ratio:.2f})")
            if REPEAT.search(t):
                reasons.append("repetition_loop")
        if reasons:
            flags.append({"group_id": r.group_id, "lang": r.lang, "split": r.split, "reasons": ";".join(reasons),
                          "text": t})
    return pd.DataFrame(flags, columns=["group_id", "lang", "split", "reasons", "text"])


def apply_review(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Apply verify_sample.csv decisions to the benchmark and persist verified flags to the source files."""
    if not VERIFY.exists():
        return df, {}
    rev = pd.read_csv(VERIFY, dtype=str).fillna("")
    rev["ok"] = rev["ok"].str.strip().str.lower()
    done = rev[rev.ok.isin(["y", "n"])]
    summary = {"reviewed": int(len(done)), "ok": int((done.ok == "y").sum()),
               "fixed": int(((done.ok == "n") & (done.fixed_text.str.strip() != "")).sum()),
               "dropped": int(((done.ok == "n") & (done.fixed_text.str.strip() == "")).sum())}
    drop_keys = set()
    for r in done.itertuples():
        mask = (df.group_id == r.group_id) & (df.lang == r.lang)
        if r.ok == "n" and not r.fixed_text.strip():
            drop_keys.add((r.group_id, r.lang))
            continue
        if r.ok == "n":
            df.loc[mask, "text"] = r.fixed_text.strip()
        df.loc[mask, "verified"] = True
    if drop_keys:
        df = df[~df.apply(lambda x: (x.group_id, x.lang) in drop_keys, axis=1)]

    # Persist to the source files so the fixes survive any re-run.
    fixes = {(r.group_id, r.lang): r for r in done.itertuples()}
    ur = pd.read_csv(UR_FILE)
    if "verified" not in ur.columns:
        ur["verified"] = False
    for i, row in ur.iterrows():
        r = fixes.get((row.group_id, "ur"))
        if r is not None and not (r.ok == "n" and not r.fixed_text.strip()):
            if r.ok == "n":
                ur.at[i, "text_ur"] = r.fixed_text.strip()
            ur.at[i, "verified"] = True
    ur.to_csv(UR_FILE, index=False, encoding="utf-8")
    for path in MANUAL_FILES:
        m = pd.read_csv(path)
        for i, row in m.iterrows():
            r = fixes.get((row.group_id, row.lang))
            if r is not None and not (r.ok == "n" and not r.fixed_text.strip()):
                if r.ok == "n":
                    m.at[i, "text"] = r.fixed_text.strip()
                m.at[i, "verified"] = True
        m.to_csv(path, index=False, encoding="utf-8")
    return df, summary


def build_verify_sample(df: pd.DataFrame) -> None:
    if VERIFY.exists():
        print(f"{VERIFY.name} already exists - not overwriting (it may contain your review).")
        return
    en = df[df.lang == "en"].set_index("group_id")["text"]
    parts = []
    for lang in ("ur", "roman_ur", "code_mixed"):
        for label in (1, 0):  # half attacks, half benign per language
            pool = df[(df.lang == lang) & (df.split == "test") & (df.label == label)]
            parts.append(pool.sample(n=min(SAMPLE_PER_LANG // 2, len(pool)), random_state=SEED))
    s = pd.concat(parts).sample(frac=1.0, random_state=SEED)
    out = pd.DataFrame({
        "sample_id": range(1, len(s) + 1),
        "group_id": s.group_id.values,
        "lang": s.lang.values,
        "label": s.label.map({1: "attack", 0: "benign"}).values,
        "english_original": s.group_id.map(en).values,
        "text": s.text.values,
        "ok": "",
        "fixed_text": "",
    })
    out.to_csv(VERIFY, index=False, encoding="utf-8-sig")  # BOM so Excel shows Urdu correctly
    print(f"wrote {VERIFY} ({len(out)} rows)")


def main() -> None:
    df = load_rows()
    df, review = apply_review(df)

    flags = quality_flags(df)
    flags.to_csv(PROCESSED / "qc_flags.csv", index=False, encoding="utf-8")
    # Machine-translated rows that are loops or much shorter than the source have lost content, often the
    # injected instruction itself, which would leave a benign-looking text labelled "attack". Drop them.
    # (Hand-written rows keep soft flags: e.g. "baar baar baar baar" is a faithful "again and again".)
    mt_loss = flags.lang.eq("ur") & flags.reasons.str.contains("repetition_loop|suspiciously_short")
    hard = flags[flags.reasons.str.contains("empty|ur_without_arabic_script|roman_with_arabic_script") | mt_loss]
    if len(hard):
        keys = set(zip(hard.group_id, hard.lang))
        df = df[~df.apply(lambda x: (x.group_id, x.lang) in keys, axis=1)]

    df = df.sort_values(["split", "group_id", "lang"]).reset_index(drop=True)
    df.to_csv(BENCHMARK / "benchmark.csv", index=False, encoding="utf-8")

    counts = df.groupby(["split", "lang", "label"]).size()
    nested: dict = {}
    for (split, lang, label), n in counts.items():
        nested.setdefault(split, {}).setdefault(lang, {})["attack" if label == 1 else "benign"] = int(n)
    report = {
        "total_rows": int(len(df)),
        "unique_groups": int(df.group_id.nunique()),
        "counts": nested,
        "by_source": {k: int(v) for k, v in df[df.lang == "en"].groupby("source").size().items()},
        "verified_rows": int(df.verified.sum() - (df.lang == "en").sum()),
        "qc": {"flagged": int(len(flags)), "dropped_hard_failures": int(len(hard)),
               "by_reason": flags.reasons.str.split(";").explode().str.replace(r"\(.*\)", "", regex=True)
               .value_counts().to_dict()},
        "review": review,
    }
    (RESULTS / "dataset_counts.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))

    # Leakage guard: every group lives in exactly one split.
    assert df.groupby("group_id").split.nunique().max() == 1, "group_id leaks across splits"
    build_verify_sample(df)


if __name__ == "__main__":
    main()
