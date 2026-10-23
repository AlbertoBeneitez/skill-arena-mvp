import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined);
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/qa/"] },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
