import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ExamRunner, type ExamQuestion } from "@/components/exam/exam-runner";

export const dynamic = "force-dynamic";

type StartResult = {
  attempt_id: string;
  /** Null for an untimed model test. */
  deadline: string | null;
  started_at: string;
  submitted_at: string | null;
  server_now: string;
  answers: Record<string, string>;
  questions: ExamQuestion[];
};

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("start_exam_attempt", {
    p_exam_id: id,
  });
  if (error) {
    // Window closed / not available — send back to the detail page.
    redirect(`/exams/${id}`);
  }
  const result = data as unknown as StartResult;
  if (!result) notFound();

  // Already submitted → straight to results.
  if (result.submitted_at) redirect(`/exams/${id}/result`);

  // Deadline already passed (e.g. resumed too late) → submit + results.
  // An untimed attempt has no deadline and can always be resumed.
  if (
    result.deadline &&
    new Date(result.deadline).getTime() <= new Date(result.server_now).getTime()
  ) {
    await supabase.rpc("submit_attempt", { p_attempt_id: result.attempt_id });
    redirect(`/exams/${id}/result`);
  }

  return (
    <ExamRunner
      examId={id}
      attemptId={result.attempt_id}
      deadline={result.deadline}
      startedAt={result.started_at}
      serverNow={result.server_now}
      questions={result.questions}
      initialAnswers={result.answers ?? {}}
    />
  );
}
