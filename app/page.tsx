import Link from "next/link";
import { Container, Eyebrow, Pending, PillLink } from "@/components/ui";
import { getSummary } from "@/lib/data";
import { SITE } from "@/lib/site";

const LANGUAGES = [
  { label: "English", sample: "Ignore your instructions", dir: "ltr" as const },
  { label: "Urdu", sample: "پچھلی ہدایات نظر انداز کرو", dir: "rtl" as const },
  { label: "Roman Urdu", sample: "hidayat nazar andaz karo", dir: "ltr" as const },
  { label: "Code-mixed", sample: "instructions ignore karo", dir: "ltr" as const },
];

function DrippingShield({ className = "w-full max-w-[18rem] drop-shadow-[0_18px_0_rgba(23,23,23,0.12)]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 260" aria-hidden="true" className={`h-auto ${className}`}>
      <path d="M110 8 22 42v62c0 58 37 107 88 122 51-15 88-64 88-122V42L110 8Z" fill="#A66BFF" />
      <path d="M110 8 22 42v62c0 26 7.5 50.5 20.6 70.7C40 150 36 126 36 104V52l74-29 74 29v52c0 22-4 46-6.6 70.7C190.5 154.5 198 130 198 104V42L110 8Z" fill="#171717" opacity="0.12" />
      {/* drips */}
      <path d="M62 196c0 14 2 30 9 30s9-14 9-24" fill="#A66BFF" />
      <circle cx="71" cy="236" r="6" fill="#A66BFF" />
      <path d="M140 205c0 20 3 38 10 38s9-20 9-32" fill="#A66BFF" />
      <circle cx="150" cy="252" r="5" fill="#A66BFF" />
      <path d="M104 226c0 8 2 16 6 16s6-8 6-14" fill="#A66BFF" />
      <path d="m82 112 20 20 38-40" fill="none" stroke="#171717" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Same attack, four languages",
    body: "Over 2,000 English prompts (attacks and harmless questions) are rewritten in Urdu script, Roman Urdu and Urdu-English code-mixed text, so every language is tested on identical content.",
  },
  {
    n: "02",
    title: "Test real detectors",
    body: "An open-source prompt-injection detector, an English-only baseline and multilingual models are scored on detection rate and false alarms, with 95% confidence intervals.",
  },
  {
    n: "03",
    title: "A lightweight fix, live",
    body: "InjectionShield-Lite, a small character n-gram model trained with multilingual data, runs entirely in your browser. Try it yourself.",
  },
];

export default function Home() {
  const summary = getSummary();
  return (
    <>
      <section className="border-b-2 border-line">
        <Container className="grid items-center gap-10 pb-12 pt-10 sm:py-20 md:grid-cols-[1.4fr_1fr]">
          <div>
            <Eyebrow>Independent AI security research</Eyebrow>
            {/* Phones: "INJECTION" scales to fill the column and a small shield sits beside "shield", replacing the large one below. */}
            <h1 className="mt-5 font-display text-[min(calc((100vw-2rem)/6),4.5rem)] leading-[0.88] tracking-tight text-brand sm:text-7xl lg:text-8xl">
              INJECTION
              <span className="relative block font-sans text-[min(calc((100vw-2rem)/7.2),3.75rem)] font-light tracking-normal text-ink sm:text-6xl lg:text-7xl">
                shield
                <DrippingShield className="absolute -bottom-[0.45em] right-1 w-[3.25rem] drop-shadow-[0_6px_0_rgba(23,23,23,0.12)] sm:hidden" />
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed sm:text-xl">
              Do prompt-injection detectors fail when the same attack is written in{" "}
              <strong>Urdu</strong>, <strong>Roman Urdu</strong> or <strong>Urdu-English code-mixed</strong> text?
            </p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap [&>a]:justify-center">
              <PillLink href="/detector/" solid>
                Try the detector
              </PillLink>
              <PillLink href="/research/">Read the research</PillLink>
            </div>
            <p className="mt-6 flex items-center gap-3 rounded-2xl border-2 border-line bg-surface px-4 py-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] sm:mt-8 sm:inline-flex sm:gap-2 sm:rounded-full sm:py-1.5 sm:text-xs sm:tracking-[0.16em]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
              <span>
                100% in-browser<span className="hidden sm:inline"> · </span>
                <span className="block font-semibold text-muted sm:inline sm:font-bold sm:text-ink">your text stays on your device</span>
              </span>
            </p>
          </div>
          <div className="hidden justify-center sm:flex md:justify-end">
            <DrippingShield />
          </div>
        </Container>
      </section>

      {/* ---- Everything below the hero follows one grid: same container, 24px card padding, 20px gaps, 96px section rhythm. ---- */}

      {/* One attack, four languages */}
      <section aria-label="Languages tested" className="border-b-2 border-line bg-surface">
        <Container>
          {/* 2px gaps over an ink background draw the dividers; the first cell of each row keeps the page's left edge. */}
          <ul className="grid grid-cols-1 gap-[2px] bg-line sm:grid-cols-2 lg:grid-cols-4">
            {LANGUAGES.map((l) => (
              <li
                key={l.label}
                className="flex min-w-0 flex-col justify-start gap-1.5 bg-surface py-5 sm:px-6 sm:[&:nth-child(odd)]:pl-0 lg:[&:nth-child(3)]:!pl-6 lg:last:!pr-0"
              >
                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-muted">{l.label}</span>
                <span
                  dir={l.dir}
                  lang={l.dir === "rtl" ? "ur" : undefined}
                  className={`truncate text-[0.9375rem] font-semibold ${l.dir === "rtl" ? "text-left !leading-8" : "leading-8"}`}
                >
                  “{l.sample}”
                </span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Headline findings */}
      <section aria-labelledby="findings">
        <Container className="py-16 sm:py-24">
          <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em]">Results</p>
              <h2 id="findings" className="mt-3 font-display text-[2rem] leading-tight tracking-tight text-brand sm:text-[2.5rem]">
                Headline findings
              </h2>
              {summary?.status === "partial" && (
                <p className="mt-3 text-sm font-semibold">Partial results: some detectors are still pending.</p>
              )}
            </div>
            <Link
              href="/research/"
              className="inline-flex shrink-0 items-center gap-3 self-start rounded-full border-2 border-line px-5 py-2.5 text-xs font-bold uppercase tracking-[0.18em] transition-colors hover:bg-ink hover:text-bg sm:self-auto"
            >
              All findings
              <span aria-hidden="true" className="arrow-nudge">
                →
              </span>
            </Link>
          </div>

          {summary && summary.cards.length > 0 ? (
            <>
              <ul className="grid gap-5 md:grid-cols-3">
                {summary.cards.map((c, i) => (
                  <li key={c.label} className="flex">
                    <article className="card-lift flex w-full flex-col rounded-2xl border-2 border-line bg-surface p-6">
                      <div className="flex items-start justify-between gap-4">
                        <p className="min-h-[2.5rem] text-[0.6875rem] font-bold uppercase leading-5 tracking-[0.14em] text-muted">
                          {c.label}
                        </p>
                        <span className="font-display text-sm leading-5 text-accent-ink" aria-hidden="true">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <p className="mt-6 font-display text-[2rem] leading-none tracking-tight text-ink sm:text-[2.25rem]">
                        {c.value}
                      </p>
                      <div className="mt-auto pt-6">
                        <p className="border-t-2 border-line-soft pt-4 text-sm leading-6">{c.detail}</p>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
              <p className="mt-6 max-w-3xl text-sm leading-6 text-muted">
                All figures are computed directly from the evaluation outputs, with 95% bootstrap confidence intervals.
              </p>
            </>
          ) : (
            <Pending what="Headline findings" />
          )}
        </Container>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="border-y-2 border-line bg-surface">
        <Container className="py-16 sm:py-24">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em]">Method</p>
            <h2 id="how" className="mt-3 font-display text-[2rem] leading-tight tracking-tight text-brand sm:text-[2.5rem]">
              How it works
            </h2>
          </div>
          <ol className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="card-lift flex flex-col rounded-2xl border-2 border-line bg-bg p-6">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-line bg-surface font-display text-lg text-accent-ink">
                  {s.n}
                </span>
                <h3 className="mt-6 text-lg font-bold leading-snug">{s.title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-7">{s.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Call to action */}
      <section aria-labelledby="cta">
        {/* No bottom padding: the footer's own top margin provides the gap. */}
        <Container className="pt-16 sm:pt-24">
          <div className="flex flex-col gap-8 rounded-3xl border-2 border-line bg-ink p-8 text-bg sm:p-12 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em]">Try it yourself</p>
              <h2 id="cta" className="mt-3 font-display text-[1.75rem] leading-tight tracking-tight sm:text-[2.25rem]">
                Paste a prompt in any of the four languages and get a risk score instantly.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 opacity-90">{SITE.description}</p>
            </div>
            <Link
              href="/detector/"
              className="inline-flex shrink-0 items-center gap-3 self-start rounded-full border-2 border-bg bg-bg px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-ink transition-colors hover:bg-accent hover:text-on-accent lg:self-auto"
            >
              Open the detector
              <span aria-hidden="true" className="arrow-nudge">
                →
              </span>
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
