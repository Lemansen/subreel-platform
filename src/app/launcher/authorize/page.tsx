"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LauncherRequest = {
  valid: boolean;
  status?: "pending" | "used";
  signed_in?: boolean;
  email?: string | null;
};

export default function LauncherAuthorizePage() {
  const [request, setRequest] = useState<LauncherRequest | null>(null);
  const [requestId, setRequestId] = useState("");
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("request_id") ?? "";
    const requestState = params.get("state") ?? "";
    const controller = new AbortController();
    const query = new URLSearchParams({ request_id: id, state: requestState });
    fetch(`/api/launcher/auth/request?${query}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as LauncherRequest;
        setRequestId(id);
        setState(requestState);
        setRequest(response.ok ? result : { valid: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRequestId(id);
          setState(requestState);
          setRequest({ valid: false });
        }
      });
    return () => controller.abort();
  }, []);

  const nextPath = useMemo(() => {
    const destination = new URLSearchParams({ request_id: requestId, state }).toString();
    return `/launcher/authorize?${destination}`;
  }, [requestId, state]);

  async function approve() {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/launcher/auth/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, state }),
        cache: "no-store",
      });
      const payload = await response.json() as { callback_url?: string; error?: string };
      if (!response.ok || !payload.callback_url) {
        setError(payload.error ?? "Не удалось подтвердить вход. Запусти его в лаунчере заново.");
        setRequest((current) => current ? { ...current, status: "used" } : current);
        return;
      }
      window.location.assign(payload.callback_url);
    } catch {
      setError("Не удалось связаться с SubReel. Проверь подключение и попробуй снова.");
    } finally {
      setBusy(false);
    }
  }

  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080810] px-4 py-12 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-purple-950/20 sm:p-9">
        <p className="text-sm font-semibold tracking-[0.25em] text-purple-300">SUBREEL · БЕЗОПАСНОСТЬ</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Вход в SubReel Launcher</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          Подтверди вход аккаунтом SubReel. Пароль и игровые токены не передаются лаунчеру через адрес браузера.
        </p>

        {!request && <p className="mt-8 text-sm text-white/60" aria-live="polite">Проверяем запрос…</p>}

        {request && !request.valid && (
          <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-5 text-sm leading-6 text-amber-100" role="status">
            Запрос входа недействителен или истёк. Закрой эту страницу и начни вход заново в лаунчере.
          </div>
        )}

        {request?.valid && request.status === "used" && (
          <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-5 text-sm leading-6 text-amber-100" role="status">
            Этот запрос уже подтверждали или он истёк. Вернись в лаунчер и начни вход заново.
          </div>
        )}

        {request?.valid && request.status === "pending" && !request.signed_in && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
            <p className="text-sm text-white/70">Сначала войди в аккаунт SubReel. После входа вернёшься сюда для подтверждения.</p>
            <Link href={loginHref} className="mt-5 inline-flex rounded-xl bg-purple-500 px-5 py-3 font-semibold transition hover:bg-purple-400">
              Перейти ко входу
            </Link>
          </div>
        )}

        {request?.valid && request.status === "pending" && request.signed_in && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
            <p className="text-xs font-semibold tracking-wide text-white/45">ВЫ ВОЙДЁТЕ КАК</p>
            <p className="mt-2 break-all text-lg font-semibold">{request.email}</p>
            <p className="mt-3 text-sm leading-6 text-white/55">Подтверждение передаст лаунчеру сессию SubReel, чтобы открыть каталог и новости. Лицензия Minecraft проверяется отдельно через Microsoft.</p>
            {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200" role="alert">{error}</p>}
            <button type="button" onClick={approve} disabled={busy} className="mt-6 w-full rounded-xl bg-purple-500 px-5 py-3 font-semibold transition hover:bg-purple-400 disabled:cursor-wait disabled:opacity-60">
              {busy ? "Подтверждаем…" : "Подтвердить вход"}
            </button>
          </div>
        )}

        <p className="mt-7 text-xs leading-5 text-white/35">
          Не подтверждай запрос, если ты сам не запускал вход в SubReel Launcher. Код входа действует несколько минут и может быть использован только один раз.
        </p>
      </section>
    </main>
  );
}
