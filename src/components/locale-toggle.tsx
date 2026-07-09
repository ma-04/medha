"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { Button } from "@/components/ui/button";

export function LocaleToggle() {
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const next = locale === "bn" ? "en" : "bn";

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => setLocale(next))}
    >
      {locale === "bn" ? "EN" : "বাং"}
    </Button>
  );
}
