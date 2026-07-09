import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { PracticeRunner } from "@/components/practice/practice-runner";
import { localName } from "@/lib/i18n-name";
import type { QuestionOption } from "@/lib/questions";

export default async function PracticeRunnerPage({
  params,
}: {
  params: Promise<{ subjectSlug: string; topicSlug: string }>;
}) {
  await requireUser();
  const { subjectSlug, topicSlug } = await params;
  const supabase = await createClient();
  const locale = await getLocale();

  const { data: subject } = await supabase
    .from("subjects")
    .select("id")
    .eq("slug", subjectSlug)
    .single();
  if (!subject) notFound();

  const { data: topic } = await supabase
    .from("topics")
    .select("id, name_bn, name_en")
    .eq("subject_id", subject.id)
    .eq("slug", topicSlug)
    .single();
  if (!topic) notFound();

  // Answer-free question fetch: correct keys live in a table students can't read.
  const { data: questions } = await supabase
    .from("questions")
    .select("id, body, options, image_url, source_label")
    .eq("topic_id", topic.id)
    .eq("status", "published")
    .limit(50);

  const items = (questions ?? []).map((q) => ({
    id: q.id,
    body: q.body,
    options: q.options as QuestionOption[],
    image_url: q.image_url,
    source_label: q.source_label,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={`/practice/${subjectSlug}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← {localName(topic, locale)}
      </Link>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          এই টপিকে এখনো কোনো প্রশ্ন নেই।
        </p>
      ) : (
        <PracticeRunner questions={items} />
      )}
    </div>
  );
}
