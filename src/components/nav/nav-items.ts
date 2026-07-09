import {
  Home,
  BookOpen,
  FileText,
  Radio,
  Library,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { href: "/", labelKey: "nav.home", icon: Home },
  { href: "/practice", labelKey: "nav.practice", icon: BookOpen },
  { href: "/exams", labelKey: "nav.exams", icon: FileText },
  { href: "/live", labelKey: "nav.live", icon: Radio },
  { href: "/archive", labelKey: "nav.archive", icon: Library },
];
