"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { questionInputSchema, type QuestionInput } from "@/lib/questions";

export type SaveResult = { error?: string; ok?: boolean };

export async function saveQuestion(input: QuestionInput): Promise<SaveResult> {
  await requireAdmin();
  const parsed = questionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "অবৈধ তথ্য" };
  }
  const q = parsed.data;

  // Ensure correct_key refers to an existing option.
  if (!q.options.some((o) => o.key === q.correct_key)) {
    return { error: "সঠিক উত্তরের অপশনটি বিদ্যমান নয়" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_upsert_question", {
    p_id: q.id ?? undefined,
    p_topic_id: q.topic_id,
    p_body: q.body,
    p_options: q.options,
    p_correct_key: q.correct_key,
    p_explanation: q.explanation ?? undefined,
    p_image_url: q.image_url ?? undefined,
    p_difficulty: q.difficulty ?? undefined,
    p_source_exam: q.source_exam ?? undefined,
    p_source_year: q.source_year ?? undefined,
    p_source_label: q.source_label ?? undefined,
    p_status: q.status,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/questions");
  return { ok: true };
}

export async function deleteQuestion(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("questions").delete().eq("id", id);
  revalidatePath("/admin/questions");
}

export async function saveQuestionAndReturn(input: QuestionInput) {
  const result = await saveQuestion(input);
  if (result.ok) redirect("/admin/questions");
  return result;
}
