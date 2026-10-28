import Link from "next/link";
import { connection } from "next/server";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Minecraft — SubReel",
  description: "Игровое направление SubReel: лаунчер, сервер и SubCoins.",
};

const sections = [
  { href: "/minecraft/launcher", title: "SubReel Launcher", description: "Лаунчер проекта и всё необходимое для запуска игры.", label: "Лаунчер" },
  { href: "/minecraft/server", title: "Игровой сервер", description: "Информация о сервере, подключении и планируемых возможностях.", label: "Сервер" },
];

export default async function MinecraftPage() {
  await connection();

  return (
    <main className="min-h-screen bg-[#09090d] text-white">
      <SiteHeader active="minecraft" />
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-12 sm:px-8 sm:pt-20">
        <div className="relative overflow-hidden rounded-[2rem] border border-sky-300/15 bg-gradient-to-br from-sky-950 via-[#10201e] to-[#0b1019] p-7 sm:p-12 lg:p-16">
          <div aria-hidden className="absolute -right-20 -top-24 size-80 rounded-full bg-sky-400/15 blur-[100px]" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">Игровая вселенная SubReel</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Твой мир. Твои правила.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">Лаунчер, сервер и будущая игровая экосистема с заданиями, достижениями и SubCoins. Развиваем всё в одном месте и с единым SubReel ID.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/minecraft/launcher" className="inline-flex min-h-12 items-center rounded-xl bg-sky-400 px-5 font-bold text-[#07101d] transition hover:bg-sky-300">О лаунчере <span className="ml-2">→</span></Link>
            </div>
          </div>
        </div>
        <div className="mt-12 flex items-end justify-between gap-4">
          <div><p className="text-sm font-semibold text-sky-300">НАПРАВЛЕНИЯ</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">Всё для игры</h2></div>
          <span className="hidden text-sm text-zinc-500 sm:block">Один аккаунт — общая экосистема</span>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} className="group rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-sky-300/30 hover:bg-white/[0.045]">
              <span className="inline-flex rounded-full border border-sky-300/15 bg-sky-300/[0.07] px-3 py-1 text-xs font-semibold text-sky-200">{section.label}</span>
              <h3 className="mt-5 text-xl font-bold">{section.title}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-zinc-400">{section.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-sky-300">Открыть <span className="transition group-hover:translate-x-1">→</span></span>
            </Link>
          ))}
        </div>
        <p className="mt-8 text-sm leading-6 text-zinc-500">Магазин убран с главной страницы. Доступ к SubCoins будет через профиль; баланс и покупки пока находятся в разработке.</p>
      </section>
    </main>
  );
}
