"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-bengali-serif text-xl font-semibold">
        কিছু একটা সমস্যা হয়েছে
      </h1>
      <p className="text-sm text-muted-foreground">
        দুঃখিত, একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।
      </p>
      <Button onClick={reset}>আবার চেষ্টা করুন</Button>
    </div>
  );
}
