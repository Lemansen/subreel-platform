"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          {
            redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
          }
        );

      if (resetError) {
        console.error("[forgot-password] Supabase error:", resetError.code);
        setError(
          resetError.status === 429
            ? "Слишком много запросов. Подожди несколько минут и попробуй снова."
            : "Не удалось отправить письмо. Попробуй ещё раз позже."
        );
        return;
      }

      setMessage(
        "Если для этого адреса доступно восстановление, инструкция придёт на почту. Проверь также папку «Спам»."
      );
    } catch {
      setError("Не удалось подключиться к сервису. Попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080810] px-4 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-purple-950/20 sm:p-9">
        <Link href="/login" className="text-sm text-white/50 transition hover:text-white">
          ← Ко входу
        </Link>

        <p className="mt-8 text-sm font-semibold tracking-[0.25em] text-purple-300">
          SUBREEL
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          Восстановление пароля
        </h1>
        <p className="mt-2 text-sm leading-6 text-white/55">
          Укажи почту, связанную с аккаунтом. Мы отправим инструкцию для смены пароля.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm text-white/75">
              Электронная почта
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition placeholder:text-white/25 focus:border-purple-400"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          {message && (
            <p role="status" className="rounded-xl border border-purple-400/20 bg-purple-400/10 px-4 py-3 text-sm text-purple-100">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-purple-500 px-4 py-3 font-semibold transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Отправляем..." : "Отправить инструкцию"}
          </button>
        </form>
      </section>
    </main>
  );
}

