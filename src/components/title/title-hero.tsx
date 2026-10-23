import Link from "next/link";
import type { ReactNode } from "react";
import { contentLabels, coverBackground } from "@/lib/catalog";

export type Cta = { href: string; label: string; disabled: boolean; icon: "play" | "book"; note?: string };

type Props = {
  title: {
    name: string;
    original_name: string | null;
    cover_url: string | null;
    banner_url: string | null;
    content_type: string;
    release_year: number | null;
  };
  genres: { name: string; slug: string }[];
  franchise: { name: string; slug: string } | null;
  rating: { average: number; count: number };
  cta: Cta | null;
  /** Блок библиотеки (клиентский компонент) — рядом с главной кнопкой. */
  actions: ReactNode;
};

function plural(n: number, forms: [string, string, string]) {
  const m10 = n % 10;
  const m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? forms[0] : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? forms[1] : forms[2];
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-current">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.8-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    </svg>
  );
}

export function TitleHero({ title, genres, franchise, rating, cta, actions }: Props) {
  const backdrop = title.banner_url ?? title.cover_url;
  const typeLabel = contentLabels[title.content_type] ?? title.content_type;
  const icon = cta?.icon === "book" ? <BookIcon /> : <PlayIcon />;

  return (
    <section className="relative isolate overflow-hidden">
      {backdrop && (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 scale-110 bg-cover bg-center opacity-60 blur-2xl saturate-150"
          style={{ backgroundImage: coverBackground(backdrop) }}
        />
      )}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-background/20 via-background/70 to-background" />

      <div className="mx-auto grid max-w-7xl items-end gap-8 px-5 pb-10 pt-10 sm:px-8 md:grid-cols-[240px_1fr] md:pt-16 lg:grid-cols-[300px_1fr] lg:gap-12">
        <div className="relative mx-auto aspect-[3/4] w-44 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-950 via-[#171321] to-[#0e0e14] shadow-2xl shadow-black/60 ring-1 ring-white/15 md:mx-0 md:w-full">
          {title.cover_url ? (
            <div
              role="img"
              aria-label={`Обложка: ${title.name}`}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: coverBackground(title.cover_url) }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-2xl font-black text-white/25">SubReel</div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-white/10 px-3 py-1 font-medium backdrop-blur">{typeLabel}</span>
            {title.release_year && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-text-secondary backdrop-blur">{title.release_year}</span>
            )}
            {franchise && (
              <Link
                href={`/franchise/${franchise.slug}`}
                className="rounded-full bg-accent/15 px-3 py-1 text-accent backdrop-blur transition hover:bg-accent/25"
              >
                Франшиза «{franchise.name}»
              </Link>
            )}
          </div>

          <h1 className="mt-4 text-balance text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">{title.name}</h1>
          {title.original_name && title.original_name !== title.name && (
            <p className="mt-2 text-base text-text-secondary">{title.original_name}</p>
          )}

          {genres.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {genres.map((g) => (
                <li key={g.slug} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-text-secondary backdrop-blur">
                  {g.name}
                </li>
              ))}
            </ul>
          )}

          {rating.count > 0 && (
            <p className="mt-5 flex items-baseline gap-2" aria-label={`Средняя оценка ${rating.average.toFixed(1)} из 10, ${rating.count} ${plural(rating.count, ["оценка", "оценки", "оценок"])}`}>
              <span className="text-3xl font-black tabular-nums text-accent">{rating.average.toFixed(1)}</span>
              <span className="text-sm text-text-muted">
                из 10, {rating.count} {plural(rating.count, ["оценка", "оценки", "оценок"])}
              </span>
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-start gap-4">
            {cta &&
              (cta.disabled ? (
                <div>
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-14 cursor-not-allowed items-center gap-3 rounded-2xl bg-surface-2 px-8 text-lg font-semibold text-text-muted"
                  >
                    {icon}
                    {cta.label}
                  </button>
                  {cta.note && <p className="mt-2 text-sm text-text-muted">{cta.note}</p>}
                </div>
              ) : (
                <Link
                  href={cta.href}
                  className="inline-flex min-h-14 items-center gap-3 rounded-2xl bg-accent-strong px-8 text-lg font-semibold text-white shadow-[0_14px_44px_-14px_var(--accent-strong)] transition hover:bg-violet-600 hover:shadow-[0_14px_50px_-10px_var(--accent-strong)]"
                >
                  {icon}
                  {cta.label}
                </Link>
              ))}
            <div className="[&>div]:mt-0">{actions}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
