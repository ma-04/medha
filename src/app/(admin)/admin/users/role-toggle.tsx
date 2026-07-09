"use client";

import { useTransition } from "react";
import { setUserRole } from "./actions";
import type { Role } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLE_LABELS: Record<Role, string> = {
  student: "স্টুডেন্ট",
  teacher: "শিক্ষক",
  admin: "অ্যাডমিন",
};

export function RoleToggle({ id, role }: { id: string; role: Role }) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={role}
      onValueChange={(next) =>
        startTransition(() => setUserRole(id, next as Role))
      }
      disabled={pending}
    >
      <SelectTrigger size="sm" className="ml-auto">
        <SelectValue>{(value) => ROLE_LABELS[value as Role]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="student">{ROLE_LABELS.student}</SelectItem>
        <SelectItem value="teacher">{ROLE_LABELS.teacher}</SelectItem>
        <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
      </SelectContent>
    </Select>
  );
}
