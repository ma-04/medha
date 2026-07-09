"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/app/(auth)/actions";

export function GoogleButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={() => startTransition(() => void signInWithGoogle())}
    >
      <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M12.24 10.29v3.72h5.19c-.23 1.34-1.62 3.93-5.19 3.93-3.12 0-5.67-2.58-5.67-5.76s2.55-5.76 5.67-5.76c1.78 0 2.97.76 3.65 1.41l2.49-2.4C16.46 3.5 14.55 2.7 12.24 2.7 7.5 2.7 3.66 6.54 3.66 12s3.84 9.3 8.58 9.3c4.95 0 8.23-3.48 8.23-8.38 0-.56-.06-.99-.14-1.42z"
        />
      </svg>
      Google দিয়ে চালিয়ে যান
    </Button>
  );
}
