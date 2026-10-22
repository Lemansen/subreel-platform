"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { processCatalogImportJob } from "./actions";

type Summary = { jobId: string; status: "queued" | "running" | "completed" | "partial" | "failed"; progress: number; inputCount: number; counts: { created: number; updated: number; skipped: number; errors: number }; busy?: boolean };
const terminal = (status: Summary["status"]) => status === "completed" || status === "partial" || status === "failed";
const label: Record<Summary["status"], string> = { queued: "В очереди", running: "Обрабатывается", completed: "Готово", partial: "Завершено с ошибками", failed: "Не удалось обработать" };

export function ImportJobRunner({ jobId, initialStatus = "queued", initialProgress = 0, inputCount, initialCounts, autoStart = false }: { jobId: string; initialStatus?: Summary["status"]; initialProgress?: number; inputCount: number; initialCounts?: Summary["counts"]; autoStart?: boolean }) {
  const [summary, setSummary] = useState<Summary>({ jobId, status: initialStatus, progress: initialProgress, inputCount, counts: initialCounts ?? { created: 0, updated: 0, skipped: 0, errors: 0 } });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const started = useRef(false);

  const run = useCallback(async () => {
    if (busy || terminal(summary.status)) return;
    setBusy(true); setNotice("");
    try {
      let current = summary;
      while (!terminal(current.status)) {
        const result = await processCatalogImportJob(jobId);
        if (!result.ok || !result.summary) { setNotice(result.error ?? "Не удалось обработать задание."); break; }
        current = result.summary; setSummary(current);
        if (current.busy) { setNotice("Это задание уже обрабатывается в другой вкладке. Обнови страницу чуть позже."); break; }
        if (terminal(current.status)) break;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    } catch { setNotice("Соединение прервалось. Задание сохранено и его можно продолжить."); }
    finally { setBusy(false); }
  }, [busy, jobId, summary]);

  useEffect(() => {
    if (autoStart && !started.current) { started.current = true; void run(); }
  }, [autoStart, run]);

  const percent = summary.inputCount ? Math.round((summary.progress / summary.inputCount) * 100) : 0;
  return <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-semibold text-zinc-200">{label[summary.status]}</span><span className="text-zinc-400">{summary.progress} / {summary.inputCount} строк · создано {summary.counts.created} · дополнено {summary.counts.updated} · ошибки {summary.counts.errors}</span></div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-400 transition-[width]" style={{ width: `${percent}%` }}/></div>
    {!terminal(summary.status) && <button type="button" onClick={() => void run()} disabled={busy} className="mt-3 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{busy ? "Обрабатываю…" : summary.busy ? "Уже обрабатывается" : summary.progress ? "Продолжить очередь" : "Обработать очередь"}</button>}
    {notice && <p role="status" className="mt-2 text-xs text-amber-200">{notice}</p>}
  </div>;
}
