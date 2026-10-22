"use client";

import { useState } from "react";
import { commitCatalogImport, previewCatalogImport, type CatalogSourceCandidate, type ImportPreview } from "./actions";
import { AniListPicker } from "./anilist-picker";
import { AniListRefresh } from "./anilist-refresh";
import { TmdbPicker } from "./tmdb-picker";
import { OpenLibraryPicker } from "./openlibrary-picker";
import { ImportJobRunner } from "./import-job-runner";

const field = "mt-1 block w-full rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500 file:px-3 file:py-2 file:text-white";
const example = `{
  "titles": [
    {
      "name": "Название",
      "original_name": "Original title",
      "slug": "original-title",
      "content_type": "anime",
      "release_year": 2025,
      "description": "Краткое описание",
      "cover_url": "https://example.com/cover.jpg",
      "external": { "provider": "anilist", "id": "12345", "url": "https://anilist.co/anime/12345" }
    }
  ]
}`;

export function ImportForm() {
  const [raw, setRaw] = useState("");
  const [filename, setFilename] = useState("JSON импорт");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [allowPossibleDuplicates, setAllowPossibleDuplicates] = useState(false);
  const [queuedJob, setQueuedJob] = useState<{ id: string; inputCount: number } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(file?: File) {
    if (!file) return;
    setPreview(null); setAllowPossibleDuplicates(false); setMessage(""); setFilename(file.name);
    if (file.size > 1_000_000) { setRaw(""); setMessage("Файл превышает ограничение 1 МБ."); return; }
    setRaw(await file.text());
  }

  function addCandidate(item: CatalogSourceCandidate) {
    let packageData: { titles?: unknown[] } = { titles: [] };
    if (raw.trim()) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { titles?: unknown }).titles)) throw new Error("format");
        packageData = parsed as { titles: unknown[] };
      } catch {
        setMessage("Сначала исправь JSON в поле ниже или очисти его, затем добавляй результат источника.");
        return;
      }
    }
    const existing = packageData.titles ?? [];
    if (existing.some((entry) => entry && typeof entry === "object" && (entry as { external?: { provider?: string; id?: string } }).external?.provider === item.external.provider && (entry as { external?: { provider?: string; id?: string } }).external?.id === item.external.id)) {
      setMessage(`Этот ${item.external.provider.toUpperCase()} ID уже есть в пакете.`);
      return;
    }
    packageData.titles = [...existing, item];
    const nextRaw = JSON.stringify(packageData, null, 2);
    if (new TextEncoder().encode(nextRaw).length > 1_000_000) { setMessage("Пакет превысит ограничение 1 МБ."); return; }
    setFilename(`${item.external.provider}-import.json`); setRaw(nextRaw); setPreview(null); setAllowPossibleDuplicates(false); setMessage("Добавлено в пакет. Подготовь предпросмотр перед импортом.");
  }

  async function onPreview() {
    setBusy(true); setMessage(""); setAllowPossibleDuplicates(false);
    try { setPreview(await previewCatalogImport(raw)); }
    catch { setMessage("Не удалось подготовить предпросмотр. Повтори попытку."); }
    finally { setBusy(false); }
  }

  async function onCommit() {
    if (!preview?.ok || preview.counts.error > 0) return;
    setBusy(true); setMessage("");
    try {
      const acknowledged = allowPossibleDuplicates && preview
        ? preview.rows.flatMap((row) => (row.possibleDuplicates ?? []).map((match) => `${row.row}:${match.id}`))
        : [];
      const result = await commitCatalogImport(raw, filename, acknowledged);
      if (!result.ok) setMessage(result.error);
      else { setMessage("Пакет добавлен в очередь импорта."); setQueuedJob({ id: result.jobId, inputCount: result.inputCount }); setPreview(null); setRaw(""); setAllowPossibleDuplicates(false); }
    } catch { setMessage("Импорт не завершился. Проверь журнал задания и подключение к Supabase."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <AniListRefresh/>
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <h2 className="text-xl font-bold">JSON пакет каталога</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">Загрузи JSON до 1 МБ, максимум 100 записей. Импорт создаёт только черновики. У совпавшего тайтла заполняются лишь пустые дополнительные поля.</p>
      <div className="mt-5 grid gap-4"><AniListPicker onSelect={addCandidate}/><TmdbPicker onSelect={addCandidate}/><OpenLibraryPicker onSelect={addCandidate}/></div>
      <label className="mt-5 block text-sm text-zinc-300">Файл JSON<input className={field} type="file" accept="application/json,.json" onChange={(event) => void onFile(event.target.files?.[0])}/></label>
      <label className="mt-4 block text-sm text-zinc-300">Или вставь JSON вручную<textarea className={`${field} font-mono`} rows={11} value={raw} onChange={(event) => { setRaw(event.target.value); setPreview(null); setAllowPossibleDuplicates(false); }} placeholder={example}/></label>
      <details className="mt-3 text-sm text-zinc-400"><summary className="cursor-pointer">Формат и пример</summary><p className="mt-2">Обязательны name, slug и content_type. Типы: {"anime, movie, series, drama, cartoon, manga, manhwa, manhua, light_novel, web_novel, book"}. Провайдеры внешнего ID: anilist, tmdb, openlibrary, custom.</p><pre className="mt-3 overflow-x-auto rounded-xl bg-black/30 p-3 text-xs text-zinc-300">{example}</pre></details>
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={busy || !raw.trim()} onClick={() => void onPreview()} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? "Проверяю…" : "Предпросмотр"}</button>{preview?.ok && preview.counts.error === 0 && <button type="button" disabled={busy || (preview.counts.duplicates > 0 && !allowPossibleDuplicates)} onClick={() => void onCommit()} className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? "Импортирую…" : "Импортировать черновики"}</button>}</div>
      {message && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-200">{message}</p>}
      {queuedJob && <ImportJobRunner key={queuedJob.id} jobId={queuedJob.id} inputCount={queuedJob.inputCount} autoStart/>}
      {preview?.error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{preview.error}</p>}
    </section>
    {preview?.ok && <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"><h2 className="text-xl font-bold">Предпросмотр</h2><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-emerald-200">Создать: {preview.counts.create}</span><span className="rounded-full bg-sky-400/10 px-3 py-1.5 text-sky-200">Дополнить: {preview.counts.enrich}</span><span className="rounded-full bg-zinc-500/20 px-3 py-1.5 text-zinc-300">Пропустить: {preview.counts.skip}</span><span className="rounded-full bg-amber-400/10 px-3 py-1.5 text-amber-200">Возможные дубли: {preview.counts.duplicates}</span><span className="rounded-full bg-red-400/10 px-3 py-1.5 text-red-200">Ошибки: {preview.counts.error}</span></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs uppercase text-zinc-500"><tr><th className="py-2 pr-3">№</th><th className="py-2 pr-3">Тайтл</th><th className="py-2 pr-3">Slug</th><th className="py-2 pr-3">Действие</th><th className="py-2">Подробности</th></tr></thead><tbody className="divide-y divide-white/5">{preview.rows.map((row) => <tr key={row.row} className="align-top"><td className="py-3 pr-3 text-zinc-500">{row.row}</td><td className="py-3 pr-3">{row.name}</td><td className="py-3 pr-3 font-mono text-xs text-zinc-400">{row.slug}</td><td className="py-3 pr-3">{{ create: "Создать черновик", enrich: "Дополнить", skip: "Пропустить", error: "Ошибка" }[row.outcome]}</td><td className="py-3 text-xs leading-5 text-zinc-400">{row.detail}{row.possibleDuplicates?.length ? <ul className="mt-2 space-y-1 text-amber-200">{row.possibleDuplicates.map((match) => <li key={match.id}>Похоже на «{match.name}» {match.original_name && `(${match.original_name})`} · {match.content_type} · {match.status} · <span className="font-mono">{match.slug}</span></li>)}</ul> : null}</td></tr>)}</tbody></table></div>{preview.counts.duplicates > 0 && <label className="mt-4 flex gap-2 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100"><input type="checkbox" checked={allowPossibleDuplicates} onChange={(event) => setAllowPossibleDuplicates(event.target.checked)} className="mt-1 accent-amber-400"/>Я проверил предупреждения и подтверждаю создание записей, несмотря на возможные дубли.</label>}{preview.counts.error > 0 && <p className="mt-4 text-sm text-red-200">Исправь ошибки и заново проверь файл. Импорт с ошибками заблокирован.</p>}</section>}
  </div>;
}
