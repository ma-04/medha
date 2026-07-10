"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setLocale(locale: "bn" | "en") {
  const store = await cookies();
  store.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Persist to profile if signed in (best-effort).
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (userId) {
    await supabase
      .from("profiles")
      .update({ preferred_locale: locale })
      .eq("id", userId);
  }

  revalidatePath("/", "layout");
}
