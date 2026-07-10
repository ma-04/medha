import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importRowSchema } from "@/lib/import";
import type { Json } from "@/types/database";

type ImportResult = {
  inserted: number;
  updated: number;
  errors: { row: number; error: string }[];
};

export async function POST(request: Request) {
  const rawRows = await request.json();
  if (!Array.isArray(rawRows)) {
    return NextResponse.json({ error: "expected array" }, { status: 400 });
  }

  // Shape validation only. Authorization lives in admin_import_questions, which
  // is SECURITY DEFINER behind can_author() and revoked from anon — so the
  // Android client gets the same gate without a second implementation here.
  const rows: Json[] = [];
  const errors: { row: number; error: string }[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const parsed = importRowSchema.safeParse(rawRows[i]);
    if (!parsed.success) {
      errors.push({
        row: i + 1,
        error: parsed.error.issues[0]?.message ?? "invalid",
      });
      continue;
    }
    rows.push({ ...parsed.data, row: i + 1 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_import_questions", {
    p_rows: rows,
  });

  if (error) {
    // 42501 = anon (no session): EXECUTE is revoked. "not authorized" = signed
    // in, but can_author() said no.
    if (error.code === "42501")
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (error.message.includes("not authorized"))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const result = data as unknown as ImportResult;
  return NextResponse.json({
    inserted: result.inserted,
    updated: result.updated,
    errors: [...errors, ...result.errors].sort((a, b) => a.row - b.row),
  });
}
