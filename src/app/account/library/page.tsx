import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SiteHeader, SiteHeaderFallback } from "@/components/site-header";
import { ContinueShelf } from "@/components/library/continue-shelf";
import { LibraryBrowser } from "@/components/library/library-browser";
import { loadLibrary } from "@/lib/library";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Моя библиотека",
  description: "Твои статусы, избранное и места, где ты остановился.",
};

async function LibraryContent() {
  await connection();
  const db = await createClient();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) redirect("/login?next=%2Faccount%2Flibrary");

  const result = await loadLibrary(db, user.id);

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <SiteHeader active="library" />
        <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 sm:pt-12 lg:px-8">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Моя библиотека</h1>
          <div role="alert" className="mt-8 rounded-2xl border border-warning/20 bg-warning/5 p-6 sm:p-8">
            <h2 className="font-semibold text-warning">Не удалось загрузить библиотеку</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">Твои данные на месте. Обнови страницу или загляни чуть позже.</p>
            <Link href="/account/library" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm font-medium transition hover:bg-surface-2">
              Повторить
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { items, continueItems, summary, truncated } = result.data;
  const stats = [
    { label: "В библиотеке", value: summary.total },
    { label: "Завершено", value: summary.completed },
    { label: "В избранном", value: summary.favorites },
    { label: "Серий и глав пройдено", value: summary.passedUnits },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader active="library" />

      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Моя библиотека</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
              Видна только тебе. Статус и избранное меняются прямо в списке.
            </p>
          </div>
          <a
            href="/account/library/export"
            className="inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm font-semibold transition hover:border-accent/40 hover:bg-surface-2"
          >
            Скачать JSON
          </a>
        </div>

        {summary.total > 0 && (
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border-subtle bg-border-subtle sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-surface-1 px-4 py-3.5">
                <dt className="text-sm text-text-secondary">{stat.label}</dt>
                <dd className="mt-1 text-2xl font-black">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="pt-3">
        <ContinueShelf items={continueItems} />
      </div>

      <LibraryBrowser initialItems={items} truncated={truncated} />
    </main>
  );
}

function LibrarySkeleton() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeaderFallback />
      <div className="mx-auto max-w-7xl animate-pulse px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <div className="h-10 w-64 rounded-xl bg-surface-2" />
        <div className="mt-6 h-[74px] rounded-2xl bg-surface-1 sm:h-[78px]" />
        <div className="mt-8 h-11 rounded-xl bg-surface-1" />
        <div className="mt-3 flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-11 w-28 shrink-0 rounded-full bg-surface-1" />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] rounded-xl bg-surface-1" />
              <div className="mt-2 h-4 w-3/4 rounded bg-surface-1" />
              <div className="mt-2 h-11 rounded-lg bg-surface-1" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<LibrarySkeleton />}>
      <LibraryContent />
    </Suspense>
  );
}
