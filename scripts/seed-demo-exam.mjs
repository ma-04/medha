// Seeds a persistent published demo model exam for manual/UI testing.
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

const { data: qs } = await svc
  .from("questions")
  .select("id, topics(subject_id)")
  .eq("status", "published")
  .limit(5);
await svc.from("exams").delete().eq("title_en", "Demo Model Test");
const { data: exam } = await svc
  .from("exams")
  .insert({
    title_bn: "ডেমো মডেল টেস্ট",
    title_en: "Demo Model Test",
    type: "model",
    status: "published",
    pattern: {
      duration_minutes: 30,
      negative_mark: 0.25,
      mark_per_question: 1,
      total_questions: qs.length,
    },
  })
  .select("id")
  .single();
await svc.from("exam_questions").insert(
  qs.map((q, i) => ({
    exam_id: exam.id,
    question_id: q.id,
    subject_id: q.topics.subject_id,
    order_index: i,
  }))
);
console.log("DEMO_EXAM_ID=" + exam.id);
