import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getUserTopicStats } from "@/lib/queries/stats";
import { formatNumber } from "@/lib/format";
import { localName } from "@/lib/i18n-name";

export default async function SubjectTopicsPage({
  params,
}: {
  params: Promise<{ subjectSlug: string }>;
}) {
  const { subjectSlug } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const locale = await getLocale();
  const t = await getTranslations("practice");

  const [{ data: subject }, allStats] = await Promise.all([
    supabase
      .from("subjects")
      .select(
        "id, name_bn, name_en, topics(id, name_bn, name_en, slug, order_index)"
      )
      .eq("slug", subjectSlug)
      .single(),
    getUserTopicStats(user.id),
  ]);

  if (!subject) notFound();

  const topics = (subject.topics ?? []).sort(
    (a, b) => a.order_index - b.order_index
  );
  const stats = new Map(allStats.map((s) => [s.topicId, s]));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/practice"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {t("title")}
        </Link>
        <h1 className="mt-1 font-bengali-serif text-2xl font-bold">
          {localName(subject, locale)}
        </h1>
      </div>
      <div className="divide-y rounded-lg border">
        {topics.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            {t("noTopics")}
          </p>
        )}
        {topics.map((topic) => {
          const stat = stats.get(topic.id);
          return (
            <Link
              key={topic.id}
              href={`/practice/${subjectSlug}/${topic.slug}`}
              className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
            >
              <div className="min-w-0">
                <p className="font-bengali-serif">{localName(topic, locale)}</p>
                <p className="text-xs text-muted-foreground">
                  {stat
                    ? `${t("seen", {
                        count: formatNumber(stat.questionsSeen, locale),
                      })} · ${t("accuracy", {
                        percent: formatNumber(
                          Math.round(stat.accuracy * 100),
                          locale
                        ),
                      })}`
                    : t("notPracticed")}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
