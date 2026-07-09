"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";

const subjectSchema = z.object({
  name_bn: z.string().min(1),
  name_en: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  order_index: z.coerce.number().int().default(0),
});

const topicSchema = subjectSchema.extend({
  subject_id: z.string().uuid(),
});

export type ActionResult = { error?: string; ok?: boolean };

export async function createSubject(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireStaff();
  const parsed = subjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "সব ঘর সঠিকভাবে পূরণ করুন" };

  const supabase = await createClient();
  const { error } = await supabase.from("subjects").insert(parsed.data);
  if (error) return { error: error.message };

  revalidatePath("/admin/taxonomy");
  return { ok: true };
}

export async function createTopic(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireStaff();
  const parsed = topicSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "সব ঘর সঠিকভাবে পূরণ করুন" };

  const supabase = await createClient();
  const { error } = await supabase.from("topics").insert(parsed.data);
  if (error) return { error: error.message };

  revalidatePath("/admin/taxonomy");
  return { ok: true };
}

export async function deleteSubject(id: string) {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("subjects").delete().eq("id", id);
  revalidatePath("/admin/taxonomy");
}

export async function deleteTopic(id: string) {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("topics").delete().eq("id", id);
  revalidatePath("/admin/taxonomy");
}
