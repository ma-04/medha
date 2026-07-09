// Seeds two demo live exams for UI testing: one upcoming (lobby countdown) and
// one finished with a populated, finalized leaderboard.
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
const iso = (ms) => new Date(ms).toISOString();
const now = Date.now();

const { data: qs } = await svc
  .from("questions")
  .select("id, topics(subject_id)")
  .eq("status", "published")
  .limit(3);

async function makeExam(titleBn, titleEn, startsAt, endsAt, published) {
  await svc.from("exams").delete().eq("title_en", titleEn);
  const { data: exam } = await svc
    .from("exams")
    .insert({
      title_bn: titleBn,
      title_en: titleEn,
      type: "live",
      status: "published",
      starts_at: iso(startsAt),
      ends_at: iso(endsAt),
      results_published_at: published ? iso(now - 60_000) : null,
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
  return exam.id;
}

// Upcoming: starts in 3 minutes.
const upcoming = await makeExam(
  "লাইভ ডেমো (আসন্ন)",
  "Live Demo Upcoming",
  now + 180_000,
  now + 3780_000,
  false
);

// Finished + published, with ranked attempts for the 3 live test users.
const finished = await makeExam(
  "লাইভ ডেমো (সম্পন্ন)",
  "Live Demo Finished",
  now - 3600_000,
  now - 600_000,
  true
);

const { data: list } = await svc.auth.admin.listUsers();
const users = ["live-a", "live-b", "live-c"]
  .map((n) => list.users.find((u) => u.email === `${n}@medha.test`))
  .filter(Boolean);
if (users.length === 3) {
  const scores = [3, 1.75, 1];
  await svc.from("exam_attempts").delete().eq("exam_id", finished);
  await svc.from("exam_attempts").insert(
    users.map((u, i) => ({
      exam_id: finished,
      user_id: u.id,
      deadline: iso(now - 600_000),
      submitted_at: iso(now - 700_000 + i * 1000),
      score: scores[i],
      correct_count: [3, 2, 1][i],
      wrong_count: [0, 1, 0][i],
      skipped_count: [0, 0, 2][i],
      rank: i + 1,
    }))
  );
}

console.log("UPCOMING=" + upcoming);
console.log("FINISHED=" + finished);
