"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber } from "@/lib/format";
import { retryExam } from "@/app/(student)/exams/[id]/actions";

type SubmittedAttempt = { id: string; attempt_number: number; score: number };

export function AttemptPanel({
  examId,
  attempts,
  maxScore,
  canRetry,
  maxAttempts,
}: {
  examId: string;
  attempts: SubmittedAttempt[];
  maxScore: number;
  canRetry: boolean;
  maxAttempts: number;
}) {
  const t = useTranslations("exam");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const ordered = [...attempts].sort(
    (a, b) => b.attempt_number - a.attempt_number
  );
  const nextNumber = attempts.length + 1;

  function confirmRetry() {
    startTransition(async () => {
      const result = await retryExam(examId);
      // retryExam redirects on success; only errors return here.
      if (result?.error) {
        toast.error(result.error);
        setOpen(false);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {ordered.length <= 1 ? (
        <Button
          nativeButton={false}
          render={
            <Link
              href={`/exams/${examId}/result${ordered[0] ? `?a=${ordered[0].id}` : ""}`}
            />
          }
        >
          {t("detail.ctaResult")}
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button>
                {t("detail.ctaResults")}
                <ChevronDown className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent className="w-56">
            {ordered.map((a) => (
              <DropdownMenuItem
                key={a.id}
                onClick={() =>
                  router.push(`/exams/${examId}/result?a=${a.id}`)
                }
              >
                {t("detail.attempt", {
                  n: formatNumber(a.attempt_number, locale),
                })}
                <span className="ml-auto text-muted-foreground">
                  {formatNumber(a.score, locale)}/{formatNumber(maxScore, locale)}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {canRetry && (
        <>
          <Button variant="outline" onClick={() => setOpen(true)}>
            {t("detail.ctaRetry")}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("detail.retryConfirmTitle")}</DialogTitle>
                <DialogDescription>
                  {t("detail.retryConfirmBody", {
                    n: formatNumber(nextNumber, locale),
                    max: formatNumber(maxAttempts, locale),
                  })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  {tCommon("cancel")}
                </DialogClose>
                <Button onClick={confirmRetry} disabled={pending}>
                  {t("detail.retryConfirmButton")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
