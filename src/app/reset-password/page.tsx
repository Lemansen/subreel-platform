"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data: { user }, error: userError } =
        await supabase.auth.getUser();

      if (userError || !user) {
        setError(
          "Сессия восстановления не найдена или истекла. Запроси новое письмо."
        );
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError("Не удалось обновить пароль. Попробуй ещё раз.");
        return;
      }

      setSuccess(true);
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
          Новый пароль
        </h1>

        {success ? (
          <div className="mt-6 space-y-5">
            <p role="status" className="rounded-xl border border-purple-400/20 bg-purple-400/10 px-4 py-3 text-sm leading-6 text-purple-100">
              Пароль успешно изменён. Теперь можно войти с новым паролем.
            </p>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="w-full rounded-xl bg-purple-500 px-4 py-3 font-semibold transition hover:bg-purple-400"
            >
              Перейти ко входу
            </button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Введи новый пароль длиной не менее 8 символов.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="password" className="mb-2 block text-sm text-white/75">
                  Новый пароль
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition focus:border-purple-400"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-sm text-white/75">
                  Повтори пароль
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition focus:border-purple-400"
                />
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
                {loading ? "Сохраняем..." : "Изменить пароль"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
