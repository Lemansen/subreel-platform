import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { unstable_rethrow } from "next/navigation";


type CatalogTitle = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  content_type: string;
  release_year: number | null;
};

const contentLabels: Record<string, string> = {
  anime: "Аниме",
  movie: "Фильм",
  series: "Сериал",
  drama: "Дорама",
  cartoon: "Мультфильм",
  manga: "Манга",
  manhwa: "Манхва",
  manhua: "Маньхуа",
  light_novel: "Лайт-новелла",
  web_novel: "Веб-новелла",
  book: "Книга",
};

async function HomeContent() {
  let titles: CatalogTitle[] = [];
  let catalogError = false;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("titles")
      .select(
        "id, name, slug, description, cover_url, content_type, release_year"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      console.error("SubReel catalog query failed:", error.message);
      catalogError = true;
    } else {
      titles = (data ?? []) as CatalogTitle[];
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error("SubReel catalog is unavailable:", error);
    catalogError = true;
  }

  return (
    <main className="min-h-screen bg-[#09090d] text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#09090d]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" className="shrink-0 text-2xl font-black tracking-tight">
            Sub<span className="text-violet-400">Reel</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
            <Link href="/" className="text-white transition hover:text-violet-300">
              Главная
            </Link>
            <a href="#catalog" className="transition hover:text-white">
              Каталог
            </a>
            <a href="#about" className="transition hover:text-white">
              О проекте
            </a>
          </nav>

          <Link
            href="/login"
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium transition hover:border-violet-400/60 hover:bg-white/5"
          >
            Войти
          </Link>
        </div>
      </header>

      <section className="relative isolate overflow-hidden border-b border-white/[0.06]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-40 -z-10 h-[520px] w-[520px] rounded-full bg-violet-600/20 blur-[130px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 left-0 -z-10 h-[400px] w-[400px] rounded-full bg-fuchsia-600/10 blur-[120px]"
        />

        <div className="mx-auto grid min-h-[470px] max-w-7xl items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/[0.08] px-3.5 py-2 text-xs font-medium text-violet-200">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              Одна платформа — целые вселенные
            </div>

            <h1 className="max-w-3xl text-5xl font-black leading-[1.06] tracking-tight sm:text-6xl lg:text-7xl">
              Твои истории.
              <br />
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-indigo-300 bg-clip-text text-transparent">
                Твой SubReel.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
              Аниме, фильмы, сериалы, манга и книги в одном пространстве.
              Находи новые истории, открывай связанные вселенные и продолжай
              с того места, где остановился.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="#catalog"
                className="rounded-xl bg-violet-500 px-6 py-3.5 text-sm font-semibold transition hover:bg-violet-400"
              >
                Открыть каталог <span aria-hidden="true">→</span>
              </a>
              <a
                href="#about"
                className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold transition hover:bg-white/[0.07]"
              >
                О платформе
              </a>
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="relative mx-auto aspect-[4/3] max-w-md">
              <div className="absolute inset-8 rotate-[-8deg] rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/20 to-transparent" />
              <div className="absolute inset-8 rotate-[7deg] rounded-3xl border border-fuchsia-400/20 bg-gradient-to-tr from-fuchsia-500/10 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-between rounded-3xl border border-white/10 bg-[#111119]/90 p-8 shadow-2xl shadow-violet-950/40">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold tracking-wide">SUBREEL UNIVERSE</span>
                  <span className="rounded-lg bg-violet-400/10 px-2.5 py-1 text-xs text-violet-300">
                    PREVIEW
                  </span>
                </div>
                <div>
                  <div className="mb-3 flex gap-2">
                    <span className="rounded-full bg-violet-400/15 px-3 py-1 text-xs text-violet-200">
                      Смотреть
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400">
                      Читать
                    </span>
                  </div>
                  <p className="text-3xl font-black">Больше, чем каталог.</p>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-zinc-400">
                    Связанные произведения, единые коллекции и твоя история
                    просмотра.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ["01", "Франшизы"],
                    ["02", "Истории"],
                    ["03", "Коллекции"],
                  ].map(([number, label]) => (
                    <div key={number} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                      <p className="text-lg font-bold text-violet-300">{number}</p>
                      <p className="mt-1 text-xs text-zinc-500">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="catalog" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
              Исследуй вселенные
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Каталог SubReel
            </h2>
            <p className="mt-3 text-sm text-zinc-400">
              Опубликованные произведения из общей базы платформы.
            </p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400">
            {titles.length} {titles.length === 1 ? "тайтл" : "тайтлов"} на странице
          </span>
        </div>

        {catalogError ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-8">
            <h3 className="font-semibold text-amber-200">
              Не удалось загрузить каталог
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Проверь подключение Supabase и доступ к таблице titles.
              Подробности ошибки доступны в терминале разработки.
            </p>
          </div>
        ) : titles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center sm:py-20">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-2xl">
              ✦
            </div>
            <h3 className="mt-5 text-xl font-semibold">
              Здесь начнётся твоя следующая история
            </h3>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-400">
              Каталог подключён к базе данных, но опубликованных произведений
              пока нет. Когда добавим первый тайтл и опубликуем его, он появится
              здесь автоматически.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {titles.map((title) => (
              <Link
                key={title.id}
                href={`/title/${title.slug}`}
                className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] transition duration-300 hover:-translate-y-1 hover:border-violet-400/40 hover:bg-white/[0.05]"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-violet-950 via-[#171321] to-[#0e0e14]">
                  {title.cover_url ? (
                    <div
                      role="img"
                      aria-label={`Обложка: ${title.name}`}
                      className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                      style={{
                        backgroundImage: `url("${title.cover_url.replace(/["\\\n\r]/g, "")}")`,
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center p-5 text-center">
                      <span className="text-2xl font-black text-white/25">
                        SubReel
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />
                  <span className="absolute left-3 top-3 rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 text-xs backdrop-blur">
                    {contentLabels[title.content_type] ?? title.content_type}
                  </span>
                  {title.release_year && (
                    <span className="absolute bottom-3 left-3 text-xs text-zinc-300">
                      {title.release_year}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="line-clamp-2 font-semibold transition group-hover:text-violet-300">
                    {title.name}
                  </h3>
                  {title.description && (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">
                      {title.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section id="about" className="border-y border-white/[0.06] bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
            Единое пространство
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold sm:text-4xl">
            Не просто список. Целая вселенная историй.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "Смотри",
                description: "Аниме, фильмы, сериалы, дорамы и мультфильмы.",
              },
              {
                title: "Читай",
                description: "Манга, манхва, ранобэ, веб-новеллы и книги.",
              },
              {
                title: "Открывай",
                description: "Франшизы, адаптации, продолжения и связанные произведения.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/[0.08] bg-[#0d0d13] p-6">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Link href="/" className="font-bold text-zinc-300">
          Sub<span className="text-violet-400">Reel</span>
        </Link>
        <p>Твои истории — в одном месте.</p>
      </footer>
    </main>
  );
}


export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#09090d] p-8 text-white">
          <p className="animate-pulse text-sm text-zinc-400">
            Загружаем SubReel...
          </p>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
