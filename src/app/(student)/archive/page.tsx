import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import {
  getArchiveFacets,
  searchArchive,
  type ArchiveFilters as Filters,
} from "@/lib/queries/archive";
import { ArchiveFilters } from "@/components/archive/archive-filters";
import { ArchiveCard } from "@/components/archive/archive-card";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const locale = await getLocale();
  const t = await getTranslations();
  const sp = await searchParams;
  const filters: Filters = {
    subject: sp.subject,
    exam: sp.exam,
    year: sp.year,
    q: sp.q,
  };
  const page = Number(sp.page ?? "0") || 0;

  const [facets, { items, hasMore }] = await Promise.all([
    getArchiveFacets(),
    searchArchive(filters, page),
  ]);

  function pageHref(next: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    params.set("page", String(next));
    return `/archive?${params.toString()}`;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">{t("archive.title")}</h1>

      <ArchiveFilters facets={facets} />

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("archive.empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((q) => (
            <ArchiveCard key={q.id} question={q} />
          ))}
        </div>
      )}

      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between pt-2">
          {page > 0 ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={pageHref(page - 1)} />}
            >
              ← {t("common.previous")}
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">
            {t("archive.page", { n: formatNumber(page + 1, locale) })}
          </span>
          {hasMore ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={pageHref(page + 1)} />}
            >
              {t("common.next")} →
            </Button>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
