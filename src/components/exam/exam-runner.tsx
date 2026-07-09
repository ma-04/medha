"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MathText } from "@/components/math/math-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDurationBn, formatNumberBn } from "@/lib/format";
import type { QuestionOption } from "@/lib/questions";

export type ExamQuestion = {
  id: string;
  order_index: number;
  subject_id: string;
  body: string;
  options: QuestionOption[];
  image_url: string | null;
  source_label: string | null;
};

export function ExamRunner({
  examId,
  attemptId,
  deadline,
  serverNow,
  questions,
  initialAnswers,
}: {
  examId: string;
  attemptId: string;
  deadline: string;
  serverNow: string;
  questions: ExamQuestion[];
  initialAnswers: Record<string, string>;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const deadlineMs = useMemo(() => new Date(deadline).getTime(), [deadline]);
  // Correct for client/server clock skew so the countdown is authoritative.
  const skewRef = useRef(new Date(serverNow).getTime() - Date.now());

  const doSubmit = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      const { error } = await supabase.rpc("submit_attempt", {
        p_attempt_id: attemptId,
      });
      if (error && !auto) {
        toast.error(error.message);
        submittedRef.current = false;
        setSubmitting(false);
        return;
      }
      if (auto) toast.info("সময় শেষ — উত্তরপত্র জমা হয়েছে");
      router.replace(`/exams/${examId}/result`);
    },
    [supabase, attemptId, examId, router]
  );

  // Countdown; auto-submit at zero.
  useEffect(() => {
    function tick() {
      const left = Math.round((deadlineMs - (Date.now() + skewRef.current)) / 1000);
      setRemaining(left);
      if (left <= 0 && !submittedRef.current) doSubmit(true);
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadlineMs, doSubmit]);

  const q = questions[index];
  const answeredCount = Object.keys(answers).length;

  async function choose(key: string) {
    if (submittedRef.current) return;
    const prev = answers[q.id];
    const nextKey = prev === key ? null : key; // tap again to clear
    setAnswers((a) => {
      const copy = { ...a };
      if (nextKey === null) delete copy[q.id];
      else copy[q.id] = nextKey;
      return copy;
    });
    const { error } = await supabase.rpc("save_answer", {
      p_attempt_id: attemptId,
      p_question_id: q.id,
      // RPC accepts null to clear the answer; generated types type it as string.
      p_selected_key: nextKey as unknown as string,
    });
    if (error) {
      // Roll back on failure (e.g. deadline passed).
      setAnswers((a) => {
        const copy = { ...a };
        if (prev) copy[q.id] = prev;
        else delete copy[q.id];
        return copy;
      });
      toast.error(error.message);
    }
  }

  const low = remaining <= 60;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Sticky header: timer + progress */}
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border bg-background/95 p-3 backdrop-blur">
        <span className="text-sm text-muted-foreground">
          প্রশ্ন {formatNumberBn(index + 1)}/{formatNumberBn(questions.length)}
        </span>
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1 font-mono text-lg font-bold tabular-nums",
            low ? "bg-destructive/10 text-destructive" : "text-foreground"
          )}
        >
          <Clock className="size-4" />
          {formatDurationBn(remaining)}
        </div>
        <Button size="sm" onClick={() => doSubmit(false)} disabled={submitting}>
          জমা দিন
        </Button>
      </div>

      {/* Question */}
      <div className="rounded-lg border p-4">
        {q.source_label && (
          <p className="mb-2 text-xs text-muted-foreground">{q.source_label}</p>
        )}
        {q.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={q.image_url} alt="" className="mb-3 max-h-56 rounded" />
        )}
        <div className="font-bengali-serif text-lg">
          <MathText>{q.body}</MathText>
        </div>

        <ul className="mt-4 space-y-2">
          {q.options.map((opt) => {
            const isSelected = answers[q.id] === opt.key;
            return (
              <li key={opt.key}>
                <button
                  type="button"
                  onClick={() => choose(opt.key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors hover:border-primary",
                    isSelected && "border-primary bg-primary/10"
                  )}
                >
                  <span className="uppercase text-muted-foreground">
                    {opt.key}
                  </span>
                  <span className="flex-1 font-bengali-serif">
                    <MathText>{opt.text}</MathText>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          পূর্ববর্তী
        </Button>
        <span className="text-sm text-muted-foreground">
          উত্তর দেওয়া হয়েছে: {formatNumberBn(answeredCount)}/
          {formatNumberBn(questions.length)}
        </span>
        <Button
          variant="outline"
          onClick={() =>
            setIndex((i) => Math.min(questions.length - 1, i + 1))
          }
          disabled={index === questions.length - 1}
        >
          পরবর্তী
        </Button>
      </div>

      {/* Palette */}
      <div className="rounded-lg border p-3">
        <p className="mb-2 text-xs text-muted-foreground">প্রশ্ন প্যালেট</p>
        <div className="grid grid-cols-8 gap-2 sm:grid-cols-10">
          {questions.map((item, i) => {
            const answered = !!answers[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(i)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md border text-xs tabular-nums",
                  i === index && "ring-2 ring-primary",
                  answered
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground"
                )}
              >
                {formatNumberBn(i + 1)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
