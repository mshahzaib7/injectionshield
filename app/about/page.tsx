import type { Metadata } from "next";
import Link from "next/link";
import { Container, pct } from "@/components/ui";
import { getDatasetCounts, getMetrics } from "@/lib/data";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `${SITE.author}, creator of InjectionShield: a four-language benchmark and in-browser detector for prompt injection in Urdu.`,
};

const FOCUS = [
  { title: "Multilingual AI safety", body: "Making sure the safety layers around language models work for the billions of people who don't write in English." },
  { title: "Prompt-injection defense", body: "Measuring how detectors fail under realistic attacks, and building lightweight defenses that close the gaps." },
  { title: "Low-resource languages", body: "Urdu, Roman Urdu and code-mixed text: how people in Pakistan actually type, not how benchmarks assume they do." },
];

const SKILLS = [
  "Python", "PyTorch", "Hugging Face Transformers", "scikit-learn", "NLP data engineering", "Machine translation (NLLB-200)",
  "Bootstrap CIs & McNemar tests", "Ablation studies", "TypeScript", "Next.js", "Playwright & accessibility testing",
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-[0.22em]">{children}</p>;
}

function SectionTitle({ eyebrow, id, children }: { eyebrow: string; id: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="mt-3 scroll-mt-24 font-display text-[2rem] leading-tight tracking-tight text-brand sm:text-[2.5rem]">
        {children}
      </h2>
    </div>
  );
}

export default function AboutPage() {
  const year = new Date().getFullYear();
  const counts = getDatasetCounts();
  const metrics = getMetrics();
  const d1ur = metrics?.results.protectai?.ur;
  const d1ru = metrics?.paired.protectai?.roman_ur?.attacks;
  const v2ru = metrics?.results.shield_lite_v2?.roman_ur;
  const configs = metrics?.detectors.filter((d) => d.available).length;
  const bibtex = `@misc{khan${year}injectionshield,
  author       = {${SITE.author}},
  title        = {InjectionShield: Do Prompt-Injection Detectors Fail on Urdu,
                  Roman Urdu and Code-Mixed Text?},
  year         = {${year}},
  howpublished = {\\url{${SITE.liveUrl || SITE.githubUrl}}},
  note         = {Research prototype}
}`;

  const built = [
    counts && { value: counts.total_rows.toLocaleString(), text: `samples in a paired four-language benchmark, built from ${counts.unique_groups.toLocaleString()} prompts` },
    configs && { value: String(configs), text: "detector configurations evaluated, with 95% confidence intervals and paired significance tests" },
    d1ur && { value: pct(d1ur.fpr), text: "of harmless Urdu prompts blocked by a widely used open-source detector, a failure this benchmark exposed" },
    d1ru && { value: pct(d1ru.switch_bypass_rate), text: "of attacks that slipped past the same detector just by switching to Roman Urdu" },
    v2ru && { value: pct(v2ru.recall), text: `of Roman Urdu attacks caught by InjectionShield-Lite, a 1.8 MB model that runs in the browser (${pct(v2ru.fpr)} false alarms)` },
  ].filter(Boolean) as { value: string; text: string }[];

  const pill = "inline-flex items-center gap-3 rounded-full border-2 border-line px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] transition-colors";

  return (
    <>
      {/* ---------------- Header ---------------- */}
      <header className="border-b-2 border-line">
        <Container className="py-14 sm:py-20">
          <div className="min-w-0">
            <Eyebrow>About the researcher</Eyebrow>
            <h1 className="mt-5 font-display text-[clamp(2rem,6vw,4.25rem)] leading-[0.95] tracking-tight text-brand sm:whitespace-nowrap">
              {SITE.author}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 sm:text-xl">
              Creator of <strong>InjectionShield</strong>, a four-language benchmark and in-browser detector that measures
              whether AI safety filters work for Urdu speakers, and fixes them where they don&apos;t.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {SITE.githubUrl && (
                <a href={SITE.githubUrl} className={`${pill} bg-ink text-bg hover:bg-accent hover:text-on-accent`}>
                  View on GitHub <span aria-hidden="true" className="arrow-nudge">→</span>
                </a>
              )}
              <Link href="/research/" className={`${pill} hover:bg-ink hover:text-bg`}>
                Read the research <span aria-hidden="true" className="arrow-nudge">→</span>
              </Link>
              {SITE.email && (
                <a href={`mailto:${SITE.email}`} className={`${pill} hover:bg-ink hover:text-bg`}>
                  Contact
                </a>
              )}
            </div>
          </div>
        </Container>
      </header>

      {/* ---------------- What I built ---------------- */}
      {built.length > 0 && (
        <section aria-labelledby="built" className="border-b-2 border-line bg-surface">
          <Container className="py-16 sm:py-24">
            <SectionTitle eyebrow="Highlights" id="built">
              What I built
            </SectionTitle>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {built.map((b) => (
                <li key={b.text} className="card-lift flex flex-col rounded-2xl border-2 border-line bg-bg p-6">
                  <p className="font-display text-[2.25rem] leading-none tracking-tight text-ink">{b.value}</p>
                  <p className="mt-4 text-[0.9375rem] leading-7">{b.text}</p>
                </li>
              ))}
              <li className="card-lift flex flex-col justify-between rounded-2xl border-2 border-line bg-ink p-6 text-bg">
                <p className="text-lg font-bold leading-snug">Everything is reproducible: open code, pinned dependencies, automated tests.</p>
                <Link
                  href="/detector/"
                  className="mt-6 inline-flex items-center gap-2 self-start text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
                >
                  Try the detector <span aria-hidden="true" className="arrow-nudge">→</span>
                </Link>
              </li>
            </ul>
          </Container>
        </section>
      )}

      {/* ---------------- Why ---------------- */}
      <section aria-labelledby="why">
        <Container className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <Eyebrow>Motivation</Eyebrow>
            <h2 id="why" className="mt-3 font-display text-[2rem] leading-tight tracking-tight text-brand sm:text-[2.5rem]">
              Why I built this
            </h2>
          </div>
          {/* Draft for the author; edit freely. */}
          <div className="space-y-5 text-[1.0625rem] leading-8">
            <p>
              Hundreds of millions of people speak Urdu, and many of them type it in Roman script, mixed with English. As
              AI assistants reach them, the safety filters guarding those assistants are trained and tested almost
              entirely in English.
            </p>
            <p>
              I wanted to measure what that means in practice. So I built a benchmark where every attack and every
              harmless question exists in four forms (English, Urdu script, Roman Urdu and code-mixed text), tested real
              detectors on it, and built a small model that closes the gap and runs privately in the browser.
            </p>
            <p>
              My goal is to keep working at this intersection: making AI security research cover the languages people
              actually use.
            </p>
          </div>
        </Container>
      </section>

      {/* ---------------- Focus + skills ---------------- */}
      <section aria-labelledby="focus" className="border-y-2 border-line bg-surface">
        <Container className="py-16 sm:py-24">
          <SectionTitle eyebrow="Research focus" id="focus">
            What I work on
          </SectionTitle>
          <ul className="grid gap-5 md:grid-cols-3">
            {FOCUS.map((f, i) => (
              <li key={f.title} className="card-lift flex flex-col rounded-2xl border-2 border-line bg-bg p-6">
                <span className="font-display text-sm text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-7">{f.body}</p>
              </li>
            ))}
          </ul>
          <h3 className="mt-14 text-xs font-bold uppercase tracking-[0.22em]">Skills used in this project</h3>
          <ul className="mt-4 flex flex-wrap gap-2">
            {SKILLS.map((s) => (
              <li key={s} className="rounded-full border-2 border-line bg-bg px-4 py-1.5 text-sm font-semibold">
                {s}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ---------------- Cite ---------------- */}
      <section aria-labelledby="cite">
        <Container className="pt-16 sm:pt-24">
          <SectionTitle eyebrow="Citation" id="cite">
            How to cite
          </SectionTitle>
          <div className="rounded-2xl border-2 border-line bg-surface p-6">
            <pre className="overflow-x-auto whitespace-pre text-xs leading-relaxed sm:text-sm">
              <code>{bibtex}</code>
            </pre>
          </div>
        </Container>
      </section>
    </>
  );
}
