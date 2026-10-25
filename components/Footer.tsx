import Link from "next/link";
import { NAV, SITE } from "@/lib/site";
import { Logo } from "./Logo";

const linkClass = "text-sm font-semibold text-ink/80 transition-colors hover:text-accent-ink";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t-2 border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="max-w-sm">
          <Link href="/" aria-label="InjectionShield home">
            <Logo />
          </Link>
          <p className="mt-4 text-sm text-muted">{SITE.tagline}</p>
          <p className="mt-2 text-sm text-muted">Research prototype · not a security guarantee</p>
        </div>

        <nav aria-label="Footer">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em]">Explore</h2>
          <ul className="mt-4 space-y-2">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className={linkClass}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.18em]">Project</h2>
          <ul className="mt-4 space-y-2">
            <li>
              {SITE.githubUrl ? (
                <a href={SITE.githubUrl} className={linkClass}>
                  GitHub
                </a>
              ) : (
                <span className="text-sm text-muted">GitHub (link coming soon)</span>
              )}
            </li>
            <li>
              <Link href="/research/" className={linkClass}>
                Paper &amp; results
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t-2 border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs font-semibold uppercase tracking-[0.14em] sm:px-6">
          © {year} {SITE.author}
        </p>
      </div>
    </footer>
  );
}
