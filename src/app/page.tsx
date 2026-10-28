import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const instant = false;

export const metadata = {
  title: "SubReel — выбери свой мир",
  description: "Кино и чтение или Minecraft — выбери своё направление в SubReel.",
};

export default async function Home() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#080910] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 top-10 h-[28rem] w-[28rem] rounded-full bg-violet-700/20 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-[30rem] w-[30rem] rounded-full bg-sky-500/10 blur-[130px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(92,63,170,0.12),transparent_55%)]" />
      </div>
      <SiteHeader active="home" />
      <section className="mx-auto flex w-full max-w-7xl flex-col px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16 lg:pt-20">
        <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-14">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-violet-200"><span className="size-1.5 rounded-full bg-violet-300" />Твой цифровой мир</p>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl lg:text-7xl">Один SubReel.<span className="mt-2 block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-sky-300 bg-clip-text text-transparent">Два направления.</span></h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">Погружайся в истории или отправляйся строить собственный мир. Выбирай, чем займёмся сегодня.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          <Link href="/cinema" className="group relative isolate min-h-[410px] overflow-hidden rounded-[2rem] border border-violet-300/15 bg-[#171326] p-6 transition duration-300 hover:-translate-y-1 hover:border-violet-300/40 hover:shadow-[0_24px_90px_-35px_rgba(139,92,246,0.45)] sm:min-h-[470px] sm:p-9">
            <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
              <div className="absolute -right-10 -top-12 h-72 w-72 rounded-full bg-violet-600/25 blur-[75px] transition duration-500 group-hover:bg-violet-500/35" />
              <div className="absolute -bottom-28 left-1/4 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-[85px]" />
              <div className="absolute inset-0 bg-gradient-to-br from-violet-950/30 via-[#171326]/35 to-[#090910]/90" />
              <div className="absolute right-7 top-8 rotate-6 text-[7rem] opacity-[0.08] transition duration-500 group-hover:rotate-12 group-hover:scale-110 sm:right-12 sm:top-10 sm:text-[10rem]">▶</div>
            </div>
            <div className="flex h-full min-h-[358px] flex-col sm:min-h-[392px]">
              <div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl border border-violet-200/15 bg-violet-300/10 text-2xl">▶</span><span className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200">Истории и вселенные</span></div>
              <div className="mt-auto max-w-lg pt-16">
                <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Кино и чтение</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-zinc-300 sm:text-base sm:leading-7">Аниме, фильмы, сериалы, манга и книги. Продолжай с того места, где остановился, и открывай связанные истории.</p>
                <div className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-xl bg-violet-500 px-5 text-sm font-bold text-white shadow-lg shadow-violet-950/30 transition group-hover:bg-violet-400">Перейти в кино <span className="transition group-hover:translate-x-1">→</span></div>
              </div>
            </div>
          </Link>
          <Link href="/minecraft" className="group relative isolate min-h-[410px] overflow-hidden rounded-[2rem] border border-sky-300/15 bg-[#111725] p-6 transition duration-300 hover:-translate-y-1 hover:border-sky-300/40 hover:shadow-[0_24px_90px_-35px_rgba(16,185,129,0.32)] sm:min-h-[470px] sm:p-9">
            <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
              <div className="absolute -right-12 -top-8 h-72 w-72 rounded-full bg-sky-500/20 blur-[80px] transition duration-500 group-hover:bg-sky-400/30" />
              <div className="absolute -bottom-24 left-1/4 h-80 w-80 rounded-full bg-cyan-600/15 blur-[85px]" />
              <div className="absolute inset-0 bg-gradient-to-br from-sky-950/30 via-[#111725]/35 to-[#080e12]/90" />
              <div className="absolute right-7 top-8 rotate-6 text-[7rem] opacity-[0.09] transition duration-500 group-hover:-rotate-3 group-hover:scale-110 sm:right-12 sm:top-10 sm:text-[10rem]">▦</div>
              <div className="absolute bottom-0 right-0 h-32 w-32 border-l border-t border-sky-100/10 bg-sky-200/[0.025]" />
            </div>
            <div className="flex h-full min-h-[358px] flex-col sm:min-h-[392px]">
              <div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl border border-sky-200/15 bg-sky-300/10 text-2xl">▦</span><span className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200">Играй и создавай</span></div>
              <div className="mt-auto max-w-lg pt-16">
                <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Minecraft</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-zinc-300 sm:text-base sm:leading-7">Наш сервер и лаунчер, игровые новости, задания, достижения и SubCoins — единая игровая экосистема SubReel.</p>
                <div className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-xl bg-sky-500 px-5 text-sm font-bold text-[#07101d] shadow-lg shadow-sky-950/30 transition group-hover:bg-sky-400">В мир Minecraft <span className="transition group-hover:translate-x-1">→</span></div>
              </div>
            </div>
          </Link>
        </div>
        <div className="mt-8 flex flex-col items-center justify-center gap-2 text-center sm:mt-10">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-300"><span className="text-violet-300">✦</span>Один SubReel ID для двух направлений</div>
          <p className="text-xs leading-5 text-zinc-500">Твой профиль и аккаунт остаются общими — выбирай, куда отправиться.</p>
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-6 text-xs text-zinc-500 sm:flex-row sm:px-8">
        <span>© {new Date().getFullYear()} SubReel</span>
        <div className="flex items-center gap-5"><Link href="/account" className="transition hover:text-zinc-300">Аккаунт</Link><Link href="/cinema" className="transition hover:text-zinc-300">Кино и чтение</Link></div>
      </footer>
    </main>
  );
}
