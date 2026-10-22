"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { quickUpdateCatalogStatus } from "./actions";

export type StatusEntry = {
  id: string;
  entity: "title" | "franchise" | "season" | "episode" | "chapter" | "edition" | "volume" | "video" | "reading";
  kind: string;
  name: string;
  detail: string;
  status: "draft" | "published" | "archived" | "disabled";
  href: string;
};

const statusLabels: Record<StatusEntry["status"], string> = {
  draft: "Черновик",
  published: "Опубликовано",
  archived: "Архив",
  disabled: "Отключено",
};

const statusStyles: Record<StatusEntry["status"], string> = {
  draft: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  published: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  archived: "border-zinc-400/20 bg-zinc-400/10 text-zinc-300",
  disabled: "border-red-300/20 bg-red-300/10 text-red-200",
};

export function StatusBoard({ entries }: { entries: StatusEntry[] }) {
  const [status, setStatus] = useState<"all" | StatusEntry["status"]>("draft");
  const [search, setSearch] = useState("");
  const visibleEntries = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("ru");
    return entries.filter((entry) => (status === "all" || entry.status === status)
      && (!normalized || `${entry.name} ${entry.detail} ${entry.kind}`.toLocaleLowerCase("ru").includes(normalized)));
  }, [entries, search, status]);
  const filters: Array<["all" | StatusEntry["status"], string]> = [
    ["draft", "Черновики"], ["published", "Опубликованные"], ["archived", "Архив"], ["disabled", "Отключённые"], ["all", "Все"],
  ];

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Контент и статусы</h2>
        <p className="mt-2 text-sm text-zinc-400">Все тайтлы и связанные записи в одном списке. Открой запись напрямую, чтобы сразу перейти к её редактированию.</p>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Фильтр по статусу">
        {filters.map(([value, label]) => {
          const count = value === "all" ? entries.length : entries.filter((entry) => entry.status === value).length;
          return <button key={value} type="button" onClick={() => setStatus(value)} aria-pressed={status === value} className={`rounded-full border px-3 py-2 text-sm ${status === value ? "border-violet-400/40 bg-violet-500/20 text-white" : "border-white/10 text-zinc-400 hover:bg-white/5"}`}>{label} · {count}</button>;
        })}
      </div>
      <label className="block max-w-xl text-sm text-zinc-300">Поиск по названию или типу
        <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-white outline-none focus:border-violet-400" placeholder="Например, Во все тяжкие" />
      </label>
      {visibleEntries.length ? <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02]">
        {visibleEntries.map((entry) => <li key={`${entry.kind}-${entry.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="font-medium">{entry.name}</p>
            <p className="mt-1 text-xs text-zinc-500">{entry.kind}{entry.detail ? ` · ${entry.detail}` : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-2.5 py-1 text-xs ${statusStyles[entry.status]}`}>{statusLabels[entry.status]}</span>
            <form key={`${entry.id}-${entry.status}`} action={quickUpdateCatalogStatus} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={entry.id}/>
              <input type="hidden" name="kind" value={entry.entity}/>
              <select aria-label={`Новый статус: ${entry.name}`} name="status" defaultValue={entry.status} className="min-h-9 rounded-lg border border-white/10 bg-[#111119] px-2 text-sm text-white">
                <option value="draft">Черновик</option><option value="published">Опубликовано</option><option value="archived">Архив</option>
                {(entry.entity === "video" || entry.entity === "reading") && <option value="disabled">Отключено</option>}
              </select>
              {(entry.entity === "video" || entry.entity === "reading") && <label className="flex items-center gap-1 text-xs text-zinc-400"><input type="checkbox" name="rights_confirmed" value="yes"/>Права подтверждены</label>}
              <button className="rounded-lg bg-violet-500/20 px-3 py-2 text-sm text-violet-100 hover:bg-violet-500/30">Сохранить статус</button>
            </form>
            <Link href={entry.href} className="rounded-lg border border-white/15 px-3 py-2 text-sm text-violet-200 hover:bg-white/5">Редактировать →</Link>
          </div>
        </li>)}
      </ul> : <p className="rounded-xl border border-white/10 p-5 text-sm text-zinc-500">По этому фильтру ничего не найдено.</p>}
    </section>
  );
}
