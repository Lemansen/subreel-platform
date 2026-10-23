import Link from "next/link";
import { ContentRow } from "@/components/content-row";
import { coverBackground } from "@/lib/catalog";
import type { ContinueItem } from "@/lib/library-shared";

/** Ряд «Продолжить»: одно касание ведёт сразу в плеер или читалку. */
export function ContinueShelf({ items }: { items: ContinueItem[] }) {
  if (items.length === 0) return null;
  return (
    <ContentRow title="Продолжить">
      {items.map((item) => (
        <div key={item.titleId} className="w-36 shrink-0 snap-start sm:w-44">
          <Link href={item.href} className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-2 shadow-lg shadow-black/30 ring-1 ring-white/5 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-accent/20 group-hover:ring-accent/40">
              {item.coverUrl ? (
                <div className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105" style={{ backgroundImage: coverBackground(item.coverUrl) }} />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-accent-strong/60 to-background p-4 text-center">
                  <span className="text-lg font-bold text-white/40">{item.name}</span>
                </div>
              )}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/0 to-black/0" />
              <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-10">
                <p className="truncate text-xs font-medium text-zinc-100">{item.label}</p>
                {item.percent > 0 && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${item.percent}%` }} />
                    <span className="sr-only">{item.kind === "read" ? "Прочитано" : "Просмотрено"} {item.percent}%</span>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 transition group-hover:text-accent">{item.name}</p>
            <p className="mt-0.5 text-xs text-text-muted">{item.kind === "read" ? "Продолжить чтение" : "Продолжить просмотр"}</p>
          </Link>
        </div>
      ))}
    </ContentRow>
  );
}
