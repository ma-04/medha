import { createClient } from "@/lib/supabase/server";

export type TopicStat = {
  topicId: string;
  name_bn: string;
  subjectSlug: string;
  topicSlug: string;
  attempts: number;
  correct: number;
  accuracy: number;
};

/** Practice stats per topic for the current user, joined with topic names. */
export async function getUserTopicStats(userId: string): Promise<TopicStat[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_user_topic_stats")
    .select("topic_id, attempts, correct")
    .eq("user_id", userId);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: topics } = await supabase
    .from("topics")
    .select("id, name_bn, slug, subjects(slug)")
    .in(
      "id",
      rows.map((r) => r.topic_id!)
    );

  const topicMap = new Map(
    (topics ?? []).map((t) => [
      t.id,
      {
        name_bn: t.name_bn,
        topicSlug: t.slug,
        subjectSlug: (t.subjects as { slug: string } | null)?.slug ?? "",
      },
    ])
  );

  return rows
    .map((r) => {
      const t = topicMap.get(r.topic_id!);
      const attempts = r.attempts ?? 0;
      const correct = r.correct ?? 0;
      return {
        topicId: r.topic_id!,
        name_bn: t?.name_bn ?? "",
        subjectSlug: t?.subjectSlug ?? "",
        topicSlug: t?.topicSlug ?? "",
        attempts,
        correct,
        accuracy: attempts > 0 ? correct / attempts : 0,
      };
    })
    .filter((s) => s.subjectSlug);
}
