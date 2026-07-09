import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getProfile } from "@/lib/auth";
import { getUserTopicStats } from "@/lib/queries/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, Library } from "lucide-react";

export default async function HomePage() {
  const t = await getTranslations();
  const profile = await getProfile();

  const stats = profile ? await getUserTopicStats(profile.id) : [];
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
            ? `স্বাগতম, ${profile.full_name ?? ""}`.trim()
            : t("app.name")}
        </h1>
        <p className="text-muted-foreground">{t("app.tagline")}</p>
      </div>

      {profile && totalAnswered > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="অনুশীলিত প্রশ্ন" value={totalAnswered} />
          <StatCard label="সঠিক উত্তর" value={totalCorrect} />
          <StatCard
            label="নির্ভুলতা"
            value={`${Math.round((totalCorrect / totalAnswered) * 100)}%`}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink href="/practice" icon={BookOpen} label={t("nav.practice")} />
        <QuickLink href="/exams" icon={FileText} label={t("nav.exams")} />
        <QuickLink href="/archive" icon={Library} label={t("nav.archive")} />
      </div>

      {weakTopics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">দুর্বল টপিক</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {weakTopics.map((topic) => (
              <div
                key={topic.topicId}
                className="flex items-center justify-between"
              >
                <span className="font-bengali-serif">{topic.name_bn}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {Math.round(topic.accuracy * 100)}%
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
                    অনুশীলন
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
