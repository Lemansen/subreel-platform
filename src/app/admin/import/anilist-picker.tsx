"use client";

import { FormEvent, useState } from "react";
import { searchAniListTitles, type AniListCandidate } from "./actions";

type SearchState = { ok: true; results: AniListCandidate[] } | { ok: false; error: string };

export function AniListPicker({ onSelect }: { onSelect: (item: AniListCandidate) => void }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"ANIME" | "MANGA">("ANIME");
  const [state, setState] = useState<SearchState | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setState(null);
    try { setState(await searchAniListTitles(query, kind)); }
    catch { setState({ ok: false, error: "Поиск не завершился. Попробуй ещё раз." }); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.04] p-5 sm:p-6">
    <h2 className="text-xl font-bold">Найти в AniList</h2>
    <p className="mt-2 text-sm leading-6 text-zinc-400">Загружает публичные метаданные аниме или манги. Найденное попадёт в JSON как черновик — проверь точность данных и права на изображения перед публикацией.</p>
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
      <label className="sr-only" htmlFor="anilist-search">Название</label><input id="anilist-search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} minLength={2} required placeholder="Название произведения" className="rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm outline-none focus:border-violet-400"/>
      <label className="sr-only" htmlFor="anilist-kind">Тип</label><select id="anilist-kind" value={kind} onChange={(event) => setKind(event.target.value as "ANIME" | "MANGA")} className="rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm"><option value="ANIME">Аниме</option><option value="MANGA">Манга</option></select>
      <button disabled={busy} className="rounded-xl border border-violet-300/25 px-4 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-400/10 disabled:opacity-50">{busy ? "Ищу…" : "Найти"}</button>
    </form>
    {state && !state.ok && <p role="alert" className="mt-4 text-sm text-amber-200">{state.error}</p>}
    {state?.ok && state.results.length === 0 && <p className="mt-4 text-sm text-zinc-400">Ничего не найдено.</p>}
    {state?.ok && state.results.length > 0 && <ul className="mt-4 grid gap-3 md:grid-cols-2">{state.results.map((item) => <li key={`${item.external.provider}-${item.external.id}`} className="flex min-w-0 gap-3 rounded-xl border border-white/10 bg-black/20 p-3">{item.cover_url ? <img src={item.cover_url} alt="" className="h-24 w-16 shrink-0 rounded-lg object-cover"/> : <div aria-hidden="true" className="h-24 w-16 shrink-0 rounded-lg bg-white/5"/>}<div className="min-w-0 flex-1"><a className="line-clamp-2 text-sm font-semibold text-white hover:text-violet-200" href={item.external.url} target="_blank" rel="noreferrer">{item.name}</a><p className="mt-1 text-xs text-zinc-500">{item.content_type}{item.release_year ? ` · ${item.release_year}` : ""} · ID {item.external.id}</p>{item.original_name && <p className="mt-1 line-clamp-1 text-xs text-zinc-400">{item.original_name}</p>}<button type="button" onClick={() => onSelect(item)} className="mt-3 rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-500/25">Добавить в пакет</button></div></li>)}</ul>}
  </section>;
}
