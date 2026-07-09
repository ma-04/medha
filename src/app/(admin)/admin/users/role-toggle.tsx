"use client";

import { useTransition } from "react";
import { setUserRole } from "./actions";
import { Button } from "@/components/ui/button";

export function RoleToggle({
  id,
  role,
}: {
  id: string;
  role: "student" | "admin";
}) {
  const [pending, startTransition] = useTransition();
  const next = role === "admin" ? "student" : "admin";

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => setUserRole(id, next))}
    >
      {role === "admin" ? "স্টুডেন্ট করুন" : "অ্যাডমিন করুন"}
    </Button>
  );
}
