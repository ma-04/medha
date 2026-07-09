import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["bn", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "bn";

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get("locale")?.value;
  const locale: Locale = cookieLocale === "en" ? "en" : "bn";

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
