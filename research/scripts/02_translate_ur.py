"""Phase 1, step 4: machine-translate English prompts to Urdu script with NLLB-200 (local, CPU).

- Model: facebook/nllb-200-distilled-600M (eng_Latn -> urd_Arab). Fallback: Helsinki-NLP/opus-mt-en-ur.
- Each prompt is split into lines and sentences; segments are translated in length-sorted batches.
- Every segment translation is cached in data/processed/translation_cache.jsonl, so re-runs are instant
  and an interrupted run resumes where it stopped.

Usage: python scripts/02_translate_ur.py [--limit N] [--model nllb|opus]
Output: data/processed/ur_translations.csv (group_id, text_ur, model)
"""
from __future__ import annotations

import common  # noqa: F401  -- must come first: sets HF_HOME before Hugging Face libraries load

import argparse
import hashlib
import json
import os
import re
import time

import pandas as pd
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

from common import PROCESSED, local_model_path

MODELS = {
    "nllb": "facebook/nllb-200-distilled-600M",
    "opus": "Helsinki-NLP/opus-mt-en-ur",
}
CACHE = PROCESSED / "translation_cache.jsonl"
BATCH = 16
# Greedy decoding: ~3x faster than beam=4 on CPU with near-identical output on these short prompts
# (benchmarked: 2.4 vs 0.7 segments/s on 8 threads). See DECISIONS.md D-106.
NUM_BEAMS = 1
torch.set_num_threads(os.cpu_count() or 4)

_SENT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])")


def segments(text: str) -> list[str]:
    """Split into lines, then sentences. Empty lines are kept as '' to preserve layout."""
    out: list[str] = []
    # Some deepset prompts contain a literal backslash-n instead of a newline; NLLB tends to silently drop
    # whatever follows it (often the injected instruction), so split on it as a line break too.
    text = text.replace("\\n", "\n")
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            out.append("")
            continue
        out.extend(s.strip() for s in _SENT.split(line) if s.strip())
        out.append("\n")
    return out


def key(model: str, seg: str) -> str:
    return hashlib.sha1(f"{model}\x00{seg}".encode("utf-8")).hexdigest()


def load_cache() -> dict[str, str]:
    cache: dict[str, str] = {}
    if CACHE.exists():
        for line in CACHE.read_text(encoding="utf-8").splitlines():
            if line.strip():
                rec = json.loads(line)
                cache[rec["k"]] = rec["t"]
    return cache


def translate_batch(tok, model, segs: list[str], model_key: str) -> list[str]:
    enc = tok(segs, return_tensors="pt", padding=True, truncation=True, max_length=256)
    kwargs = dict(num_beams=NUM_BEAMS, max_new_tokens=int(enc["input_ids"].shape[1] * 2.5) + 16)
    if model_key == "nllb":
        kwargs["forced_bos_token_id"] = tok.convert_tokens_to_ids("urd_Arab")
    with torch.inference_mode():
        out = model.generate(**enc, **kwargs)
    return tok.batch_decode(out, skip_special_tokens=True)


_UR_FULLSTOP = re.compile(r"(?<=[؀-ۿ])\s*\.(?=\s|$)")
_UR_QUESTION = re.compile(r"(?<=[؀-ۿ])\s*\?")


def urdu_punctuation(text: str) -> str:
    """NLLB often emits Latin '.' and '?' after Urdu words; proper Urdu uses '۔' and '؟'."""
    return _UR_QUESTION.sub("؟", _UR_FULLSTOP.sub("۔", text))


def join_segments(parts: list[str]) -> str:
    text, line = [], []
    for p in parts:
        if p == "\n":
            text.append(" ".join(line))
            line = []
        elif p == "":
            text.append("")
        else:
            line.append(p)
    if line:
        text.append(" ".join(line))
    return "\n".join(text).strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--model", choices=list(MODELS), default="nllb")
    args = ap.parse_args()

    base = pd.read_csv(PROCESSED / "base_en.csv")
    if args.limit:
        base = base.head(args.limit)

    model_name = MODELS[args.model]
    cache = load_cache()
    seg_lists = {r.group_id: segments(r.text) for r in base.itertuples()}
    todo = sorted(
        {s for segs in seg_lists.values() for s in segs if s not in ("", "\n") and key(model_name, s) not in cache},
        key=len,
    )
    print(f"{len(base)} prompts, {len(todo)} uncached segments, model={model_name}")

    if todo:
        try:  # prefer the already-downloaded local snapshot (works offline)
            path = local_model_path(model_name)
        except Exception:
            path = model_name
        tok = AutoTokenizer.from_pretrained(path, src_lang="eng_Latn") if args.model == "nllb" \
            else AutoTokenizer.from_pretrained(path)
        model = AutoModelForSeq2SeqLM.from_pretrained(path).eval()
        t0 = time.time()
        with CACHE.open("a", encoding="utf-8") as fh:
            for i in range(0, len(todo), BATCH):
                batch = todo[i : i + BATCH]
                for seg, tr in zip(batch, translate_batch(tok, model, batch, args.model)):
                    k = key(model_name, seg)
                    cache[k] = tr
                    fh.write(json.dumps({"k": k, "src": seg, "t": tr}, ensure_ascii=False) + "\n")
                fh.flush()
                done = i + len(batch)
                if done % (BATCH * 10) == 0 or done == len(todo):
                    rate = done / (time.time() - t0)
                    print(f"  {done}/{len(todo)} segments  {rate:.2f} seg/s  eta {(len(todo) - done) / rate / 60:.1f} min",
                          flush=True)

    rows = []
    for gid, segs in seg_lists.items():
        parts = [s if s in ("", "\n") else cache[key(model_name, s)] for s in segs]
        rows.append({"group_id": gid, "text_ur": urdu_punctuation(join_segments(parts)), "model": model_name})
    out = pd.DataFrame(rows)
    if not args.limit:
        out.to_csv(PROCESSED / "ur_translations.csv", index=False, encoding="utf-8")
    print(out.head(5).to_string())


if __name__ == "__main__":
    main()
