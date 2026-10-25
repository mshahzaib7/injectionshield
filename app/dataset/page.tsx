import type { Metadata } from "next";
import { Card, Container, Eyebrow, H1, H2, Pending } from "@/components/ui";
import { getDatasetCounts, getDatasetExamples, LANG_LABEL, LANG_ORDER } from "@/lib/data";

export const metadata: Metadata = {
  title: "Dataset",
  description: "Summary of the InjectionShield benchmark: the same prompts in English, Urdu script, Roman Urdu and code-mixed text.",
};

const SOURCES = [
  { name: "deepset/prompt-injections", url: "https://huggingface.co/datasets/deepset/prompt-injections", license: "Apache-2.0", role: "Attacks and harmless prompts" },
  { name: "Lakera/gandalf_ignore_instructions", url: "https://huggingface.co/datasets/Lakera/gandalf_ignore_instructions", license: "MIT", role: "Attacks" },
  { name: "OpenAssistant/oasst1", url: "https://huggingface.co/datasets/OpenAssistant/oasst1", license: "Apache-2.0", role: "Harmless user questions" },
];

export default function DatasetPage() {
  const counts = getDatasetCounts();
  const examples = getDatasetExamples();
  return (
    <Container className="py-12 sm:py-16">
      <Eyebrow>Dataset</Eyebrow>
      <div className="mt-4 max-w-3xl">
        <H1>One prompt, four languages</H1>
        <p className="mt-4 text-lg leading-relaxed">
          A paired benchmark: every prompt appears in English, Urdu script, Roman Urdu and Urdu-English code-mixed text,
          so each language is tested on exactly the same content.
        </p>
      </div>

      <section className="mt-14" aria-labelledby="size">
        <H2 id="size">Size</H2>
        {counts ? (
          <>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              <Card>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Rows</p>
                <p className="mt-2 font-display text-4xl">{counts.total_rows.toLocaleString()}</p>
              </Card>
              <Card>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Source prompts</p>
                <p className="mt-2 font-display text-4xl">{counts.unique_groups.toLocaleString()}</p>
              </Card>
              <Card>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Languages</p>
                <p className="mt-2 font-display text-4xl">4</p>
              </Card>
            </div>
            <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-line bg-surface">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <caption className="sr-only">Attack and benign counts per split and language</caption>
                <thead className="border-b-2 border-line">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-xs font-bold uppercase tracking-[0.12em]">Split</th>
                    {LANG_ORDER.map((l) => (
                      <th key={l} scope="col" className="px-3 py-3 text-xs font-bold uppercase tracking-[0.12em]">
                        {LANG_LABEL[l]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {["train", "val", "test"].map((s) => (
                    <tr key={s} className="border-b border-line-soft">
                      <th scope="row" className="px-3 py-2 font-semibold capitalize">{s}</th>
                      {LANG_ORDER.map((l) => {
                        const c = counts.counts[s]?.[l];
                        return (
                          <td key={l} className="px-3 py-2 tabular-nums">
                            {c ? `${c.attack ?? 0} / ${c.benign ?? 0}` : "–"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm text-muted">Attack / harmless counts. Roman Urdu and code-mixed versions exist for a subset of prompts.</p>
          </>
        ) : (
          <div className="mt-6">
            <Pending what="Dataset summary" />
          </div>
        )}
      </section>

      <section className="mt-14" aria-labelledby="examples">
        <H2 id="examples">Examples</H2>
        {examples && examples.examples.length ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {examples.examples.map((ex) => (
              <Card key={ex.group_id}>
                <p
                  className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${
                    ex.label === "attack" ? "bg-danger text-on-status" : "bg-success text-on-status"
                  }`}
                >
                  {ex.label === "attack" ? "Attack" : "Harmless"}
                </p>
                <dl className="mt-4 space-y-3">
                  {LANG_ORDER.map((l) => (
                    <div key={l}>
                      <dt className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{LANG_LABEL[l]}</dt>
                      <dd lang={l === "ur" ? "ur" : undefined} dir="auto" className="mt-0.5 break-words">
                        {ex.texts[l]}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <Pending what="Examples" />
          </div>
        )}
      </section>

      <section className="mt-14" aria-labelledby="sources">
        <H2 id="sources">Sources and licenses</H2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {SOURCES.map((s) => (
            <li key={s.name}>
              <Card className="h-full">
                <a href={s.url} className="break-words font-bold underline underline-offset-4 hover:text-accent-ink" rel="noopener noreferrer">
                  {s.name}
                </a>
                <p className="mt-2 text-sm">{s.role}</p>
                <p className="mt-1 text-sm text-muted">License: {s.license}</p>
              </Card>
            </li>
          ))}
        </ul>
        <div className="mt-6 max-w-3xl space-y-3 leading-relaxed">
          <p>
            <strong>How the versions were made:</strong> Urdu-script text was machine-translated locally with NLLB-200
            (600M). Roman Urdu and code-mixed text is LLM-assisted. Translations with obvious content loss were removed
            automatically, and a reviewed sample was corrected.
          </p>
          <p className="text-sm text-muted">
            This site shows a summary only. The original English datasets are freely available from the links above.
          </p>
        </div>
      </section>
    </Container>
  );
}
