"use client";

import { useMemo, useState } from "react";
import { setProfileModeration } from "./actions";

type Profile = { id: string; username: string | null; display_name: string | null; bio: string | null; is_public: boolean; is_suspended: boolean; suspension_reason: string | null; moderated_at: string | null };
type Filter = "all" | "public" | "suspended" | "private";
const field = "w-full rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-400";

export function ProfileModerationForm({ profiles }: { profiles: Profile[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const counts = useMemo(() => ({
    all: profiles.length,
    public: profiles.filter((profile) => profile.is_public && !profile.is_suspended).length,
    suspended: profiles.filter((profile) => profile.is_suspended).length,
    private: profiles.filter((profile) => !profile.is_public && !profile.is_suspended).length,
  }), [profiles]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return profiles.filter((profile) => {
      const matchesFilter = filter === "all"
        || (filter === "public" && profile.is_public && !profile.is_suspended)
        || (filter === "suspended" && profile.is_suspended)
        || (filter === "private" && !profile.is_public && !profile.is_suspended);
      const matchesSearch = !term
        || (profile.username ?? "").toLocaleLowerCase().includes(term)
        || (profile.display_name ?? "").toLocaleLowerCase().includes(term)
        || profile.id.toLocaleLowerCase().includes(term)
        || (profile.suspension_reason ?? "").toLocaleLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [profiles, search, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleProfiles = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function updateSearch(value: string) { setSearch(value); setPage(1); }
  function updateFilter(value: Filter) { setFilter(value); setPage(1); }

  if (profiles.length === 0) return <p className="mt-3 text-sm text-zinc-400">Профили пока не созданы.</p>;

  return <div className="mt-5">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">Поиск профиля</span>
        <input className={field} type="search" value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Ник, отображаемое имя, UUID или причина" aria-label="Поиск профиля для модерации"/>
      </label>
      <div className="flex flex-wrap items-end gap-2" aria-label="Фильтр профилей">
        {([
          ["all", "Все"],
          ["public", "Публичные"],
          ["private", "Приватные"],
          ["suspended", "Ограниченные"],
        ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => updateFilter(value)} aria-pressed={filter === value} className={"rounded-xl border px-3 py-2.5 text-sm transition " + (filter === value ? "border-violet-400/50 bg-violet-500/15 text-violet-200" : "border-white/10 text-zinc-400 hover:bg-white/5")}>
          {label} <span className="ml-1 text-xs opacity-70">{counts[value]}</span>
        </button>)}
      </div>
    </div>
    <p className="mt-4 text-xs text-zinc-500">Найдено: {filtered.length} из {profiles.length}</p>

    {filtered.length === 0 ? <div className="mt-3 rounded-2xl border border-dashed border-white/10 p-8 text-center">
      <p className="font-medium text-zinc-300">Профили не найдены</p>
      <p className="mt-1 text-sm text-zinc-500">Попробуй изменить запрос или фильтр.</p>
      <button type="button" onClick={() => { updateSearch(""); updateFilter("all"); }} className="mt-3 text-sm text-violet-300 hover:text-violet-200">Сбросить фильтры</button>
    </div> : <ul className="mt-3 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
      {visibleProfiles.map((profile) => <li key={profile.id} className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-words font-medium">{profile.display_name || profile.username || "Без имени"}</p>
              {profile.is_suspended && <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[11px] text-red-200">Ограничен</span>}
              {!profile.is_suspended && profile.is_public && <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200">Публичный</span>}
              {!profile.is_suspended && !profile.is_public && <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-300">Приватный</span>}
            </div>
            <p className="mt-1 break-all text-xs text-zinc-500">{profile.username ? `@${profile.username}` : "Ник не задан"} · ID {profile.id}</p>
            {profile.bio && <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-zinc-400">{profile.bio}</p>}
            {profile.suspension_reason && <p className="mt-2 text-sm text-amber-200">Причина: {profile.suspension_reason}</p>}
          </div>
        </div>
        {profile.is_suspended ? <form action={setProfileModeration} className="mt-4">
          <input type="hidden" name="user_id" value={profile.id}/><input type="hidden" name="suspend" value="false"/>
          <button className="rounded-xl border border-emerald-400/20 px-4 py-2.5 text-sm text-emerald-200 transition hover:bg-emerald-400/10" onClick={(event) => { if (!window.confirm("Снять ограничение? Профиль останется приватным; владелец сможет снова включить публичность.")) event.preventDefault(); }}>Снять ограничение</button>
        </form> : <form action={setProfileModeration} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="user_id" value={profile.id}/><input type="hidden" name="suspend" value="true"/>
          <input className={field} name="reason" maxLength={500} required placeholder="Причина ограничения" aria-label={`Причина ограничения профиля ${profile.username || profile.id.slice(0, 8)}`}/>
          <button className="shrink-0 rounded-xl border border-red-400/20 px-4 py-2.5 text-sm text-red-200 transition hover:bg-red-400/10" onClick={(event) => { if (!window.confirm("Скрыть профиль и запретить владельцу снова включить публичность до снятия ограничения?")) event.preventDefault(); }}>Ограничить публичность</button>
        </form>}
        {profile.moderated_at && <p className="mt-2 text-xs text-zinc-600">Последнее решение: {new Date(profile.moderated_at).toLocaleString("ru-RU")}</p>}
      </li>)}
    </ul>}

    {pageCount > 1 && <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Страницы профилей">
      <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-40">← Назад</button>
      <span className="text-sm text-zinc-400">Страница {currentPage} из {pageCount}</span>
      <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage >= pageCount} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-40">Далее →</button>
    </nav>}
  </div>;
}
