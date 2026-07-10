import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration, formatNumber } from "@/lib/format";
import { localName } from "@/lib/i18n-name";
import { AttemptPanel } from "@/components/exam/attempt-panel";

type Breakdown = Record<
  string,
  { total: number; correct: number; wrong: number; skipped: number }
>;

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string }>;
}) {
  const { id } = await params;
  const { a } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const locale = await getLocale();
  const t = await getTranslations("exam");

  const [{ data: exam }, { data: attempts }] = await Promise.all([
    supabase
      .from("exams")
      .select("title_bn, type, results_published_at, pattern, max_attempts")
      .eq("id", id)
      .single(),
    supabase
      .from("exam_attempts")
      .select("*")
      .eq("exam_id", id)
      .eq("user_id", user.id)
      .order("attempt_number", { ascending: true }),
  ]);
  if (!exam) notFound();

  const all = attempts ?? [];
  if (all.length === 0) redirect(`/exams/${id}`);
  const submitted = all.filter((x) => x.submitted_at);
  if (submitted.length === 0) redirect(`/exams/${id}/attempt`);

  // Show the requested attempt (?a=) when it's a submitted one the user owns,
  // otherwise fall back to their latest submitted attempt.
  const attempt =
    (a ? submitted.find((x) => x.id === a) : undefined) ??
    submitted[submitted.length - 1];

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

  // Auto-submit runs on a one-minute cron, so submitted_at can overshoot the
  // deadline; clamp, or a timed exam reports more time than it allowed.
  const submittedMs = new Date(attempt.submitted_at!).getTime();
  const endMs = attempt.deadline
    ? Math.min(submittedMs, new Date(attempt.deadline).getTime())
    : submittedMs;
  const totalSeconds = Math.max(
    0,
    Math.round((endMs - new Date(attempt.started_at).getTime()) / 1000)
  );
  // For an untimed attempt this is wall-clock, not time on task — a student who
  // left the tab open overnight will see it. Averaging it per question would be
  // noise, so only timed attempts get an average.
  const avgSeconds =
    attempt.deadline && total > 0 ? Math.round(totalSeconds / total) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/exams"
          className="text-sm text-muted-foreground hover:underline"
        >
          {t("result.back")}
        </Link>
        <h1 className="mt-1 font-bengali-serif text-2xl font-bold">
          {exam.title_bn}
        </h1>
        {exam.max_attempts > 1 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("result.attemptOf", {
              n: formatNumber(attempt.attempt_number, locale),
              max: formatNumber(exam.max_attempts, locale),
            })}
          </p>
        )}
      </div>

      {submitted.length > 1 && (
        <AttemptPanel
          examId={id}
          attempts={submitted.map((x) => ({
            id: x.id,
            attempt_number: x.attempt_number,
            score: Number(x.score ?? 0),
          }))}
          maxScore={maxScore}
          canRetry={false}
          maxAttempts={exam.max_attempts}
        />
      )}

      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("result.yourScore")}</p>
          <p className="text-4xl font-bold">
            {formatNumber(Number(attempt.score ?? 0), locale)}
            <span className="text-lg text-muted-foreground">
              {" "}
              / {formatNumber(maxScore, locale)}
            </span>
          </p>
          {exam.type === "live" && attempt.rank != null && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("result.rank")}: {formatNumber(attempt.rank, locale)}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Stat label={t("result.correct")} value={attempt.correct_count ?? 0} tone="good" locale={locale} />
        <Stat label={t("result.wrong")} value={attempt.wrong_count ?? 0} tone="bad" locale={locale} />
        <Stat label={t("result.skipped")} value={attempt.skipped_count ?? 0} locale={locale} />
      </div>

      <Card>
        <CardContent className="flex items-center justify-around p-4 text-center">
          <div>
            <p className="text-lg font-bold tabular-nums">
              {formatDuration(totalSeconds, locale)}
            </p>
            <p className="text-xs text-muted-foreground">
              {attempt.deadline ? t("result.totalTime") : t("result.elapsedTime")}
            </p>
          </div>
          {avgSeconds !== null && (
            <div>
              <p className="text-lg font-bold tabular-nums">
                {formatDuration(avgSeconds, locale)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("result.avgPerQuestion")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {subjectIds.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-semibold">{t("result.subjectBreakdown")}</p>
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
                    {formatNumber(b.correct, locale)}/{formatNumber(b.total, locale)}{" "}
                    {t("result.correct")}
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
          render={<Link href={`/exams/${id}/review?a=${attempt.id}`} />}
        >
          {t("result.reviewButton")}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">{t("result.reviewLater")}</p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  locale,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
  locale: string;
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
          {formatNumber(value, locale)}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
