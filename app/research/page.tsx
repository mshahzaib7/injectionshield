import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorBrowser } from "@/components/research/ErrorBrowser";
import { MetricChart, type ChartRow, type ChartSeries } from "@/components/research/MetricChart";
import { Card, Container, Eyebrow, H1, H2, Pending, pct } from "@/components/ui";
import {
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
    "Research questions, method, results with 95% confidence intervals, and limitations: how prompt-injection detectors perform on Urdu, Roman Urdu and code-mixed text.",
};

const COLOR: Record<string, ChartSeries["colorIndex"]> = { protectai: 1, baseline: 2, shield_lite_v2: 3, minilm_lr: 4 };

const toPct = (x: number | null | undefined) => (x === null || x === undefined ? null : +(100 * x).toFixed(2));
const err = (x: number | null | undefined, ci: Interval): [number, number] | null =>
  x === null || x === undefined || !ci ? null : [+(100 * (x - ci[0])).toFixed(2), +(100 * (ci[1] - x)).toFixed(2)];

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

function ChartCard({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <Card>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{caption}</p>
      <div className="mt-4">
        <ErrorBoundary what="chart">{children}</ErrorBoundary>
      </div>
    </Card>
  );
}

const fci = (x: number | null | undefined, ci: Interval) =>
  x === null || x === undefined ? "–" : ci ? `${pct(x)} [${(100 * ci[0]).toFixed(1)}–${(100 * ci[1]).toFixed(1)}]` : pct(x);

export default function ResearchPage() {
  const metrics = getMetrics();
  const summary = getSummary();
  const errors = getErrorSample();
  const independent = getIndependent();
  const main = metrics?.detectors.filter((d) => d.role === "main" && d.available) ?? [];
  const series: ChartSeries[] = main.map((d) => ({ key: d.key, name: `${d.id} ${d.name}`, colorIndex: COLOR[d.key] ?? 2 }));
  const keys = main.map((d) => d.key);

  return (
    <Container className="py-12 sm:py-16">
      <Eyebrow>Research</Eyebrow>
      <div className="mt-4 max-w-3xl">
        <H1>Do detectors fail on Urdu?</H1>
        <p className="mt-4 text-lg leading-relaxed">
          Prompt-injection detectors are trained mostly on English. We measured what happens when the same attack is
          written in Urdu script, Roman Urdu, or Urdu-English code-mixed text.
        </p>
      </div>

      <section className="mt-14" aria-labelledby="rq">
        <H2 id="rq">Research questions</H2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["RQ1", "Do detectors lose detection rate when the same attack is written in Urdu script, Roman Urdu, or code-mixed text?"],
            ["RQ2", "Do they falsely flag harmless Urdu-language text as attacks?"],
            ["RQ3", "Does a lightweight detector trained with multilingual augmented data close the gap?"],
          ].map(([id, q]) => (
            <li key={id}>
              <Card className="h-full">
                <p className="font-display text-3xl text-accent-ink">{id}</p>
                <p className="mt-2 leading-relaxed">{q}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14" aria-labelledby="findings">
        <H2 id="findings">Key findings</H2>
        {summary ? (
          <>
            {summary.status === "partial" && (
              <p className="mt-4 font-semibold">Partial results. Still pending: {summary.unavailable_detectors.join(", ")}.</p>
            )}
            <ul className="mt-6 space-y-4">
              {summary.findings.map((f) => (
                <li key={f.title} className="rounded-2xl border-2 border-line bg-surface p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">
                    {f.rq} · {f.title}
                  </p>
                  <p className="mt-2 leading-relaxed">{f.statement}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted">{summary.note}</p>
          </>
        ) : (
          <div className="mt-6">
            <Pending what="Findings" />
          </div>
        )}
      </section>

      <section className="mt-14" aria-labelledby="method">
        <H2 id="method">Method</H2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Card>
            <h3 className="font-bold">Benchmark</h3>
            <p className="mt-2 leading-relaxed">
              English prompts from public, permissively licensed datasets (deepset, Lakera Gandalf, OpenAssistant), filtered,
              deduplicated and balanced between attacks and harmless questions. The data is split into train, validation
              and test <em>before</em> translation, so no version of a test prompt is ever seen in training. Each prompt has
              versions in Urdu script (machine translation, NLLB-200), Roman Urdu and code-mixed text (LLM-assisted).
            </p>
          </Card>
          <Card>
            <h3 className="font-bold">Detectors &amp; metrics</h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
              {(metrics?.detectors ?? []).map((d) => (
                <li key={d.key}>
                  <strong>
                    {d.id} {d.name}
                  </strong>
                  {d.available ? "" : " (pending)"}: {d.description}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm leading-relaxed">
              Detection rate (recall), false-positive rate, precision, F1 and ROC-AUC at a fixed 0.5 threshold, with 95%
              confidence intervals from {metrics?.n_bootstrap ?? 1000} bootstrap resamples. <em>Language-switch bypass</em> is
              the share of attacks caught in English that are missed when the same attack is in another language.
            </p>
          </Card>
        </div>
      </section>

      <section className="mt-14" aria-labelledby="charts">
        <H2 id="charts">Results</H2>
        {metrics && main.length ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <ChartCard title="Attacks detected, by language" caption="Recall (higher is better). Error bars show 95% confidence intervals.">
              <MetricChart
                rows={rowsFor(metrics, LANG_ORDER, keys, (k, l) => [metrics.results[k]?.[l]?.recall ?? null, metrics.results[k]?.[l]?.ci?.recall ?? null])}
                series={series}
                yLabel="Recall"
              />
            </ChartCard>
            <ChartCard title="False alarms on harmless text" caption="False-positive rate (lower is better). Error bars show 95% confidence intervals.">
              <MetricChart
                rows={rowsFor(metrics, LANG_ORDER, keys, (k, l) => [metrics.results[k]?.[l]?.fpr ?? null, metrics.results[k]?.[l]?.ci?.fpr ?? null])}
                series={series}
                yLabel="False-positive rate"
              />
            </ChartCard>
            <ChartCard
              title="Language-switch bypass"
              caption="Of the attacks a detector caught in English, the share it missed when the same attack was in another language (lower is better)."
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
          </div>
        ) : (
          <div className="mt-6">
            <Pending />
          </div>
        )}
      </section>

      <section className="mt-14" aria-labelledby="table">
        <H2 id="table">Full results table</H2>
        {metrics ? (
          <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-line bg-surface">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <caption className="sr-only">Metrics for every detector and language on the test split</caption>
              <thead className="border-b-2 border-line">
                <tr>
                  {["Detector", "Language", "n", "Recall [95% CI]", "FPR [95% CI]", "Precision", "F1", "ROC-AUC"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-3 text-xs font-bold uppercase tracking-[0.12em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.detectors.flatMap((d) =>
                  !d.available
                    ? [
                        <tr key={d.key} className="border-b border-line-soft">
                          <th scope="row" className="px-3 py-2 font-semibold">
                            {d.id} {d.name}
                          </th>
                          <td colSpan={7} className="px-3 py-2 text-muted">
                            Results pending
                          </td>
                        </tr>,
                      ]
                    : LANG_ORDER.filter((l) => metrics.results[d.key]?.[l]).map((l, i) => {
                        const r = metrics.results[d.key]![l]!;
                        return (
                          <tr key={`${d.key}-${l}`} className="border-b border-line-soft">
                            <th scope="row" className="px-3 py-2 font-semibold">
                              {i === 0 ? `${d.id} ${d.name}` : <span className="sr-only">{`${d.id} ${d.name}`}</span>}
                            </th>
                            <td className="px-3 py-2">{LANG_LABEL[l]}</td>
                            <td className="px-3 py-2 tabular-nums">{r.n}</td>
                            <td className="px-3 py-2 tabular-nums">{fci(r.recall, r.ci?.recall)}</td>
                            <td className="px-3 py-2 tabular-nums">{fci(r.fpr, r.ci?.fpr)}</td>
                            <td className="px-3 py-2 tabular-nums">{pct(r.precision)}</td>
                            <td className="px-3 py-2 tabular-nums">{pct(r.f1)}</td>
                            <td className="px-3 py-2 tabular-nums">{r.roc_auc === null ? "–" : r.roc_auc.toFixed(3)}</td>
                          </tr>
                        );
                      }),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6">
            <Pending />
          </div>
        )}
      </section>

      <section className="mt-14" aria-labelledby="independent">
        <H2 id="independent">Independent test set</H2>
        <p className="mt-3 max-w-3xl leading-relaxed">
          After training, every detector was also run on {independent ? Object.values(independent.counts).reduce((s, c) => s + c.attack + c.benign, 0) : "additional"}{" "}
          sentences written independently of the benchmark. Their attacks are phrased differently from the training data, so
          this is a check of how well each detector generalises. The sample is small (Roman Urdu: 10 sentences), so treat it
          as a sanity check.
        </p>
        {independent ? (
          <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-line bg-surface">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Recall and false-positive rate on the independent test set</caption>
              <thead className="border-b-2 border-line">
                <tr>
                  <th scope="col" className="px-3 py-3 text-xs font-bold uppercase tracking-[0.12em]">Detector</th>
                  {(["en", "ur", "roman_ur"] as const).map((l) => (
                    <th key={l} scope="col" className="px-3 py-3 text-xs font-bold uppercase tracking-[0.12em]">
                      {LANG_LABEL[l]} · recall / FPR
                      <span className="block font-normal normal-case tracking-normal text-muted">
                        n = {independent.counts[l].attack} + {independent.counts[l].benign}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(independent.detectors).map(([key, d]) => (
                  <tr key={key} className="border-b border-line-soft">
                    <th scope="row" className="px-3 py-2 font-semibold">
                      {d.id} {d.name}
                    </th>
                    {(["en", "ur", "roman_ur"] as const).map((l) => (
                      <td key={l} className="px-3 py-2 tabular-nums">
                        {pct(d.by_lang[l].recall)} / {pct(d.by_lang[l].fpr)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6">
            <Pending what="Independent test results" />
          </div>
        )}

        {independent?.stress && (
          <>
            <h3 className="mt-10 text-lg font-bold">Stress test: unseen attack styles</h3>
            <p className="mt-2 max-w-3xl leading-relaxed">
              {independent.stress.n.roman_ur} Roman Urdu and {independent.stress.n.ur} Urdu-script attacks in styles the
              models never saw in training (fake authority, developer modes, role-play, tool instructions). There are no
              harmless rows, so only the detection rate is shown. Some &ldquo;privacy&rdquo; and &ldquo;tool&rdquo; items are
              questions rather than clear attacks.
            </p>
            <div className="mt-4 overflow-x-auto rounded-2xl border-2 border-line bg-surface">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">Detection rate on unseen attack styles</caption>
                <thead className="border-b-2 border-line">
                  <tr>
                    {["Detector", "Roman Urdu · detected [95% CI]", "Urdu (script) · detected [95% CI]"].map((h) => (
                      <th key={h} scope="col" className="px-3 py-3 text-xs font-bold uppercase tracking-[0.12em]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(independent.stress.detectors).map(([key, d]) => (
                    <tr key={key} className="border-b border-line-soft">
                      <th scope="row" className="px-3 py-2 font-semibold">
                        {d.id} {d.name}
                      </th>
                      <td className="px-3 py-2 tabular-nums">{fci(d.by_lang.roman_ur.recall, d.by_lang.roman_ur.ci)}</td>
                      <td className="px-3 py-2 tabular-nums">{fci(d.by_lang.ur.recall, d.by_lang.ur.ci)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm text-muted">Per-category results are in the full report.</p>
          </>
        )}
      </section>

      <section className="mt-14" aria-labelledby="errors">
        <H2 id="errors">Error examples</H2>
        <p className="mt-3 max-w-3xl leading-relaxed">
          A few of the attacks each detector missed, and harmless prompts it wrongly flagged.
        </p>
        <div className="mt-6">
          {errors && metrics ? (
            <ErrorBoundary what="error browser">
              <ErrorBrowser
                sample={errors.detectors}
                perCategory={errors.per_category}
                detectors={metrics.detectors.filter((d) => d.available && errors.detectors[d.key]).map((d) => ({ key: d.key, label: `${d.id} ${d.name}` }))}
                languages={LANG_ORDER.map((l) => ({ key: l, label: LANG_LABEL[l] }))}
              />
            </ErrorBoundary>
          ) : (
            <Pending what="Error examples" />
          )}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="limits">
        <H2 id="limits">Limitations</H2>
        <ul className="mt-6 max-w-3xl list-disc space-y-2 pl-5 leading-relaxed">
          <li>Test sets are small (about 330 prompts in English and Urdu, 200 in Roman Urdu and code-mixed), so confidence intervals are wide.</li>
          <li>Urdu-script text is machine-translated. A reviewed sample showed frequent errors, so some results on Urdu may reflect translation artefacts.</li>
          <li>
            Roman Urdu and code-mixed text is LLM-assisted, not collected from real users, and the same source produced its
            training and test rows. This may flatter InjectionShield-Lite on those languages.
          </li>
          <li>Attacks are mostly short &ldquo;ignore your instructions / reveal the password&rdquo; prompts. Indirect, multi-turn and tool-use injections are not covered.</li>
          <li>One fixed threshold (0.5). Detectors calibrated differently could trade detection for false alarms.</li>
        </ul>
        <p className="mt-6 max-w-3xl text-sm text-muted">
          <strong className="text-ink">Ethics:</strong> defensive research using public datasets of well-known attack
          patterns. No new attack techniques were developed and no real system was attacked.
        </p>
      </section>

      <section className="mt-14" aria-labelledby="downloads">
        <H2 id="downloads">Downloads</H2>
        <ul className="mt-6 flex flex-wrap gap-3">
          {[
            ["/data/REPORT.md", "Full report (Markdown)"],
            ["/data/metrics.json", "All metrics (JSON)"],
            ["/data/summary.json", "Findings summary (JSON)"],
          ].map(([href, label]) => (
            <li key={href}>
              <a
                href={href}
                download
                className="inline-flex rounded-full border-2 border-line px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] hover:bg-ink hover:text-bg"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
