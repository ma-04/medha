import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { importRowSchema, contentHash } from "@/lib/import";

export async function POST(request: Request) {
  // Verify the caller is staff (admin or teacher) using their session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rawRows = await request.json();
  if (!Array.isArray(rawRows)) {
    return NextResponse.json({ error: "expected array" }, { status: 400 });
  }

  const service = createServiceClient();

  // Resolve (subject_slug, topic_slug) -> topic_id once.
  const { data: topicRows } = await service
    .from("topics")
    .select("id, slug, subjects(slug)");
  const topicMap = new Map<string, string>();
  for (const t of topicRows ?? []) {
    const subjectSlug = (t.subjects as { slug: string } | null)?.slug;
    if (subjectSlug) topicMap.set(`${subjectSlug}/${t.slug}`, t.id);
  }

  const errors: { row: number; error: string }[] = [];
  let inserted = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const parsed = importRowSchema.safeParse(rawRows[i]);
    if (!parsed.success) {
      errors.push({ row: i + 1, error: parsed.error.issues[0]?.message ?? "invalid" });
      continue;
    }
    const row = parsed.data;
    const topicId = topicMap.get(`${row.subject_slug}/${row.topic_slug}`);
    if (!topicId) {
      errors.push({ row: i + 1, error: `topic not found: ${row.subject_slug}/${row.topic_slug}` });
      continue;
    }
    if (row.options.length < 2) {
      errors.push({ row: i + 1, error: "need at least 2 options" });
      continue;
    }
    if (!row.options.some((o) => o.key === row.correct_key)) {
      errors.push({ row: i + 1, error: "correct_key not among options" });
      continue;
    }

    const hash = contentHash(row.body, row.source_exam);
    const { data: q, error: qErr } = await service
      .from("questions")
      .upsert(
        {
          topic_id: topicId,
          body: row.body,
          options: row.options,
          explanation: row.explanation ?? null,
          difficulty: row.difficulty ?? null,
          source_exam: row.source_exam ?? null,
          source_year: row.source_year ?? null,
          source_label: row.source_label ?? null,
          status: row.status ?? "published",
          content_hash: hash,
        },
        { onConflict: "content_hash" }
      )
      .select("id")
      .single();

    if (qErr || !q) {
      errors.push({ row: i + 1, error: qErr?.message ?? "insert failed" });
      continue;
    }

    const { error: aErr } = await service
      .from("question_answers")
      .upsert(
        { question_id: q.id, correct_key: row.correct_key },
        { onConflict: "question_id" }
      );
    if (aErr) {
      errors.push({ row: i + 1, error: aErr.message });
      continue;
    }
    inserted++;
  }

  return NextResponse.json({ inserted, errors });
}
