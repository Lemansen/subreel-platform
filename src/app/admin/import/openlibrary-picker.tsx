"use client";

import { useState } from "react";
import { searchOpenLibraryTitles, type OpenLibraryCandidate } from "./actions";

type SearchState = { ok: true; results: OpenLibraryCandidate[] } | { ok: false; error: string };

export function OpenLibraryPicker({ onSelect }: { onSelect: (item: OpenLibraryCandidate) => void }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState | null>(null);
  const [busy, setBusy] = useState(false);
  async function search() {
    setBusy(true);
    try { setState(await searchOpenLibraryTitles(query)); }
    catch { setState({ ok: false, error: "Не удалось связаться с Open Library." }); }
    finally { setBusy(false); }
  }

  return <section className="rounded-xl border border-white/10 bg-black/20 p-4">
    <h3 className="font-semibold">Найти книгу в Open Library</h3>
    <p className="mt-1 text-xs text-zinc-500">Поиск берёт метаданные произведения и, если доступна, обложку.</p>
    <div className="mt-3 flex flex-wrap gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} maxLength={120} placeholder="Название книги" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"/><button type="button" disabled={busy || query.trim().length < 2} onClick={() => void search()} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? "Ищу…" : "Найти"}</button></div>
    {state && !state.ok && <p role="alert" className="mt-3 text-sm text-red-200">{state.error}</p>}
    {state?.ok && <ul className="mt-3 divide-y divide-white/5">{state.results.map((item) => <li key={item.external.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{item.name}</p><p className="mt-1 text-xs text-zinc-500">{item.release_year ?? "Год неизвестен"} · {item.external.id}</p></div><div className="flex gap-2"><a href={item.external.url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300">Open Library ↗</a><button type="button" onClick={() => onSelect(item)} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold">Добавить</button></div></li>)}{!state.results.length && <li className="py-3 text-sm text-zinc-500">Книги не найдены.</li>}</ul>}
  </section>;
}
