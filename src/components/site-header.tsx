import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader({ active }: { active?: "catalog" | "home" }) {
  let accountLabel: string | null = null;
  let isCatalogAdmin = false;

  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (user && !userError) {
      isCatalogAdmin = user.app_metadata?.role === "catalog_admin";
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", user.id)
        .maybeSingle();

      accountLabel =
        profile?.display_name?.trim() ||
        profile?.username ||
        user.email?.split("@")[0] ||
        "Аккаунт";
    }
  } catch {
    // If auth/profile lookup is unavailable, keep the navigation usable.
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[68px] max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="SubReel — главная"
          className="shrink-0 text-xl font-black tracking-tight sm:text-2xl"
        >
          Sub<span className="text-accent">Reel</span>
        </Link>

        <nav aria-label="Основная навигация" className="hidden shrink-0 items-center gap-5 text-sm md:flex">
          <Link
            href="/"
            aria-current={active === "home" ? "page" : undefined}
            className={active === "home" ? "text-white" : "text-text-secondary transition hover:text-white"}
          >
            Главная
          </Link>
          <Link
            href="/catalog"
            aria-current={active === "catalog" ? "page" : undefined}
            className={active === "catalog" ? "text-white" : "text-text-secondary transition hover:text-white"}
          >
            Каталог
          </Link>
          {isCatalogAdmin && (
            <Link href="/admin" className="text-text-secondary transition hover:text-white">
              Управление
            </Link>
          )}
        </nav>

        <form action="/catalog" role="search" className="ml-auto flex min-w-0 max-w-sm flex-1">
          <label className="sr-only" htmlFor="site-search">
            Найти произведение
          </label>
          <input
            id="site-search"
            type="search"
            name="q"
            placeholder="Найти произведение"
            className="h-10 w-full rounded-xl border border-border-subtle bg-surface-1 px-3 text-sm text-white outline-none placeholder:text-text-muted focus:border-accent"
          />
          <button className="sr-only" type="submit">Найти</button>
        </form>

        <Link
          href={accountLabel ? "/account" : "/login"}
          aria-label={accountLabel ? `Профиль: ${accountLabel}` : "Войти"}
          className="shrink-0 rounded-xl border border-border-subtle px-3 py-2 text-sm font-medium transition hover:border-accent/60 hover:bg-surface-1 sm:px-4"
        >
          {accountLabel ?? "Войти"}
        </Link>
      </div>
    </header>
  );
}

export function SiteHeaderFallback() {
  return (
    <header
      aria-hidden="true"
      className="sticky top-0 z-30 border-b border-border-subtle bg-background/95 backdrop-blur-xl"
    >
      <div className="mx-auto flex min-h-[68px] max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <span className="shrink-0 text-xl font-black tracking-tight sm:text-2xl">
          Sub<span className="text-accent">Reel</span>
        </span>
        <div className="ml-auto hidden h-9 w-40 animate-pulse rounded-xl bg-surface-2 sm:block" />
        <div className="h-9 w-20 animate-pulse rounded-xl bg-surface-2" />
      </div>
    </header>
  );
}
