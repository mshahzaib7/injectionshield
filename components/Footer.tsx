import Link from "next/link";
import { SITE } from "@/lib/site";
import { ShieldMark } from "./Logo";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t-2 border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-center gap-2">
          <ShieldMark className="h-5 w-5 text-brand" />
          <span>
            Built by {SITE.author} · {year}
          </span>
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li>
            {SITE.githubUrl ? (
              <a href={SITE.githubUrl} className="font-semibold underline underline-offset-4 hover:text-accent-ink">
                GitHub
              </a>
            ) : (
              <span className="text-muted">GitHub (link coming soon)</span>
            )}
          </li>
          <li>
            <Link href="/research/" className="font-semibold underline underline-offset-4 hover:text-accent-ink">
              Research
            </Link>
          </li>
          <li className="text-muted">Research prototype · not a security guarantee</li>
        </ul>
      </div>
    </footer>
  );
}
