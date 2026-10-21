import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type PublicProfile = {
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
    .select("username, display_name, avatar_url, bio")
    .eq("username", normalizedUsername)
    .eq("is_public", true)
    .maybeSingle();

  if (error || !data?.username) notFound();

  const profile = data as PublicProfile;
  const displayName = profile.display_name || profile.username;

  return (
    <main className="min-h-screen bg-[#080810] px-4 py-12 text-white">
      <section className="mx-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-purple-950/20">
        <div className="h-32 bg-[radial-gradient(ellipse_at_top_right,_rgba(124,58,237,0.34),_transparent_65%)]" />
        <div className="px-6 pb-8 sm:px-9">
          <div className="-mt-12 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-[#111119] bg-purple-500/20 text-3xl font-bold text-purple-200">
            {profile.avatar_url ? (
              // Remote avatars are user-provided URLs, so render them without requiring a host allowlist.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              displayName.slice(0, 1).toUpperCase()
            )}
          </div>
          <p className="mt-5 text-sm text-purple-300">@{profile.username}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{displayName}</h1>
          <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-white/65">
            {profile.bio || "Пользователь пока ничего не рассказал о себе."}
          </p>
          <p className="mt-8 border-t border-white/10 pt-5 text-xs text-white/40">
            Публичная страница SubReel. Личная библиотека и прогресс просмотра скрыты.
          </p>
        </div>
      </section>
    </main>
  );
}
