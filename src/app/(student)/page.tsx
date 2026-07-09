import { getProfile } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations();
  const profile = await getProfile();

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
    </div>
  );
}
