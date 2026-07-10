"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-bengali-serif text-xl font-semibold">
        {t("errors.errorTitle")}
      </h1>
      <p className="text-sm text-muted-foreground">{t("errors.errorBody")}</p>
      <Button onClick={reset}>{t("common.retry")}</Button>
    </div>
  );
}
