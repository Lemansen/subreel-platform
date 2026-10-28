import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SiteHeader, SiteHeaderFallback } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import AccountForm, { type AccountProfile, type AccountSummary } from "./account-form";
import { getLinkedMinecraftProfiles } from "@/lib/minecraft/linked-profiles";
import { SubCoinsPanel } from "./subcoins-panel";

export const metadata = {
  title: "Мой профиль",
  description: "Имя, аватар, приватность и быстрый доступ к библиотеке и друзьям.",
};

type LibraryStats = { library_count: number; in_progress_count: number; completed_count: number };


async function AccountGate() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/login?next=%2Faccount");

  const friendsOf = () =>
    supabase.from("friend_requests").select("id", { count: "exact", head: true });

  const [profileRes, statsRes, friendsRes, incomingRes, minecraftResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name, avatar_url, bio, is_public, is_suspended, suspension_reason")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("user_library_stats"),
    friendsOf().eq("status", "accepted").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
    friendsOf().eq("addressee_id", user.id).eq("status", "pending"),
    getLinkedMinecraftProfiles(supabase, user.id),
  ]);

  const profile = (profileRes.data ?? null) as AccountProfile | null;

  let appealStatus: string | null = null;
  if (profile?.is_suspended) {
    const { data: appeal } = await supabase
      .from("moderation_appeals")
      .select("status")
      .eq("user_id", user.id)
      .in("status", ["open", "in_review"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    appealStatus = appeal?.status ?? null;
  }

  // Счётчики — дополнение: если миграции ещё не применены, блок просто упрощается.
  const stats = (statsRes.error ? null : (statsRes.data?.[0] ?? null)) as LibraryStats | null;
  const summary: AccountSummary = {
    library: stats ? Number(stats.library_count) : null,
    inProgress: stats ? Number(stats.in_progress_count) : null,
    completed: stats ? Number(stats.completed_count) : null,
    friends: friendsRes.error ? null : (friendsRes.count ?? 0),
    incomingRequests: incomingRes.error ? null : (incomingRes.count ?? 0),
  };

  return (
    <>
      <AccountForm
        userId={user.id}
        email={user.email ?? ""}
        minecraftProfiles={minecraftResult.profiles}
        minecraftProfilesLoadFailed={Boolean(minecraftResult.error)}
        profile={profile}
        appealStatus={appealStatus}
        summary={summary}
        loadFailed={Boolean(profileRes.error)}
      />
      <SubCoinsPanel userId={user.id} />
    </>
  );
}

function AccountSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">
      <div className="overflow-hidden rounded-3xl border border-border-subtle bg-surface-1">
        <div className="h-24 bg-surface-2 sm:h-32" />
        <div className="px-5 pb-8 sm:px-8">
          <div className="-mt-12 size-24 rounded-full border-4 border-surface-1 bg-surface-hover sm:-mt-14 sm:size-28" />
          <div className="mt-5 h-4 w-24 rounded bg-surface-2" />
          <div className="mt-3 h-9 w-56 rounded bg-surface-2" />
          <div className="mt-4 h-4 w-full max-w-md rounded bg-surface-2" />
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[288px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="h-28 rounded-2xl bg-surface-1" />
          <div className="h-24 rounded-2xl bg-surface-1" />
        </div>
        <div className="h-96 rounded-2xl bg-surface-1" />
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Suspense
        fallback={
          <>
            <SiteHeaderFallback />
            <AccountSkeleton />
          </>
        }
      >
        <SiteHeader active="profile" />
        <AccountGate />
      </Suspense>
    </main>
  );
}
