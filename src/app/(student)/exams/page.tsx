import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatNumber } from "@/lib/format";

export default async function ExamsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const t = await getTranslations("exam");
  const locale = await getLocale();

  const { data: exams } = await supabase
    .from("exams")
    .select("id, title_bn, description, type, status, pattern, starts_at, ends_at")
    .in("status", ["scheduled", "published"])
    .order("starts_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  // A student can now have several attempts per exam; the badge reflects their
  // latest one. Ordering ascending means the last write per exam_id wins.
  const { data: attempts } = await supabase
    .from("exam_attempts")
    .select("exam_id, attempt_number, submitted_at")
    .eq("user_id", user.id)
    .order("attempt_number", { ascending: true });
  const attemptMap = new Map<string, string | null>();
  for (const a of attempts ?? []) attemptMap.set(a.exam_id, a.submitted_at);

  const list = exams ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("list.title")}</h1>

      {list.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("list.empty")}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((e) => {
          const pattern = e.pattern as {
            duration_minutes?: number;
            total_questions?: number;
          } | null;
          const hasAttempt = attemptMap.has(e.id);
          const submitted = attemptMap.get(e.id);
          return (
            <Link key={e.id} href={`/exams/${e.id}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    <Badge variant="outline">{t(`type.${e.type}`)}</Badge>
                    {submitted ? (
                      <Badge>{t("status.completed")}</Badge>
                    ) : hasAttempt ? (
                      <Badge variant="secondary">{t("status.inProgress")}</Badge>
                    ) : null}
                  </div>
                  <p className="font-bengali-serif text-lg font-medium">
                    {e.title_bn}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(pattern?.total_questions ?? 0, locale)}{" "}
                    {t("questions")} ·{" "}
                    {formatNumber(pattern?.duration_minutes ?? 0, locale)}{" "}
                    {t("minutes")}
                  </p>
                  {e.type === "live" && e.starts_at && (
                    <p className="text-xs text-muted-foreground">
                      {t("list.startsAt")}: {formatDateTime(e.starts_at, locale)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
