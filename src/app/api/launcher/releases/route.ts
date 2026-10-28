import { createClient } from "@supabase/supabase-js";

type LauncherReleaseRow = {
  id: string;
  version: string;
  channel: "stable" | "beta";
  news_tag: "launcher" | "server" | "event";
  cover_url: string | null;
  title: string;
  summary: string;
  change_notes: string[];
  github_release_url: string;
  published_at: string;
};

const cacheHeaders = {
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return Response.json({ error: "Новости временно недоступны." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.from("launcher_releases")
      .select("id,version,channel,news_tag,cover_url,title,summary,change_notes,github_release_url,published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("[launcher/releases] Public release query failed:", error.message);
      return Response.json({ error: "Новости временно недоступны." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json((data ?? []) as LauncherReleaseRow[], { headers: cacheHeaders });
  } catch (error) {
    console.error("[launcher/releases] Unexpected error:", error);
    return Response.json({ error: "Новости временно недоступны." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
