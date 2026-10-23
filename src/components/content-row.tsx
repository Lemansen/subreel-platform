"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";

export function ContentRow({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const btn =
    "h-8 w-8 rounded-full border border-white/10 bg-white/[0.04] text-lg leading-none transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400";

  return (
    <section className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        <div className="flex items-center gap-3">
          {href && (
            <Link href={href} className="text-sm font-medium text-violet-300 transition hover:text-violet-200">
              Все
            </Link>
          )}
          <div className="hidden gap-1.5 md:flex">
            <button type="button" aria-label="Прокрутить назад" onClick={() => scroll(-1)} className={btn}>
              ‹
            </button>
            <button type="button" aria-label="Прокрутить вперёд" onClick={() => scroll(1)} className={btn}>
              ›
            </button>
          </div>
        </div>
      </div>

      <div
        ref={track}
        className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:gap-4 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
}
