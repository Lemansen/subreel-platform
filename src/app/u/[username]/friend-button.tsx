"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type FriendState =
  | { kind: "none" }
  | { kind: "outgoing"; requestId: string }
  | { kind: "incoming"; requestId: string }
  | { kind: "friends"; requestId: string }
  | { kind: "blocked" };

const primary =
  "inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
const secondary =
  "inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm font-semibold transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60";

/** Действия с дружбой на публичной странице. Права проверяет RLS: здесь только удобство. */
export function FriendButton({
  viewerId,
  profileId,
  initial,
}: {
  viewerId: string;
  profileId: string;
  initial: FriendState;
}) {
  const [state, setState] = useState<FriendState>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run(task: () => Promise<FriendState | string>) {
    setBusy(true);
    setMessage("");
    try {
      const result = await task();
      if (typeof result === "string") setMessage(result);
      else setState(result);
    } catch {
      setMessage("Нет соединения. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  const send = () =>
    run(async () => {
      const { data, error } = await createClient()
        .from("friend_requests")
        .insert({ requester_id: viewerId, addressee_id: profileId })
        .select("id")
        .single();
      if (error || !data) return "Заявка не отправлена. Возможно, она уже есть или пользователь закрыл доступ.";
      return { kind: "outgoing", requestId: data.id as string };
    });

  const drop = (requestId: string, error: string) =>
    run(async () => {
      const { error: deleteError } = await createClient().from("friend_requests").delete().eq("id", requestId);
      return deleteError ? error : { kind: "none" };
    });

  const respond = (requestId: string, status: "accepted" | "rejected") =>
    run(async () => {
      const { error } = await createClient()
        .from("friend_requests")
        .update({ status })
        .eq("id", requestId)
        .eq("status", "pending");
      if (error) return "Не удалось ответить на заявку. Попробуй ещё раз.";
      return status === "accepted" ? { kind: "friends", requestId } : { kind: "none" };
    });

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {state.kind === "none" && (
          <button type="button" onClick={send} disabled={busy} className={primary}>
            {busy ? "Отправляем…" : "Добавить в друзья"}
          </button>
        )}
        {state.kind === "outgoing" && (
          <>
            <span className="inline-flex min-h-11 items-center rounded-xl border border-border-subtle bg-surface-2 px-4 text-sm text-text-secondary">
              Заявка отправлена
            </span>
            <button type="button" onClick={() => drop(state.requestId, "Не удалось отменить заявку.")} disabled={busy} className={secondary}>
              Отменить
            </button>
          </>
        )}
        {state.kind === "incoming" && (
          <>
            <button type="button" onClick={() => respond(state.requestId, "accepted")} disabled={busy} className={primary}>
              Принять заявку
            </button>
            <button type="button" onClick={() => respond(state.requestId, "rejected")} disabled={busy} className={secondary}>
              Отклонить
            </button>
          </>
        )}
        {state.kind === "friends" && (
          <>
            <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 text-sm font-semibold text-success">
              <span aria-hidden>✓</span> В друзьях
            </span>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Убрать пользователя из друзей?")) void drop(state.requestId, "Не удалось убрать из друзей.");
              }}
              disabled={busy}
              className={secondary}
            >
              Убрать
            </button>
          </>
        )}
        {state.kind === "blocked" && (
          <Link href="/friends" className={secondary}>
            Ты заблокировал этого пользователя
          </Link>
        )}
      </div>
      {message && (
        <p role="alert" className="max-w-xs text-xs text-danger sm:text-right">
          {message}
        </p>
      )}
    </div>
  );
}
