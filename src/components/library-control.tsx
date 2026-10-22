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

  if (!signedIn) return <Link href={`/login?next=${encodeURIComponent(`/title/${slug}`)}`} className="inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm font-semibold hover:bg-surface-2">Войди, чтобы сохранить в библиотеку</Link>;

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
    <div className="mt-5 rounded-2xl border border-border-subtle bg-surface-1 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-text-secondary">Моя библиотека
          <select value={status} onChange={(event) => setStatus(event.target.value as LibraryStatus)} className="min-h-11 rounded-lg border border-border-subtle bg-surface-1 px-3 text-foreground">
            {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" aria-pressed={favorite} onClick={() => setFavorite((value) => !value)} className={`min-h-11 rounded-lg border px-3 text-sm transition ${favorite ? "border-accent/40 bg-accent/15 text-accent" : "border-border-subtle text-text-secondary hover:bg-surface-2"}`}>
          {favorite ? "♥ В избранном" : "♡ В избранное"}
        </button>
        <button type="button" disabled={pending} onClick={save} className="min-h-11 rounded-lg bg-accent-strong px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">{pending ? "Сохраняю…" : saved ? "Сохранить" : "Добавить"}</button>
        {saved && <button type="button" disabled={pending} onClick={remove} className="min-h-11 rounded-lg border border-border-subtle px-3 text-sm text-text-secondary hover:text-foreground disabled:opacity-50">Убрать</button>}
      </div>
      {message && <p role="alert" className="mt-3 text-sm text-danger">{message}</p>}
    </div>
  );
}
