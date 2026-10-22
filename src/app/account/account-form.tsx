"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
};

export default function AccountForm() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (!active) return;

        if (authError || !authData.user) {
          setLoading(false);
          return;
        }

        const user = authData.user;
        setUserId(user.id);
        setEmail(user.email ?? "");

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("username, display_name, avatar_url, bio, is_public")
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;

        if (profileError) {
          setError("Не удалось загрузить профиль. Проверь подключение таблицы profiles.");
          return;
        }

        let profile = data as Profile | null;

        if (!profile) {
          const { data: created, error: createError } = await supabase
            .from("profiles")
            .insert({ id: user.id })
            .select("username, display_name, avatar_url, bio, is_public")
            .single();

          if (!active) return;

          if (createError) {
            setError("Не удалось создать профиль. Попробуй обновить страницу.");
            return;
          }

          profile = created as Profile;
        }

        setUsername(profile.username ?? "");
        setSavedUsername(profile.username?.toLowerCase() ?? null);
        setDisplayName(profile.display_name ?? "");
        setAvatarUrl(profile.avatar_url ?? "");
        setBio(profile.bio ?? "");
        setIsPublic(profile.is_public ?? false);
      } catch {
        if (active) {
          setError("Не удалось подключиться к Supabase.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!userId) {
      setError("Сначала войди в аккаунт.");
      return;
    }

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedName = displayName.trim();
    const normalizedBio = bio.trim();
    const normalizedAvatar = avatarUrl.trim();

    if (
      normalizedUsername &&
      !/^[a-z0-9_]{3,24}$/.test(normalizedUsername)
    ) {
      setError("Никнейм: от 3 до 24 символов, только латинские буквы, цифры и _.");
      return;
    }

    if (isPublic && !normalizedUsername) {
      setError("Чтобы открыть профиль, сначала укажи никнейм.");
      return;
    }

    if (normalizedName.length > 40) {
      setError("Отображаемое имя должно быть не длиннее 40 символов.");
      return;
    }

    if (normalizedBio.length > 300) {
      setError("Описание должно быть не длиннее 300 символов.");
      return;
    }

    if (normalizedAvatar && !/^https?:\/\/\S+$/i.test(normalizedAvatar)) {
      setError("Ссылка на аватар должна начинаться с http:// или https://.");
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();
      const { error: saveError } = await supabase
        .from("profiles")
        .update({
          username: normalizedUsername || null,
          display_name: normalizedName || null,
          avatar_url: normalizedAvatar || null,
          bio: normalizedBio || null,
          is_public: isPublic,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (saveError) {
        if (saveError.code === "23505") {
          setError("Этот никнейм уже занят. Выбери другой.");
        } else {
          setError("Не удалось сохранить профиль. Попробуй ещё раз.");
        }
        return;
      }

      setUsername(normalizedUsername);
      setSavedUsername(normalizedUsername || null);
      setDisplayName(normalizedName);
      setAvatarUrl(normalizedAvatar);
      setBio(normalizedBio);
      setNotice("Профиль сохранён.");
    } catch {
      setError("Не удалось подключиться к Supabase.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setSigningOut(true);

    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError("Не удалось выйти. Попробуй ещё раз.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Не удалось подключиться к сервису авторизации.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080810] px-4 py-12 text-white">
      <section className="mx-auto w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-purple-950/20 sm:p-9">
        <Link href="/" className="text-sm text-white/50 transition hover:text-white">
          ← На главную
        </Link>

        <p className="mt-8 text-sm font-semibold tracking-[0.25em] text-purple-300">
          SUBREEL
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          Мой профиль
        </h1>

        {loading ? (
          <p className="mt-6 text-sm text-white/60">Загружаем профиль...</p>
        ) : !userId ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm leading-6 text-white/60">
              Активная сессия не найдена. Войди или создай аккаунт, чтобы продолжить.
            </p>
            <Link
              href="/login"
              className="block rounded-xl bg-purple-500 px-4 py-3 text-center font-semibold transition hover:bg-purple-400"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="block text-center text-sm text-purple-300 hover:text-purple-200"
            >
              Создать аккаунт
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-white/45">Аккаунт</p>
              <p className="mt-1 break-all text-sm">{email || "Email не указан"}</p>
            </div>

            <Link href="/account/library" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm font-semibold transition hover:border-violet-400/40 hover:bg-white/[0.04]">
              Открыть мою библиотеку
            </Link>
            <Link href="/friends" className="ml-2 inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm font-semibold transition hover:border-violet-400/40 hover:bg-white/[0.04]">
              Друзья
            </Link>

            {avatarUrl && (
              <div className="mt-5 flex items-center gap-4">
                <img
                  src={avatarUrl}
                  alt="Предпросмотр аватара"
                  className="h-16 w-16 rounded-full border border-white/15 object-cover"
                />
                <p className="text-sm text-white/50">Предпросмотр аватара</p>
              </div>
            )}

            <form onSubmit={handleSave} className="mt-6 space-y-5">
              <div>
                <label htmlFor="username" className="mb-2 block text-sm text-white/75">
                  Никнейм
                </label>
                <input
                  id="username"
                  name="username"
                  autoComplete="nickname"
                  maxLength={24}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="например, subreel_user"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-purple-400"
                />
                <p className="mt-2 text-xs text-white/40">
                  3–24 символа: латинские буквы, цифры и подчёркивание.
                </p>
              </div>

              <div>
                <label htmlFor="displayName" className="mb-2 block text-sm text-white/75">
                  Отображаемое имя
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  autoComplete="name"
                  maxLength={40}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Как тебя будут видеть другие"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-purple-400"
                />
              </div>

              <div>
                <label htmlFor="avatarUrl" className="mb-2 block text-sm text-white/75">
                  Ссылка на аватар
                </label>
                <input
                  id="avatarUrl"
                  name="avatarUrl"
                  type="url"
                  maxLength={2048}
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-purple-400"
                />
              </div>

              <div>
                <label htmlFor="bio" className="mb-2 block text-sm text-white/75">
                  О себе
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  maxLength={300}
                  rows={4}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Расскажи немного о себе..."
                  className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-purple-400"
                />
                <p className="mt-2 text-right text-xs text-white/40">
                  {bio.length}/300
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 transition hover:border-purple-400/40">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(event) => setIsPublic(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-purple-500"
                />
                <span>
                  <span className="block text-sm font-medium text-white/85">Публичный профиль</span>
                  <span className="mt-1 block text-xs leading-5 text-white/50">
                    Другие смогут открыть страницу по никнейму и увидеть имя, аватар и описание. Библиотека и прогресс остаются приватными.
                  </span>
                </span>
              </label>

              {isPublic && savedUsername && username.trim().toLowerCase() === savedUsername && (
                <Link href={`/u/${encodeURIComponent(savedUsername)}`} className="inline-flex text-sm text-purple-300 transition hover:text-purple-200">
                  Открыть публичный профиль →
                </Link>
              )}

              {error && (
                <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </p>
              )}

              {notice && (
                <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-purple-500 px-4 py-3 font-semibold transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Сохраняем..." : "Сохранить профиль"}
              </button>
            </form>

            <div className="mt-8 border-t border-white/10 pt-6">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full rounded-xl border border-white/15 px-4 py-3 font-semibold transition hover:bg-white/10 disabled:opacity-60"
              >
                {signingOut ? "Выходим..." : "Выйти из аккаунта"}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
