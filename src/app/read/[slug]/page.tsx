import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { ReadingViewer } from "@/components/reading-viewer";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const readingTypes = ["manga", "manhwa", "manhua", "light_novel", "web_novel", "book"];
type ReadingProgress = { chapter_id: string | null; current_page: number; total_pages: number | null; completed_at: string | null; updated_at: string };

async function ReadContent({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  await connection();
  const { slug } = await params;
  const query = await searchParams;
  const requestedId = Array.isArray(query.chapter) ? query.chapter[0] : query.chapter;
  const supabase = await createClient();
  const { data: title, error } = await supabase
    .from("titles")
    .select("id, name, slug, content_type")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <SiteHeader active="catalog" />
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold">Не удалось открыть читалку</h1>
          <p className="mt-3 text-sm text-text-secondary">Каталог временно недоступен. Попробуй позже.</p>
          <Link href="/catalog" className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm hover:bg-surface-1">← В каталог</Link>
        </div>
      </main>
    );
  }

  if (!title) notFound();

  const [chaptersRes, sourcesRes] = await Promise.all([
    supabase.from("title_chapters").select("id, chapter_label, name, sort_order").eq("title_id", title.id).eq("status", "published").order("sort_order"),
    supabase.from("reading_sources").select("id, chapter_id, source_url, source_format, provider_name, language_code").eq("title_id", title.id).order("created_at"),
  ]);
  if (chaptersRes.error) console.error(`[read/${slug}] chapters query failed:`, chaptersRes.error.message);
  if (sourcesRes.error) console.error(`[read/${slug}] sources query failed:`, sourcesRes.error.message);
  const chapters = chaptersRes.data ?? [];
  const sources = sourcesRes.data ?? [];
  const { data: { user } } = await supabase.auth.getUser();
  const progressRes = user
    ? await supabase.from("reading_progress").select("chapter_id, current_page, total_pages, completed_at, updated_at").eq("user_id", user.id).eq("title_id", title.id).order("updated_at", { ascending: false }).limit(100)
    : { data: [], error: null };
  if (progressRes.error) console.error(`[read/${slug}] progress query failed:`, progressRes.error.message);
  const progress = (progressRes.data ?? []) as ReadingProgress[];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader active="catalog" />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <Link href={`/title/${title.slug}`} className="text-sm text-text-secondary transition hover:text-white">← К странице тайтла</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Читалка</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{title.name}</h1>
          </div>
          <span className="rounded-full border border-border-subtle px-3 py-1.5 text-xs text-text-muted">{sources.length ? `${sources.length} разрешённых источников` : "Источник не подключён"}</span>
        </div>

        {!readingTypes.includes(title.content_type) ? (
          <section className="mt-6 rounded-2xl border border-border-subtle bg-surface-1 p-6 sm:p-8">
            <h2 className="font-semibold">Для этого формата не нужна читалка</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">Открой страницу тайтла и перейди к просмотру, если формат видео.</p>
            <Link href={`/title/${title.slug}`} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-4 text-sm font-semibold text-white hover:bg-violet-600">К тайтлу</Link>
          </section>
        ) : (
          sources.length > 0 ? <ReadingViewer titleId={title.id} chapters={chapters} sources={sources} initialProgress={progress} canSaveProgress={Boolean(user)} initialChapterId={requestedId ?? null} /> : <section className="mt-6 grid min-h-[55vh] place-items-center rounded-2xl border border-border-subtle bg-surface-1 px-6 py-12 text-center">
            <div className="max-w-xl">
              <div aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-2xl text-accent">▤</div>
              <h2 className="mt-5 text-lg font-semibold">Материалы для чтения пока не добавлены</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">Для этого тайтла ещё нет подключённого разрешённого источника. Страницы, главы и настройки чтения появятся здесь после добавления материалов в каталог.</p>
              <Link href={`/title/${title.slug}`} className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm font-medium hover:bg-surface-2">Вернуться к тайтлу</Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default function ReadPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <Suspense fallback={<main className="min-h-screen animate-pulse bg-background"><div className="h-[68px] border-b border-border-subtle" /><div className="mx-auto mt-10 min-h-[55vh] max-w-6xl rounded-2xl bg-surface-1" /></main>}>
      <ReadContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
