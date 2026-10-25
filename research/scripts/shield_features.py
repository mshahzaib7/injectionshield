r"""Text preprocessing and analyzers shared by D2 (baseline) and D3 (InjectionShield-Lite).

Everything here is deliberately simple and fully specified, because lib/detector.ts must reproduce it
exactly (Phase 3 parity test, tolerance 1e-4). Rules:

  preprocess(text): Unicode NFKC -> str.lower() -> every run of whitespace becomes one ' ' -> strip.
  word_analyzer   : tokens = maximal runs of Unicode letters/numbers (categories L*, N*); features are
                    unigrams and space-joined bigrams of those tokens.          (JS: /[\p{L}\p{N}]+/gu)
  char_wb_analyzer: identical to scikit-learn's analyzer="char_wb" with ngram_range=(2, 5): each
                    space-separated word is padded with one space on each side, and all character
                    n-grams of length 2..5 inside the padded word are emitted (a word shorter than n
                    yields itself once). Lengths are counted in Unicode code points (JS: Array.from).
"""
from __future__ import annotations

import re
import unicodedata

# Explicit whitespace set (identical in TypeScript) rather than relying on each language's "\s".
WHITESPACE = re.compile(
    "[ \t\n\r\f\v\u0085   -     　﻿\u001c-\u001f]+"
)
CHAR_NGRAM = (2, 5)
WORD_NGRAM = (1, 2)


def preprocess(text: str) -> str:
    text = unicodedata.normalize("NFKC", str(text)).lower()
    return WHITESPACE.sub(" ", text).strip()


def _is_word_char(ch: str) -> bool:
    return unicodedata.category(ch)[0] in ("L", "N")


def word_tokens(text: str) -> list[str]:
    tokens, cur = [], []
    for ch in text:
        if _is_word_char(ch):
            cur.append(ch)
        elif cur:
            tokens.append("".join(cur))
            cur = []
    if cur:
        tokens.append("".join(cur))
    return tokens


def word_analyzer(text: str) -> list[str]:
    toks = word_tokens(preprocess(text))
    feats = list(toks)
    if WORD_NGRAM[1] >= 2:
        feats.extend(f"{a} {b}" for a, b in zip(toks, toks[1:]))
    return feats


def char_wb_analyzer(text: str) -> list[str]:
    lo, hi = CHAR_NGRAM
    grams: list[str] = []
    for w in preprocess(text).split(" "):
        if not w:
            continue
        w = f" {w} "
        w_len = len(w)
        for n in range(lo, hi + 1):
            offset = 0
            grams.append(w[offset : offset + n])
            while offset + n < w_len:
                offset += 1
                grams.append(w[offset : offset + n])
            if offset == 0:  # word shorter than n: counted once, longer n would repeat it
                break
    return grams
