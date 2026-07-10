import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { getProfile } from "@/lib/auth";
import { localName } from "@/lib/i18n-name";
import { getUserTopicStats } from "@/lib/queries/stats";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, FileText, Library, Radio } from "lucide-react";
import { formatDateTime, formatNumber } from "@/lib/format";

export default async function HomePage() {
  const t = await getTranslations();
  const locale = await getLocale();
  const profile = await getProfile();

  // Upcoming/live exams for the next-up widget.
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [stats, { data: upcomingLive }] = await Promise.all([
    profile ? getUserTopicStats(profile.id) : [],
    profile
      ? supabase
          .from("exams")
          .select("id, title_bn, starts_at, ends_at")
          .eq("type", "live")
          .in("status", ["scheduled", "published"])
          .gt("ends_at", nowIso)
          .order("starts_at", { ascending: true })
          .limit(3)
      : { data: [] },
  ]);
  const weakTopics = stats
    .filter((s) => s.attempts >= 2 && s.accuracy < 0.6)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);
  const totalAnswered = stats.reduce((sum, s) => sum + s.attempts, 0);
  const totalCorrect = stats.reduce((sum, s) => sum + s.correct, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {profile
            ? t("home.welcome", { name: profile.full_name ?? "" }).trim()
            : t("app.name")}
        </h1>
        <p className="text-muted-foreground">{t("app.tagline")}</p>
      </div>

      {profile && totalAnswered > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label={t("home.statsAnswered")}
            value={formatNumber(totalAnswered, locale)}
          />
          <StatCard
            label={t("home.statsCorrect")}
            value={formatNumber(totalCorrect, locale)}
          />
          <StatCard
            label={t("home.statsAccuracy")}
            value={`${formatNumber(Math.round((totalCorrect / totalAnswered) * 100), locale)}%`}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink href="/practice" icon={BookOpen} label={t("nav.practice")} />
        <QuickLink href="/exams" icon={FileText} label={t("nav.exams")} />
        <QuickLink href="/archive" icon={Library} label={t("nav.archive")} />
      </div>

      {upcomingLive && upcomingLive.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="size-4 text-primary" /> {t("home.liveExams")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingLive.map((exam) => {
              // Server render: request-time check, evaluated once per request.
              // eslint-disable-next-line react-hooks/purity
              const nowMs = Date.now();
              const live =
                exam.starts_at !== null &&
                exam.ends_at !== null &&
                nowMs >= new Date(exam.starts_at).getTime() &&
                nowMs < new Date(exam.ends_at).getTime();
              return (
                <Link
                  key={exam.id}
                  href={`/live/${exam.id}`}
                  className="flex items-center justify-between rounded-md p-2 hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    {live && (
                      <Badge variant="destructive">{t("home.liveBadge")}</Badge>
                    )}
                    <span className="font-bengali-serif">{exam.title_bn}</span>
                  </div>
                  {!live && exam.starts_at && (
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(exam.starts_at, locale)}
                    </span>
                  )}
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}

      {weakTopics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("home.weakTopics")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {weakTopics.map((topic) => (
              <div
                key={topic.topicId}
                className="flex items-center justify-between"
              >
                <span className="font-bengali-serif">
                  {localName(topic, locale)}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {formatNumber(Math.round(topic.accuracy * 100), locale)}%
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/practice/${topic.subjectSlug}/${topic.topicSlug}`}
                      />
                    }
                  >
                    {t("home.practiceCta")}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof BookOpen;
  label: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-primary">
        <CardContent className="flex items-center gap-3 p-4">
          <Icon className="size-5 text-primary" />
          <span className="font-medium">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
