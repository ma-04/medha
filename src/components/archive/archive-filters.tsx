"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localName } from "@/lib/i18n-name";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ArchiveFacets } from "@/lib/queries/archive";

const ALL = "__all__";

export function ArchiveFilters({ facets }: { facets: ArchiveFacets }) {
  const router = useRouter();
  const params = useSearchParams();
  const locale = useLocale();
  const [q, setQ] = useState(params.get("q") ?? "");
  // Base UI Select can fire onValueChange while hydrating (committing its native
  // default), which would apply a filter the user never chose. Ignore changes
  // until after mount, and treat same-value fires as no-ops.
  const ready = useRef(false);
  useEffect(() => {
    ready.current = true;
  }, []);

  function apply(next: Record<string, string | null>) {
    if (!ready.current) return;
    const sp = new URLSearchParams(params.toString());
    let changed = false;
    for (const [k, v] of Object.entries(next)) {
      const normalized = v === null || v === "" || v === ALL ? null : v;
      const current = sp.get(k);
      if (normalized === current) continue;
      changed = true;
      if (normalized === null) sp.delete(k);
      else sp.set(k, normalized);
    }
    if (!changed) return;
    router.push(`/archive?${sp.toString()}`);
  }

  const hasFilters =
    !!params.get("subject") ||
    !!params.get("exam") ||
    !!params.get("year") ||
    !!params.get("q");

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q });
        }}
        className="flex gap-2"
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="প্রশ্ন খুঁজুন…"
        />
        <Button type="submit" variant="secondary">
          <Search className="size-4" />
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        <Select
          value={params.get("subject") ?? ALL}
          onValueChange={(v) => apply({ subject: v })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="বিষয়" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>সব বিষয়</SelectItem>
            {facets.subjects.map((s) => (
              <SelectItem key={s.slug} value={s.slug}>
                {localName(s, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {facets.exams.length > 0 && (
          <Select
            value={params.get("exam") ?? ALL}
            onValueChange={(v) => apply({ exam: v })}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="পরীক্ষা" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>সব পরীক্ষা</SelectItem>
              {facets.exams.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {facets.years.length > 0 && (
          <Select
            value={params.get("year") ?? ALL}
            onValueChange={(v) => apply({ year: v })}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="সাল" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>সব সাল</SelectItem>
              {facets.years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              router.push("/archive");
            }}
          >
            <X className="size-4" /> মুছুন
          </Button>
        )}
      </div>
    </div>
  );
}
