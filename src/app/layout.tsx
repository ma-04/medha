import type { Metadata } from "next";
import { Geist_Mono, Hind_Siliguri, Noto_Serif_Bengali } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const hindSiliguri = Hind_Siliguri({
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["bengali", "latin"],
});

const notoSerifBengali = Noto_Serif_Bengali({
  variable: "--font-bengali-serif",
  subsets: ["bengali", "latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "মেধা — Medha",
    template: "%s | মেধা",
  },
  description:
    "বিসিএস ও চাকরির প্রস্তুতির সেরা সঙ্গী — অনুশীলন, মডেল টেস্ট, লাইভ পরীক্ষা ও প্রশ্নব্যাংক",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${hindSiliguri.variable} ${notoSerifBengali.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
