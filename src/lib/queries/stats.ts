import { createClient } from "@/lib/supabase/server";

export type TopicStat = {
  topicId: string;
  name_bn: string;
  name_en: string | null;
  subjectSlug: string;
  topicSlug: string;
  /** Every answer ever submitted — practice_answers is append-only, so a
   *  question answered three times counts three times. */
  attempts: number;
  correct: number;
  /** Distinct questions answered at least once: coverage, not volume. */
  questionsSeen: number;
  accuracy: number;
};

export type SubjectStat = {
  subjectSlug: string;
  attempts: number;
  correct: number;
  questionsSeen: number;
  accuracy: number;
};

/** Practice stats per topic for the current user, joined with topic names. */
export async function getUserTopicStats(userId: string): Promise<TopicStat[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_user_topic_stats")
    .select("topic_id, attempts, correct, questions_seen")
    .eq("user_id", userId);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: topics } = await supabase
    .from("topics")
    .select("id, name_bn, name_en, slug, subjects(slug)")
    .in(
      "id",
      rows.map((r) => r.topic_id!)
    );

  const topicMap = new Map(
    (topics ?? []).map((t) => [
      t.id,
      {
        name_bn: t.name_bn,
        name_en: t.name_en,
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
        name_en: t?.name_en ?? null,
        subjectSlug: t?.subjectSlug ?? "",
        topicSlug: t?.topicSlug ?? "",
        attempts,
        correct,
        questionsSeen: r.questions_seen ?? 0,
        accuracy: attempts > 0 ? correct / attempts : 0,
      };
    })
    .filter((s) => s.subjectSlug);
}

/** The same practice stats rolled up per subject, keyed by subject slug. */
export async function getUserSubjectStats(
  userId: string
): Promise<Map<string, SubjectStat>> {
  const topics = await getUserTopicStats(userId);
  const bySubject = new Map<string, SubjectStat>();

  for (const t of topics) {
    const s = bySubject.get(t.subjectSlug) ?? {
      subjectSlug: t.subjectSlug,
      attempts: 0,
      correct: 0,
      questionsSeen: 0,
      accuracy: 0,
    };
    s.attempts += t.attempts;
    s.correct += t.correct;
    // Topics partition questions, so summing distinct counts double-counts nothing.
    s.questionsSeen += t.questionsSeen;
    bySubject.set(t.subjectSlug, s);
  }

  for (const s of bySubject.values()) {
    s.accuracy = s.attempts > 0 ? s.correct / s.attempts : 0;
  }
  return bySubject;
}
