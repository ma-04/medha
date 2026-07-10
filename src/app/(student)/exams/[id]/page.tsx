import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatNumber } from "@/lib/format";
import { AttemptPanel } from "@/components/exam/attempt-panel";

export default async function ExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const t = await getTranslations("exam");
  const locale = await getLocale();

  const { data: exam } = await supabase
    .from("exams")
    .select("*")
    .eq("id", id)
    .single();
  if (!exam || !["scheduled", "published", "archived"].includes(exam.status)) {
    notFound();
  }

  const { data: attempts } = await supabase
    .from("exam_attempts")
    .select("id, attempt_number, submitted_at, score")
    .eq("exam_id", id)
    .eq("user_id", user.id)
    .order("attempt_number", { ascending: true });

  const allAttempts = attempts ?? [];
  const latest = allAttempts[allAttempts.length - 1];
  const submittedAttempts = allAttempts.filter((a) => a.submitted_at);

  const pattern = exam.pattern as {
    duration_minutes?: number;
    total_questions?: number;
    mark_per_question?: number;
    negative_mark?: number;
  } | null;

  const maxScore =
    (pattern?.total_questions ?? 0) * (pattern?.mark_per_question ?? 1);
  const canRetry =
    exam.type === "model" &&
    !!latest?.submitted_at &&
    allAttempts.length < exam.max_attempts;

  // Server render: request-time availability check, evaluated once per request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const startsAt = exam.starts_at ? new Date(exam.starts_at).getTime() : null;
  const endsAt = exam.ends_at ? new Date(exam.ends_at).getTime() : null;

  const isLive = exam.type === "live";
  const notStarted = isLive && startsAt !== null && now < startsAt;
  const ended = isLive && endsAt !== null && now >= endsAt;
  const available =
    exam.type === "model"
      ? exam.status === "published"
      : !notStarted && !ended;

  // Decide the primary CTA.
  let cta: React.ReactNode = null;
  if (latest?.submitted_at) {
    cta = (
      <AttemptPanel
        examId={id}
        attempts={submittedAttempts.map((a) => ({
          id: a.id,
          attempt_number: a.attempt_number,
          score: Number(a.score ?? 0),
        }))}
        maxScore={maxScore}
        canRetry={canRetry}
        maxAttempts={exam.max_attempts}
      />
    );
  } else if (latest) {
    cta = available ? (
      <Button nativeButton={false} render={<Link href={`/exams/${id}/attempt`} />}>
        {t("detail.ctaContinue")}
      </Button>
    ) : (
      <Button disabled>{t("detail.ctaTimeUp")}</Button>
    );
  } else if (available) {
    cta = (
      <Button nativeButton={false} render={<Link href={`/exams/${id}/attempt`} />}>
        {t("detail.ctaStart")}
      </Button>
    );
  } else if (notStarted) {
    cta = <Button disabled>{t("detail.ctaNotStarted")}</Button>;
  } else {
    cta = <Button disabled>{t("detail.ctaEnded")}</Button>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/exams"
          className="text-sm text-muted-foreground hover:underline"
        >
          {t("detail.back")}
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline">{t(`type.${exam.type}`)}</Badge>
          {ended && <Badge variant="secondary">{t("status.ended")}</Badge>}
        </div>
        <h1 className="mt-1 font-bengali-serif text-2xl font-bold">
          {exam.title_bn}
        </h1>
      </div>

      {exam.description && (
        <p className="font-bengali-serif text-muted-foreground">
          {exam.description}
        </p>
      )}

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 text-sm">
          <Info
            label={t("detail.totalQuestions")}
            value={formatNumber(pattern?.total_questions ?? 0, locale)}
          />
          <Info
            label={t("detail.duration")}
            value={`${formatNumber(pattern?.duration_minutes ?? 0, locale)} ${t("minutes")}`}
          />
          <Info
            label={t("detail.perQuestion")}
            value={`${formatNumber(pattern?.mark_per_question ?? 1, locale)} ${t("marks")}`}
          />
          <Info
            label={t("detail.negativeMark")}
            value={formatNumber(pattern?.negative_mark ?? 0, locale)}
          />
          {isLive && exam.starts_at && (
            <Info label={t("detail.startsAt")} value={formatDateTime(exam.starts_at, locale)} />
          )}
          {isLive && exam.ends_at && (
            <Info label={t("detail.endsAt")} value={formatDateTime(exam.ends_at, locale)} />
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          {t("detail.instructionsTitle")}
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>{t("detail.instruction1")}</li>
          <li>{t("detail.instruction2")}</li>
          <li>{t("detail.instruction3")}</li>
          <li>
            {exam.type === "model" && exam.max_attempts > 1
              ? t("detail.instruction4Retry", {
                  count: formatNumber(exam.max_attempts, locale),
                })
              : t("detail.instruction4")}
          </li>
        </ul>
      </div>

      <div>{cta}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
