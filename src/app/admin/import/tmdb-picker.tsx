"use client";

import { FormEvent, useState } from "react";
import { searchTmdbTitles, type TmdbCandidate } from "./actions";

type SearchState = { ok: true; results: TmdbCandidate[] } | { ok: false; error: string };

export function TmdbPicker({ onSelect }: { onSelect: (item: TmdbCandidate) => void }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"movie" | "tv">("movie");
  const [state, setState] = useState<SearchState | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setState(null);
    try { setState(await searchTmdbTitles(query, kind)); }
    catch { setState({ ok: false, error: "Поиск не завершился. Попробуй ещё раз." }); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-sky-400/15 bg-sky-500/[0.035] p-5 sm:p-6">
    <h2 className="text-xl font-bold">Найти в TMDB</h2>
    <p className="mt-2 text-sm leading-6 text-zinc-400">Загружает до 10 результатов для фильма или сериала. Запрос выполняется на сервере; в пакет попадёт черновик после ручного выбора.</p>
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
      <label className="sr-only" htmlFor="tmdb-search">Название</label><input id="tmdb-search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} minLength={2} required placeholder="Название фильма или сериала" className="rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm outline-none focus:border-sky-300"/>
      <label className="sr-only" htmlFor="tmdb-kind">Тип</label><select id="tmdb-kind" value={kind} onChange={(event) => setKind(event.target.value as "movie" | "tv")} className="rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm"><option value="movie">Фильм</option><option value="tv">Сериал</option></select>
      <button disabled={busy} className="rounded-xl border border-sky-300/25 px-4 py-2.5 text-sm font-semibold text-sky-100 hover:bg-sky-400/10 disabled:opacity-50">{busy ? "Ищу…" : "Найти"}</button>
    </form>
    {state && !state.ok && <p role="alert" className="mt-4 text-sm text-amber-200">{state.error}</p>}
    {state?.ok && state.results.length === 0 && <p className="mt-4 text-sm text-zinc-400">Ничего не найдено.</p>}
    {state?.ok && state.results.length > 0 && <ul className="mt-4 grid gap-3 md:grid-cols-2">{state.results.map((item) => <li key={`${item.external.provider}-${item.external.id}`} className="flex min-w-0 gap-3 rounded-xl border border-white/10 bg-black/20 p-3">{item.cover_url ? <img src={item.cover_url} alt="" className="h-24 w-16 shrink-0 rounded-lg object-cover"/> : <div aria-hidden="true" className="h-24 w-16 shrink-0 rounded-lg bg-white/5"/>}<div className="min-w-0 flex-1"><a className="line-clamp-2 text-sm font-semibold text-white hover:text-sky-200" href={item.external.url} target="_blank" rel="noreferrer">{item.name}</a><p className="mt-1 text-xs text-zinc-500">{item.content_type === "movie" ? "Фильм" : "Сериал"}{item.release_year ? ` · ${item.release_year}` : ""} · ID {item.external.id}</p>{item.original_name && <p className="mt-1 line-clamp-1 text-xs text-zinc-400">{item.original_name}</p>}{item.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">{item.description}</p>}<button type="button" onClick={() => onSelect(item)} className="mt-3 rounded-lg bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-400/20">Добавить в пакет</button></div></li>)}</ul>}
  </section>;
}
