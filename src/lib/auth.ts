import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Role = "student" | "teacher" | "admin";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  preferred_locale: "bn" | "en";
  plan: string;
};

/** Returns the current user's profile, or null if unauthenticated. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, preferred_locale, plan")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

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
