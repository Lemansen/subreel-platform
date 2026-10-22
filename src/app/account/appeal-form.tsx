"use client";

import { useState } from "react";
import { submitModerationAppeal } from "@/app/reports/actions";

export function AppealForm({
  reason,
  existingStatus,
  onSubmitted,
}: {
  reason: string | null;
  existingStatus: string | null;
  onSubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await submitModerationAppeal(text);
      setMessage(result.ok ? result.message : result.error);
      if (result.ok) {
        setOpen(false);
        setText("");
        onSubmitted();
      }
    } catch {
      setMessage("Не удалось отправить апелляцию.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-warning/20 bg-warning/5 p-4">
      <h2 className="font-semibold text-warning">Публичность профиля ограничена</h2>
      <p className="mt-2 text-sm text-text-secondary">
        {reason ? `Причина: ${reason}. ` : ""}
        Пока ограничение активно, изменить публичность нельзя.
      </p>
      {existingStatus ? (
        <p className="mt-3 text-sm text-warning">Апелляция на рассмотрении.</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-warning/30 px-3 text-sm text-warning hover:bg-warning/10"
          >
            {open ? "Закрыть форму" : "Подать апелляцию"}
          </button>
          {open && (
            <form onSubmit={submit} className="mt-3">
              <label className="block text-sm text-text-secondary">
                Почему решение стоит пересмотреть?
                <textarea
                  required
                  minLength={20}
                  maxLength={2000}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  className="mt-1.5 min-h-28 w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </label>
              <button
                disabled={busy}
                className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-accent-strong px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {busy ? "Отправляем…" : "Отправить апелляцию"}
              </button>
            </form>
          )}
        </>
      )}
      {message && (
        <p role="status" className="mt-2 text-sm text-text-secondary">
          {message}
        </p>
      )}
    </section>
  );
}
