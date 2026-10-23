import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://subreel.ru").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/catalog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];
  try {
    const supabase = await createClient();
    const [titles, franchises] = await Promise.all([
      supabase.from("titles").select("slug, updated_at").eq("status", "published").limit(50000),
      supabase.from("franchises").select("slug, updated_at").eq("status", "published").limit(10000),
    ]);
    if (titles.error) console.error("[sitemap] titles query failed:", titles.error.message);
    if (franchises.error) console.error("[sitemap] franchises query failed:", franchises.error.message);
    return [
      ...staticRoutes,
      ...(titles.data ?? []).map((item) => ({
        url: `${siteUrl}/title/${item.slug}`,
        lastModified: item.updated_at ? new Date(item.updated_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...(franchises.data ?? []).map((item) => ({
        url: `${siteUrl}/franchise/${item.slug}`,
        lastModified: item.updated_at ? new Date(item.updated_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch (error) {
    console.error("[sitemap] generation failed:", error);
    return staticRoutes;
  }
}
