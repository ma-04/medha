import { z } from "zod";

export type ExamPattern = {
  duration_minutes: number;
  negative_mark: number;
  mark_per_question: number;
  total_questions: number;
};

export const examStatuses = [
  "draft",
  "scheduled",
  "published",
  "archived",
] as const;

export const examStatusLabels: Record<string, string> = {
  draft: "খসড়া",
  scheduled: "নির্ধারিত",
  published: "প্রকাশিত",
  archived: "সংরক্ষিত",
};

export const examTypeLabels: Record<string, string> = {
  model: "মডেল টেস্ট",
  live: "লাইভ পরীক্ষা",
};

// Form input for creating/editing an exam. Datetimes come from the admin form
// as ISO strings (or empty); live exams require both.
export const examInputSchema = z
  .object({
    id: z.string().uuid().optional().nullable(),
    title_bn: z.string().min(1, "শিরোনাম দিন"),
    title_en: z.string().min(1, "English title required"),
    description: z.string().optional().nullable(),
    type: z.enum(["model", "live"]),
    duration_minutes: z.coerce.number().int().min(1).max(600),
    negative_mark: z.coerce.number().min(0).max(5),
    mark_per_question: z.coerce.number().min(0.1).max(100),
    starts_at: z.string().optional().nullable(),
    ends_at: z.string().optional().nullable(),
    status: z.enum(examStatuses).default("draft"),
  })
  .refine(
    (v) => v.type !== "live" || (v.starts_at && v.ends_at),
    { message: "লাইভ পরীক্ষার শুরু ও শেষ সময় দিন", path: ["starts_at"] }
  )
  .refine(
    (v) =>
      v.type !== "live" ||
      !v.starts_at ||
      !v.ends_at ||
      new Date(v.ends_at) > new Date(v.starts_at),
    { message: "শেষ সময় শুরুর পরে হতে হবে", path: ["ends_at"] }
  );

export type ExamInput = z.infer<typeof examInputSchema>;

export function defaultPattern(): ExamPattern {
  return {
    duration_minutes: 30,
    negative_mark: 0.25,
    mark_per_question: 1,
    total_questions: 0,
  };
}
