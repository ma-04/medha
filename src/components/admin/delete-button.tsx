"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteButton({
  id,
  action,
  confirmText = "মুছে ফেলবেন?",
  small = false,
}: {
  id: string;
  action: (id: string) => Promise<void>;
  confirmText?: string;
  small?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size={small ? "icon-sm" : "icon"}
      disabled={pending}
      onClick={() => {
        if (confirm(confirmText)) startTransition(() => action(id));
      }}
    >
      <Trash2 className="size-4 text-destructive" />
    </Button>
  );
}
