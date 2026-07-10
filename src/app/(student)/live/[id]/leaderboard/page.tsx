import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

type LeaderRow = {
  rank: number;
  user_id: string;
  full_name: string;
  score: number;
  is_self: boolean;
};

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const supabase = await createClient();
  const t = await getTranslations("exam.leaderboard");
  const locale = await getLocale();

  const [{ data: exam }, { data, error }] = await Promise.all([
    supabase
      .from("exams")
      .select("title_bn, results_published_at")
      .eq("id", id)
      .single(),
    supabase.rpc("get_leaderboard", { p_exam_id: id }),
  ]);
  if (!exam) notFound();
  if (error) redirect(`/live/${id}`);
  const rows = (data ?? []) as LeaderRow[];

  const self = rows.find((r) => r.is_self);
  const top = rows.filter((r) => r.rank <= 100);
  // If the caller is outside the top 100, show their row separately at the end.
  const selfOutside = self && self.rank > 100 ? self : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link
          href={`/live/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          {t("back")}
        </Link>
        <h1 className="mt-1 flex items-center gap-2 font-bengali-serif text-2xl font-bold">
          <Trophy className="size-6 text-amber-500" />
          {t("title")}
        </h1>
        <p className="font-bengali-serif text-muted-foreground">
          {exam.title_bn}
        </p>
      </div>

      <div className="divide-y rounded-lg border">
        {top.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">{t("empty")}</p>
        )}
        {top.map((r) => (
          <Row key={r.user_id} row={r} locale={locale} selfLabel={t("you")} />
        ))}
        {selfOutside && (
          <>
            <div className="p-2 text-center text-xs text-muted-foreground">
              ⋯
            </div>
            <Row row={selfOutside} locale={locale} selfLabel={t("you")} />
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  row,
  locale,
  selfLabel,
}: {
  row: LeaderRow;
  locale: string;
  selfLabel: string;
}) {
  const medal =
    row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : null;
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3",
        row.is_self && "bg-primary/10"
      )}
    >
      <span className="w-8 text-center font-bold tabular-nums">
        {medal ?? formatNumber(row.rank, locale)}
      </span>
      <span className="flex-1 font-bengali-serif">
        {row.full_name}
        {row.is_self && (
          <span className="ml-2 text-xs text-primary">{selfLabel}</span>
        )}
      </span>
      <span className="font-semibold tabular-nums">
        {formatNumber(Number(row.score ?? 0), locale)}
      </span>
    </div>
  );
}
