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

export function ContentCard({ title }: { title: CatalogCardTitle }) {
  return (
    <Link
      href={`/title/${title.slug}`}
      className="group overflow-hidden rounded-2xl border border-border-subtle bg-surface-1 transition hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-accent-strong via-surface-1 to-background">
        {title.cover_url ? (
          <div
            role="img"
            aria-label={`Обложка: ${title.name}`}
            className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
            style={{ backgroundImage: coverBackground(title.cover_url) }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
            <span className="text-xl font-bold text-white/35">{title.name}</span>
          </div>
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/10" />
        <span className="absolute left-3 top-3 rounded-lg border border-white/15 bg-black/65 px-2.5 py-1 text-xs text-white backdrop-blur">
          {contentLabels[title.content_type] ?? title.content_type}
        </span>
        {title.release_year && (
          <span className="absolute bottom-3 left-3 text-xs font-medium text-white/85">
            {title.release_year}
          </span>
        )}
      </div>
      <div className="p-3.5 sm:p-4">
        <h2 className="line-clamp-2 min-h-10 font-semibold leading-5 transition group-hover:text-accent">
          {title.name}
        </h2>
        {title.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-text-secondary">
            {title.description}
          </p>
        )}
      </div>
    </Link>
  );
}
