import { z } from "zod";

export const optionKeys = ["a", "b", "c", "d", "e"] as const;

export const questionOptionSchema = z.object({
  key: z.enum(optionKeys),
  text: z.string().min(1),
});

export const questionInputSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  topic_id: z.string().uuid(),
  body: z.string().min(1),
  options: z.array(questionOptionSchema).min(2).max(5),
  correct_key: z.enum(optionKeys),
  explanation: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  difficulty: z.coerce.number().int().min(1).max(3).optional().nullable(),
  source_exam: z.string().optional().nullable(),
  source_year: z.coerce.number().int().optional().nullable(),
  source_label: z.string().optional().nullable(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;
export type QuestionOption = z.infer<typeof questionOptionSchema>;
