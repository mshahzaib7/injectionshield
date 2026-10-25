import type { Metadata } from "next";
import { Card, Container, Eyebrow, H1, H2 } from "@/components/ui";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `About ${SITE.author} and the InjectionShield project, and how to cite it.`,
};

export default function AboutPage() {
  const year = new Date().getFullYear();
  const bibtex = `@misc{khan${year}injectionshield,
  author       = {${SITE.author}},
  title        = {InjectionShield: Do Prompt-Injection Detectors Fail on Urdu,
                  Roman Urdu and Code-Mixed Text?},
  year         = {${year}},
  howpublished = {${SITE.liveUrl || SITE.githubUrl || "TODO: project URL"}},
  note         = {Research prototype}
}`;

  return (
    <Container className="py-12 sm:py-16">
      <Eyebrow>About</Eyebrow>
      <div className="mt-4 max-w-3xl">
        <H1>{SITE.author}</H1>
      </div>

      <section className="mt-12 max-w-3xl" aria-labelledby="motivation">
        <H2 id="motivation">Why I built this</H2>
        {/* TODO(author): replace this placeholder with your own words. */}
        <div className="mt-4 rounded-2xl border-2 border-dashed border-line bg-surface p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-ink">Placeholder: to be written by the author</p>
          <p className="mt-2 leading-relaxed">
            Write a few sentences here about your background, why the safety of AI systems for Urdu speakers matters to
            you, and what you want to research next.
          </p>
        </div>
      </section>

      <section className="mt-12 max-w-3xl" aria-labelledby="contact">
        <H2 id="contact">Links</H2>
        <ul className="mt-4 space-y-2">
          <li>
            <span className="font-semibold">GitHub: </span>
            {SITE.githubUrl ? (
              <a href={SITE.githubUrl} className="break-all underline underline-offset-4 hover:text-accent-ink">{SITE.githubUrl}</a>
            ) : (
              <span className="text-muted">coming soon</span>
            )}
          </li>
          <li>
            <span className="font-semibold">Contact: </span>
            {SITE.email ? (
              <a href={`mailto:${SITE.email}`} className="underline underline-offset-4 hover:text-accent-ink">{SITE.email}</a>
            ) : (
              <span className="text-muted">coming soon</span>
            )}
          </li>
        </ul>
      </section>

      <section className="mt-12 max-w-3xl" aria-labelledby="cite">
        <H2 id="cite">How to cite</H2>
        <Card className="mt-4">
          <pre className="overflow-x-auto whitespace-pre text-xs leading-relaxed sm:text-sm">
            <code>{bibtex}</code>
          </pre>
        </Card>
      </section>
    </Container>
  );
}
