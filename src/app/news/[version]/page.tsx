/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { SiteHeader, SiteHeaderFallback } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type Props = { params: Promise<{ version: string }> };
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

export async function generateMetadata({ params }: Props) {
  const { version } = await params;
  return { title: `Обновление ${version} — SubReel`, description: "Новости и список изменений SubReel Launcher." };
}

export default function LauncherNewsArticle({ params }: Props) {
  return <Suspense fallback={<main className="min-h-screen bg-background p-10 text-text-secondary">Загружаю новость…</main>}>
    <LauncherNewsArticleContent params={params} />
  </Suspense>;
}

async function LauncherNewsArticleContent({ params }: Props) {
  await connection();
  const { version } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("launcher_releases")
    .select("id,version,channel,news_tag,cover_url,title,summary,change_notes,github_release_url,published_at")
    .eq("version", version).eq("status", "published").maybeSingle();
  if (!data) notFound();
  const release = data as Release;

  return <main className="min-h-screen bg-background text-white">
    <Suspense fallback={<SiteHeaderFallback />}><SiteHeader active="news" /></Suspense>
    <article className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
      <Link href="/news" className="text-sm text-accent hover:underline">← Все новости</Link>
      <header className="relative mt-6 min-h-72 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-950 via-surface-1 to-sky-950 p-7 sm:p-10">
        {release.cover_url && <div className="absolute inset-0"><img src={release.cover_url} alt="" className="size-full object-cover opacity-25" /></div>}
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-32 size-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{{ launcher: "Лаунчер", server: "Сервер", event: "Событие" }[release.news_tag]} · {release.channel === "beta" ? "Бета" : "Релиз"} · {new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(new Date(release.published_at))}</p>
          <h1 className="mt-4 text-3xl font-black sm:text-5xl">{release.title}</h1>
          <p className="mt-4 max-w-2xl leading-7 text-text-secondary">{release.summary}</p>
          <p className="mt-5 text-sm text-text-muted">Версия {release.version}</p>
        </div>
      </header>
      <section className="mt-9">
        <h2 className="text-2xl font-bold">Что изменилось</h2>
        {release.change_notes.length ? <ul className="mt-5 space-y-3">{release.change_notes.map((note, index) => <li key={`${index}-${note}`} className="flex gap-3 rounded-xl border border-white/5 bg-surface-1 px-4 py-3 leading-6 text-text-secondary"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />{note}</li>)}</ul> : <p className="mt-4 text-text-secondary">Подробный список изменений пока не добавлен.</p>}
      </section>
      <a href={release.github_release_url} target="_blank" rel="noreferrer" className="mt-8 inline-flex rounded-xl bg-accent-strong px-5 py-3 text-sm font-bold text-white transition hover:brightness-110">Открыть релиз на GitHub ↗</a>
    </article>
  </main>;
}
