import type { QuestionOption } from "@/lib/questions";

// A displayed option keeps its original `key` (used for answer submission and
// correctness checks) but gets a fresh positional `label` (a/b/c/d…) so the
// visible ordering can be randomized without breaking grading.
export type ShuffledOption = {
  key: string;
  text: string;
  label: string;
};

export const LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** Positional label for the i-th displayed option. Use this wherever the order
 *  already arrived shuffled (exam runner, review) — labelling by `option.key`
 *  there would print the authored letter next to a moved option. */
export function optionLabel(i: number): string {
  return LABELS[i] ?? String(i + 1);
}

// FNV-1a hash → deterministic 32-bit seed from a string (e.g. a question id).
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 PRNG — small, fast, deterministic given a seed.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Randomizes the display order of a question's options. Deterministic per
// `seed` so the order is stable across re-renders and React Compiler
// purity-safe — no Math.random() during render. Positional labels are
// reassigned a/b/c/d.
//
// Exams no longer use this: start_exam_attempt and get_attempt_review shuffle
// server-side per attempt, so the runner and the review agree and the Android
// client needs no port of this PRNG. It remains for practice and the archive,
// where nothing has to agree with anything. Vary the seed per session/page view
// (not just the question id), or the scramble is frozen forever.
export function shuffleOptions(
  options: QuestionOption[],
  seed: string
): ShuffledOption[] {
  const rng = mulberry32(hashSeed(seed));
  const arr = options.map((o) => ({ key: o.key, text: o.text }));
  // Fisher–Yates using the seeded PRNG.
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.map((o, i) => ({ key: o.key, text: o.text, label: LABELS[i] }));
}
