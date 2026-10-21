import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, unstable_rethrow } from "next/navigation";
import { ContentCard, type CatalogCardTitle } from "@/components/content-card";
import { SiteHeader, SiteHeaderFallback } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { coverBackground } from "@/lib/catalog";

type Params = Promise<{ slug: string }>;

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function FranchiseContent({ params }: { params: Params }) {
  await connection();
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) notFound();

  let franchise: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    cover_url: string | null;
  } | null = null;
  let titles: CatalogCardTitle[] = [];
  let catalogError = false;
  let pageError = false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("franchises")
      .select("id, name, slug, description, cover_url")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    if (!data) notFound();
    franchise = data;

    const titlesResult = await supabase
      .from("titles")
      .select("id, name, slug, description, cover_url, content_type, release_year")
      .eq("franchise_id", franchise.id)
      .eq("status", "published")
      .order("release_year", { ascending: true, nullsFirst: false })
      .limit(48);
    if (titlesResult.error) {
      console.error(`[franchise/${slug}] titles query failed:`, titlesResult.error.message);
      catalogError = true;
    } else {
      titles = (titlesResult.data ?? []) as CatalogCardTitle[];
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error(`[franchise/${slug}] load failed:`, error);
    if (!franchise) pageError = true;
    else catalogError = true;
  }

  if (!franchise && pageError) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <SiteHeader active="catalog" />
        <div role="alert" className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Не удалось загрузить франшизу</h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">Попробуй обновить страницу чуть позже.</p>
          <Link href="/catalog" className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-5 text-sm font-medium hover:bg-surface-1">Вернуться в каталог</Link>
        </div>
      </main>
    );
  }

  if (!franchise) notFound();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader active="catalog" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav aria-label="Хлебные крошки" className="py-5 text-sm text-text-secondary">
          <Link href="/catalog" className="transition hover:text-white">Каталог</Link>
          <span aria-hidden="true" className="px-2 text-text-muted">/</span>
          <span aria-current="page" className="text-white">{franchise.name}</span>
        </nav>

        <section className="relative isolate overflow-hidden rounded-3xl border border-border-subtle bg-surface-1">
          {franchise.cover_url && (
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 scale-110 bg-cover bg-center opacity-20 blur-2xl"
              style={{ backgroundImage: coverBackground(franchise.cover_url) }}
            />
          )}
          <div className="grid gap-6 p-5 sm:p-8 md:grid-cols-[180px_1fr] md:items-center lg:gap-10 lg:p-10">
            <div className="relative mx-auto aspect-[3/4] w-36 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-950 via-[#171321] to-[#0e0e14] sm:w-44 md:mx-0">
              {franchise.cover_url ? (
                <div role="img" aria-label={`Обложка франшизы: ${franchise.name}`} className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: coverBackground(franchise.cover_url) }} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-lg font-bold text-white/45">{franchise.name}</div>
              )}
            </div>
            <div className="text-center md:text-left">
              <p className="text-sm font-semibold text-accent">ФРАНШИЗА</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">{franchise.name}</h1>
              {franchise.description ? (
                <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-7 text-text-secondary sm:text-base">{franchise.description}</p>
              ) : (
                <p className="mt-4 text-sm text-text-muted">Описание франшизы пока не добавлено.</p>
              )}
              <a href="#franchise-titles" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-strong px-5 text-sm font-semibold text-white transition hover:bg-violet-600">К произведениям</a>
            </div>
          </div>
        </section>

        <section id="franchise-titles" className="py-10 sm:py-14">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-accent">ВСЕЛЕННАЯ SUBREEL</p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Произведения франшизы</h2>
            </div>
            {!catalogError && <p className="text-sm text-text-secondary">{titles.length} {titles.length === 1 ? "тайтл" : "тайтлов"}</p>}
          </div>

          {catalogError ? (
            <div role="alert" className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-6">
              <h3 className="font-semibold text-amber-200">Не удалось загрузить список произведений</h3>
              <p className="mt-2 text-sm text-text-secondary">Информация о франшизе доступна. Попробуй обновить страницу.</p>
            </div>
          ) : titles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-subtle px-6 py-12 text-center">
              <p className="font-semibold">В этой франшизе пока нет опубликованных произведений</p>
              <p className="mt-2 text-sm text-text-secondary">Когда произведения будут опубликованы, они появятся здесь.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {titles.map((title) => <ContentCard key={title.id} title={title} />)}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function FranchisePage({ params }: { params: Params }) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background text-foreground">
          <SiteHeaderFallback />
          <div className="mx-auto max-w-7xl animate-pulse px-4 py-12 sm:px-6 lg:px-8">
            <div className="h-5 w-40 rounded bg-surface-2" />
            <div className="mt-6 h-64 rounded-3xl bg-surface-1" />
            <div className="mt-10 h-8 w-64 rounded bg-surface-2" />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="aspect-[3/4] rounded-2xl bg-surface-1" />
              ))}
            </div>
          </div>
        </main>
      }
    >
      <FranchiseContent params={params} />
    </Suspense>
  );
}
