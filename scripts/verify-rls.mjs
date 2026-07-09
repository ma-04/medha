// Verifies the answer-key isolation invariant: an anonymous/student client
// must NOT be able to read question_answers, but CAN read published questions.
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

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

let failed = false;

// 1. Anon cannot read any answer key.
const { data: answers } = await anon
  .from("question_answers")
  .select("question_id, correct_key");
if (answers && answers.length > 0) {
  console.error(`✗ FAIL: anon read ${answers.length} answer rows!`);
  failed = true;
} else {
  console.log("✓ anon cannot read question_answers");
}

// 2. Anon CAN read published questions (but rows carry no correct_key column).
const { data: questions } = await anon
  .from("questions")
  .select("id, body, options, status");
const published = (questions ?? []).filter((q) => q.status === "published");
if (published.length > 0) {
  console.log(`✓ anon can read ${published.length} published questions`);
} else {
  console.error("✗ FAIL: anon could not read any published questions");
  failed = true;
}

// 3. Anon cannot write a question.
const { error: writeErr } = await anon
  .from("questions")
  .insert({ topic_id: "00000000-0000-0000-0000-000000000000", body: "x", options: [] });
if (writeErr) {
  console.log("✓ anon cannot insert questions");
} else {
  console.error("✗ FAIL: anon inserted a question!");
  failed = true;
}

process.exit(failed ? 1 : 0);
