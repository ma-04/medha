import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { localName } from "@/lib/i18n-name";
import { formatNumber } from "@/lib/format";

export default async function PracticePage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const t = await getTranslations("practice");
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name_bn, name_en, slug, topics(id)")
    .order("order_index");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(subjects ?? []).map((s) => (
          <Link key={s.id} href={`/practice/${s.slug}`}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="flex h-full flex-col justify-between gap-2 p-4">
                <span className="font-bengali-serif text-lg font-medium">
                  {localName(s, locale)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("topicCount", {
                    count: formatNumber(s.topics?.length ?? 0, locale),
                  })}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
