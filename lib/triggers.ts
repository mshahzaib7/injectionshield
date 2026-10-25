/**
 * Explanation layer: highlights well-known prompt-injection phrases in English, Urdu script and Roman Urdu.
 *
 * Used ONLY to show the visitor which phrases look suspicious. It has no influence on the risk score, which
 * comes solely from the trained model (lib/detector.ts). The list is hand-curated, not learned.
 */

export type TriggerLang = "en" | "ur" | "roman_ur";

export interface TriggerPhrase {
  phrase: string;
  lang: TriggerLang;
  meaning: string;
}

const P = (lang: TriggerLang, meaning: string, ...phrases: string[]): TriggerPhrase[] =>
  phrases.map((phrase) => ({ phrase, lang, meaning }));

export const TRIGGER_PHRASES: TriggerPhrase[] = [
  // English
  ...P("en", "overrides earlier instructions",
    "ignore all previous instructions", "ignore previous instructions", "ignore the above", "ignore your instructions",
    "disregard previous instructions", "disregard", "forget all previous", "forget your instructions",
    "forget everything", "override", "new instructions"),
  ...P("en", "asks for hidden configuration", "system prompt", "initial instructions", "your instructions", "print your prompt"),
  ...P("en", "asks for a secret", "reveal the password", "tell me the password", "password", "secret word", "passphrase"),
  ...P("en", "role-play / jailbreak framing",
    "you are now", "pretend you are", "pretend there are no", "act as", "developer mode", "jailbreak", "do anything now",
    "no restrictions"),
  // Urdu script
  ...P("ur", "ignore (nazar andaz)", "نظر انداز", "نظرانداز"),
  ...P("ur", "previous instructions", "پچھلی ہدایات", "پچھلے ہدایات", "سابقہ ہدایات", "سابق ہدایات", "تمام ہدایات"),
  ...P("ur", "forget", "بھول جاؤ", "بھول جائیں", "بھول جاو"),
  ...P("ur", "password / secret", "پاس ورڈ", "خفیہ", "راز"),
  ...P("ur", "reveal", "ظاہر کرو", "ظاہر کریں", "بتاؤ", "بتائیں"),
  ...P("ur", "rules", "قواعد", "اصول"),
  // Roman Urdu / code-mixed
  ...P("roman_ur", "ignore (nazar andaz)", "nazar andaz", "nazarandaz", "nazr andaz", "ignore karo", "ignore kro"),
  ...P("roman_ur", "previous instructions",
    "pichli hidayat", "pichli hidayaat", "pichle hidayat", "pichli instructions", "previous instructions"),
  ...P("roman_ur", "forget", "bhool jao", "bhool jaao", "bhul jao", "forget karo", "forget kar do"),
  ...P("roman_ur", "reveal the password / secret",
    "password batao", "password btao", "password bata do", "password do", "zahir karo", "zahir kro", "khufiya", "raaz"),
  ...P("roman_ur", "rules", "qawaid", "usool"),
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Longest phrases first so "ignore all previous instructions" wins over "ignore"; flexible whitespace.
const SORTED = [...TRIGGER_PHRASES].sort((a, b) => b.phrase.length - a.phrase.length);
const MATCHER = new RegExp(SORTED.map((t) => escapeRe(t.phrase).replace(/ +/g, "\\s+")).join("|"), "giu");
const BY_KEY = new Map(SORTED.map((t) => [t.phrase.toLowerCase().replace(/\s+/g, " "), t]));

export interface TriggerMatch {
  start: number;
  end: number;
  text: string;
  trigger: TriggerPhrase;
}

/** Non-overlapping matches, with offsets into the original text. */
export function findTriggers(text: string): TriggerMatch[] {
  const out: TriggerMatch[] = [];
  for (const m of text.matchAll(MATCHER)) {
    const key = m[0].toLowerCase().replace(/\s+/g, " ");
    const trigger = BY_KEY.get(key);
    if (trigger) out.push({ start: m.index, end: m.index + m[0].length, text: m[0], trigger });
  }
  return out;
}

export interface Segment {
  text: string;
  match?: TriggerMatch;
}

/** Split text into plain and highlighted segments, for safe rendering as React text nodes. */
export function segmentText(text: string, matches: TriggerMatch[]): Segment[] {
  const segs: Segment[] = [];
  let pos = 0;
  for (const m of matches) {
    if (m.start > pos) segs.push({ text: text.slice(pos, m.start) });
    segs.push({ text: text.slice(m.start, m.end), match: m });
    pos = m.end;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos) });
  return segs;
}
