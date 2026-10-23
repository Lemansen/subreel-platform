import Link from "next/link";
import { contentLabels, coverBackground } from "@/lib/catalog";

export type CatalogCardTitle = {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  cover_url: string | null;
  content_type: string;
  release_year: number | null;
};

const readable = new Set(["manga", "manhwa", "manhua", "light_novel", "web_novel", "book"]);

export function ContentCard({ title, rating }: { title: CatalogCardTitle; rating?: number | null }) {
  const isReadable = readable.has(title.content_type);
  return (
    <Link
      href={`/title/${title.slug}`}
      className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-2 shadow-lg shadow-black/30 ring-1 ring-white/5 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-accent/20 group-hover:ring-accent/40">
        {title.cover_url ? (
          <div
            role="img"
            aria-label={`Обложка: ${title.name}`}
            className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
            style={{ backgroundImage: coverBackground(title.cover_url) }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-accent-strong/60 to-background p-4 text-center">
            <span className="text-lg font-bold text-white/40">{title.name}</span>
          </div>
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-80 transition group-hover:opacity-100" />

        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold text-white ${isReadable ? "bg-emerald-600/90" : "bg-accent-strong/90"}`}>
            {contentLabels[title.content_type] ?? title.content_type}
          </span>
        </div>
        {rating ? (
          <span className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur">
            ★ {rating.toFixed(1)}
          </span>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 flex translate-y-2 items-center justify-center pb-3 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
          <span className="rounded-full bg-white/95 px-4 py-1.5 text-xs font-bold text-black">
            {isReadable ? "Читать" : "Смотреть"}
          </span>
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-5 transition group-hover:text-accent">{title.name}</h3>
        <p className="mt-0.5 text-xs text-text-muted">
          {[title.release_year, contentLabels[title.content_type]].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}
