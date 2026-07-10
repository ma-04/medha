import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExamForm } from "../exam-form";
import { QuestionPicker, type PickableQuestion } from "../question-picker";
import type { ExamInput } from "@/lib/exams";

export default async function EditExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: exam } = await supabase
    .from("exams")
    .select("*")
    .eq("id", id)
    .single();
  if (!exam) notFound();

  const pattern = exam.pattern as {
    duration_minutes?: number;
    negative_mark?: number;
    mark_per_question?: number;
  } | null;

  const initial: ExamInput = {
    id: exam.id,
    title_bn: exam.title_bn,
    title_en: exam.title_en,
    description: exam.description,
    type: exam.type as ExamInput["type"],
    duration_minutes: pattern?.duration_minutes ?? 30,
    negative_mark: pattern?.negative_mark ?? 0.25,
    mark_per_question: pattern?.mark_per_question ?? 1,
    starts_at: exam.starts_at,
    ends_at: exam.ends_at,
    status: exam.status as ExamInput["status"],
    max_attempts: exam.max_attempts ?? 1,
  };

  // Pool of published questions to pick from.
  const { data: pool } = await supabase
    .from("questions")
    .select("id, body, topics(name_bn, subjects(name_bn))")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(500);

  const pickable: PickableQuestion[] = (pool ?? []).map((q) => {
    const topic = q.topics as
      | { name_bn: string; subjects: { name_bn: string } | null }
      | null;
    return {
      id: q.id,
      body: q.body,
      topic_bn: topic?.name_bn ?? "",
      subject_bn: topic?.subjects?.name_bn ?? "",
    };
  });

  const { data: current } = await supabase
    .from("exam_questions")
    .select("question_id, order_index")
    .eq("exam_id", id)
    .order("order_index");
  const selectedIds = (current ?? []).map((r) => r.question_id);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/exams"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← পরীক্ষা
        </Link>
        <h1 className="mt-1 font-bengali-serif text-2xl font-bold">
          {exam.title_bn}
        </h1>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">তথ্য</h2>
        <ExamForm initial={initial} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">প্রশ্ন নির্বাচন</h2>
        <QuestionPicker
          examId={id}
          pool={pickable}
          initialSelectedIds={selectedIds}
        />
      </section>
    </div>
  );
}
