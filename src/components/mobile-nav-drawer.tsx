"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = { accountLabel: string | null; isCatalogAdmin: boolean };

const groups = [
  { title: "Платформа", links: [
    { href: "/", label: "Главная", icon: "⌂" },
    { href: "/cinema", label: "Кино и чтение", icon: "▶" },
    { href: "/catalog", label: "Каталог", icon: "▦" },
    { href: "/account/library", label: "Моя библиотека", icon: "▤" },
  ]},
  { title: "Minecraft", links: [
    { href: "/minecraft", label: "Обзор Minecraft", icon: "▦" },
    { href: "/minecraft/launcher", label: "Лаунчер", icon: "⬇" },
    { href: "/minecraft/server", label: "Игровой сервер", icon: "◇" },
  ]},
  { title: "Аккаунт", links: [
    { href: "/account", label: "Профиль и настройки", icon: "◉" },
    { href: "/friends", label: "Друзья", icon: "♧" },
    { href: "/minecraft/shop", label: "SubCoins и магазин", icon: "✦" },
  ]},
];

export function MobileNavDrawer({ accountLabel, isCatalogAdmin }: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" aria-label={open ? "Закрыть меню" : "Открыть меню"} aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-xl transition hover:bg-white/[0.08] md:hidden">
        <span aria-hidden>{open ? "×" : "☰"}</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] md:hidden">
          <button type="button" aria-label="Закрыть меню" onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <aside aria-label="Мобильная навигация" className="absolute inset-y-0 left-0 flex w-[min(88vw,360px)] flex-col border-r border-white/10 bg-[#0c0c14] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
              <Link href="/" onClick={() => setOpen(false)} className="text-2xl font-black tracking-tight">Sub<span className="text-violet-400">Reel</span></Link>
              <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть меню" className="grid size-10 place-items-center rounded-xl text-2xl text-zinc-400 hover:bg-white/5 hover:text-white">×</button>
            </div>
            {accountLabel ? (
              <Link href="/account" onClick={() => setOpen(false)} className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-violet-600/30 font-bold text-violet-100">{accountLabel.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0"><span className="block text-xs text-zinc-500">Твой аккаунт</span><span className="block truncate font-semibold">{accountLabel}</span></span>
                <span className="ml-auto text-zinc-500">→</span>
              </Link>
            ) : (
              <Link href="/login" onClick={() => setOpen(false)} className="mt-5 flex min-h-11 items-center justify-center rounded-xl bg-violet-600 font-semibold hover:bg-violet-500">Войти в SubReel ID</Link>
            )}
            <nav className="mt-5 flex-1 space-y-6 overflow-y-auto pb-4">
              {groups.map((group) => (
                <section key={group.title}>
                  <h2 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">{group.title}</h2>
                  <div className="space-y-1">
                    {group.links.map((link) => (
                      <Link key={link.href} href={link.href} onClick={() => setOpen(false)}
                        className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white">
                        <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-white/[0.05] text-base text-violet-300">{link.icon}</span>
                        {link.label}<span className="ml-auto text-zinc-600">›</span>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
              {isCatalogAdmin && <Link href="/admin" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-xl px-3 text-sm text-zinc-300 hover:bg-white/[0.06]">Управление каталогом</Link>}
            </nav>
            <div className="border-t border-white/[0.08] pt-4 text-xs text-zinc-600">Один SubReel ID для кино, чтения и Minecraft</div>
          </aside>
        </div>
      )}
    </>
  );
}
