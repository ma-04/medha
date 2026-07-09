// Seeds a persistent PUBLISHED model exam that any student can attend anytime.
// Model exams have no start/end window — they're available as soon as status is
// 'published', and each student gets one server-timed attempt on first start.
// Idempotent: re-running replaces the same exam (matched by title_en).
// Usage: node scripts/seed-standing-exam.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2];
}
const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const TITLE_EN = "Full Model Test — Mixed";
const TITLE_BN = "ফুল মডেল টেস্ট — মিশ্র";

// Pull all published questions with their subject (for the breakdown + ordering).
const { data: qs, error: qErr } = await svc
  .from("questions")
  .select("id, subject_id:topics(subject_id, subjects(order_index))")
  .eq("status", "published");
if (qErr) throw qErr;
if (!qs?.length) throw new Error("No published questions — run seed-questions.mjs first.");

// Flatten and order by subject so the paper flows subject-by-subject.
const flat = qs.map((q) => ({
  id: q.id,
  subject_id: q.subject_id.subject_id,
  order: q.subject_id.subjects?.order_index ?? 99,
}));
flat.sort((a, b) => a.order - b.order);

// Replace any prior copy of this exam (cascade clears exam_questions/attempts).
await svc.from("exams").delete().eq("title_en", TITLE_EN);

const duration = Math.max(20, Math.round(flat.length * 0.75)); // ~45s/question
const { data: exam, error: eErr } = await svc
  .from("exams")
  .insert({
    title_bn: TITLE_BN,
    title_en: TITLE_EN,
    description:
      "সকল বিষয়ের মিশ্র প্রশ্ন নিয়ে পূর্ণাঙ্গ মডেল টেস্ট। যেকোনো সময় অংশগ্রহণ করা যাবে।",
    type: "model",
    status: "published",
    pattern: {
      duration_minutes: duration,
      negative_mark: 0.5,
      mark_per_question: 1,
      total_questions: flat.length,
    },
  })
  .select("id")
  .single();
if (eErr) throw eErr;

const { error: linkErr } = await svc.from("exam_questions").insert(
  flat.map((q, i) => ({
    exam_id: exam.id,
    question_id: q.id,
    subject_id: q.subject_id,
    order_index: i,
  }))
);
if (linkErr) throw linkErr;

console.log(
  `✓ Published "${TITLE_EN}" — ${flat.length} questions, ${duration} min.`
);
console.log(`  Exam ID: ${exam.id}`);
console.log(`  Students can attend anytime at /exams/${exam.id}`);
