/**
 * In-browser prompt-injection scoring for the exported TF-IDF + logistic-regression models.
 *
 * This is a line-by-line port of research/scripts/shield_features.py and scikit-learn's TfidfVectorizer
 * (sublinear_tf, l2 norm) + LogisticRegression.predict_proba. tests/detector.test.ts checks it against
 * Python's own probabilities on 200 strings (tolerance 1e-4). Change both sides together, or not at all.
 */

export const MODEL_FORMAT = "injectionshield-tfidf-lr/1";

export interface TfidfModelJson {
  format: string;
  name: string;
  title: string;
  analyzer: "word" | "char_wb";
  ngram_range: [number, number];
  sublinear_tf: boolean;
  norm: "l2";
  intercept: number;
  terms: string[];
  idf: number[];
  coef: number[];
  training?: { C: number; train_langs: string[]; n_train: number };
}

export interface Model {
  json: TfidfModelJson;
  index: Map<string, number>;
}

// Code-point ranges (not the engine's own "\s"), identical to WHITESPACE in shield_features.py:
// tab..CR, U+001C..space, NEL, NBSP, Ogham space, en quad..hair space, line/para separators,
// narrow NBSP, medium math space, ideographic space, BOM.
const WHITESPACE_RANGES: [number, number][] = [
  [0x09, 0x0d], [0x1c, 0x20], [0x85, 0x85], [0xa0, 0xa0], [0x1680, 0x1680], [0x2000, 0x200a],
  [0x2028, 0x2029], [0x202f, 0x202f], [0x205f, 0x205f], [0x3000, 0x3000], [0xfeff, 0xfeff],
];
const WHITESPACE_CLASS = WHITESPACE_RANGES.map(([a, b]) =>
  a === b ? String.fromCodePoint(a) : `${String.fromCodePoint(a)}-${String.fromCodePoint(b)}`,
).join("");
const WHITESPACE = new RegExp(`[${WHITESPACE_CLASS}]+`, "gu");
const NON_WHITESPACE_RUN = new RegExp(`[^${WHITESPACE_CLASS}]+`, "gu");
const WORD_TOKEN = /[\p{L}\p{N}]+/gu;

export function preprocess(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(WHITESPACE, " ").trim();
}

export function wordFeatures(text: string, [lo, hi]: [number, number] = [1, 2]): string[] {
  const toks = preprocess(text).match(WORD_TOKEN) ?? [];
  const feats: string[] = lo <= 1 ? [...toks] : [];
  if (hi >= 2) {
    for (let i = 0; i + 1 < toks.length; i++) feats.push(`${toks[i]} ${toks[i + 1]}`);
  }
  return feats;
}

/** scikit-learn analyzer="char_wb", counting Unicode code points (Array.from), on already-preprocessed text. */
function charWbOfPreprocessed(text: string, [lo, hi]: [number, number]): string[] {
  const grams: string[] = [];
  for (const raw of text.split(" ")) {
    if (!raw) continue;
    const w = Array.from(` ${raw} `);
    const wLen = w.length;
    for (let n = lo; n <= hi; n++) {
      let offset = 0;
      grams.push(w.slice(offset, offset + n).join(""));
      while (offset + n < wLen) {
        offset += 1;
        grams.push(w.slice(offset, offset + n).join(""));
      }
      if (offset === 0) break; // word shorter than n: counted once
    }
  }
  return grams;
}

export function charWbFeatures(text: string, range: [number, number] = [2, 5]): string[] {
  return charWbOfPreprocessed(preprocess(text), range);
}

export function prepareModel(json: TfidfModelJson): Model {
  if (json.format !== MODEL_FORMAT) throw new Error(`Unsupported model format: ${json.format}`);
  const n = json.terms.length;
  if (json.idf.length !== n || json.coef.length !== n) throw new Error("Corrupt model: array lengths differ");
  if (!json.sublinear_tf || json.norm !== "l2") throw new Error("Unsupported TF-IDF settings");
  const index = new Map<string, number>();
  json.terms.forEach((t, i) => index.set(t, i));
  return { json, index };
}

function features(model: Model, text: string): string[] {
  const { analyzer, ngram_range } = model.json;
  return analyzer === "char_wb" ? charWbFeatures(text, ngram_range) : wordFeatures(text, ngram_range);
}

function weights(model: Model, feats: string[]) {
  const tf = new Map<number, number>();
  for (const f of feats) {
    const i = model.index.get(f);
    if (i !== undefined) tf.set(i, (tf.get(i) ?? 0) + 1);
  }
  let sq = 0;
  const v = new Map<number, number>();
  for (const [i, c] of tf) {
    const x = (1 + Math.log(c)) * model.json.idf[i];
    v.set(i, x);
    sq += x * x;
  }
  return { tf, v, norm: Math.sqrt(sq) };
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Probability that `text` is a prompt injection, in [0, 1]. */
export function score(model: Model, text: string): number {
  const { v, norm } = weights(model, features(model, text));
  let dot = 0;
  if (norm > 0) for (const [i, x] of v) dot += (x / norm) * model.json.coef[i];
  return sigmoid(dot + model.json.intercept);
}

export interface WordContribution {
  start: number;
  end: number;
  text: string;
  /** Additive share of the logit: positive pushes towards "injection", negative towards "benign". */
  contribution: number;
}

/**
 * Per-word explanation for char_wb models. char_wb n-grams never cross whitespace, so every n-gram belongs to
 * exactly one word; each n-gram's logit contribution is split evenly across its occurrences. Offsets refer to
 * the original (unnormalised) text. Returns [] for word-level models.
 */
export function wordContributions(model: Model, text: string): WordContribution[] {
  if (model.json.analyzer !== "char_wb") return [];
  const range = model.json.ngram_range;
  const words: { start: number; end: number; text: string; grams: string[] }[] = [];
  for (const m of text.matchAll(NON_WHITESPACE_RUN)) {
    words.push({ start: m.index, end: m.index + m[0].length, text: m[0], grams: charWbFeatures(m[0], range) });
  }
  const { tf, v, norm } = weights(model, words.flatMap((w) => w.grams));
  if (norm === 0) return words.map(({ start, end, text: t }) => ({ start, end, text: t, contribution: 0 }));
  return words.map(({ start, end, text: t, grams }) => {
    let c = 0;
    for (const g of grams) {
      const i = model.index.get(g);
      if (i !== undefined) c += ((v.get(i)! / norm) * model.json.coef[i]) / tf.get(i)!;
    }
    return { start, end, text: t, contribution: c };
  });
}

export type Script = "Latin" | "Arabic" | "Mixed" | "Other" | "None";

/** Which writing system the letters in `text` use (Arabic covers Urdu script). */
export function detectScript(text: string): Script {
  let latin = 0;
  let arabic = 0;
  let other = 0;
  for (const ch of text) {
    if (/\p{Script=Latin}/u.test(ch)) latin++;
    else if (/\p{Script=Arabic}/u.test(ch)) arabic++;
    else if (/\p{L}/u.test(ch)) other++;
  }
  const total = latin + arabic + other;
  if (total === 0) return "None";
  if (latin && arabic) return Math.min(latin, arabic) / total >= 0.1 ? "Mixed" : latin > arabic ? "Latin" : "Arabic";
  if (latin) return other / total >= 0.1 ? "Mixed" : "Latin";
  if (arabic) return other / total >= 0.1 ? "Mixed" : "Arabic";
  return "Other";
}

export type RiskLevel = "Low" | "Medium" | "High";

/** Display bands for the 0-100 risk score. The research metrics use a single 0.5 threshold. */
export function riskLevel(probability: number): RiskLevel {
  if (probability >= 0.7) return "High";
  if (probability >= 0.3) return "Medium";
  return "Low";
}

export const MAX_INPUT_CHARS = 5000;

/** Truncate to MAX_INPUT_CHARS code points (never splitting an emoji/surrogate pair). */
export function clampInput(text: string): { text: string; truncated: boolean } {
  const cps = Array.from(text);
  return cps.length > MAX_INPUT_CHARS
    ? { text: cps.slice(0, MAX_INPUT_CHARS).join(""), truncated: true }
    : { text, truncated: false };
}

export async function loadModel(url: string, signal?: AbortSignal): Promise<Model> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Could not load model (${res.status})`);
  return prepareModel((await res.json()) as TfidfModelJson);
}
