// End-to-end verification of the exam engine's integrity guarantees:
//  - server-side grading with negative marking is correct
//  - a student cannot tamper with their score (no UPDATE path)
//  - a student cannot read exam_questions / attempt_answers / question_answers
//  - answers cannot be saved past the server deadline
//  - review reveals answers only after submission
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}
loadEnv();

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });

let failed = false;
function check(ok, msg) {
  console.log(`${ok ? "✓" : "✗ FAIL:"} ${msg}`);
  if (!ok) failed = true;
}

// --- Setup: pick 4 published questions with known answers ------------------
const { data: qs } = await svc
  .from("questions")
  .select("id, topics(subject_id)")
  .eq("status", "published")
  .limit(4);
if (!qs || qs.length < 4) {
  console.error("Need >=4 published questions; run seed first.");
  process.exit(1);
}
const { data: keys } = await svc
  .from("question_answers")
  .select("question_id, correct_key")
  .in("question_id", qs.map((q) => q.id));
const keyMap = new Map(keys.map((k) => [k.question_id, k.correct_key]));
const items = qs.map((q) => ({
  id: q.id,
  subject_id: q.topics.subject_id,
  correct: keyMap.get(q.id),
}));

// Fresh exam each run.
await svc.from("exams").delete().eq("title_en", "__verify_exam__");
const { data: exam } = await svc
  .from("exams")
  .insert({
    title_bn: "যাচাই পরীক্ষা",
    title_en: "__verify_exam__",
    type: "model",
    status: "published",
    pattern: {
      duration_minutes: 30,
      negative_mark: 0.25,
      mark_per_question: 1,
      total_questions: 4,
    },
  })
  .select("id")
  .single();

await svc.from("exam_questions").insert(
  items.map((it, i) => ({
    exam_id: exam.id,
    question_id: it.id,
    subject_id: it.subject_id,
    order_index: i,
  }))
);

// --- Student session -------------------------------------------------------
const email = "exam-tester@medha.test";
const password = "Test1234!";
const { data: list } = await svc.auth.admin.listUsers();
let stu = list.users.find((u) => u.email === email);
if (!stu) {
  const { data } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Exam Tester" },
  });
  stu = data.user;
}

const student = createClient(URL_, ANON, { auth: { persistSession: false } });
const { error: signInErr } = await student.auth.signInWithPassword({
  email,
  password,
});
if (signInErr) {
  console.error("student sign-in failed:", signInErr.message);
  process.exit(1);
}

// --- Start attempt: questions delivered without answer keys ----------------
const { data: startRaw, error: startErr } = await student.rpc(
  "start_exam_attempt",
  { p_exam_id: exam.id }
);
check(!startErr, `start_exam_attempt ok ${startErr?.message ?? ""}`);
const start = startRaw;
check(start?.questions?.length === 4, "attempt returns 4 questions");
const leaks = JSON.stringify(start?.questions ?? []).match(/correct_key/);
check(!leaks, "delivered questions contain no correct_key");
const attemptId = start.attempt_id;

// --- Answer: 2 correct, 1 wrong, 1 skipped => 2 - 0.25 = 1.75 --------------
const wrongKey = (correct) => (correct === "a" ? "b" : "a");
await student.rpc("save_answer", {
  p_attempt_id: attemptId,
  p_question_id: items[0].id,
  p_selected_key: items[0].correct,
});
await student.rpc("save_answer", {
  p_attempt_id: attemptId,
  p_question_id: items[1].id,
  p_selected_key: items[1].correct,
});
await student.rpc("save_answer", {
  p_attempt_id: attemptId,
  p_question_id: items[2].id,
  p_selected_key: wrongKey(items[2].correct),
});

const { data: summary } = await student.rpc("submit_attempt", {
  p_attempt_id: attemptId,
});
check(Number(summary.score) === 1.75, `score is 1.75 (got ${summary.score})`);
check(summary.correct_count === 2, "correct_count is 2");
check(summary.wrong_count === 1, "wrong_count is 1");
check(summary.skipped_count === 1, "skipped_count is 1");

// --- Tamper: student cannot change their score -----------------------------
await student
  .from("exam_attempts")
  .update({ score: 999 })
  .eq("id", attemptId);
const { data: afterTamper } = await svc
  .from("exam_attempts")
  .select("score")
  .eq("id", attemptId)
  .single();
check(Number(afterTamper.score) === 1.75, "score unchanged after tamper attempt");

// --- Tamper: student cannot read protected tables --------------------------
const { data: eqRead } = await student.from("exam_questions").select("*");
check((eqRead ?? []).length === 0, "student cannot read exam_questions");
const { data: aaRead } = await student.from("attempt_answers").select("*");
check((aaRead ?? []).length === 0, "student cannot read attempt_answers");
const { data: qaRead } = await student.from("question_answers").select("*");
check((qaRead ?? []).length === 0, "student cannot read question_answers");

// --- Tamper: no answers past the deadline ----------------------------------
await svc
  .from("exam_attempts")
  .update({ submitted_at: null, deadline: new Date(Date.now() - 60000).toISOString() })
  .eq("id", attemptId);
const { error: lateErr } = await student.rpc("save_answer", {
  p_attempt_id: attemptId,
  p_question_id: items[3].id,
  p_selected_key: "a",
});
check(!!lateErr, `save_answer rejected past deadline (${lateErr?.message ?? "no error!"})`);
// Re-submit as the student to restore a graded state for the review check.
await student.rpc("submit_attempt", { p_attempt_id: attemptId });

// --- Review reveals answers only after submission --------------------------
const { data: review, error: revErr } = await student.rpc("get_attempt_review", {
  p_attempt_id: attemptId,
});
check(!revErr && (review ?? []).length === 4, "review returns 4 rows with keys");
check(
  (review ?? []).every((r) => typeof r.correct_key === "string"),
  "review rows include correct_key"
);

// Cleanup
await svc.from("exams").delete().eq("id", exam.id);

process.exit(failed ? 1 : 0);
