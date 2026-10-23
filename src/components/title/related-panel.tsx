import Link from "next/link";
import Image from "next/image";
import { contentLabels } from "@/lib/catalog";

export type TitleBrief = {
  name: string;
  slug: string;
  content_type: string;
  release_year: number | null;
  cover_url: string | null;
};
export type RelationItem = { label: string; title: TitleBrief };

function PosterCard({ title, caption }: { title: TitleBrief; caption?: string }) {
  return (
    <Link href={`/title/${title.slug}`} className="group block rounded-2xl focus-visible:outline-offset-4">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-gradient-to-br from-violet-950 via-[#171321] to-[#0e0e14] ring-1 ring-white/10 transition group-hover:ring-accent/50">
        {title.cover_url ? (
          <Image
            src={title.cover_url}
            alt={`Обложка: ${title.name}`}
            fill
            sizes="(max-width: 639px) 44vw, (max-width: 1023px) 28vw, 200px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-lg font-black text-white/25">SubReel</div>
        )}
      </div>
      {caption && <p className="mt-3 text-xs text-accent">{caption}</p>}
      <p className={`line-clamp-2 font-semibold transition group-hover:text-accent ${caption ? "mt-1" : "mt-3"}`}>{title.name}</p>
      <p className="mt-1 text-xs text-text-muted">
        {contentLabels[title.content_type] ?? title.content_type}
        {title.release_year ? `, ${title.release_year}` : ""}
      </p>
    </Link>
  );
}

const grid = "mt-5 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

export function RelatedPanel({
  relations,
  siblings,
  franchise,
}: {
  relations: RelationItem[];
  siblings: TitleBrief[];
  franchise: { name: string; slug: string } | null;
}) {
  if (relations.length === 0 && siblings.length === 0) {
    return <p className="rounded-2xl border border-border-subtle bg-surface-1 p-6 text-sm text-text-secondary">Связанных произведений пока нет.</p>;
  }

  return (
    <div className="space-y-12">
      {relations.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold">Связанные произведения</h3>
          <div className={grid}>
            {relations.map((r) => (
              <PosterCard key={`${r.label}-${r.title.slug}`} title={r.title} caption={r.label} />
            ))}
          </div>
        </section>
      )}
      {siblings.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold">Ещё во франшизе{franchise ? ` «${franchise.name}»` : ""}</h3>
          <div className={grid}>
            {siblings.map((s) => (
              <PosterCard key={s.slug} title={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
