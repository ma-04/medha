import { useTranslations } from "next-intl";

export default function Home() {
  const t = useTranslations();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-5xl font-bold">{t("app.name")}</h1>
      <p className="text-lg text-muted-foreground">{t("app.tagline")}</p>
    </main>
  );
}
