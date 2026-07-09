import { createClient } from "@/lib/supabase/server";

export type SubjectWithTopics = {
  id: string;
  name_bn: string;
  topics: { id: string; name_bn: string }[];
};

/** Loads subjects each with their topics, ordered for select menus. */
export async function getSubjectsWithTopics(): Promise<SubjectWithTopics[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subjects")
    .select("id, name_bn, order_index, topics(id, name_bn, order_index)")
    .order("order_index");

  return (data ?? []).map((s) => ({
    id: s.id,
    name_bn: s.name_bn,
    topics: (s.topics ?? [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((t) => ({ id: t.id, name_bn: t.name_bn })),
  }));
}
