import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";

// This route reads request-time route params under Next.js Cache Components.
export const instant = false;

const pages = {
  launcher: {
    eyebrow: "SUBREEL LAUNCHER",
    title: "Точка входа в игру",
    description: "Здесь будет страница лаунчера: возможности, системные требования, авторизация через SubReel ID и загрузка установщика.",
    status: "Страница лаунчера — в разработке",
  },
  server: {
    eyebrow: "ИГРОВОЙ СЕРВЕР",
    title: "Встречаемся в игре",
    description: "Здесь появятся адрес сервера, версия Minecraft, правила, статус и инструкция по подключению.",
    status: "Страница сервера — в разработке",
  },
  shop: {
    eyebrow: "SUBCOINS",
    title: "Игровая экономика SubReel",
    description: "Планируемый магазин косметики и наград с единым балансом SubCoins для сайта и будущего лаунчера. Начисления и покупки будут подтверждаться сервером.",
    status: "Тестовая экономика — следующий этап разработки",
  },
};

type Section = keyof typeof pages;

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const page = pages[section as Section];
  return { title: page ? `${page.title} — Minecraft` : "Minecraft — SubReel" };
}

export default async function MinecraftSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const page = pages[section as Section];
  if (!page) notFound();

  return (
    <main className="min-h-screen bg-[#09090d] text-white">
      <SiteHeader active="minecraft" />eader>
      <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="rounded-[2rem] border border-sky-300/15 bg-gradient-to-br from-sky-950/60 via-[#111725] to-[#09090d] p-7 sm:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">{page.eyebrow}</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">{page.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300">{page.description}</p>
          <div className="mt-8 inline-flex rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-4 py-2 text-sm font-medium text-amber-200">{page.status}</div>
          <div className="mt-10"><Link href="/minecraft" className="inline-flex min-h-11 items-center rounded-xl bg-sky-400 px-5 font-bold text-[#07101d] transition hover:bg-sky-300">Вернуться в Minecraft</Link></div>
        </div>
      </section>
    </main>
  );
}
