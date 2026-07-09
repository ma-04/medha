// Creates (or promotes) a confirmed admin user using the service-role key.
// Usage: node scripts/create-admin.mjs <email> <password>
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

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: node scripts/create-admin.mjs <email> <password>");
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Find existing user by email, else create one (email pre-confirmed).
const { data: list } = await admin.auth.admin.listUsers();
let user = list.users.find((u) => u.email === email);

if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Admin" },
  });
  if (error) throw error;
  user = data.user;
  console.log("Created user", user.id);
} else {
  console.log("User already exists", user.id);
}

const { error: roleErr } = await admin
  .from("profiles")
  .update({ role: "admin" })
  .eq("id", user.id);
if (roleErr) throw roleErr;

console.log(`✓ ${email} is now an admin.`);
