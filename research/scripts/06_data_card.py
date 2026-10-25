"""Fill the Counts section of DATA_CARD.md from results/dataset_counts.json (never typed by hand)."""
from __future__ import annotations

import json
import re

from common import LANGS, REPO, RESULTS

CARD = REPO / "DATA_CARD.md"


def table(counts: dict) -> str:
    lines = ["| Split | Language | Attack | Benign | Total |", "|---|---|---:|---:|---:|"]
    for split in ("train", "val", "test"):
        for lang in LANGS:
            c = counts.get(split, {}).get(lang)
            if not c:
                continue
            a, b = c.get("attack", 0), c.get("benign", 0)
            lines.append(f"| {split} | `{lang}` | {a} | {b} | {a + b} |")
    return "\n".join(lines)


def main() -> None:
    rep = json.loads((RESULTS / "dataset_counts.json").read_text(encoding="utf-8"))
    src = "\n".join(f"| {k} | {v} |" for k, v in rep["by_source"].items())
    qc = rep["qc"]
    review = rep.get("review") or {}
    body = (
        f"Total rows: **{rep['total_rows']}** across **{rep['unique_groups']}** source prompts (groups).\n\n"
        f"{table(rep['counts'])}\n\n"
        f"English source prompts by origin:\n\n| Source | Prompts |\n|---|---:|\n{src}\n\n"
        f"Quality checks: {qc['flagged']} rows flagged, {qc['dropped_hard_failures']} dropped as hard failures "
        f"(see `research/data/processed/qc_flags.csv`).\n\n"
        + (f"Review (performed by Claude at the author's request, not by a native speaker): {review.get('reviewed', 0)} rows — {review.get('ok', 0)} accepted as-is, "
           f"{review.get('fixed', 0)} corrected, {review.get('dropped', 0)} dropped. "
           f"Verified non-English rows: {rep['verified_rows']}.\n" if review else
           "Review: pending (`research/data/manual/verify_sample.csv`).\n")
    )
    text = CARD.read_text(encoding="utf-8")
    text = re.sub(r"<!-- COUNTS:START -->.*?<!-- COUNTS:END -->",
                  lambda _: f"<!-- COUNTS:START -->\n{body}<!-- COUNTS:END -->", text, flags=re.S)
    CARD.write_text(text, encoding="utf-8")
    print(body)


if __name__ == "__main__":
    main()
