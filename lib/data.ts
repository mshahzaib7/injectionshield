/**
 * Build-time access to the research outputs in public/data/ (produced by research/scripts/09_metrics.py etc.).
 * Server-only: pages are statically exported, so these files are read once during `next build`.
 * Every reader returns null on a missing or malformed file, and the UI shows "Results pending".
 */
import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type LangKey = "en" | "ur" | "roman_ur" | "code_mixed";
export type Interval = [number, number] | null;

export interface LangResult {
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  fpr: number | null;
  bypass_rate: number | null;
  roc_auc: number | null;
  n: number;
  n_attack: number;
  n_benign: number;
  ci: Record<"accuracy" | "precision" | "recall" | "f1" | "fpr" | "bypass_rate" | "roc_auc", Interval>;
}

export interface PairedResult {
  n_groups: number;
  attacks: {
    n: number;
    recall_en: number | null;
    recall_lang: number | null;
    caught_in_en: number;
    caught_en_missed_lang: number;
    switch_bypass_rate: number | null;
    switch_bypass_ci: Interval;
    mcnemar_p: number | null;
  };
  benign: { n: number; fpr_en: number | null; fpr_lang: number | null };
}

export interface DetectorInfo {
  key: string;
  id: string;
  name: string;
  role: "main" | "previous" | "ablation";
  description: string;
  available: boolean;
}

export interface Metrics {
  generated_at: string;
  threshold: number;
  n_bootstrap: number;
  languages: { key: LangKey; name: string }[];
  detectors: DetectorInfo[];
  results: Record<string, Partial<Record<LangKey, LangResult>>>;
  paired: Record<string, Partial<Record<LangKey, PairedResult | null>>>;
}

export interface Summary {
  generated_at: string;
  status: "complete" | "partial";
  unavailable_detectors: string[];
  cards: { label: string; value: string; detail: string }[];
  findings: { rq: string; detector: string; title: string; statement: string }[];
  note: string;
}

export interface ErrorExample {
  group_id: string;
  text: string;
  english: string;
  score: number;
}
export interface ErrorSample {
  per_category: number;
  detectors: Record<string, Partial<Record<LangKey, { bypass: ErrorExample[]; false_positive: ErrorExample[] }>>>;
}

export interface DatasetCounts {
  total_rows: number;
  unique_groups: number;
  counts: Record<string, Partial<Record<LangKey, { attack?: number; benign?: number }>>>;
  by_source: Record<string, number>;
}

export interface DatasetExamples {
  examples: { group_id: string; label: "attack" | "benign"; texts: Record<LangKey, string> }[];
}

function read<T>(file: string, valid: (x: unknown) => boolean): T | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(process.cwd(), "public", "data", file), "utf8"));
    return valid(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

export const getMetrics = () =>
  read<Metrics>("metrics.json", (x) => isObj(x) && Array.isArray(x.detectors) && isObj(x.results) && isObj(x.paired));
export const getSummary = () =>
  read<Summary>("summary.json", (x) => isObj(x) && Array.isArray(x.cards) && Array.isArray(x.findings));
export const getErrorSample = () => read<ErrorSample>("errors_sample.json", (x) => isObj(x) && isObj(x.detectors));
export const getDatasetCounts = () =>
  read<DatasetCounts>("dataset_counts.json", (x) => isObj(x) && isObj(x.counts) && typeof x.total_rows === "number");
export const getDatasetExamples = () =>
  read<DatasetExamples>("dataset_examples.json", (x) => isObj(x) && Array.isArray(x.examples));

export interface IndependentResults {
  source: string;
  counts: Record<"en" | "ur" | "roman_ur", { attack: number; benign: number }>;
  detectors: Record<
    string,
    { id: string; name: string; by_lang: Record<"en" | "ur" | "roman_ur", { n: number; recall: number | null; fpr: number | null }> }
  >;
  stress?: {
    n: Record<"roman_ur" | "ur", number>;
    categories: Record<string, string>;
    detectors: Record<
      string,
      { id: string; name: string; by_lang: Record<"roman_ur" | "ur", { recall: number | null; ci: Interval; by_category: Record<string, number | null> }> }
    >;
  };
}
export const getIndependent = () =>
  read<IndependentResults>("independent.json", (x) => isObj(x) && isObj(x.detectors) && isObj(x.counts));

export const LANG_LABEL: Record<LangKey, string> = {
  en: "English",
  ur: "Urdu (script)",
  roman_ur: "Roman Urdu",
  code_mixed: "Code-mixed",
};
export const LANG_ORDER: LangKey[] = ["en", "ur", "roman_ur", "code_mixed"];
