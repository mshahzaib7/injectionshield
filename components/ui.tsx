import Link from "next/link";
import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-[0.22em] text-ink">{children}</p>;
}

export function H1({ children }: { children: ReactNode }) {
  return <h1 className="font-display text-4xl leading-[0.95] tracking-tight text-brand sm:text-6xl">{children}</h1>;
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="scroll-mt-24 font-display text-2xl tracking-tight text-brand sm:text-3xl">
      {children}
    </h2>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border-2 border-line bg-surface p-5 sm:p-6 ${className}`}>{children}</div>;
}

/** Pill button styled after the template's "EXPLORE →". */
export function PillLink({ href, children, solid = false }: { href: string; children: ReactNode; solid?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-3 rounded-full border-2 border-line px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] transition-colors ${
        solid ? "bg-ink text-bg hover:bg-accent hover:text-on-accent" : "text-ink hover:bg-ink hover:text-bg"
      }`}
    >
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  );
}

/** Shown wherever research outputs are missing or incomplete. Never shows numbers. */
export function Pending({ what = "Results" }: { what?: string }) {
  return (
    <div role="status" className="rounded-2xl border-2 border-dashed border-line bg-surface p-6">
      <p className="font-bold">{what} pending</p>
      <p className="mt-1 text-sm text-muted">
        These numbers appear once the research pipeline has been run. Nothing is shown until real results exist.
      </p>
    </div>
  );
}

export const pct = (x: number | null | undefined, digits = 1) =>
  x === null || x === undefined || !Number.isFinite(x) ? "–" : `${(100 * x).toFixed(digits)}%`;
