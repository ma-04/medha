import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { localName } from "@/lib/i18n-name";

export default async function SubjectTopicsPage({
  params,
}: {
  params: Promise<{ subjectSlug: string }>;
}) {
  const { subjectSlug } = await params;
  const supabase = await createClient();
  const locale = await getLocale();
  const t = await getTranslations("practice");

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name_bn, name_en, topics(id, name_bn, name_en, slug, order_index)")
    .eq("slug", subjectSlug)
    .single();

  if (!subject) notFound();

  const topics = (subject.topics ?? []).sort(
    (a, b) => a.order_index - b.order_index
  );

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
        {topics.map((t) => (
          <Link
            key={t.id}
            href={`/practice/${subjectSlug}/${t.slug}`}
            className="flex items-center justify-between p-4 hover:bg-accent"
          >
            <span className="font-bengali-serif">{localName(t, locale)}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
