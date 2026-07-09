import { requireUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LocaleToggle } from "@/components/locale-toggle";

export default async function ProfilePage() {
  const profile = await requireUser();
  const t = await getTranslations();
  const initial = (profile.full_name ?? "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">{t("nav.profile")}</h1>
      <Card>
        <CardHeader className="flex-row items-center gap-4 space-y-0">
          <Avatar className="size-14">
            {profile.avatar_url && (
              <AvatarImage src={profile.avatar_url} alt="" />
            )}
            <AvatarFallback className="text-lg">{initial}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>{profile.full_name ?? "—"}</CardTitle>
            {profile.role === "admin" && (
              <Badge className="mt-1" variant="secondary">
                {t("nav.admin")}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t("common.language")}
            </span>
            <LocaleToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
