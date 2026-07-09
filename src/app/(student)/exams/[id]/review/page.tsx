import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { MathText } from "@/components/math/math-text";
import { cn } from "@/lib/utils";
import { formatNumberBn } from "@/lib/format";
import type { QuestionOption } from "@/lib/questions";

type ReviewRow = {
  question_id: string;
  order_index: number;
  subject_id: string;
  body: string;
  options: QuestionOption[];
  image_url: string | null;
  explanation: string | null;
  selected_key: string | null;
  correct_key: string;
  is_correct: boolean;
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data: attempt } = await supabase
    .from("exam_attempts")
    .select("id")
    .eq("exam_id", id)
    .maybeSingle();
  if (!attempt) redirect(`/exams/${id}`);

  const { data, error } = await supabase.rpc("get_attempt_review", {
    p_attempt_id: attempt.id,
  });
  if (error) redirect(`/exams/${id}/result`);
  const rows = (data ?? []) as ReviewRow[];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={`/exams/${id}/result`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← ফলাফল
      </Link>
      <h1 className="text-xl font-bold">উত্তরপত্র পর্যালোচনা</h1>

      {rows.map((r) => (
        <div key={r.question_id} className="rounded-lg border p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formatNumberBn(r.order_index + 1)}.
            </span>
            {r.is_correct ? (
              <Check className="size-4 text-green-600" />
            ) : (
              <X className="size-4 text-destructive" />
            )}
          </div>
          {r.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.image_url} alt="" className="mb-3 max-h-56 rounded" />
          )}
          <div className="font-bengali-serif">
            <MathText>{r.body}</MathText>
          </div>
          <ul className="mt-3 space-y-1.5">
            {r.options.map((opt) => {
              const isCorrect = opt.key === r.correct_key;
              const isChosen = opt.key === r.selected_key;
              const chosenWrong = isChosen && !isCorrect;
              return (
                <li
                  key={opt.key}
                  className={cn(
                    "flex items-center gap-3 rounded-md border p-2.5 text-sm",
                    isCorrect && "border-green-500 bg-green-500/10",
                    chosenWrong && "border-destructive bg-destructive/10"
                  )}
                >
                  <span className="uppercase text-muted-foreground">
                    {opt.key}
                  </span>
                  <span className="flex-1 font-bengali-serif">
                    <MathText>{opt.text}</MathText>
                  </span>
                  {isCorrect && <Check className="size-4 text-green-600" />}
                  {chosenWrong && <X className="size-4 text-destructive" />}
                </li>
              );
            })}
          </ul>
          {r.explanation && (
            <div className="mt-3 rounded-md bg-muted p-3 text-sm">
              <span className="font-semibold">ব্যাখ্যা: </span>
              <span className="font-bengali-serif">
                <MathText>{r.explanation}</MathText>
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
