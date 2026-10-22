"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppealForm } from "./appeal-form";

type Profile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
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
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState<string | null>(null);
  const [appealStatus, setAppealStatus] = useState<string | null>(null);

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
          .select("username, display_name, avatar_url, bio, is_public, is_suspended, suspension_reason")
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
            .select("username, display_name, avatar_url, bio, is_public, is_suspended, suspension_reason")
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
        setIsSuspended(profile.is_suspended ?? false);
        setSuspensionReason(profile.suspension_reason ?? null);
        if (profile.is_suspended) {
          const { data: appeal } = await supabase.from("moderation_appeals").select("status").eq("user_id", user.id).in("status", ["open", "in_review"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (active) setAppealStatus(appeal?.status ?? null);
        }
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
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <section className="mx-auto w-full max-w-2xl rounded-3xl border border-border-subtle bg-surface-1 p-6 shadow-2xl shadow-black/20 sm:p-9">
        <Link href="/" className="text-sm text-text-secondary transition hover:text-foreground">
          ← На главную
        </Link>

        <p className="mt-8 text-sm font-semibold tracking-[0.25em] text-accent">
          SUBREEL
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          Мой профиль
        </h1>

        {loading ? (
          <p className="mt-6 text-sm text-text-secondary">Загружаем профиль...</p>
        ) : !userId ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm leading-6 text-text-secondary">
              Активная сессия не найдена. Войди или создай аккаунт, чтобы продолжить.
            </p>
            <Link
              href="/login"
              className="block min-h-11 rounded-xl bg-accent-strong px-4 py-3 text-center font-semibold text-white transition hover:brightness-110"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-center text-sm text-accent hover:brightness-125"
            >
              Создать аккаунт
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-xl border border-border-subtle bg-surface-2 p-4">
              <p className="text-xs text-text-muted">Аккаунт</p>
              <p className="mt-1 break-all text-sm">{email || "Email не указан"}</p>
            </div>

            <Link href="/account/library" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm font-semibold transition hover:border-accent/40 hover:bg-surface-2">
              Открыть мою библиотеку
            </Link>
            <Link href="/friends" className="ml-2 inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm font-semibold transition hover:border-accent/40 hover:bg-surface-2">
              Друзья
            </Link>

            {isSuspended && <AppealForm reason={suspensionReason} existingStatus={appealStatus} onSubmitted={() => setAppealStatus("open")} />}

            {avatarUrl && (
              <div className="mt-5 flex items-center gap-4">
                <img
                  src={avatarUrl}
                  alt="Предпросмотр аватара"
                  className="h-16 w-16 rounded-full border border-border-subtle object-cover"
                />
                <p className="text-sm text-text-secondary">Предпросмотр аватара</p>
              </div>
            )}

            <form onSubmit={handleSave} className="mt-6 space-y-5">
              <div>
                <label htmlFor="username" className="mb-2 block text-sm text-text-secondary">
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
                  className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 text-foreground outline-none transition placeholder:text-text-muted focus:border-accent"
                />
                <p className="mt-2 text-xs text-text-muted">
                  3–24 символа: латинские буквы, цифры и подчёркивание.
                </p>
              </div>

              <div>
                <label htmlFor="displayName" className="mb-2 block text-sm text-text-secondary">
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
                  className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 text-foreground outline-none transition placeholder:text-text-muted focus:border-accent"
                />
              </div>

              <div>
                <label htmlFor="avatarUrl" className="mb-2 block text-sm text-text-secondary">
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
                  className="min-h-11 w-full rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 text-foreground outline-none transition placeholder:text-text-muted focus:border-accent"
                />
              </div>

              <div>
                <label htmlFor="bio" className="mb-2 block text-sm text-text-secondary">
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
                  className="min-h-28 w-full resize-y rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 text-foreground outline-none transition placeholder:text-text-muted focus:border-accent"
                />
                <p className="mt-2 text-right text-xs text-text-muted">
                  {bio.length}/300
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-subtle bg-surface-2 p-4 transition hover:border-accent/40">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(event) => setIsPublic(event.target.checked)}
                  className="mt-1 h-5 w-5 accent-accent"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">Публичный профиль</span>
                  <span className="mt-1 block text-xs leading-5 text-text-secondary">
                    Другие смогут открыть страницу по никнейму и увидеть имя, аватар и описание. Библиотека и прогресс остаются приватными.
                  </span>
                </span>
              </label>

              {isPublic && savedUsername && username.trim().toLowerCase() === savedUsername && (
                <Link href={`/u/${encodeURIComponent(savedUsername)}`} className="inline-flex min-h-11 items-center text-sm text-accent transition hover:brightness-125">
                  Открыть публичный профиль →
                </Link>
              )}

              {error && (
                <p role="alert" className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </p>
              )}

              {notice && (
                <p role="status" className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="min-h-11 w-full rounded-xl bg-accent-strong px-4 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Сохраняем..." : "Сохранить профиль"}
              </button>
            </form>

            <div className="mt-8 border-t border-border-subtle pt-6">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="min-h-11 w-full rounded-xl border border-border-subtle px-4 py-3 font-semibold transition hover:bg-surface-2 disabled:opacity-60"
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
