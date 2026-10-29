"use client";

import { useMemo, useState } from "react";
import { setCatalogAdminRole } from "./actions";

type AdminUser = { id: string; email: string | null; role: string | null; createdAt: string };
type Filter = "all" | "admins" | "users";

const control = "min-w-0 rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-400";

export function UserRoleForm({ users, currentUserId }: { users: AdminUser[]; currentUserId: string }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const counts = useMemo(() => ({
    all: users.length,
    admins: users.filter((user) => user.role === "catalog_admin").length,
    users: users.filter((user) => user.role !== "catalog_admin").length,
  }), [users]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return users.filter((user) => {
      const matchesFilter = filter === "all" || (filter === "admins" ? user.role === "catalog_admin" : user.role !== "catalog_admin");
      const matchesSearch = !term || (user.email ?? "").toLocaleLowerCase().includes(term) || user.id.toLocaleLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    }).sort((a, b) => {
      const roleOrder = Number(b.role === "catalog_admin") - Number(a.role === "catalog_admin");
      return roleOrder || (a.email ?? "").localeCompare(b.email ?? "");
    });
  }, [users, search, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleUsers = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function changeSearch(value: string) { setSearch(value); setPage(1); }
  function changeFilter(value: Filter) { setFilter(value); setPage(1); }

  if (users.length === 0) return <p className="mt-3 text-sm text-zinc-500">Пользователей пока нет.</p>;

  return <div className="mt-5">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">Поиск пользователя</span>
        <input className={control + " w-full"} type="search" value={search} onChange={(event) => changeSearch(event.target.value)} placeholder="Email или UUID пользователя" aria-label="Поиск пользователя по email или UUID"/>
      </label>
      <div className="flex flex-wrap items-end gap-2" aria-label="Фильтр пользователей">
        {([
          ["all", "Все"],
          ["admins", "Администраторы"],
          ["users", "Пользователи"],
        ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => changeFilter(value)} aria-pressed={filter === value} className={"rounded-xl border px-3 py-2.5 text-sm transition " + (filter === value ? "border-violet-400/50 bg-violet-500/15 text-violet-200" : "border-white/10 text-zinc-400 hover:bg-white/5")}>
          {label} <span className="ml-1 text-xs opacity-70">{counts[value]}</span>
        </button>)}
      </div>
    </div>

    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
      <span>Найдено: {filtered.length} из {users.length}</span>
      <span>Показано до {pageSize} на странице</span>
    </div>

    {filtered.length === 0 ? <div className="mt-3 rounded-2xl border border-dashed border-white/10 p-8 text-center">
      <p className="font-medium text-zinc-300">Ничего не найдено</p>
      <p className="mt-1 text-sm text-zinc-500">Измени запрос или выбери другой фильтр.</p>
      <button type="button" onClick={() => { changeSearch(""); changeFilter("all"); }} className="mt-3 text-sm text-violet-300 hover:text-violet-200">Сбросить фильтры</button>
    </div> : <ul className="mt-3 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
      {visibleUsers.map((user) => {
        const isAdmin = user.role === "catalog_admin";
        const isSelf = user.id === currentUserId;
        return <li key={user.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-all font-medium text-white">{user.email || "Почта не указана"}</p>
              {isSelf && <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[11px] text-sky-200">Это вы</span>}
              {isAdmin && <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-[11px] text-violet-200">Администратор</span>}
            </div>
            <p className="mt-1 text-xs text-zinc-500">ID {user.id} · регистрация {new Date(user.createdAt).toLocaleDateString("ru-RU")}</p>
          </div>
          {isSelf ? <span className="shrink-0 text-xs text-zinc-500">Свою роль здесь менять нельзя</span> : <form action={setCatalogAdminRole} onSubmit={() => setPendingId(user.id)} className="shrink-0">
            <input type="hidden" name="user_id" value={user.id}/>
            <input type="hidden" name="role" value={isAdmin ? "user" : "catalog_admin"}/>
            <button className={"w-full rounded-xl border px-3 py-2.5 text-sm transition disabled:cursor-wait disabled:opacity-50 sm:w-auto " + (isAdmin ? "border-red-400/20 text-red-200 hover:bg-red-400/10" : "border-violet-400/30 text-violet-200 hover:bg-violet-400/10")} disabled={pendingId === user.id}>
              {pendingId === user.id ? "Сохраняем…" : isAdmin ? "Снять роль администратора" : "Назначить администратором"}
            </button>
          </form>}
        </li>;
      })}
    </ul>}

    {pageCount > 1 && <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Страницы пользователей">
      <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-40">← Назад</button>
      <span className="text-sm text-zinc-400">Страница {currentPage} из {pageCount}</span>
      <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage >= pageCount} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-40">Далее →</button>
    </nav>}
  </div>;
}
