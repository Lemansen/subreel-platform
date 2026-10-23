import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://subreel.ru").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/account/", "/api/", "/login", "/register", "/reset-password", "/forgot-password"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
