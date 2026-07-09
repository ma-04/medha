import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/app/(auth)/actions";
import {
  LayoutDashboard,
  FileQuestion,
  FolderTree,
  CalendarClock,
  Users,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const adminNav = [
  { href: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard },
  { href: "/admin/questions", label: "প্রশ্ন", icon: FileQuestion },
  { href: "/admin/taxonomy", label: "বিষয় ও টপিক", icon: FolderTree },
  { href: "/admin/exams", label: "পরীক্ষা", icon: CalendarClock },
  { href: "/admin/users", label: "ব্যবহারকারী", icon: Users },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-muted/30 p-4 md:flex">
        <Link href="/admin" className="mb-6 px-2 text-lg font-bold">
          মেধা <span className="text-muted-foreground">Admin</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-1">
          <div className="px-1">
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            nativeButton={false}
            render={<Link href="/" />}
          >
            ← অ্যাপে ফিরুন
          </Button>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="size-4" />
              লগআউট
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
