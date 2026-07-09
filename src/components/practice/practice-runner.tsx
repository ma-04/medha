"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MathText } from "@/components/math/math-text";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { QuestionOption } from "@/lib/questions";

type Question = {
  id: string;
  body: string;
  options: QuestionOption[];
  image_url: string | null;
  source_label: string | null;
};

type Reveal = {
  correctKey: string;
  isCorrect: boolean;
  explanation: string | null;
};

export function PracticeRunner({ questions }: { questions: Question[] }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [checking, setChecking] = useState(false);
  const [score, setScore] = useState({ correct: 0, answered: 0 });

  const q = questions[index];
  const isLast = index === questions.length - 1;

  async function choose(key: string) {
    if (reveal) return;
    setSelected(key);
    setChecking(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("check_practice_answer", {
        p_question_id: q.id,
        p_selected_key: key,
      });
      if (error) throw error;
      const row = data?.[0];
      if (row) {
        setReveal({
          correctKey: row.correct_key,
          isCorrect: row.is_correct,
          explanation: row.explanation,
        });
        setScore((s) => ({
          correct: s.correct + (row.is_correct ? 1 : 0),
          answered: s.answered + 1,
        }));
      }
    } finally {
      setChecking(false);
    }
  }

  function next() {
    setSelected(null);
    setReveal(null);
    setIndex((i) => Math.min(i + 1, questions.length - 1));
  }

  if (index >= questions.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Progress
          value={((index + (reveal ? 1 : 0)) / questions.length) * 100}
          className="flex-1"
        />
        <span className="text-sm text-muted-foreground">
          {index + 1}/{questions.length}
        </span>
      </div>

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
            const isSelected = selected === opt.key;
            const isCorrectOpt = reveal?.correctKey === opt.key;
            const showWrong = reveal && isSelected && !reveal.isCorrect;
            return (
              <li key={opt.key}>
                <button
                  type="button"
                  disabled={!!reveal || checking}
                  onClick={() => choose(opt.key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors",
                    !reveal && "hover:border-primary",
                    isCorrectOpt && "border-green-500 bg-green-500/10",
                    showWrong && "border-destructive bg-destructive/10"
                  )}
                >
                  <span className="uppercase text-muted-foreground">
                    {opt.key}
                  </span>
                  <span className="flex-1 font-bengali-serif">
                    <MathText>{opt.text}</MathText>
                  </span>
                  {isCorrectOpt && <Check className="size-4 text-green-600" />}
                  {showWrong && <X className="size-4 text-destructive" />}
                </button>
              </li>
            );
          })}
        </ul>

        {reveal?.explanation && (
          <div className="mt-4 rounded-md bg-muted p-3 text-sm">
            <span className="font-semibold">ব্যাখ্যা: </span>
            <span className="font-bengali-serif">
              <MathText>{reveal.explanation}</MathText>
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          সঠিক: {score.correct}/{score.answered}
        </span>
        {reveal && !isLast && <Button onClick={next}>পরবর্তী</Button>}
        {reveal && isLast && (
          <span className="text-sm font-medium text-primary">
            অনুশীলন শেষ! 🎉
          </span>
        )}
      </div>
    </div>
  );
}
