"""Shared paths and helpers for the InjectionShield research pipeline."""
from __future__ import annotations

import os
import re
import unicodedata
from pathlib import Path

RESEARCH = Path(__file__).resolve().parent.parent
REPO = RESEARCH.parent
DATA = RESEARCH / "data"
RAW = DATA / "raw"
PROCESSED = DATA / "processed"
MANUAL = DATA / "manual"
BENCHMARK = DATA / "benchmark"
RESULTS = RESEARCH / "results"
PUBLIC_DATA = REPO / "public" / "data"
PUBLIC_MODEL = REPO / "public" / "model"

# Keep Hugging Face downloads inside the repo (git-ignored) so the pipeline is self-contained.
os.environ.setdefault("HF_HOME", str(RESEARCH / ".hf_cache"))
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")

SEED = 42
LANGS = ["en", "ur", "roman_ur", "code_mixed"]

for _d in (RAW, PROCESSED, MANUAL, BENCHMARK, RESULTS, PUBLIC_DATA, PUBLIC_MODEL):
    _d.mkdir(parents=True, exist_ok=True)

_WS = re.compile(r"\s+")


def normalize(text: str) -> str:
    """Canonical form used for deduplication only (not for model input)."""
    return _WS.sub(" ", unicodedata.normalize("NFKC", str(text))).strip().lower()


ARABIC_SCRIPT = re.compile(r"[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]")


def has_arabic_script(text: str) -> bool:
    return bool(ARABIC_SCRIPT.search(str(text)))


def local_model_path(repo_id: str) -> str:
    """Folder of an already-downloaded Hugging Face model (offline). Raises if it was never downloaded.

    Only the files we need are downloaded (e.g. no ONNX copies), so snapshot_download(local_files_only=True)
    would wrongly report the snapshot as incomplete; locating config.json is enough.
    """
    from huggingface_hub import hf_hub_download

    return str(Path(hf_hub_download(repo_id, "config.json", local_files_only=True)).parent)
