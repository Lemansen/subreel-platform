"use client";

import { useState } from "react";
import { getCatalogImportJobErrors } from "./actions";
import { RetryButton } from "./retry-button";

type ErrorRow = { id: string; row_number: number; external_id: string | null; item_name: string | null; message: string; retryable: boolean };

export function ImportJobErrors({ jobId, errorCount }: { jobId: string; errorCount: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ErrorRow[] | null>(null);
  const [error, setError] = useState("");

  async function toggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen || rows) return;
    setLoading(true); setError("");
    try {
      const result = await getCatalogImportJobErrors(jobId);
      if (result.ok) setRows(result.rows);
      else setError(result.error);
    } catch { setError("Не удалось загрузить ошибки. Повтори попытку."); }
    finally { setLoading(false); }
  }

  if (errorCount <= 0) return null;
  return <div className="mt-3 border-t border-white/5 pt-3">
    <button type="button" aria-expanded={open} onClick={() => void toggle()} className="text-xs font-semibold text-red-200 hover:text-red-100">{open ? "Скрыть" : "Показать"} ошибки ({errorCount})</button>
    {open && <div className="mt-2">{loading ? <p className="text-xs text-zinc-400">Загружаю ошибки…</p> : error ? <p role="alert" className="text-xs text-red-200">{error}</p> : rows?.length ? <ul className="space-y-2 text-xs text-red-200">{rows.map((row) => <li key={row.id} className="rounded-lg bg-red-400/[0.04] p-2"><p>Строка {row.row_number}{row.item_name ? ` · ${row.item_name}` : ""}{row.external_id ? <span className="ml-1 font-mono text-zinc-500">ID {row.external_id}</span> : null}: {row.message}{row.retryable && <RetryButton errorId={row.id}/>}</p></li>)}</ul> : <p className="text-xs text-zinc-400">Подробности не найдены.</p>}{rows && rows.length < errorCount && <p className="mt-2 text-[11px] text-zinc-500">Показаны первые {rows.length} строк ошибок.</p>}</div>}
  </div>;
}
