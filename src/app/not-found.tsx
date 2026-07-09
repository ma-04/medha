import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl font-bold text-muted-foreground">৪০৪</p>
      <h1 className="font-bengali-serif text-xl font-semibold">
        পৃষ্ঠাটি খুঁজে পাওয়া যায়নি
      </h1>
      <p className="text-sm text-muted-foreground">
        আপনি যে পৃষ্ঠাটি খুঁজছেন তা সরানো হয়েছে বা বিদ্যমান নেই।
      </p>
      <Button nativeButton={false} render={<Link href="/" />}>
        হোমে ফিরুন
      </Button>
    </div>
  );
}
