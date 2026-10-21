"use client";

import { useMemo, useState } from "react";
import { useTransition } from "react";
import { saveReadingProgress } from "@/app/progress/actions";

type Chapter = { id: string; chapter_label: string; name: string | null; sort_order: number };
type ReadingSource = { id: string; chapter_id: string | null; source_url: string; source_format: "image_pages" | "pdf" | "epub" | "html" | "plain_text"; provider_name: string | null; language_code: string | null };
type ReadingProgress = { chapter_id: string | null; current_page: number; total_pages: number | null; completed_at: string | null; updated_at: string };

export function ReadingViewer({ titleId, chapters, sources, initialProgress, canSaveProgress }: { titleId: string; chapters: Chapter[]; sources: ReadingSource[]; initialProgress: ReadingProgress[]; canSaveProgress: boolean }) {
  const [chapterId, setChapterId] = useState(() => {
    const lastChapter = initialProgress[0]?.chapter_id;
    return (lastChapter && chapters.some((chapter) => chapter.id === lastChapter) ? lastChapter : null) ?? chapters.find((chapter) => sources.some((source) => source.chapter_id === chapter.id))?.id ?? "title";
  });
  const [sourceId, setSourceId] = useState("");
  const [completed, setCompleted] = useState(Boolean(initialProgress.find((item) => item.chapter_id === chapterId)?.completed_at));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const options = useMemo(() => {
    const specific = chapterId === "title" ? [] : sources.filter((source) => source.chapter_id === chapterId);
    return specific.length ? specific : sources.filter((source) => source.chapter_id === null);
  }, [chapterId, sources]);
  const selected = options.find((source) => source.id === sourceId) ?? options[0];
  const chapter = chapters.find((item) => item.id === chapterId);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-border-subtle bg-surface-1">
      <div className="flex flex-wrap items-center gap-4 border-b border-border-subtle px-4 py-3">
        {chapters.length > 0 && <label className="flex items-center gap-3 text-sm text-text-secondary">Глава<select value={chapterId} onChange={(event) => {
          const nextId = event.target.value;
          setChapterId(nextId);
          setSourceId("");
          const existingProgress = initialProgress.find((item) => item.chapter_id === (nextId === "title" ? null : nextId));
          setCompleted(Boolean(existingProgress?.completed_at));
          setMessage("");
          if (canSaveProgress) startTransition(async () => {
            const result = await saveReadingProgress(titleId, nextId === "title" ? null : nextId, Boolean(existingProgress?.completed_at));
            if (!result.ok) setMessage("Не удалось сохранить главу. Проверь подключение и войди в аккаунт.");
          });
        }} className="min-h-10 min-w-44 rounded-lg border border-border-subtle bg-background px-3 text-white"><option value="title">Всё произведение</option>{chapters.map((item) => <option key={item.id} value={item.id}>{item.chapter_label}{item.name ? ` · ${item.name}` : ""}</option>)}</select></label>}
        {options.length > 1 && <label className="flex items-center gap-3 text-sm text-text-secondary">Источник<select value={selected?.id} onChange={(event) => setSourceId(event.target.value)} className="min-h-10 min-w-44 rounded-lg border border-border-subtle bg-background px-3 text-white">{options.map((item) => <option key={item.id} value={item.id}>{[item.provider_name, item.language_code, item.source_format.toUpperCase()].filter(Boolean).join(" · ")}</option>)}</select></label>}
        {canSaveProgress && <button type="button" disabled={pending || !chapterId} onClick={() => startTransition(async () => {
          setMessage("");
          const result = await saveReadingProgress(titleId, chapterId === "title" ? null : chapterId, !completed);
          if (result.ok) setCompleted((value) => !value);
          else setMessage("Не удалось сохранить прогресс. Попробуй снова.");
        })} className="min-h-10 rounded-lg border border-violet-400/30 px-3 text-sm text-violet-200 hover:bg-violet-500/10 disabled:opacity-50">{pending ? "Сохраняю…" : completed ? "✓ Глава прочитана" : "Отметить прочитанной"}</button>}
      </div>
      {message && <p role="alert" className="border-b border-red-400/20 px-4 py-2 text-sm text-red-300">{message}</p>}
      {selected ? <ReaderContent source={selected} label={chapter ? `Глава ${chapter.chapter_label}${chapter.name ? ` — ${chapter.name}` : ""}` : "Материал для чтения"} /> : <div className="grid min-h-[50vh] place-items-center p-8 text-center text-sm text-text-secondary">Для выбранной главы нет доступного источника.</div>}
    </section>
  );
}

function ReaderContent({ source, label }: { source: ReadingSource; label: string }) {
  if (source.source_format === "pdf" || source.source_format === "epub") {
    return <div className="grid min-h-[50vh] place-items-center p-8 text-center"><div><p className="font-medium">Материал доступен в формате {source.source_format.toUpperCase()}</p><p className="mt-2 text-sm text-text-secondary">Открой его в новой вкладке браузера.</p><a href={source.source_url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-4 text-sm font-semibold text-white hover:bg-violet-600">Открыть материал ↗</a></div></div>;
  }

  return <div className="bg-[#111119]"><iframe title={label} src={source.source_url} sandbox="allow-scripts" referrerPolicy="no-referrer" className="min-h-[65vh] w-full border-0 bg-white" /><div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3"><span className="text-xs text-text-muted">Источник: {source.provider_name || "проверенный источник"}</span><a href={source.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-300 hover:text-violet-200">Открыть отдельно ↗</a></div></div>;
}
