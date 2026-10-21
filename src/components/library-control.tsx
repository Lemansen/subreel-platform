"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { removeLibraryEntry, saveLibraryEntry, type LibraryStatus } from "@/app/progress/actions";

const labels: Record<LibraryStatus, string> = {
  planned: "Запланировано",
  in_progress: "В процессе",
  completed: "Завершено",
  on_hold: "Отложено",
  dropped: "Брошено",
};

export function LibraryControl({ titleId, slug, signedIn, initialStatus, initialFavorite }: {
  titleId: string;
  slug: string;
  signedIn: boolean;
  initialStatus: LibraryStatus | null;
  initialFavorite: boolean;
}) {
  const [status, setStatus] = useState<LibraryStatus>(initialStatus ?? "planned");
  const [favorite, setFavorite] = useState(initialFavorite);
  const [saved, setSaved] = useState(initialStatus !== null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  if (!signedIn) return <Link href={`/login?next=${encodeURIComponent(`/title/${slug}`)}`} className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm font-semibold hover:bg-white/[0.05]">Войди, чтобы сохранить в библиотеку</Link>;

  function save() {
    setMessage("");
    startTransition(async () => {
      const result = await saveLibraryEntry(titleId, status, favorite);
      if (result.ok) setSaved(true);
      else setMessage("Не удалось сохранить. Обнови страницу и попробуй снова.");
    });
  }

  function remove() {
    setMessage("");
    startTransition(async () => {
      const result = await removeLibraryEntry(titleId);
      if (result.ok) { setSaved(false); setFavorite(false); }
      else setMessage("Не удалось удалить запись. Попробуй снова.");
    });
  }

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-300">Моя библиотека
          <select value={status} onChange={(event) => setStatus(event.target.value as LibraryStatus)} className="min-h-10 rounded-lg border border-white/10 bg-[#111119] px-3 text-white">
            {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" aria-pressed={favorite} onClick={() => setFavorite((value) => !value)} className={`min-h-10 rounded-lg border px-3 text-sm transition ${favorite ? "border-violet-400/40 bg-violet-500/15 text-violet-200" : "border-white/10 text-zinc-300 hover:bg-white/[0.05]"}`}>
          {favorite ? "♥ В избранном" : "♡ В избранное"}
        </button>
        <button type="button" disabled={pending} onClick={save} className="min-h-10 rounded-lg bg-violet-500 px-4 text-sm font-semibold hover:bg-violet-400 disabled:opacity-50">{pending ? "Сохраняю…" : saved ? "Сохранить" : "Добавить"}</button>
        {saved && <button type="button" disabled={pending} onClick={remove} className="min-h-10 rounded-lg border border-white/10 px-3 text-sm text-zinc-400 hover:text-white disabled:opacity-50">Убрать</button>}
      </div>
      {message && <p role="alert" className="mt-3 text-sm text-red-300">{message}</p>}
    </div>
  );
}
