import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cache } from "react";

export type Role = "student" | "teacher" | "admin";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  preferred_locale: "bn" | "en";
  plan: string;
};

/**
 * Returns the current user's profile, or null if unauthenticated.
 *
 * getClaims() verifies the JWT's ES256 signature locally against the cached
 * JWKS, so unlike getUser() it costs no round-trip to the Auth server. It is
 * still a trustworthy authorization source, unlike a bare getSession(), which
 * only decodes. cache() collapses the layout's and the page's calls into one
 * profiles query per request.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, preferred_locale, plan")
    .eq("id", userId)
    .single();

  return (profile as Profile) ?? null;
});

/** Redirects to /login if unauthenticated; returns the profile otherwise. */
export async function requireUser(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Redirects non-admins away; returns the profile if admin. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");
  return profile;
}

/**
 * Redirects away anyone who is not staff (admin or teacher); returns the
 * profile otherwise. Gates content-authoring and exam-running admin routes.
 */
export async function requireStaff(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "teacher") redirect("/");
  return profile;
}
