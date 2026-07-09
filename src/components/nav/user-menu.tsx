"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { User, Shield, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/(auth)/actions";
import { LocaleToggle } from "@/components/locale-toggle";

export function UserMenu({
  fullName,
  avatarUrl,
  isAdmin,
}: {
  fullName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
}) {
  const t = useTranslations();
  const initial = (fullName ?? "?").charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-1">
      <LocaleToggle />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="size-8">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href="/profile" />}>
            <User className="size-4" />
            {t("nav.profile")}
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem render={<Link href="/admin" />}>
              <Shield className="size-4" />
              {t("nav.admin")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            render={
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2"
                >
                  <LogOut className="size-4" />
                  {t("nav.logout")}
                </button>
              </form>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
