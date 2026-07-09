import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSubjectsWithTopics } from "@/lib/queries/taxonomy";
import { QuestionForm } from "../question-form";
import type { QuestionInput, QuestionOption } from "@/lib/questions";

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: question }, { data: answer }, subjects] = await Promise.all([
    supabase.from("questions").select("*").eq("id", id).single(),
    supabase
      .from("question_answers")
      .select("correct_key")
      .eq("question_id", id)
      .single(),
    getSubjectsWithTopics(),
  ]);

  if (!question) notFound();

  const initial: QuestionInput = {
    id: question.id,
    topic_id: question.topic_id,
    body: question.body,
    options: question.options as QuestionOption[],
    correct_key: (answer?.correct_key as QuestionInput["correct_key"]) ?? "a",
    explanation: question.explanation,
    image_url: question.image_url,
    difficulty: question.difficulty,
    source_exam: question.source_exam,
    source_year: question.source_year,
    source_label: question.source_label,
    status: question.status as QuestionInput["status"],
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">প্রশ্ন সম্পাদনা</h1>
      <QuestionForm subjects={subjects} initial={initial} />
    </div>
  );
}
