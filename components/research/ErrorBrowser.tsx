"use client";

import { useId, useState } from "react";

interface Example {
  group_id: string;
  text: string;
  english: string;
  score: number;
}
type Sample = Record<string, Partial<Record<string, { bypass: Example[]; false_positive: Example[] }>>>;

export function ErrorBrowser({
  sample,
  detectors,
  languages,
  perCategory,
}: {
  sample: Sample;
  detectors: { key: string; label: string }[];
  languages: { key: string; label: string }[];
  perCategory: number;
}) {
  const [det, setDet] = useState(detectors[0]?.key ?? "");
  const [lang, setLang] = useState(languages[1]?.key ?? languages[0]?.key ?? "");
  const [kind, setKind] = useState<"bypass" | "false_positive">("bypass");
  const id = useId();
  const list = sample[det]?.[lang]?.[kind] ?? [];

  const select = "mt-1 block w-full rounded-xl border-2 border-line bg-surface px-3 py-2 text-sm font-semibold";
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-bold uppercase tracking-[0.16em]" htmlFor={`${id}-d`}>
          Detector
          <select id={`${id}-d`} className={select} value={det} onChange={(e) => setDet(e.target.value)}>
            {detectors.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-[0.16em]" htmlFor={`${id}-l`}>
          Language
          <select id={`${id}-l`} className={select} value={lang} onChange={(e) => setLang(e.target.value)}>
            {languages.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-[0.16em]" htmlFor={`${id}-k`}>
          Error type
          <select
            id={`${id}-k`}
            className={select}
            value={kind}
            onChange={(e) => setKind(e.target.value as "bypass" | "false_positive")}
          >
            <option value="bypass">Missed attacks (bypasses)</option>
            <option value="false_positive">False alarms on harmless text</option>
          </select>
        </label>
      </div>
      <p className="mt-3 text-sm text-muted" aria-live="polite">
        {list.length === 0
          ? "No errors of this type for this detector and language."
          : `Showing ${list.length} example${list.length > 1 ? "s" : ""} (up to ${perCategory} per category).`}
      </p>
      <ul className="mt-3 space-y-3">
        {list.map((ex) => (
          <li key={ex.group_id} className="rounded-xl border-2 border-line-soft bg-surface p-4">
            <p dir="auto" className="whitespace-pre-wrap break-words leading-loose">
              {ex.text}
            </p>
            {lang !== "en" && ex.english && (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">
                <span className="font-semibold">English original:</span> {ex.english}
              </p>
            )}
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em]">Score {Math.round(ex.score * 100)}/100</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
