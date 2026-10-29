/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { SiteHeader, SiteHeaderFallback } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Новости лаунчера — SubReel" };
export const instant = false;

type Release = {
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

const dateLabel = (value: string) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(new Date(value));
const isNew = (value: string) => Date.now() - new Date(value).getTime() < 7 * 24 * 60 * 60 * 1000;
const tagLabel = (tag: Release["news_tag"]) => ({ launcher: "Лаунчер", server: "Сервер", event: "Событие" })[tag] ?? "Лаунчер";

export default function LauncherNewsPage() {
  return <Suspense fallback={<main className="min-h-screen bg-background p-10 text-text-secondary">Загружаю новости…</main>}>
    <LauncherNewsContent />
  </Suspense>;
}

async function LauncherNewsContent() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.from("launcher_releases")
    .select("id,version,channel,news_tag,cover_url,title,summary,change_notes,github_release_url,published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);
  if (error) console.error("Launcher news query failed:", error.message);
  const releases = (data ?? []) as Release[];
  const [featured, ...rest] = releases;

  return <main className="min-h-screen bg-background text-white">
    <Suspense fallback={<SiteHeaderFallback />}><SiteHeader active="news" /></Suspense>
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">SubReel Launcher</p>
      <h1 className="mt-3 text-4xl font-black sm:text-5xl">Новости и обновления</h1>
      <p className="mt-3 max-w-2xl text-text-secondary">Релизы лаунчера и список изменений — те же публикации, которые видны в лаунчере.</p>

      {featured ? <>
        <Link href={`/news/${encodeURIComponent(featured.version)}`} className="group mt-9 block overflow-hidden rounded-3xl border border-white/10 bg-surface-1 transition hover:border-accent/50">
          <div className="relative grid min-h-72 items-center gap-6 overflow-hidden bg-gradient-to-br from-violet-950 via-surface-1 to-sky-950 p-7 sm:grid-cols-[1fr_auto] sm:p-10">
            {featured.cover_url && <div className="absolute inset-0"><img src={featured.cover_url} alt="" className="size-full object-cover opacity-25 transition duration-500 group-hover:scale-[1.02]" /></div>}
            <div className="pointer-events-none absolute -right-12 -top-28 size-96 rounded-full bg-accent/15 blur-3xl transition group-hover:bg-accent/25" />
            <div className="relative max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
                <span>{tagLabel(featured.news_tag)} · {featured.channel === "beta" ? "Бета" : "Релиз"}</span>
                {isNew(featured.published_at) && <span className="rounded-full bg-accent px-2 py-1 text-[10px] text-white">НОВОЕ</span>}
              </div>
              <h2 className="mt-4 text-3xl font-black sm:text-4xl">{featured.title}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">{featured.summary}</p>
              <p className="mt-5 text-xs text-text-muted">{dateLabel(featured.published_at)} · версия {featured.version}</p>
            </div>
            <div aria-hidden className="relative hidden select-none text-7xl font-black tracking-tighter text-white/10 sm:block lg:text-9xl">{featured.version}</div>
          </div>
        </Link>
        {rest.length ? <section className="mt-10">
          <h2 className="text-xl font-bold">Предыдущие публикации</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((release) => <Link key={release.id} href={`/news/${encodeURIComponent(release.version)}`} className="group rounded-2xl border border-white/10 bg-surface-1 p-5 transition hover:-translate-y-0.5 hover:border-accent/40">
              {release.cover_url && <div className="-mx-5 -mt-5 mb-4 h-36 overflow-hidden rounded-t-2xl"><img src={release.cover_url} alt="" className="size-full object-cover" /></div>}
              <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wider text-accent">{tagLabel(release.news_tag)} · {release.channel === "beta" ? "Бета" : "Обновление"}</span>{isNew(release.published_at) && <span className="rounded-full bg-accent/15 px-2 py-1 text-[10px] font-bold text-accent">НОВОЕ</span>}</div>
              <h3 className="mt-3 text-lg font-bold group-hover:text-accent">{release.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-text-secondary">{release.summary}</p>
              <p className="mt-4 text-xs text-text-muted">{dateLabel(release.published_at)} · {release.version}</p>
            </Link>)}
          </div>
        </section> : null}
      </> : <div className="mt-9 rounded-3xl border border-white/10 bg-surface-1 p-8 text-text-secondary">{error ? "Новости временно недоступны. Попробуйте обновить страницу позже." : "Пока нет опубликованных новостей. Новые релизы появятся здесь."}</div>}
    </div>
  </main>;
}
