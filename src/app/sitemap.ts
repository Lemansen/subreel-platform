import type { MetadataRoute } from "next";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://subreel.ru").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/catalog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/cinema`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/minecraft`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/minecraft/launcher`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/minecraft/server`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error("Supabase public environment variables are missing.");
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
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
