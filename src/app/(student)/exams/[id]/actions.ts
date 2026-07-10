"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

// Start a fresh attempt on a retry-enabled model test. The RPC enforces the
// cap, model-only, and that the latest attempt is already submitted.
export async function retryExam(examId: string): Promise<{ error?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("retry_exam_attempt", {
    p_exam_id: examId,
  });
  if (error) return { error: error.message };
  redirect(`/exams/${examId}/attempt`);
}
