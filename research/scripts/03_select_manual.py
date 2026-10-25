"""Phase 1, step 4: choose the source prompts that get Roman Urdu and code-mixed versions.

Both languages use the SAME group_ids, so the paired "language-switch" analysis compares
identical attacks across en / ur / roman_ur / code_mixed.

  test : up to 200 prompts (100 attack / 100 benign)
  train: up to 300 prompts (150 attack / 150 benign)

Only prompts of <= 300 characters are eligible (hand-writing long prompts is impractical);
this selection bias is disclosed in DATA_CARD.md.

Output: data/manual/to_write.csv (group_id, split, label, source, text)
"""
from __future__ import annotations

import pandas as pd

from common import MANUAL, PROCESSED, SEED

MAX_CHARS = 300
PER_LABEL = {"test": 100, "train": 150}


def main() -> None:
    base = pd.read_csv(PROCESSED / "base_en.csv")
    picks = []
    for split, n in PER_LABEL.items():
        for label in (1, 0):
            pool = base[(base.split == split) & (base.label == label) & (base.text.str.len() <= MAX_CHARS)]
            picks.append(pool.sample(n=min(n, len(pool)), random_state=SEED))
    out = pd.concat(picks).sort_values(["split", "group_id"])
    out[["group_id", "split", "label", "source", "text"]].to_csv(MANUAL / "to_write.csv", index=False, encoding="utf-8")
    print(out.groupby(["split", "label", "source"]).size())


if __name__ == "__main__":
    main()
