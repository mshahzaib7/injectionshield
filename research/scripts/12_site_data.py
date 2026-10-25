"""Phase 4: small data files for the website (read at build time; nothing is typed by hand).

  public/data/dataset_examples.json  every language version of a few hand-picked test prompts
  public/data/REPORT.md              copy of research/REPORT.md for the download link
"""
from __future__ import annotations

import json
import shutil

import pandas as pd

from common import BENCHMARK, LANGS, PUBLIC_DATA, RESEARCH

# Hand-picked test prompts that exist in all four languages: two attacks, one benign.
EXAMPLE_GROUPS = ["g00030", "g01287", "g00418"]


def main() -> None:
    bench = pd.read_csv(BENCHMARK / "benchmark.csv")
    examples = []
    for gid in EXAMPLE_GROUPS:
        rows = bench[bench.group_id == gid].set_index("lang")
        missing = [l for l in LANGS if l not in rows.index]
        if missing:
            raise SystemExit(f"{gid} lacks {missing}; pick another example")
        examples.append({"group_id": gid, "label": "attack" if rows.label.iloc[0] == 1 else "benign",
                         "texts": {l: rows.loc[l, "text"] for l in LANGS}})
    (PUBLIC_DATA / "dataset_examples.json").write_text(json.dumps({"examples": examples}, ensure_ascii=False, indent=1),
                                                       encoding="utf-8")
    shutil.copy(RESEARCH / "REPORT.md", PUBLIC_DATA / "REPORT.md")
    print(f"wrote dataset_examples.json ({len(examples)} examples) and REPORT.md")


if __name__ == "__main__":
    main()
