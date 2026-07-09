import { createClient } from "@/lib/supabase/server";
import type { QuestionOption } from "@/lib/questions";

export type ArchiveFilters = {
  subject?: string;
  exam?: string;
  year?: string;
  q?: string;
};

export type ArchiveQuestion = {
  id: string;
  body: string;
  options: QuestionOption[];
  image_url: string | null;
  source_label: string | null;
  source_exam: string | null;
  source_year: number | null;
  subject_bn: string;
  topic_bn: string;
};

export type ArchiveFacets = {
  subjects: { slug: string; name_bn: string }[];
  exams: string[];
  years: number[];
};

// Subjects + the distinct exams/years present in published questions.
export async function getArchiveFacets(): Promise<ArchiveFacets> {
  const supabase = await createClient();
  const [{ data: subjects }, { data: rows }] = await Promise.all([
    supabase.from("subjects").select("slug, name_bn").order("order_index"),
    supabase
      .from("questions")
      .select("source_exam, source_year")
      .eq("status", "published")
      .limit(2000),
  ]);

  const exams = [
    ...new Set(
      (rows ?? []).map((r) => r.source_exam).filter((x): x is string => !!x)
    ),
  ].sort();
  const years = [
    ...new Set(
      (rows ?? []).map((r) => r.source_year).filter((x): x is number => !!x)
    ),
  ].sort((a, b) => b - a);

  return { subjects: subjects ?? [], exams, years };
}

const PAGE_SIZE = 30;

export async function searchArchive(
  filters: ArchiveFilters,
  page = 0
): Promise<{ items: ArchiveQuestion[]; hasMore: boolean }> {
  const supabase = await createClient();

  let query = supabase
    .from("questions")
    .select(
      "id, body, options, image_url, source_label, source_exam, source_year, topics!inner(name_bn, subjects!inner(slug, name_bn))"
    )
    .eq("status", "published");

  if (filters.subject) {
    query = query.eq("topics.subjects.slug", filters.subject);
  }
  if (filters.exam) query = query.eq("source_exam", filters.exam);
  if (filters.year) query = query.eq("source_year", Number(filters.year));
  if (filters.q) {
    // Trigram-backed substring match — forgiving for Bangla phrases.
    query = query.ilike("body", `%${filters.q}%`);
  }

  const from = page * PAGE_SIZE;
  query = query
    .order("source_year", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE);

  const { data } = await query;
  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;

  const items: ArchiveQuestion[] = rows.slice(0, PAGE_SIZE).map((q) => {
    const topic = q.topics as unknown as {
      name_bn: string;
      subjects: { name_bn: string } | null;
    } | null;
    return {
      id: q.id,
      body: q.body,
      options: q.options as QuestionOption[],
      image_url: q.image_url,
      source_label: q.source_label,
      source_exam: q.source_exam,
      source_year: q.source_year,
      topic_bn: topic?.name_bn ?? "",
      subject_bn: topic?.subjects?.name_bn ?? "",
    };
  });

  return { items, hasMore };
}
