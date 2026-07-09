import { z } from "zod";
import { optionKeys } from "@/lib/questions";
import { createHash } from "node:crypto";

// A single import row. Options can be given either as an `options` array
// (JSON) or flat option_a..option_e columns (CSV). subject/topic are matched
// by slug.
export const importRowSchema = z
  .object({
    subject_slug: z.string().min(1),
    topic_slug: z.string().min(1),
    body: z.string().min(1),
    options: z
      .array(z.object({ key: z.string(), text: z.string() }))
      .optional(),
    option_a: z.string().optional(),
    option_b: z.string().optional(),
    option_c: z.string().optional(),
    option_d: z.string().optional(),
    option_e: z.string().optional(),
    correct_key: z.string().min(1),
    explanation: z.string().optional().nullable(),
    difficulty: z.coerce.number().int().min(1).max(3).optional().nullable(),
    source_exam: z.string().optional().nullable(),
    source_year: z.coerce.number().int().optional().nullable(),
    source_label: z.string().optional().nullable(),
    status: z.enum(["draft", "published", "archived"]).optional(),
  })
  .transform((row) => {
    const options: { key: string; text: string }[] =
      row.options && row.options.length > 0
        ? row.options.map((o) => ({
            key: o.key.trim().toLowerCase(),
            text: o.text,
          }))
        : optionKeys.flatMap((k) => {
            const text = row[`option_${k}` as const];
            return text && text.trim() ? [{ key: k as string, text }] : [];
          });
    return { ...row, options, correct_key: row.correct_key.trim().toLowerCase() };
  });

export type ImportRow = z.infer<typeof importRowSchema>;

export function contentHash(body: string, sourceExam?: string | null): string {
  return createHash("sha256")
    .update(`${sourceExam ?? ""}::${body.trim()}`)
    .digest("hex");
}
