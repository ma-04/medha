import type { QuestionOption } from "@/lib/questions";

// A displayed option keeps its original `key` (used for answer submission and
// correctness checks) but gets a fresh positional `label` (a/b/c/d…) so the
// visible ordering can be randomized without breaking grading.
export type ShuffledOption = {
  key: string;
  text: string;
  label: string;
};

const LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];

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
// `seed` (pass the question id) so the order is stable across re-renders and
// React Compiler purity-safe — no Math.random() during render. Each question
// gets its own scrambled order, and positional labels are reassigned a/b/c/d.
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
