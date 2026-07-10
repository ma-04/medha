import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withBundleAnalyzer from "@next/bundle-analyzer";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lwyaybsmshckpanmgaln.supabase.co",
      },
    ],
  },
  experimental: {
    // Rewrites barrel imports to deep paths so a named import doesn't pull the
    // whole package into the graph. lucide-react and @base-ui/react are the two
    // large barrel packages we use, at 39 MB and 19 MB on disk.
    optimizePackageImports: ["lucide-react", "@base-ui/react"],
  },
};

export default withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" })(
  withNextIntl(nextConfig)
);
