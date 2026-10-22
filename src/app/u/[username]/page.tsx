import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportForm } from "@/app/reports/report-form";

export const instant = false;

type PublicProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const normalizedUsername = username.toLowerCase();

  if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio")
    .eq("username", normalizedUsername)
    .eq("is_public", true)
    .maybeSingle();

  if (error || !data?.username) notFound();

  const profile = data as PublicProfile;
  const displayName = profile.display_name || profile.username;

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <section className="mx-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-border-subtle bg-surface-1 shadow-2xl shadow-black/20">
        <div className="h-32 bg-[radial-gradient(ellipse_at_top_right,_rgba(124,58,237,0.34),_transparent_65%)]" />
        <div className="px-6 pb-8 sm:px-9">
          <div className="-mt-12 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-surface-1 bg-accent/20 text-3xl font-bold text-accent">
            {profile.avatar_url ? (
              // Remote avatars are user-provided URLs, so render them without requiring a host allowlist.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              displayName.slice(0, 1).toUpperCase()
            )}
          </div>
          <p className="mt-5 text-sm text-accent">@{profile.username}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{displayName}</h1>
          <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-text-secondary">
            {profile.bio || "Пользователь пока ничего не рассказал о себе."}
          </p>
          <p className="mt-8 border-t border-border-subtle pt-5 text-xs text-text-muted">
            Публичная страница SubReel. Личная библиотека и прогресс просмотра скрыты.
          </p>
          <ReportForm target={{type:"profile",id:profile.id}} />
        </div>
      </section>
    </main>
  );
}
