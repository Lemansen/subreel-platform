"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export type Banner = {
  id: string;
  name: string;
  description: string | null;
  image: string;
  href: string;
  badge: string;
  cta: string;
};

const AUTOPLAY_MS = 6000;

export function HeroSlider({ banners }: { banners: Banner[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  const goTo = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el) return;
      el.scrollTo({ left: ((i + count) % count) * el.clientWidth, behavior: "smooth" });
    },
    [count]
  );

  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => goTo(active + 1), AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [active, paused, count, goTo]);

  const arrow =
    "absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/40 text-xl backdrop-blur transition hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 md:flex";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Рекомендуем"
      className="mx-auto max-w-7xl px-5 pt-5 sm:px-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#111119]">
        <div
          ref={track}
          onScroll={(e) =>
            setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))
          }
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {banners.map((b, i) => (
            <article
              key={b.id}
              aria-roledescription="slide"
              aria-label={`${i + 1} из ${count}`}
              className="relative h-[320px] min-w-full snap-center sm:h-[400px] lg:h-[480px]"
            >
              <Image
                src={b.image}
                alt=""
                fill
                priority={i === 0}
                sizes="(max-width: 767px) 100vw, 1280px"
                quality={75}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#09090d] via-[#09090d]/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#09090d]/80 via-transparent to-transparent" />

              <div className="absolute inset-x-0 bottom-0 max-w-2xl p-6 pb-12 sm:p-10 sm:pb-14">
                <span className="rounded-full border border-violet-400/30 bg-violet-400/15 px-3 py-1 text-xs font-medium text-violet-200">
                  {b.badge}
                </span>
                <h2 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">{b.name}</h2>
                {b.description && (
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-300 sm:line-clamp-3 sm:text-base">
                    {b.description}
                  </p>
                )}
                <Link
                  href={b.href}
                  className="mt-5 inline-block rounded-xl bg-violet-500 px-6 py-3 text-sm font-semibold transition hover:bg-violet-400"
                >
                  {b.cta}
                </Link>
              </div>
            </article>
          ))}
        </div>

        {count > 1 && (
          <>
            <button type="button" aria-label="Предыдущий слайд" onClick={() => goTo(active - 1)} className={`${arrow} left-4`}>
              ‹
            </button>
            <button type="button" aria-label="Следующий слайд" onClick={() => goTo(active + 1)} className={`${arrow} right-4`}>
              ›
            </button>
            <div className="absolute bottom-5 left-6 flex gap-2 sm:left-10">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  aria-label={`Слайд ${i + 1}`}
                  aria-current={i === active}
                  onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === active ? "w-8 bg-violet-400" : "w-3 bg-white/30 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
