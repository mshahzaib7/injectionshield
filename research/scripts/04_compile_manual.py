"""Phase 1, step 4: compile LLM-assisted Roman Urdu / code-mixed drafts into the manual CSVs.

Drafts live in data/manual/drafts/{lang}_{split}_{nn}.txt, one "group_id|text" per line.
Labels are NEVER typed by hand: they are looked up from data/manual/to_write.csv.

Output: data/manual/{lang}_{split}_{nn}.csv with columns
        group_id, lang, text, label, author, verified
Prints any missing / unknown / duplicate group_ids so gaps are visible.
"""
from __future__ import annotations

import re
import sys

import pandas as pd

from common import MANUAL

DRAFTS = MANUAL / "drafts"
NAME = re.compile(r"^(roman_ur|code_mixed)_(test|train)_(\d+)\.txt$")


def main() -> int:
    want = pd.read_csv(MANUAL / "to_write.csv")
    label_of = dict(zip(want.group_id, want.label))
    split_of = dict(zip(want.group_id, want.split))
    problems = 0
    seen: dict[tuple[str, str], str] = {}

    for path in sorted(DRAFTS.glob("*.txt")):
        m = NAME.match(path.name)
        if not m:
            print(f"skip unrecognised draft file: {path.name}")
            continue
        lang, split, _ = m.groups()
        rows = []
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                continue
            gid, sep, text = line.partition("|")
            gid, text = gid.strip(), text.strip()
            if not sep or not text:
                print(f"{path.name}:{n} malformed or empty line")
                problems += 1
                continue
            if gid not in label_of:
                print(f"{path.name}:{n} unknown group_id {gid}")
                problems += 1
                continue
            if split_of[gid] != split:
                print(f"{path.name}:{n} {gid} belongs to split {split_of[gid]}, not {split}")
                problems += 1
                continue
            if (lang, gid) in seen:
                print(f"{path.name}:{n} duplicate {lang} {gid} (also in {seen[(lang, gid)]})")
                problems += 1
                continue
            seen[(lang, gid)] = path.name
            rows.append({"group_id": gid, "lang": lang, "text": text, "label": int(label_of[gid]),
                         "author": "llm_assisted", "verified": False})
        pd.DataFrame(rows).to_csv(MANUAL / path.with_suffix(".csv").name, index=False, encoding="utf-8")

    for lang in ("roman_ur", "code_mixed"):
        for split in ("test", "train"):
            ids = set(want[want.split == split].group_id)
            done = {g for (l, g) in seen if l == lang and g in ids}
            missing = sorted(ids - done)
            print(f"{lang:10s} {split:5s}: {len(done)}/{len(ids)} written"
                  + (f"; missing: {' '.join(missing[:20])}{' ...' if len(missing) > 20 else ''}" if missing else ""))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
