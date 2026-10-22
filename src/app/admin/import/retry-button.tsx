"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { retryCatalogImportError } from "./actions";

export function RetryButton({ errorId }: { errorId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function retry() {
    setBusy(true); setMessage("");
    try {
      const result = await retryCatalogImportError(errorId);
      setMessage(result.ok ? result.message : result.error);
      if (result.ok) router.refresh();
    } catch { setMessage("Не удалось повторить строку. Обнови страницу и проверь подключение."); }
    finally { setBusy(false); }
  }
  return <span className="ml-2 inline-flex flex-wrap items-center gap-2"><button type="button" disabled={busy} onClick={() => void retry()} className="rounded-lg border border-red-300/20 px-2 py-1 text-[11px] text-red-100 hover:bg-red-300/10 disabled:opacity-50">{busy ? "Повторяю…" : "Повторить"}</button>{message && <span role="status" className="text-[11px] text-zinc-300">{message}</span>}</span>;
}
