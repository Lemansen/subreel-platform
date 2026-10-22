"use client";

import { useState } from "react";
import { applyAniListRefresh, previewAniListRefresh, type AniListRefreshPreview } from "./actions";

type Result = { ok: true; preview: AniListRefreshPreview } | { ok: false; error: string };
const inputClass = "rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
const displayValue = (value: string | number | null) => value === null ? "—" : String(value);

export function AniListRefresh() {
  const [externalId, setExternalId] = useState("");
  const [kind, setKind] = useState<"ANIME" | "MANGA">("ANIME");
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function onPreview() {
    setBusy(true); setNotice(""); setResult(null); setSelected([]);
    try { setResult(await previewAniListRefresh(externalId, kind)); }
    catch { setResult({ ok: false, error: "Предпросмотр не удался. Повтори попытку." }); }
    finally { setBusy(false); }
  }

  async function onApply() {
    if (!result?.ok || selected.length === 0) return;
    setBusy(true); setNotice("");
    try {
      const applied = await applyAniListRefresh(result.preview.title.id, externalId, kind, selected);
      if (applied.ok) {
        setNotice(applied.message); setSelected([]);
        const refreshed = await previewAniListRefresh(externalId, kind);
        setResult(refreshed.ok ? refreshed : { ok: false, error: refreshed.error });
      } else setNotice(applied.error);
    } catch { setNotice("Не удалось сохранить изменения. Повтори попытку."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
    <h2 className="text-xl font-bold">Обновить существующий тайтл из AniList</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Укажи ID уже связанного тайтла. Изменения сначала сравниваются, затем ты сам выбираешь поля. Slug, тип и публикация не затрагиваются.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <label className="grid gap-1 text-xs text-zinc-400">AniList ID<input className={inputClass} value={externalId} onChange={(event) => setExternalId(event.target.value)} inputMode="numeric" maxLength={10} placeholder="Например, 16498"/></label>
      <label className="grid gap-1 text-xs text-zinc-400">Тип<select className={inputClass} value={kind} onChange={(event) => setKind(event.target.value as "ANIME" | "MANGA")}><option value="ANIME">Аниме</option><option value="MANGA">Манга</option></select></label>
      <button type="button" disabled={busy || !externalId.trim()} onClick={() => void onPreview()} className="self-end rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? "Загружаю…" : "Сравнить"}</button>
    </div>
    {result && !result.ok && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{result.error}</p>}
    {result?.ok && <div className="mt-5">
      <p className="text-sm text-zinc-300">Найден тайтл: <span className="font-semibold text-white">{result.preview.title.name}</span> <span className="font-mono text-xs text-zinc-500">/{result.preview.title.slug}</span></p>
      {!result.preview.changes.length ? <p className="mt-3 rounded-xl bg-black/20 p-3 text-sm text-zinc-400">Новых значений для обновления нет.</p> : <>
        <div className="mt-3 space-y-2">{result.preview.changes.map((change) => <label key={change.field} className="grid gap-3 rounded-xl border border-white/5 bg-black/20 p-3 sm:grid-cols-[auto_1fr_1fr] sm:items-start">
          <input type="checkbox" checked={selected.includes(change.field)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, change.field] : current.filter((field) => field !== change.field))} className="mt-1 accent-violet-500"/>
          <span><span className="block text-xs font-semibold text-violet-200">{change.label} · сейчас</span><span className="mt-1 block whitespace-pre-wrap break-words text-sm text-zinc-400">{displayValue(change.current)}</span></span>
          <span><span className="block text-xs font-semibold text-emerald-200">Новое значение</span><span className="mt-1 block whitespace-pre-wrap break-words text-sm text-zinc-200">{displayValue(change.incoming)}</span></span>
        </label>)}</div>
        <button type="button" disabled={busy || !selected.length} onClick={() => void onApply()} className="mt-4 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? "Сохраняю…" : `Обновить выбранное (${selected.length})`}</button>
      </>}
    </div>}
    {notice && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-200">{notice}</p>}
  </section>;
}
