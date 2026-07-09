import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { examTypeLabels } from "@/lib/exams";
import { formatDateTimeBn, formatNumberBn } from "@/lib/format";

export default async function ExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: exam } = await supabase
    .from("exams")
    .select("*")
    .eq("id", id)
    .single();
  if (!exam || !["scheduled", "published", "archived"].includes(exam.status)) {
    notFound();
  }

  const { data: attempt } = await supabase
    .from("exam_attempts")
    .select("id, submitted_at")
    .eq("exam_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const pattern = exam.pattern as {
    duration_minutes?: number;
    total_questions?: number;
    mark_per_question?: number;
    negative_mark?: number;
  } | null;

  // Server render: request-time availability check, evaluated once per request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const startsAt = exam.starts_at ? new Date(exam.starts_at).getTime() : null;
  const endsAt = exam.ends_at ? new Date(exam.ends_at).getTime() : null;

  const isLive = exam.type === "live";
  const notStarted = isLive && startsAt !== null && now < startsAt;
  const ended = isLive && endsAt !== null && now >= endsAt;
  const available =
    exam.type === "model"
      ? exam.status === "published"
      : !notStarted && !ended;

  // Decide the primary CTA.
  let cta: React.ReactNode = null;
  if (attempt?.submitted_at) {
    cta = (
      <Button nativeButton={false} render={<Link href={`/exams/${id}/result`} />}>
        ফলাফল দেখুন
      </Button>
    );
  } else if (attempt) {
    cta = available ? (
      <Button nativeButton={false} render={<Link href={`/exams/${id}/attempt`} />}>
        চালিয়ে যান
      </Button>
    ) : (
      <Button disabled>সময় শেষ</Button>
    );
  } else if (available) {
    cta = (
      <Button nativeButton={false} render={<Link href={`/exams/${id}/attempt`} />}>
        শুরু করুন
      </Button>
    );
  } else if (notStarted) {
    cta = <Button disabled>এখনো শুরু হয়নি</Button>;
  } else {
    cta = <Button disabled>পরীক্ষা শেষ</Button>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/exams"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← পরীক্ষা
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline">{examTypeLabels[exam.type]}</Badge>
          {ended && <Badge variant="secondary">সমাপ্ত</Badge>}
        </div>
        <h1 className="mt-1 font-bengali-serif text-2xl font-bold">
          {exam.title_bn}
        </h1>
      </div>

      {exam.description && (
        <p className="font-bengali-serif text-muted-foreground">
          {exam.description}
        </p>
      )}

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 text-sm">
          <Info label="প্রশ্ন সংখ্যা" value={formatNumberBn(pattern?.total_questions ?? 0)} />
          <Info label="সময়" value={`${formatNumberBn(pattern?.duration_minutes ?? 0)} মিনিট`} />
          <Info label="প্রতি প্রশ্ন" value={`${formatNumberBn(pattern?.mark_per_question ?? 1)} নম্বর`} />
          <Info label="নেগেটিভ মার্ক" value={formatNumberBn(pattern?.negative_mark ?? 0)} />
          {isLive && exam.starts_at && (
            <Info label="শুরু" value={formatDateTimeBn(exam.starts_at)} />
          )}
          {isLive && exam.ends_at && (
            <Info label="শেষ" value={formatDateTimeBn(exam.ends_at)} />
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">নির্দেশনা</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>একবার শুরু করলে সময় গণনা শুরু হবে।</li>
          <li>ভুল উত্তরে নেগেটিভ মার্ক কাটা যাবে।</li>
          <li>সময় শেষ হলে স্বয়ংক্রিয়ভাবে জমা হবে।</li>
          <li>প্রতিটি পরীক্ষায় একবারই অংশ নেওয়া যাবে।</li>
        </ul>
      </div>

      <div>{cta}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
