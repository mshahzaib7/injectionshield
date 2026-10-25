"""Fill the "Key findings" section of the root README.md from results/summary.json (never typed by hand)."""
from __future__ import annotations

import json
import re

from common import REPO, RESULTS

README = REPO / "README.md"


def main() -> None:
    s = json.loads((RESULTS / "summary.json").read_text(encoding="utf-8"))
    lines = ["| Finding | Value | Detail |", "|---|---|---|"]
    lines += [f"| {c['label']} | **{c['value']}** | {c['detail']} |" for c in s["cards"]]
    lines.append("")
    lines += [f"- **{f['rq']} · {f['title']}.** {f['statement']}" for f in s["findings"]]
    lines += ["", f"_{s['note']}_", ""]
    body = "\n".join(lines)
    text = README.read_text(encoding="utf-8")
    text = re.sub(r"<!-- FINDINGS:START -->.*?<!-- FINDINGS:END -->",
                  lambda _: f"<!-- FINDINGS:START -->\n{body}<!-- FINDINGS:END -->", text, flags=re.S)
    README.write_text(text, encoding="utf-8")
    print(f"README findings updated ({len(s['findings'])} findings)")


if __name__ == "__main__":
    main()
