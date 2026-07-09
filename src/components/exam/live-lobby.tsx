"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Radio, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { formatDuration, formatNumber } from "@/lib/format";

type Phase = "before" | "open" | "ended";

export function LiveLobby({
  examId,
  userId,
  startsAt,
  endsAt,
  serverNow,
  hasSubmitted,
  resultsPublished,
}: {
  examId: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  serverNow: string;
  hasSubmitted: boolean;
  resultsPublished: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("exam.live");
  const locale = useLocale();
  const supabase = useMemo(() => createClient(), []);
  // Clock-skew correction is computed inside the tick effect to stay pure.
  const skewRef = useRef(0);
  const startMs = useMemo(() => new Date(startsAt).getTime(), [startsAt]);
  const endMs = useMemo(() => new Date(endsAt).getTime(), [endsAt]);

  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  const [present, setPresent] = useState(1);
  const [published, setPublished] = useState(resultsPublished);

  // Ticking clock; refresh the page when the exam opens or ends so the server
  // re-evaluates availability.
  const prevPhase = useRef<Phase | null>(null);
  useEffect(() => {
    skewRef.current = new Date(serverNow).getTime() - Date.now();
    function tick() {
      const t = Date.now() + skewRef.current;
      setNow(t);
      const phase: Phase = t < startMs ? "before" : t < endMs ? "open" : "ended";
      if (prevPhase.current && prevPhase.current !== phase) router.refresh();
      prevPhase.current = phase;
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startMs, endMs, serverNow, router]);

  // Realtime Presence: count unique waiting participants.
  useEffect(() => {
    const channel = supabase.channel(`live-exam:${examId}`, {
      config: { presence: { key: userId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        setPresent(Object.keys(channel.presenceState()).length || 1);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: Date.now() });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, examId, userId]);

  // Poll for result publication once the window has ended.
  useEffect(() => {
    if (now < endMs || published) return;
    const id = setInterval(async () => {
      const { data } = await supabase
        .from("exams")
        .select("results_published_at")
        .eq("id", examId)
        .single();
      if (data?.results_published_at) {
        setPublished(true);
        clearInterval(id);
      }
    }, 15000);
    return () => clearInterval(id);
  }, [now, endMs, published, supabase, examId]);

  const phase: Phase = now < startMs ? "before" : now < endMs ? "open" : "ended";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Users className="size-4" />
        {formatNumber(present, locale)} {t("participants")}
      </div>

      {phase === "before" && (
        <div className="rounded-lg border bg-muted/30 p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Radio className="size-4 animate-pulse" />
            {t("startsIn")}
          </div>
          <p className="mt-2 font-mono text-4xl font-bold tabular-nums">
            {formatDuration((startMs - now) / 1000, locale)}
          </p>
        </div>
      )}

      {phase === "open" && (
        <div className="text-center">
          {hasSubmitted ? (
            <Button
              nativeButton={false}
              render={<Link href={`/exams/${examId}/result`} />}
            >
              {t("yourResult")}
            </Button>
          ) : (
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href={`/exams/${examId}/attempt`} />}
            >
              {t("startExam")}
            </Button>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            {t("endsIn")}: {formatDuration((endMs - now) / 1000, locale)}
          </p>
        </div>
      )}

      {phase === "ended" && (
        <div className="space-y-3 text-center">
          {published ? (
            <>
              <Button
                nativeButton={false}
                render={<Link href={`/live/${examId}/leaderboard`} />}
              >
                {t("viewLeaderboard")}
              </Button>
              {hasSubmitted && (
                <div>
                  <Link
                    href={`/exams/${examId}/result`}
                    className="text-sm text-muted-foreground hover:underline"
                  >
                    {t("resultAndReview")}
                  </Link>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("preparing")}</p>
          )}
        </div>
      )}
    </div>
  );
}
