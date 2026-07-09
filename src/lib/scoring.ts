// Pure grading logic — the authoritative grade is computed server-side by the
// _grade_attempt SQL function; this mirrors its formula for unit testing and
// for any client-side score estimate. Keep the two in sync.

export type GradableQuestion = {
  questionId: string;
  subjectId: string;
  correctKey: string;
};

export type SubjectResult = {
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
};

export type GradeResult = {
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  breakdown: Record<string, SubjectResult>;
};

export function gradeAttempt(
  questions: GradableQuestion[],
  answers: Record<string, string | null | undefined>,
  pattern: { mark_per_question: number; negative_mark: number }
): GradeResult {
  const breakdown: Record<string, SubjectResult> = {};
  let correct = 0;
  let wrong = 0;
  let skipped = 0;

  for (const q of questions) {
    const b = (breakdown[q.subjectId] ??= {
      total: 0,
      correct: 0,
      wrong: 0,
      skipped: 0,
    });
    b.total += 1;

    const selected = answers[q.questionId];
    if (selected == null || selected === "") {
      skipped += 1;
      b.skipped += 1;
    } else if (selected === q.correctKey) {
      correct += 1;
      b.correct += 1;
    } else {
      wrong += 1;
      b.wrong += 1;
    }
  }

  const score =
    correct * pattern.mark_per_question - wrong * pattern.negative_mark;

  return { score, correct, wrong, skipped, breakdown };
}
