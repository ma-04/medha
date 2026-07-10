"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { examInputSchema, type ExamInput } from "@/lib/exams";

export type SaveResult = { error?: string; id?: string };

function patternFrom(q: ExamInput) {
  return {
    duration_minutes: q.duration_minutes,
    negative_mark: q.negative_mark,
    mark_per_question: q.mark_per_question,
    total_questions: 0,
    // A live exam is bounded by ends_at, so it is always timed.
    timed: q.type === "live" ? true : q.timed,
  };
}

export async function saveExam(input: ExamInput): Promise<SaveResult> {
  await requireStaff();
  const parsed = examInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "অবৈধ তথ্য" };
  }
  const q = parsed.data;
  const supabase = await createClient();

  const row = {
    title_bn: q.title_bn,
    title_en: q.title_en,
    description: q.description || null,
    type: q.type,
    starts_at: q.type === "live" ? q.starts_at : null,
    ends_at: q.type === "live" ? q.ends_at : null,
    status: q.status,
    max_attempts: q.type === "live" ? 1 : q.max_attempts,
  };

  if (q.id) {
    // Preserve total_questions already computed from the question set.
    const { data: existing } = await supabase
      .from("exams")
      .select("pattern")
      .eq("id", q.id)
      .single();
    const total =
      (existing?.pattern as { total_questions?: number } | null)
        ?.total_questions ?? 0;
    const { error } = await supabase
      .from("exams")
      .update({ ...row, pattern: { ...patternFrom(q), total_questions: total } })
      .eq("id", q.id);
    if (error) return { error: error.message };
    revalidatePath("/admin/exams");
    return { id: q.id };
  }

  const { data, error } = await supabase
    .from("exams")
    .insert({ ...row, pattern: patternFrom(q) })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/admin/exams");
  return { id: data.id };
}

export async function saveExamAndRedirect(input: ExamInput) {
  const result = await saveExam(input);
  if (result.id) redirect(`/admin/exams/${result.id}`);
  return result;
}

export async function setExamQuestions(examId: string, questionIds: string[]) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_exam_questions", {
    p_exam_id: examId,
    p_question_ids: questionIds,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/exams/${examId}`);
  return { ok: true };
}

export async function deleteExam(id: string) {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("exams").delete().eq("id", id);
  revalidatePath("/admin/exams");
}
