// Verifies live-exam integrity (the Phase 5 checkpoint, data-layer equivalent
// of "3 profiles sit a 5-min exam"):
//  - no early start (before starts_at)
//  - one attempt per user (resume, not duplicate)
//  - no answers after the window closes
//  - leaderboard gated until results are finalized
//  - ranks computed correctly by finalize_live_exam
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2];
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let failed = false;
function check(ok, msg) {
  console.log(`${ok ? "✓" : "✗ FAIL:"} ${msg}`);
  if (!ok) failed = true;
}
const iso = (ms) => new Date(ms).toISOString();

// --- 3 questions with known keys -------------------------------------------
const { data: qs } = await svc
  .from("questions")
  .select("id, topics(subject_id)")
  .eq("status", "published")
  .limit(3);
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
const wrong = (k) => (k === "a" ? "b" : "a");

// --- Live exam, initially starting 1 hour in the FUTURE --------------------
await svc.from("exams").delete().eq("title_en", "__verify_live__");
const now = Date.now();
const { data: exam } = await svc
  .from("exams")
  .insert({
    title_bn: "লাইভ যাচাই",
    title_en: "__verify_live__",
    type: "live",
    status: "published",
    starts_at: iso(now + 3600_000),
    ends_at: iso(now + 7200_000),
    pattern: {
      duration_minutes: 30,
      negative_mark: 0.25,
      mark_per_question: 1,
      total_questions: 3,
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

// --- Three student clients -------------------------------------------------
async function studentClient(email) {
  const { data: list } = await svc.auth.admin.listUsers();
  let u = list.users.find((x) => x.email === email);
  if (!u) {
    const { data } = await svc.auth.admin.createUser({
      email,
      password: "Test1234!",
      email_confirm: true,
      user_metadata: { full_name: email.split("@")[0] },
    });
    u = data.user;
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: "Test1234!" });
  return c;
}
const A = await studentClient("live-a@medha.test");
const B = await studentClient("live-b@medha.test");
const C = await studentClient("live-c@medha.test");

// --- No early start --------------------------------------------------------
const { error: earlyErr } = await A.rpc("start_exam_attempt", {
  p_exam_id: exam.id,
});
check(!!earlyErr, `early start rejected (${earlyErr?.message ?? "no error!"})`);

// Open the window now.
await svc
  .from("exams")
  .update({ starts_at: iso(now - 60_000), ends_at: iso(now + 3600_000) })
  .eq("id", exam.id);

// --- Everyone starts and answers -------------------------------------------
async function attempt(client, answers) {
  const { data: start } = await client.rpc("start_exam_attempt", {
    p_exam_id: exam.id,
  });
  for (const [qi, key] of answers) {
    await client.rpc("save_answer", {
      p_attempt_id: start.attempt_id,
      p_question_id: items[qi].id,
      p_selected_key: key,
    });
  }
  await client.rpc("submit_attempt", { p_attempt_id: start.attempt_id });
  return start.attempt_id;
}
// A: 3 correct => 3 ; B: 2 correct 1 wrong => 1.75 ; C: 1 correct => 1
await attempt(A, [
  [0, items[0].correct],
  [1, items[1].correct],
  [2, items[2].correct],
]);
await attempt(B, [
  [0, items[0].correct],
  [1, items[1].correct],
  [2, wrong(items[2].correct)],
]);
await attempt(C, [[0, items[0].correct]]);

// --- One attempt per user (starting again resumes, not duplicates) ---------
await A.rpc("start_exam_attempt", { p_exam_id: exam.id });
const { count } = await svc
  .from("exam_attempts")
  .select("id", { count: "exact", head: true })
  .eq("exam_id", exam.id);
check(count === 3, `exactly 3 attempts exist (got ${count})`);

// --- Leaderboard gated before finalize -------------------------------------
const { error: gateErr } = await A.rpc("get_leaderboard", {
  p_exam_id: exam.id,
});
check(!!gateErr, `leaderboard gated pre-finalize (${gateErr?.message ?? "leaked!"})`);

// --- Close the window; no late answers on the student's own attempt --------
await svc.from("exams").update({ ends_at: iso(now - 1000) }).eq("id", exam.id);
const aUserId = (await A.auth.getUser()).data.user.id;
const { data: aAttempt } = await svc
  .from("exam_attempts")
  .select("id")
  .eq("exam_id", exam.id)
  .eq("user_id", aUserId)
  .single();
await svc
  .from("exam_attempts")
  .update({ submitted_at: null, deadline: iso(now - 1000) })
  .eq("id", aAttempt.id);
const { error: lateErr } = await A.rpc("save_answer", {
  p_attempt_id: aAttempt.id,
  p_question_id: items[1].id,
  p_selected_key: "a",
});
check(
  lateErr?.message === "time is up",
  `late answer rejected past deadline (${lateErr?.message ?? "no error!"})`
);

// --- Finalize (window has ended, so service may finalize) ------------------
const { data: ranked, error: finErr } = await svc.rpc("finalize_live_exam", {
  p_exam_id: exam.id,
});
check(!finErr && ranked === 3, `finalize ranked 3 attempts (${finErr?.message ?? ranked})`);

// --- Ranks correct ---------------------------------------------------------
const { data: board } = await A.rpc("get_leaderboard", { p_exam_id: exam.id });
const byName = Object.fromEntries(
  (board ?? []).map((r) => [r.full_name, r])
);
check(byName["live-a"]?.rank === 1 && Number(byName["live-a"].score) === 3, "A is rank 1 (score 3)");
check(byName["live-b"]?.rank === 2 && Number(byName["live-b"].score) === 1.75, "B is rank 2 (score 1.75)");
check(byName["live-c"]?.rank === 3 && Number(byName["live-c"].score) === 1, "C is rank 3 (score 1)");
check(byName["live-a"]?.is_self === true, "caller's own row flagged is_self");

// Cleanup
await svc.from("exams").delete().eq("id", exam.id);

process.exit(failed ? 1 : 0);
