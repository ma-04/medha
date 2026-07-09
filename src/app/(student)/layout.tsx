import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getProfile } from "@/lib/auth";
import { DesktopNav, MobileNav } from "@/components/nav/nav-link";
import { UserMenu } from "@/components/nav/user-menu";
import { Button } from "@/components/ui/button";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  const t = await getTranslations();

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur">
        <Link href="/" className="text-xl font-bold">
          {t("app.name")}
        </Link>
        {profile ? (
          <UserMenu
            fullName={profile.full_name}
            avatarUrl={profile.avatar_url}
            isAdmin={profile.role === "admin"}
          />
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/login" />}
            >
              {t("nav.login")}
            </Button>
            <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
              {t("nav.signup")}
            </Button>
          </div>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1">
        <aside className="hidden w-56 shrink-0 border-r p-4 md:block">
          <DesktopNav />
        </aside>
        <main className="flex-1 p-4 pb-20 md:pb-4">{children}</main>
      </div>

      {profile && <MobileNav />}
    </div>
  );
}
