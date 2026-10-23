import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { contentLabels, coverBackground, firstOf } from "@/lib/catalog";
import { pluralRu } from "@/lib/catalog-query";
import { createClient } from "@/lib/supabase/server";
import { ReportForm } from "@/app/reports/report-form";
import { FriendButton, type FriendState } from "./friend-button";

export const instant = false;

type PublicProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type ReviewTitle = {
  name: string;
  slug: string;
  cover_url: string | null;
  content_type: string;
  release_year: number | null;
};

type PublicReview = {
  rating: number;
  body: string;
  updated_at: string;
  titles: ReviewTitle | ReviewTitle[] | null;
};

type RequestRow = { id: string; requester_id: string; addressee_id: string; status: "pending" | "accepted" | "rejected" };

const REVIEWS_SHOWN = 12;

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

  // Закрытый и несуществующий профиль выглядят одинаково: приватность не раскрывает, что аккаунт есть.
  if (error || !data?.username) notFound();

  const profile = data as PublicProfile;
  const displayName = profile.display_name || profile.username;

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const isOwner = viewer?.id === profile.id;

  const [reviewsRes, requestsRes, blockRes] = await Promise.all([
    supabase
      .from("title_reviews")
      .select("rating, body, updated_at, titles(name, slug, cover_url, content_type, release_year)", { count: "exact" })
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(REVIEWS_SHOWN),
    viewer && !isOwner
      ? supabase
          .from("friend_requests")
          .select("id, requester_id, addressee_id, status")
          .or(
            `and(requester_id.eq.${viewer.id},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${viewer.id})`,
          )
          .in("status", ["pending", "accepted"])
          .limit(1)
      : Promise.resolve(null),
    viewer && !isOwner
      ? supabase.from("user_blocks").select("blocked_id").eq("blocker_id", viewer.id).eq("blocked_id", profile.id).limit(1)
      : Promise.resolve(null),
  ]);

  const reviews = ((reviewsRes.error ? [] : reviewsRes.data) ?? []) as unknown as PublicReview[];
  const reviewCount = reviewsRes.error ? 0 : (reviewsRes.count ?? reviews.length);

  let friendState: FriendState = { kind: "none" };
  if (blockRes?.data?.length) {
    friendState = { kind: "blocked" };
  } else {
    const request = ((requestsRes?.data ?? []) as RequestRow[])[0];
    if (request) {
      friendState =
        request.status === "accepted"
          ? { kind: "friends", requestId: request.id }
          : request.requester_id === viewer?.id
            ? { kind: "outgoing", requestId: request.id }
            : { kind: "incoming", requestId: request.id };
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 pb-28 pt-6 sm:px-6 sm:pt-10 md:pb-16">
        <section className="overflow-hidden rounded-3xl border border-border-subtle bg-surface-1 shadow-2xl shadow-black/20">
          <div className="h-24 bg-[radial-gradient(ellipse_at_top_right,_rgba(124,58,237,0.34),_transparent_65%)] sm:h-32" />
          <div className="px-5 pb-6 sm:px-8 sm:pb-8">
            <div className="-mt-12 flex flex-wrap items-end justify-between gap-3 sm:-mt-14">
              <ProfileAvatar name={displayName} url={profile.avatar_url} size="lg" className="border-4 border-surface-1" />
              {isOwner ? (
                <Link
                  href="/account"
                  className="inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm font-semibold transition hover:border-accent/40 hover:bg-surface-2"
                >
                  Редактировать профиль
                </Link>
              ) : viewer ? (
                <FriendButton viewerId={viewer.id} profileId={profile.id} initial={friendState} />
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(`/u/${profile.username}`)}`}
                  className="inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm font-semibold transition hover:bg-surface-2"
                >
                  Войди, чтобы добавить в друзья
                </Link>
              )}
            </div>
            <p className="mt-4 text-sm text-accent">@{profile.username}</p>
            <h1 className="mt-1 break-words text-3xl font-black tracking-tight sm:text-4xl">{displayName}</h1>
            <p className="mt-3 max-w-prose whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">
              {profile.bio || "Пользователь пока ничего не рассказал о себе."}
            </p>
          </div>
        </section>

        <section aria-labelledby="reviews-heading" className="mt-10">
          <h2 id="reviews-heading" className="text-2xl font-bold tracking-tight">
            Отзывы
            {reviewCount > 0 && <span className="ml-2 text-base font-medium text-text-muted">{reviewCount}</span>}
          </h2>

          {reviews.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border-subtle px-6 py-12 text-center">
              <p className="font-semibold">Публичных отзывов пока нет</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">
                {isOwner
                  ? "Отзыв появится здесь, если отметить его публичным в форме оценки на странице произведения."
                  : "Здесь появятся оценки и отзывы, которыми пользователь решит поделиться."}
              </p>
              {isOwner && (
                <Link href="/account/library" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm font-semibold transition hover:bg-surface-2">
                  Открыть библиотеку
                </Link>
              )}
            </div>
          ) : (
            <ul className="mt-4 grid gap-3">
              {reviews.map((review) => {
                const title = firstOf(review.titles);
                if (!title) return null;
                return (
                  <li key={title.slug} className="flex gap-4 rounded-2xl border border-border-subtle bg-surface-1 p-4">
                    <Link
                      href={`/title/${title.slug}`}
                      tabIndex={-1}
                      aria-hidden
                      className="relative block aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg bg-surface-2 ring-1 ring-white/5 sm:w-20"
                    >
                      {title.cover_url ? (
                        <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: coverBackground(title.cover_url) }} />
                      ) : (
                        <span className="absolute inset-0 bg-gradient-to-br from-accent-strong/60 to-background" />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <h3 className="font-semibold leading-6">
                          <Link href={`/title/${title.slug}`} className="transition hover:text-accent">{title.name}</Link>
                        </h3>
                        <p aria-label={`Оценка: ${review.rating} из 10`} className="text-sm font-bold text-warning">
                          ★ {review.rating}<span className="font-medium text-text-muted"> / 10</span>
                        </p>
                      </div>
                      <p className="text-xs text-text-muted">
                        {[title.release_year, contentLabels[title.content_type] ?? title.content_type].filter(Boolean).join(" · ")}
                      </p>
                      {review.body && (
                        <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">{review.body}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {reviewCount > REVIEWS_SHOWN && (
            <p className="mt-3 text-sm text-text-muted">
              Показаны последние {REVIEWS_SHOWN} из {reviewCount} {pluralRu(reviewCount, ["отзыва", "отзывов", "отзывов"])}.
            </p>
          )}
        </section>

        <footer className="mt-10 border-t border-border-subtle pt-5">
          <p className="text-xs text-text-muted">
            Публичная страница SubReel. Личная библиотека и прогресс просмотра скрыты.
          </p>
          {!isOwner && <ReportForm target={{ type: "profile", id: profile.id }} />}
        </footer>
      </div>
    </main>
  );
}
