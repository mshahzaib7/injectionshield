"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV } from "@/lib/site";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const norm = (p: string) => (p.endsWith("/") ? p : `${p}/`);

export function Navbar() {
  const pathname = norm(usePathname() || "/");
  const [open, setOpen] = useState(false);

  const linkClass = (href: string) =>
    `text-xs font-bold uppercase tracking-[0.18em] transition-colors hover:text-accent-ink ${
      pathname === norm(href) ? "text-ink underline decoration-2 underline-offset-8" : "text-ink/80"
    }`;

  return (
    <header className="border-b-2 border-line">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" aria-label="InjectionShield home" onClick={() => setOpen(false)}>
          <Logo />
        </Link>
        <ul className="hidden items-center gap-8 lg:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className={linkClass(n.href)} aria-current={pathname === norm(n.href) ? "page" : undefined}>
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-line lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>
      {open && (
        <ul id="mobile-menu" className="flex flex-col gap-1 border-t-2 border-line px-4 py-3 lg:hidden">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-2 py-3 ${linkClass(n.href)}`}
                aria-current={pathname === norm(n.href) ? "page" : undefined}
              >
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
