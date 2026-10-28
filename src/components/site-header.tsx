import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";

type Active = "catalog" | "home" | "cinema" | "library" | "profile" | "minecraft" | "news";

export async function SiteHeader({ active }: { active?: Active }) {
  let accountLabel: string | null = null;
  let avatarUrl: string | null = null;
  let isCatalogAdmin = false;

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (user && !error) {
      isCatalogAdmin = user.app_metadata?.role === "catalog_admin";
      const { data: profile } = await supabase
        .from("profiles").select("username, display_name, avatar_url").eq("id", user.id).maybeSingle();
      accountLabel = profile?.display_name?.trim() || profile?.username || user.email?.split("@")[0] || "Аккаунт";
      avatarUrl = profile?.avatar_url ?? null;
    }
  } catch { /* навигация должна работать без auth */ }

  const links: { href: string; label: string; key: Active }[] = [
    { href: "/", label: "Главная", key: "home" },
    { href: "/cinema", label: "Кино и чтение", key: "cinema" },
    { href: "/catalog", label: "Каталог", key: "catalog" },
    { href: "/minecraft", label: "Minecraft", key: "minecraft" },
    { href: "/news", label: "Новости", key: "news" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="SubReel — главная" className="shrink-0 text-xl font-black tracking-tight sm:text-2xl">
          Sub<span className="text-accent">Reel</span>
        </Link>

        <nav aria-label="Основная навигация" className="ml-3 hidden items-center gap-1 text-sm lg:flex">
          {links.map((l) => (
            <Link key={l.href + l.label} href={l.href} aria-current={active === l.key ? "page" : undefined}
              className={`rounded-lg px-3 py-2 transition ${active === l.key ? "bg-surface-2 text-white" : "text-text-secondary hover:bg-surface-1 hover:text-white"}`}>
              {l.label}
            </Link>
          ))}
          {isCatalogAdmin && <Link href="/admin" className="rounded-lg px-3 py-2 text-text-secondary hover:bg-surface-1 hover:text-white">Управление</Link>}
        </nav>

        <form action="/catalog" role="search" className="relative ml-auto hidden min-w-0 max-w-md flex-1 sm:block">
          <label className="sr-only" htmlFor="site-search">Поиск</label>
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">⌕</span>
          <input id="site-search" type="search" name="q" placeholder="Аниме, манга, фильмы…"
            className="h-10 w-full rounded-full border border-white/5 bg-surface-1 pl-9 pr-4 text-sm text-white outline-none transition placeholder:text-text-muted focus:border-accent focus:bg-surface-2" />
        </form>

        {accountLabel ? (
          <Link href="/account" title={accountLabel} aria-label={`Профиль: ${accountLabel}`} aria-current={active === "profile" ? "page" : undefined}
            className={`hidden size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-strong text-sm font-bold text-white ring-2 transition hover:ring-accent sm:grid ${active === "profile" ? "ring-accent" : "ring-transparent"}`}>
            {avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={avatarUrl} alt="" className="size-full object-cover" />
              : accountLabel.slice(0, 1).toUpperCase()}
          </Link>
        ) : (
          <Link href="/login" className="hidden shrink-0 rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-white hover:brightness-110 sm:inline-flex">Войти</Link>
        )}
        <MobileNavDrawer accountLabel={accountLabel} isCatalogAdmin={isCatalogAdmin} />
      </div>
    </header>
  );
}

export function SiteHeaderFallback() {
  return (
    <header aria-hidden className="sticky top-0 z-40 border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <span className="text-xl font-black tracking-tight sm:text-2xl">Sub<span className="text-accent">Reel</span></span>
        <div className="ml-auto h-10 w-full max-w-md animate-pulse rounded-full bg-surface-2" />
        <div className="size-10 animate-pulse rounded-full bg-surface-2" />
      </div>
    </header>
  );
}
