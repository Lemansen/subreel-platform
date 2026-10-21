"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (signInError) {
        setError("Не удалось войти. Проверь почту и пароль.");
        return;
      }

      router.replace("/account");
      router.refresh();
    } catch {
      setError("Не удалось подключиться к сервису авторизации. Попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080810] px-4 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-purple-950/20 sm:p-9">
        <Link href="/" className="text-sm text-white/50 transition hover:text-white">
          ← На главную
        </Link>

        <div className="mt-8">
          <p className="text-sm font-semibold tracking-[0.25em] text-purple-300">
            SUBREEL
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            С возвращением
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Войди в аккаунт, чтобы продолжить смотреть и читать.
          </p>
        </div>

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

          <div>
            <label htmlFor="password" className="mb-2 block text-sm text-white/75">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Введи пароль"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition placeholder:text-white/25 focus:border-purple-400"
            />
          </div>

          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-sm text-purple-300 transition hover:text-purple-200"
            >
              Забыли пароль?
            </Link>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-purple-500 px-4 py-3 font-semibold transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/55">
          Ещё нет аккаунта?{" "}
          <Link href="/register" className="font-medium text-purple-300 hover:text-purple-200">
            Зарегистрироваться
          </Link>
        </p>
      </section>
    </main>
  );
}
