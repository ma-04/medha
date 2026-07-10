"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MathText } from "@/components/math/math-text";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ArchiveQuestion } from "@/lib/queries/archive";

export function ArchiveCard({ question }: { question: ArchiveQuestion }) {
  const t = useTranslations();
  const [reveal, setReveal] = useState<{
    correctKey: string;
    explanation: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function showAnswer() {
    if (reveal || loading) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.rpc("reveal_answer", {
        p_question_id: question.id,
      });
      const row = data?.[0];
      if (row) {
        setReveal({
          correctKey: row.correct_key,
          explanation: row.explanation,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{question.subject_bn}</Badge>
        {question.source_label && (
          <span className="text-xs text-muted-foreground">
            {question.source_label}
          </span>
        )}
      </div>

      {question.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={question.image_url} alt="" className="mb-3 max-h-56 rounded" />
      )}

      <div className="font-bengali-serif text-lg">
        <MathText>{question.body}</MathText>
      </div>

      <ul className="mt-3 space-y-1.5">
        {question.options.map((opt) => {
          const isCorrect = reveal?.correctKey === opt.key;
          return (
            <li
              key={opt.key}
              className={cn(
                "flex items-center gap-3 rounded-md border p-2.5 text-sm",
                isCorrect && "border-green-500 bg-green-500/10"
              )}
            >
              <span className="uppercase text-muted-foreground">{opt.key}</span>
              <span className="flex-1 font-bengali-serif">
                <MathText>{opt.text}</MathText>
              </span>
              {isCorrect && <Check className="size-4 text-green-600" />}
            </li>
          );
        })}
      </ul>

      {reveal ? (
        reveal.explanation && (
          <div className="mt-3 rounded-md bg-muted p-3 text-sm">
            <span className="font-semibold">{t("common.explanation")} </span>
            <span className="font-bengali-serif">
              <MathText>{reveal.explanation}</MathText>
            </span>
          </div>
        )
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={showAnswer}
          disabled={loading}
        >
          <Eye className="size-4" /> {t("archive.showAnswer")}
        </Button>
      )}
    </div>
  );
}
