import { describe, it, expect } from "vitest";
import { gradeAttempt, type GradableQuestion } from "./scoring";

const pattern = { mark_per_question: 1, negative_mark: 0.25 };

const qs: GradableQuestion[] = [
  { questionId: "q1", subjectId: "bangla", correctKey: "a" },
  { questionId: "q2", subjectId: "bangla", correctKey: "b" },
  { questionId: "q3", subjectId: "math", correctKey: "c" },
  { questionId: "q4", subjectId: "math", correctKey: "d" },
];

describe("gradeAttempt", () => {
  it("scores all correct at full marks with no negatives", () => {
    const r = gradeAttempt(
      qs,
      { q1: "a", q2: "b", q3: "c", q4: "d" },
      pattern
    );
    expect(r.correct).toBe(4);
    expect(r.wrong).toBe(0);
    expect(r.skipped).toBe(0);
    expect(r.score).toBe(4);
  });

  it("applies negative marking to wrong answers", () => {
    // 2 correct (+2), 2 wrong (-0.5) => 1.5
    const r = gradeAttempt(
      qs,
      { q1: "a", q2: "b", q3: "a", q4: "a" },
      pattern
    );
    expect(r.correct).toBe(2);
    expect(r.wrong).toBe(2);
    expect(r.score).toBeCloseTo(1.5);
  });

  it("does not penalize skipped questions", () => {
    // 1 correct (+1), 0 wrong, 3 skipped => 1
    const r = gradeAttempt(qs, { q1: "a" }, pattern);
    expect(r.correct).toBe(1);
    expect(r.wrong).toBe(0);
    expect(r.skipped).toBe(3);
    expect(r.score).toBe(1);
  });

  it("treats empty-string selection as skipped", () => {
    const r = gradeAttempt(qs, { q1: "", q2: null }, pattern);
    expect(r.skipped).toBe(4);
    expect(r.score).toBe(0);
  });

  it("can go negative when wrong answers outweigh correct", () => {
    // 0 correct, 4 wrong => -1
    const r = gradeAttempt(
      qs,
      { q1: "b", q2: "a", q3: "a", q4: "a" },
      pattern
    );
    expect(r.wrong).toBe(4);
    expect(r.score).toBeCloseTo(-1);
  });

  it("respects a zero negative-mark pattern", () => {
    const r = gradeAttempt(
      qs,
      { q1: "b", q2: "a", q3: "c", q4: "d" },
      { mark_per_question: 1, negative_mark: 0 }
    );
    expect(r.correct).toBe(2);
    expect(r.wrong).toBe(2);
    expect(r.score).toBe(2);
  });

  it("honors custom mark_per_question", () => {
    const r = gradeAttempt(
      qs,
      { q1: "a", q2: "b", q3: "c", q4: "d" },
      { mark_per_question: 2, negative_mark: 0.5 }
    );
    expect(r.score).toBe(8);
  });

  it("builds a correct per-subject breakdown", () => {
    const r = gradeAttempt(
      qs,
      { q1: "a", q2: "x", q3: "c" },
      pattern
    );
    expect(r.breakdown.bangla).toEqual({
      total: 2,
      correct: 1,
      wrong: 1,
      skipped: 0,
    });
    expect(r.breakdown.math).toEqual({
      total: 2,
      correct: 1,
      wrong: 0,
      skipped: 1,
    });
  });
});
