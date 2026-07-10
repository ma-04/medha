/**
 * The canonical origin of this deployment, for links that leave the app —
 * auth confirmation emails and the OAuth redirect.
 *
 * Never derive this from the request's `Origin`/`Host` header: those are
 * attacker-controlled, absent on some clients, and on Vercel they carry the
 * per-deployment preview host rather than the production domain, which is what
 * has to be in Supabase's redirect allow-list.
 *
 * Set NEXT_PUBLIC_SITE_URL to the production origin. VERCEL_PROJECT_PRODUCTION_URL
 * is the fallback: Vercel injects it as the project's production domain even in
 * preview builds, so a preview never mails out a preview link.
 */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return raw.replace(/\/$/, "");
}
