// Seeds questions from data/questions/*.json using the service-role key.
// Idempotent via content_hash. Usage: node scripts/seed-questions.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const raw = readFileSync(join(__dirname, "../.env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}
loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const hash = (body, exam) =>
  createHash("sha256").update(`${exam ?? ""}::${body.trim()}`).digest("hex");

// Resolve subject_slug/topic_slug -> topic_id.
const { data: topics } = await supabase
  .from("topics")
  .select("id, slug, subjects(slug)");
const topicMap = new Map();
for (const t of topics ?? []) {
  const s = t.subjects?.slug;
  if (s) topicMap.set(`${s}/${t.slug}`, t.id);
}

const dir = join(__dirname, "../data/questions");
let inserted = 0;
const errors = [];

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const rows = JSON.parse(readFileSync(join(dir, file), "utf8"));
  for (const row of rows) {
    const topicId = topicMap.get(`${row.subject_slug}/${row.topic_slug}`);
    if (!topicId) {
      errors.push(`${file}: topic ${row.subject_slug}/${row.topic_slug} not found`);
      continue;
    }
    const { data: q, error } = await supabase
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
          status: "published",
          content_hash: hash(row.body, row.source_exam),
        },
        { onConflict: "content_hash" }
      )
      .select("id")
      .single();
    if (error || !q) {
      errors.push(`${file}: ${error?.message}`);
      continue;
    }
    await supabase
      .from("question_answers")
      .upsert(
        { question_id: q.id, correct_key: row.correct_key },
        { onConflict: "question_id" }
      );
    inserted++;
  }
}

console.log(`✓ Seeded ${inserted} questions.`);
if (errors.length) console.error("Errors:\n" + errors.join("\n"));
