import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { formatNumberBn } from "@/lib/format";

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

  const { data: exam } = await supabase
    .from("exams")
    .select("title_bn, results_published_at")
    .eq("id", id)
    .single();
  if (!exam) notFound();

  const { data, error } = await supabase.rpc("get_leaderboard", {
    p_exam_id: id,
  });
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
          ← লবি
        </Link>
        <h1 className="mt-1 flex items-center gap-2 font-bengali-serif text-2xl font-bold">
          <Trophy className="size-6 text-amber-500" />
          লিডারবোর্ড
        </h1>
        <p className="font-bengali-serif text-muted-foreground">
          {exam.title_bn}
        </p>
      </div>

      <div className="divide-y rounded-lg border">
        {top.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            এখনো কোনো ফলাফল নেই।
          </p>
        )}
        {top.map((r) => (
          <Row key={r.user_id} row={r} />
        ))}
        {selfOutside && (
          <>
            <div className="p-2 text-center text-xs text-muted-foreground">
              ⋯
            </div>
            <Row row={selfOutside} />
          </>
        )}
      </div>
    </div>
  );
}

function Row({ row }: { row: LeaderRow }) {
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
        {medal ?? formatNumberBn(row.rank)}
      </span>
      <span className="flex-1 font-bengali-serif">
        {row.full_name}
        {row.is_self && (
          <span className="ml-2 text-xs text-primary">(আপনি)</span>
        )}
      </span>
      <span className="font-semibold tabular-nums">
        {formatNumberBn(Number(row.score ?? 0))}
      </span>
    </div>
  );
}
