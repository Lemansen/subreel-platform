import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

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
  subcoins: {
    eyebrow: "SUBREEL ECONOMY",
    title: "Баланс SubCoins",
    description: "Единая игровая валюта SubReel для будущих заданий, достижений и наград. Баланс и история операций будут храниться на сервере и синхронизироваться с лаунчером.",
    status: "Баланс и история операций — в разработке",
  },
  shop: {
    eyebrow: "SUBREEL STORE",
    title: "Магазин SubReel",
    description: "Отдельный раздел для игровых наград и косметических предметов. Покупки появятся после запуска серверной экономики SubCoins.",
    status: "Магазин — в разработке",
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

  // Персональная игровая экономика доступна только после привязки Minecraft в лаунчере.
  let minecraftLinked = false;
  if (section === "subcoins" || section === "shop") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("launcher_game_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      minecraftLinked = Boolean(data);
    }
  }

  return (
    <main className="min-h-screen bg-[#09090d] text-white">
      <SiteHeader active="minecraft" />
      <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="rounded-[2rem] border border-sky-300/15 bg-gradient-to-br from-sky-950/60 via-[#111725] to-[#09090d] p-7 sm:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">{page.eyebrow}</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">{page.title}</h1>
          {(section === "subcoins" || section === "shop") && !minecraftLinked ? (
            <>
              <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300">Чтобы открыть персональные игровые данные и будущую экономику SubReel, сначала подключи Minecraft-профиль в лаунчере под тем же SubReel ID. До привязки игровой баланс и данные аккаунта не отображаются.</p>
              <div className="mt-8 inline-flex rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-4 py-2 text-sm font-medium text-amber-200">Minecraft-профиль не подключён</div>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/minecraft/launcher" className="inline-flex min-h-11 items-center rounded-xl bg-sky-400 px-5 font-bold text-[#07101d] transition hover:bg-sky-300">Как подключить профиль</Link>
                <Link href="/account" className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-5 font-semibold transition hover:bg-white/5">Открыть аккаунт</Link>
              </div>
            </>
          ) : (
            <>
              <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300">{page.description}</p>
              <div className="mt-8 inline-flex rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-4 py-2 text-sm font-medium text-amber-200">{page.status}</div>
              <div className="mt-10"><Link href="/minecraft" className="inline-flex min-h-11 items-center rounded-xl bg-sky-400 px-5 font-bold text-[#07101d] transition hover:bg-sky-300">Вернуться в Minecraft</Link></div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
