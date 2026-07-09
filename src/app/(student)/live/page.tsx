import Link from "next/link";
import { Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeBn, formatNumberBn } from "@/lib/format";

export default async function LivePage() {
  await requireUser();
  const supabase = await createClient();

  const { data: exams } = await supabase
    .from("exams")
    .select("id, title_bn, pattern, starts_at, ends_at, results_published_at")
    .eq("type", "live")
    .in("status", ["scheduled", "published"])
    .order("starts_at", { ascending: true });

  // Server render: request-time bucketing, evaluated once per request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const groups: Record<"live" | "upcoming" | "past", ExamRow[]> = {
    live: [],
    upcoming: [],
    past: [],
  };
  for (const e of exams ?? []) {
    const s = e.starts_at ? new Date(e.starts_at).getTime() : null;
    const en = e.ends_at ? new Date(e.ends_at).getTime() : null;
    if (s !== null && en !== null && now >= s && now < en) groups.live.push(e);
    else if (s !== null && now < s) groups.upcoming.push(e);
    else groups.past.push(e);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">লাইভ পরীক্ষা</h1>

      {(exams ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">
          এখন কোনো লাইভ পরীক্ষা নেই।
        </p>
      )}

      <Section title="চলমান" tone="live" exams={groups.live} />
      <Section title="আসন্ন" exams={groups.upcoming} />
      <Section title="সম্পন্ন" exams={groups.past} />
    </div>
  );
}

type ExamRow = {
  id: string;
  title_bn: string;
  pattern: unknown;
  starts_at: string | null;
  ends_at: string | null;
  results_published_at: string | null;
};

function Section({
  title,
  exams,
  tone,
}: {
  title: string;
  exams: ExamRow[] | null;
  tone?: "live";
}) {
  if (!exams || exams.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {exams.map((e) => {
          const pattern = e.pattern as {
            duration_minutes?: number;
            total_questions?: number;
          } | null;
          return (
            <Link key={e.id} href={`/live/${e.id}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center gap-2">
                    <Radio
                      className={
                        tone === "live"
                          ? "size-4 animate-pulse text-destructive"
                          : "size-4 text-primary"
                      }
                    />
                    {tone === "live" && <Badge variant="destructive">লাইভ</Badge>}
                    {e.results_published_at && <Badge>ফলাফল প্রকাশিত</Badge>}
                  </div>
                  <p className="font-bengali-serif text-lg font-medium">
                    {e.title_bn}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumberBn(pattern?.total_questions ?? 0)} প্রশ্ন ·{" "}
                    {formatNumberBn(pattern?.duration_minutes ?? 0)} মিনিট
                  </p>
                  {e.starts_at && (
                    <p className="text-xs text-muted-foreground">
                      শুরু: {formatDateTimeBn(e.starts_at)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
