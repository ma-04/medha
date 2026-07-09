import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { LiveLobby } from "@/components/exam/live-lobby";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumberBn } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LiveLobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: exam } = await supabase
    .from("exams")
    .select("*")
    .eq("id", id)
    .single();
  if (
    !exam ||
    exam.type !== "live" ||
    !["scheduled", "published", "archived"].includes(exam.status) ||
    !exam.starts_at ||
    !exam.ends_at
  ) {
    notFound();
  }

  const { data: attempt } = await supabase
    .from("exam_attempts")
    .select("submitted_at")
    .eq("exam_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const pattern = exam.pattern as {
    duration_minutes?: number;
    total_questions?: number;
    negative_mark?: number;
  } | null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/live"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← লাইভ পরীক্ষা
        </Link>
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
        <CardContent className="grid grid-cols-3 gap-4 p-4 text-center text-sm">
          <div>
            <p className="text-lg font-bold">
              {formatNumberBn(pattern?.total_questions ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">প্রশ্ন</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {formatNumberBn(pattern?.duration_minutes ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">মিনিট</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {formatNumberBn(pattern?.negative_mark ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">নেগেটিভ</p>
          </div>
        </CardContent>
      </Card>

      <LiveLobby
        examId={id}
        userId={user.id}
        startsAt={exam.starts_at}
        endsAt={exam.ends_at}
        serverNow={new Date().toISOString()}
        hasSubmitted={!!attempt?.submitted_at}
        resultsPublished={!!exam.results_published_at}
      />
    </div>
  );
}
