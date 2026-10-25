/** Original InjectionShield mark: a charcoal (or yellow, in dark mode) shield with a lavender core. */
export function ShieldMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path d="M16 2 4 6.5v8.2c0 7.3 5.1 13.4 12 15.3 6.9-1.9 12-8 12-15.3V6.5L16 2Z" fill="currentColor" />
      <path d="M16 7.5 9 10.2v4.9c0 4.4 2.9 8.1 7 9.4 4.1-1.3 7-5 7-9.4v-4.9L16 7.5Z" fill="#A66BFF" />
      <path d="m12.6 15.6 2.4 2.4 4.6-4.8" fill="none" stroke="#171717" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-display text-lg tracking-tight text-brand">
      <ShieldMark />
      <span>
        INJECTION<span className="text-ink">SHIELD</span>
      </span>
    </span>
  );
}
