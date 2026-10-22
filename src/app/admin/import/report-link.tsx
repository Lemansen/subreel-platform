"use client";

import { useState } from "react";

export function ImportReportLink() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const href = `/admin/import/report${params.size ? `?${params.toString()}` : ""}`;
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="text-lg font-bold">Отчёт импорта</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">CSV-сводка по заданиям: количество строк, созданные и дополненные тайтлы, пропуски, ошибки и статусы. Можно ограничить период.</p></div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[11px] text-zinc-500">С даты<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs text-white"/></label>
        <label className="grid gap-1 text-[11px] text-zinc-500">По дату<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs text-white"/></label>
        <a href={href} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500">Скачать CSV</a>
      </div>
    </div>
  </div>;
}
