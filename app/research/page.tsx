import type { Metadata } from "next";
import Link from "next/link";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorBrowser } from "@/components/research/ErrorBrowser";
import { MetricChart, type ChartRow, type ChartSeries } from "@/components/research/MetricChart";
import { Container, Pending, pct } from "@/components/ui";
import {
  getDatasetCounts,
  getErrorSample,
  getIndependent,
  getMetrics,
  getSummary,
  LANG_LABEL,
  LANG_ORDER,
  type Interval,
  type LangKey,
  type Metrics,
} from "@/lib/data";

export const metadata: Metadata = {
  title: "Research",
  description:
    "A four-language benchmark for prompt-injection detection in English, Urdu, Roman Urdu and code-mixed text: findings, charts with 95% confidence intervals, and full results.",
};

/** The three systems the story is about; every other configuration is in "Full results". */
const STORY = ["protectai", "baseline", "shield_lite_v2"] as const;
const COLOR: Record<string, ChartSeries["colorIndex"]> = { protectai: 1, baseline: 2, shield_lite_v2: 3 };
/** Findings shown up front (by generated title prefix); all findings remain under "Full results". */
const KEY_FINDINGS = [
  "D1: detection rate by language",
  "D1: language-switch bypass",
  "D1: false alarms on harmless text",
  "D1: false alarms confirmed on independently written Urdu",
];

const toPct = (x: number | null | undefined) => (x === null || x === undefined ? null : +(100 * x).toFixed(2));
const err = (x: number | null | undefined, ci: Interval): [number, number] | null =>
  x === null || x === undefined || !ci ? null : [+(100 * (x - ci[0])).toFixed(2), +(100 * (ci[1] - x)).toFixed(2)];
const fci = (x: number | null | undefined, ci: Interval | undefined) =>
  x === null || x === undefined ? "–" : ci ? `${pct(x)} [${(100 * ci[0]).toFixed(1)}–${(100 * ci[1]).toFixed(1)}]` : pct(x);

function rowsFor(m: Metrics, langs: LangKey[], keys: string[], pick: (key: string, lang: LangKey) => [number | null, Interval]) {
  return langs.map((lang) => {
    const row: ChartRow = { lang: LANG_LABEL[lang] };
    for (const k of keys) {
      const [v, ci] = pick(k, lang);
      row[k] = toPct(v);
      row[`${k}_err`] = err(v, ci);
    }
    return row;
  });
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-[0.22em]">{children}</p>;
}

function SectionTitle({ eyebrow, id, children, intro }: { eyebrow: string; id: string; children: React.ReactNode; intro?: React.ReactNode }) {
  return (
    <div className="mb-10 max-w-3xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="mt-3 scroll-mt-24 font-display text-[2rem] leading-tight tracking-tight text-brand sm:text-[2.5rem]">
        {children}
      </h2>
      {intro && <p className="mt-3 text-base leading-7 sm:text-[1.0625rem]">{intro}</p>}
    </div>
  );
}

function ChartCard({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border-2 border-line bg-surface p-6">
      <h3 className="text-lg font-bold leading-snug">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted">{caption}</p>
      <div className="mt-5">
        <ErrorBoundary what="chart">{children}</ErrorBoundary>
      </div>
    </div>
  );
}

const TABLE = "w-full text-left text-sm";
const TH = "px-4 py-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] whitespace-nowrap";
const TD = "px-4 py-2.5 tabular-nums";

export default function ResearchPage() {
  const metrics = getMetrics();
  const summary = getSummary();
  const errors = getErrorSample();
  const independent = getIndependent();
  const counts = getDatasetCounts();

  const av = new Set(metrics?.detectors.filter((d) => d.available).map((d) => d.key));
  const keys = STORY.filter((k) => av.has(k));
  const nameOf = (k: string) => metrics?.detectors.find((d) => d.key === k)?.name ?? k;
  const series: ChartSeries[] = keys.map((k) => ({ key: k, name: nameOf(k), colorIndex: COLOR[k] ?? 2 }));
  const r = (k: string, l: LangKey) => metrics?.results[k]?.[l];

  const extraSentences = independent
    ? Object.values(independent.counts).reduce((s, c) => s + c.attack + c.benign, 0) +
      (independent.stress ? independent.stress.n.roman_ur + independent.stress.n.ur : 0)
    : null;
  const stats = [
    { value: counts?.total_rows.toLocaleString(), label: "Benchmark samples" },
    { value: counts?.unique_groups.toLocaleString(), label: "Paired source prompts" },
    { value: "4", label: "Languages & scripts" },
    { value: metrics ? String(av.size) : undefined, label: "Detector configurations" },
    { value: extraSentences?.toLocaleString(), label: "Extra evaluation sentences" },
    { value: metrics ? metrics.n_bootstrap.toLocaleString() : undefined, label: "Bootstrap resamples per CI" },
  ].filter((s) => s.value);

  const d1 = { en: r("protectai", "en"), ur: r("protectai", "ur"), ru: r("protectai", "roman_ur") };
  const sw = metrics?.paired.protectai?.roman_ur?.attacks;
  const v2 = { ur: r("shield_lite_v2", "ur"), ru: r("shield_lite_v2", "roman_ur"), cm: r("shield_lite_v2", "code_mixed") };
  const base = { ur: r("baseline", "ur"), ru: r("baseline", "roman_ur") };
  const keyFindings = summary?.findings.filter((f) => KEY_FINDINGS.includes(f.title)) ?? [];

  return (
    <>
      {/* ---------------- Header + scale ---------------- */}
      <header className="border-b-2 border-line">
        <Container className="py-14 sm:py-20">
          <Eyebrow>Research</Eyebrow>
          <h1 className="mt-5 max-w-4xl font-display text-[2.6rem] leading-[0.95] tracking-tight text-brand sm:text-6xl">
            A four-language benchmark for prompt-injection detection in Urdu
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 sm:text-xl">
            The same attacks and harmless prompts in English, Urdu script, Roman Urdu and Urdu-English code-mixed text, used
            to measure where today&apos;s detectors break and to build a lightweight multilingual detector that fixes it.
          </p>
        </Container>
        {stats.length > 0 && (
          <div className="border-t-2 border-line bg-surface">
            <Container>
              <dl className="grid grid-cols-2 gap-[2px] bg-line sm:grid-cols-3 lg:grid-cols-6">
                {stats.map((s) => (
                  <div key={s.label} className="bg-surface py-6 sm:px-5 [&:nth-child(odd)]:pr-4 sm:[&:nth-child(3n+1)]:pl-0 lg:[&:nth-child(3n+1)]:pl-5 lg:first:!pl-0">
                    <dd className="font-display text-[2rem] leading-none tracking-tight text-ink">{s.value}</dd>
                    <dt className="mt-2 text-[0.6875rem] font-bold uppercase leading-4 tracking-[0.14em] text-muted">{s.label}</dt>
                  </div>
                ))}
              </dl>
            </Container>
          </div>
        )}
      </header>

      {/* ---------------- The story in 30 seconds ---------------- */}
      <section aria-labelledby="story">
        <Container className="py-16 sm:py-24">
          <SectionTitle eyebrow="Summary" id="story">
            The study in 30 seconds
          </SectionTitle>
          {metrics && d1.en && d1.ur && d1.ru && v2.ur && v2.ru ? (
            <ol className="grid gap-5 lg:grid-cols-3">
              <li className="card-lift flex flex-col rounded-2xl border-2 border-line bg-surface p-6">
                <span className="font-display text-sm text-accent-ink">01 · The problem</span>
                <h3 className="mt-4 text-xl font-bold leading-snug">A widely used detector breaks on Urdu</h3>
                <ul className="mt-4 space-y-3 text-[0.9375rem] leading-7">
                  <li>
                    Catches <strong>{pct(d1.en.recall)}</strong> of English attacks but only <strong>{pct(d1.ru.recall)}</strong> in Roman
                    Urdu{sw ? <>: {pct(sw.switch_bypass_rate)} of attacks slip through just by switching language</> : null}.
                  </li>
                  <li>
                    Blocks <strong>{pct(d1.ur.fpr)}</strong> of completely harmless Urdu questions.
                  </li>
                </ul>
              </li>
              <li className="card-lift flex flex-col rounded-2xl border-2 border-line bg-surface p-6">
                <span className="font-display text-sm text-accent-ink">02 · The benchmark</span>
                <h3 className="mt-4 text-xl font-bold leading-snug">Same prompt, four languages</h3>
                <p className="mt-4 text-[0.9375rem] leading-7">
                  {counts ? <><strong>{counts.total_rows.toLocaleString()}</strong> samples built from <strong>{counts.unique_groups.toLocaleString()}</strong> prompts</> : "A paired benchmark"},
                  each one tested in every language, so differences come from language alone. Split before translation, scored with 95%
                  confidence intervals and paired significance tests.
                </p>
              </li>
              <li className="card-lift flex flex-col rounded-2xl border-2 border-line bg-ink p-6 text-bg">
                <span className="font-display text-sm">03 · The fix</span>
                <h3 className="mt-4 text-xl font-bold leading-snug">InjectionShield-Lite: 1.8 MB, runs in the browser</h3>
                <ul className="mt-4 space-y-3 text-[0.9375rem] leading-7">
                  <li>
                    Urdu attacks caught: <strong>{pct(base.ur?.recall)} → {pct(v2.ur.recall)}</strong>
                  </li>
                  <li>
                    Roman Urdu attacks caught: <strong>{pct(base.ru?.recall)} → {pct(v2.ru.recall)}</strong>
                  </li>
                  <li>
                    False alarms stay at <strong>{pct(Math.min(v2.ur.fpr ?? 1, v2.ru.fpr ?? 1, v2.cm?.fpr ?? 1))}–{pct(Math.max(v2.ur.fpr ?? 0, v2.ru.fpr ?? 0, v2.cm?.fpr ?? 0))}</strong>
                  </li>
                </ul>
                <Link
                  href="/detector/"
                  className="mt-6 inline-flex items-center gap-3 self-start rounded-full border-2 border-bg bg-bg px-5 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-ink transition-colors hover:bg-accent hover:text-on-accent"
                >
                  Try it <span aria-hidden="true" className="arrow-nudge">→</span>
                </Link>
              </li>
            </ol>
          ) : (
            <Pending />
          )}
        </Container>
      </section>

      {/* ---------------- Key charts ---------------- */}
      <section aria-labelledby="charts" className="border-y-2 border-line bg-surface">
        <Container className="py-16 sm:py-24">
          <SectionTitle
            eyebrow="Results"
            id="charts"
            intro="The open-source ProtectAI detector, an English-only baseline, and InjectionShield-Lite v2 on the same test prompts. Error bars show 95% confidence intervals."
          >
            Where detectors break, and the fix
          </SectionTitle>
          {metrics && keys.length ? (
            <div className="grid gap-5 xl:grid-cols-2">
              <ChartCard title="Attacks caught, by language" caption="Recall: higher is better.">
                <MetricChart
                  rows={rowsFor(metrics, LANG_ORDER, keys, (k, l) => [r(k, l)?.recall ?? null, r(k, l)?.ci?.recall ?? null])}
                  series={series}
                  yLabel="Recall"
                />
              </ChartCard>
              <ChartCard title="False alarms on harmless text" caption="False-positive rate: lower is better.">
                <MetricChart
                  rows={rowsFor(metrics, LANG_ORDER, keys, (k, l) => [r(k, l)?.fpr ?? null, r(k, l)?.ci?.fpr ?? null])}
                  series={series}
                  yLabel="False-positive rate"
                />
              </ChartCard>
              <ChartCard
                title="Language-switch bypass"
                caption="Of the attacks caught in English, the share missed when the same attack is in another language: lower is better."
              >
                <MetricChart
                  rows={rowsFor(metrics, ["ur", "roman_ur", "code_mixed"], keys, (k, l) => {
                    const a = metrics.paired[k]?.[l]?.attacks;
                    return [a?.switch_bypass_rate ?? null, a?.switch_bypass_ci ?? null];
                  })}
                  series={series}
                  yLabel="Bypass rate"
                />
              </ChartCard>
              {keyFindings.length > 0 && (
                <div className="flex flex-col rounded-2xl border-2 border-line bg-bg p-6">
                  <h3 className="text-lg font-bold">Key findings</h3>
                  <ul className="mt-4 space-y-4">
                    {keyFindings.map((f) => (
                      <li key={f.title} className="border-t-2 border-line-soft pt-4 text-[0.9375rem] leading-7 first:border-t-0 first:pt-0">
                        {f.statement}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <Pending />
          )}
        </Container>
      </section>

      {/* ---------------- Method ---------------- */}
      <section aria-labelledby="method">
        <Container className="py-16 sm:py-24">
          <SectionTitle eyebrow="Method" id="method">
            How the benchmark was built
          </SectionTitle>
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["01", "Collect", "English attacks and harmless prompts from public, permissively licensed datasets (deepset, Lakera Gandalf, OpenAssistant), deduplicated and balanced."],
              ["02", "Split first", "Prompts are split into train / validation / test before any translation, so no version of a test prompt is ever seen in training."],
              ["03", "Translate", "Every prompt gets Urdu-script (NLLB-200), Roman Urdu and code-mixed (LLM-assisted) versions, quality-checked and sample-reviewed."],
              ["04", "Evaluate", "Detectors are scored on recall, false alarms, F1 and ROC-AUC with 1,000-sample bootstrap CIs and paired McNemar tests."],
            ].map(([n, t, b]) => (
              <li key={n} className="card-lift flex flex-col rounded-2xl border-2 border-line bg-surface p-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-line font-display text-base text-accent-ink">
                  {n}
                </span>
                <h3 className="mt-5 text-lg font-bold">{t}</h3>
                <p className="mt-2 text-[0.9375rem] leading-7">{b}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ---------------- Full results (collapsed) ---------------- */}
      <section aria-labelledby="full" className="border-t-2 border-line">
        <Container className="py-16 sm:py-24">
          <SectionTitle
            eyebrow="Details"
            id="full"
            intro="Every number, every configuration and every additional evaluation, for readers who want to check the work."
          >
            Full results &amp; methodology
          </SectionTitle>

          <div className="space-y-4">
            {summary && (
              <details className="group rounded-2xl border-2 border-line bg-surface">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 font-bold">
                  All {summary.findings.length} findings
                  <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45">+</span>
                </summary>
                <ul className="space-y-4 border-t-2 border-line p-6">
                  {summary.findings.map((f) => (
                    <li key={f.title}>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-ink">
                        {f.rq} · {f.title}
                      </p>
                      <p className="mt-1 text-[0.9375rem] leading-7">{f.statement}</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {metrics && (
              <details className="group rounded-2xl border-2 border-line bg-surface">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 font-bold">
                  Results table: all {av.size} detector configurations × 4 languages
                  <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45">+</span>
                </summary>
                <div className="overflow-x-auto border-t-2 border-line">
                  <table className={`${TABLE} min-w-[48rem]`}>
                    <caption className="sr-only">Metrics for every detector and language on the test split</caption>
                    <thead className="border-b-2 border-line">
                      <tr>
                        {["Detector", "Language", "n", "Recall [95% CI]", "FPR [95% CI]", "Precision", "F1", "ROC-AUC"].map((h) => (
                          <th key={h} scope="col" className={TH}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.detectors
                        .filter((d) => d.available)
                        .flatMap((d) =>
                          LANG_ORDER.filter((l) => metrics.results[d.key]?.[l]).map((l, i) => {
                            const x = metrics.results[d.key]![l]!;
                            return (
                              <tr key={`${d.key}-${l}`} className={`border-b border-line-soft ${i === 0 ? "border-t-2 border-t-line-soft" : ""}`}>
                                <th scope="row" className="px-4 py-2.5 font-semibold">
                                  {i === 0 ? `${d.id} ${d.name}` : <span className="sr-only">{`${d.id} ${d.name}`}</span>}
                                </th>
                                <td className="px-4 py-2.5">{LANG_LABEL[l]}</td>
                                <td className={TD}>{x.n}</td>
                                <td className={TD}>{fci(x.recall, x.ci?.recall)}</td>
                                <td className={TD}>{fci(x.fpr, x.ci?.fpr)}</td>
                                <td className={TD}>{pct(x.precision)}</td>
                                <td className={TD}>{pct(x.f1)}</td>
                                <td className={TD}>{x.roc_auc === null ? "–" : x.roc_auc.toFixed(3)}</td>
                              </tr>
                            );
                          }),
                        )}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {independent && (
              <details className="group rounded-2xl border-2 border-line bg-surface">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 font-bold">
                  Additional evaluations: independent sentences &amp; new attack styles
                  <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45">+</span>
                </summary>
                <div className="space-y-8 border-t-2 border-line p-6">
                  <div>
                    <h3 className="font-bold">Independently written sentences</h3>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      Written separately from the benchmark and used for evaluation only. Recall / false-positive rate.
                    </p>
                    <div className="mt-4 overflow-x-auto rounded-xl border-2 border-line-soft">
                      <table className={`${TABLE} min-w-[40rem]`}>
                        <thead className="border-b-2 border-line-soft">
                          <tr>
                            <th scope="col" className={TH}>Detector</th>
                            {(["en", "ur", "roman_ur"] as const).map((l) => (
                              <th key={l} scope="col" className={TH}>
                                {LANG_LABEL[l]} (n = {independent.counts[l].attack + independent.counts[l].benign})
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(independent.detectors).map(([key, d]) => (
                            <tr key={key} className="border-b border-line-soft last:border-0">
                              <th scope="row" className="px-4 py-2.5 font-semibold">
                                {d.id} {d.name}
                              </th>
                              {(["en", "ur", "roman_ur"] as const).map((l) => (
                                <td key={l} className={TD}>
                                  {pct(d.by_lang[l].recall)} / {pct(d.by_lang[l].fpr)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {independent.stress && (
                    <div>
                      <h3 className="font-bold">New attack styles (attack-only)</h3>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {independent.stress.n.roman_ur} Roman Urdu and {independent.stress.n.ur} Urdu attacks using fake authority,
                        special modes, role-play and tool instructions. Share of attacks caught [95% CI].
                      </p>
                      <div className="mt-4 overflow-x-auto rounded-xl border-2 border-line-soft">
                        <table className={`${TABLE} min-w-[34rem]`}>
                          <thead className="border-b-2 border-line-soft">
                            <tr>
                              {["Detector", "Roman Urdu", "Urdu (script)"].map((h) => (
                                <th key={h} scope="col" className={TH}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(independent.stress.detectors).map(([key, d]) => (
                              <tr key={key} className="border-b border-line-soft last:border-0">
                                <th scope="row" className="px-4 py-2.5 font-semibold">
                                  {d.id} {d.name}
                                </th>
                                <td className={TD}>{fci(d.by_lang.roman_ur.recall, d.by_lang.roman_ur.ci)}</td>
                                <td className={TD}>{fci(d.by_lang.ur.recall, d.by_lang.ur.ci)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </details>
            )}

            {errors && metrics && (
              <details className="group rounded-2xl border-2 border-line bg-surface">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 font-bold">
                  Error examples by detector and language
                  <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45">+</span>
                </summary>
                <div className="border-t-2 border-line p-6">
                  <ErrorBoundary what="error browser">
                    <ErrorBrowser
                      sample={errors.detectors}
                      perCategory={errors.per_category}
                      detectors={metrics.detectors
                        .filter((d) => d.available && errors.detectors[d.key])
                        .map((d) => ({ key: d.key, label: `${d.id} ${d.name}` }))}
                      languages={LANG_ORDER.map((l) => ({ key: l, label: LANG_LABEL[l] }))}
                    />
                  </ErrorBoundary>
                </div>
              </details>
            )}

            <details className="group rounded-2xl border-2 border-line bg-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 font-bold">
                Scope, ethics &amp; next steps
                <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="border-t-2 border-line p-6 text-[0.9375rem] leading-7">
                <ul className="list-disc space-y-2 pl-5">
                  <li>Test sets hold about 330 English/Urdu and 200 Roman Urdu/code-mixed prompts; confidence intervals are reported for every number.</li>
                  <li>Urdu-script text is machine-translated and Roman Urdu / code-mixed text is LLM-assisted. Next step: a larger test set written by native speakers.</li>
                  <li>Next steps also include indirect injections (attacks hidden in documents and tool outputs) and more South Asian languages.</li>
                </ul>
                <p className="mt-4">
                  <strong>Ethics:</strong> defensive research using public datasets of well-known attack patterns. No new attack
                  techniques were developed and no real system was attacked. Full details are in the downloadable report.
                </p>
              </div>
            </details>
          </div>

          <ul className="mt-10 flex flex-wrap gap-3">
            {[
              ["/data/REPORT.md", "Full report"],
              ["/data/metrics.json", "All metrics (JSON)"],
              ["/data/summary.json", "Findings (JSON)"],
            ].map(([href, label]) => (
              <li key={href}>
                <a
                  href={href}
                  download
                  className="inline-flex items-center gap-2 rounded-full border-2 border-line px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] transition-colors hover:bg-ink hover:text-bg"
                >
                  <span aria-hidden="true">↓</span> {label}
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </>
  );
}
