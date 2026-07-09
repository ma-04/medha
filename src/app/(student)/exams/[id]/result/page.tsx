import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumberBn } from "@/lib/format";
import { localName } from "@/lib/i18n-name";

type Breakdown = Record<
  string,
  { total: number; correct: number; wrong: number; skipped: number }
>;

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const locale = await getLocale();

  const { data: exam } = await supabase
    .from("exams")
    .select("title_bn, type, results_published_at, pattern")
    .eq("id", id)
    .single();
  if (!exam) notFound();

  const { data: attempt } = await supabase
    .from("exam_attempts")
    .select("*")
    .eq("exam_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!attempt) redirect(`/exams/${id}`);
  if (!attempt.submitted_at) redirect(`/exams/${id}/attempt`);

  const breakdown = (attempt.subject_breakdown ?? {}) as Breakdown;
  const subjectIds = Object.keys(breakdown);
  const { data: subjects } = subjectIds.length
    ? await supabase
        .from("subjects")
        .select("id, name_bn, name_en")
        .in("id", subjectIds)
    : { data: [] };
  const subjectName = new Map(
    (subjects ?? []).map((s) => [s.id, localName(s, locale)])
  );

  const total = (exam.pattern as { total_questions?: number })?.total_questions ?? 0;
  const maxScore =
    total *
    ((exam.pattern as { mark_per_question?: number })?.mark_per_question ?? 1);

  // Live exams: review only after results are published.
  const reviewAvailable =
    exam.type === "model" || !!exam.results_published_at;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/exams"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← পরীক্ষা
        </Link>
        <h1 className="mt-1 font-bengali-serif text-2xl font-bold">
          {exam.title_bn}
        </h1>
      </div>

      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">আপনার স্কোর</p>
          <p className="text-4xl font-bold">
            {formatNumberBn(Number(attempt.score ?? 0))}
            <span className="text-lg text-muted-foreground">
              {" "}
              / {formatNumberBn(maxScore)}
            </span>
          </p>
          {exam.type === "live" && attempt.rank != null && (
            <p className="mt-2 text-sm text-muted-foreground">
              মেধাক্রম: {formatNumberBn(attempt.rank)}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="সঠিক" value={attempt.correct_count ?? 0} tone="good" />
        <Stat label="ভুল" value={attempt.wrong_count ?? 0} tone="bad" />
        <Stat label="বাদ" value={attempt.skipped_count ?? 0} />
      </div>

      {subjectIds.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-semibold">বিষয়ভিত্তিক ফলাফল</p>
            {subjectIds.map((sid) => {
              const b = breakdown[sid];
              return (
                <div
                  key={sid}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-bengali-serif">
                    {subjectName.get(sid) ?? "—"}
                  </span>
                  <span className="text-muted-foreground">
                    {formatNumberBn(b.correct)}/{formatNumberBn(b.total)} সঠিক
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {reviewAvailable ? (
        <Button
          nativeButton={false}
          render={<Link href={`/exams/${id}/review`} />}
        >
          উত্তরপত্র পর্যালোচনা
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          ফলাফল প্রকাশের পর উত্তরপত্র দেখা যাবে।
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
}) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p
          className={
            tone === "good"
              ? "text-2xl font-bold text-green-600"
              : tone === "bad"
                ? "text-2xl font-bold text-destructive"
                : "text-2xl font-bold"
          }
        >
          {formatNumberBn(value)}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
