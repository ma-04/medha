import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations("errors");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl font-bold text-muted-foreground">
        {formatNumber(404, locale)}
      </p>
      <h1 className="font-bengali-serif text-xl font-semibold">
        {t("notFoundTitle")}
      </h1>
      <p className="text-sm text-muted-foreground">{t("notFoundBody")}</p>
      <Button nativeButton={false} render={<Link href="/" />}>
        {t("backHome")}
      </Button>
    </div>
  );
}
