"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { AppealForm } from "./appeal-form";

export type AccountProfile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
};

export type AccountSummary = {
  library: number | null;
  inProgress: number | null;
  completed: number | null;
  friends: number | null;
  incomingRequests: number | null;
};

type Values = { username: string; displayName: string; avatarUrl: string; bio: string; isPublic: boolean };
type Field = "username" | "displayName" | "avatarUrl" | "bio";
type Errors = Partial<Record<Field, string>>;

const fieldIds: Record<Field, string> = {
  username: "username",
  displayName: "displayName",
  avatarUrl: "avatarUrl",
  bio: "bio",
};
const fieldOrder: Field[] = ["username", "displayName", "avatarUrl", "bio"];

const inputClass = (invalid: boolean) =>
  `min-h-11 w-full rounded-xl border bg-surface-2 px-4 py-3 text-foreground outline-none transition placeholder:text-text-muted focus:border-accent ${
    invalid ? "border-danger/60" : "border-border-subtle"
  }`;

function toValues(profile: AccountProfile | null): Values {
  return {
    username: profile?.username ?? "",
    displayName: profile?.display_name ?? "",
    avatarUrl: profile?.avatar_url ?? "",
    bio: profile?.bio ?? "",
    isPublic: profile?.is_public ?? false,
  };
}

function normalize(values: Values): Values {
  return {
    username: values.username.trim().toLowerCase(),
    displayName: values.displayName.trim(),
    avatarUrl: values.avatarUrl.trim(),
    bio: values.bio.trim(),
    isPublic: values.isPublic,
  };
}

function validate(values: Values): Errors {
  const errors: Errors = {};
  if (values.username && !/^[a-z0-9_]{3,24}$/.test(values.username)) {
    errors.username = "От 3 до 24 символов: латинские буквы, цифры и _.";
  } else if (values.isPublic && !values.username) {
    errors.username = "Чтобы открыть профиль, сначала укажи никнейм.";
  }
  if (values.displayName.length > 40) errors.displayName = "Имя должно быть не длиннее 40 символов.";
  if (values.avatarUrl && !/^https?:\/\/\S+$/i.test(values.avatarUrl)) {
    errors.avatarUrl = "Ссылка должна начинаться с http:// или https://.";
  }
  if (values.bio.length > 300) errors.bio = "Описание должно быть не длиннее 300 символов.";
  return errors;
}

const same = (a: Values, b: Values) =>
  a.username === b.username && a.displayName === b.displayName && a.avatarUrl === b.avatarUrl && a.bio === b.bio && a.isPublic === b.isPublic;

function Stat({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <div className="min-w-0">
      <dd className="text-xl font-black">{value}</dd>
      <dt className="truncate text-xs text-text-muted">{label}</dt>
    </div>
  );
}

export default function AccountForm({
  userId,
  email,
  profile,
  appealStatus,
  summary,
  loadFailed,
}: {
  userId: string;
  email: string;
  profile: AccountProfile | null;
  appealStatus: string | null;
  summary: AccountSummary;
  loadFailed: boolean;
}) {
  const router = useRouter();
  const initial = toValues(profile);
  const [values, setValues] = useState<Values>(initial);
  const [saved, setSaved] = useState<Values>(initial);
  const [exists, setExists] = useState(profile !== null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [appeal, setAppeal] = useState(appealStatus);
  const noticeTimer = useRef<number | undefined>(undefined);
  const isSuspended = profile?.is_suspended ?? false;

  const dirty = !same(normalize(values), saved);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key !== "isPublic" && errors[key as Field]) setErrors((current) => ({ ...current, [key]: undefined }));
    if (key === "isPublic" && errors.username) setErrors((current) => ({ ...current, username: undefined }));
    setNotice("");
  }

  function discard() {
    setValues(saved);
    setErrors({});
    setFormError("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setNotice("");

    const next = normalize(values);
    const found = validate(next);
    setErrors(found);
    const firstInvalid = fieldOrder.find((field) => found[field]);
    if (firstInvalid) {
      document.getElementById(fieldIds[firstInvalid])?.focus();
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      if (!exists) {
        const { error: createError } = await supabase.from("profiles").insert({ id: userId });
        if (createError && createError.code !== "23505") {
          setFormError("Не удалось создать профиль. Обнови страницу и попробуй снова.");
          return;
        }
        setExists(true);
      }

      const { error: saveError } = await supabase
        .from("profiles")
        .update({
          username: next.username || null,
          display_name: next.displayName || null,
          avatar_url: next.avatarUrl || null,
          bio: next.bio || null,
          // При ограничении публичность менять нельзя, поле не отправляем.
          ...(isSuspended ? {} : { is_public: next.isPublic }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (saveError) {
        if (saveError.code === "23505") {
          setErrors({ username: "Этот никнейм уже занят. Выбери другой." });
          document.getElementById(fieldIds.username)?.focus();
        } else {
          setFormError("Не удалось сохранить профиль. Попробуй ещё раз.");
        }
        return;
      }

      const confirmed = isSuspended ? { ...next, isPublic: saved.isPublic } : next;
      setValues(confirmed);
      setSaved(confirmed);
      setNotice("Профиль сохранён");
      window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(""), 4000);
      router.refresh();
    } catch {
      setFormError("Нет соединения. Проверь интернет и попробуй снова.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSignOutError("");
    setSigningOut(true);
    try {
      const { error } = await createClient().auth.signOut();
      if (error) {
        setSignOutError("Не удалось выйти. Попробуй ещё раз.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setSignOutError("Нет соединения. Попробуй ещё раз.");
    } finally {
      setSigningOut(false);
    }
  }

  if (loadFailed) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Мой профиль</h1>
        <div role="alert" className="mt-8 rounded-2xl border border-warning/20 bg-warning/5 p-6 sm:p-8">
          <h2 className="font-semibold text-warning">Не удалось загрузить профиль</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">Твои данные на месте. Обнови страницу или загляни чуть позже.</p>
          <Link href="/account" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-border-subtle px-4 text-sm font-medium transition hover:bg-surface-2">
            Повторить
          </Link>
        </div>
      </div>
    );
  }

  const preview = normalize(values);
  const previewName = preview.displayName || preview.username || "Без имени";
  const publicPath = saved.isPublic && saved.username ? `/u/${encodeURIComponent(saved.username)}` : null;
  const showBar = dirty || Boolean(notice) || Boolean(formError);
  const hasSummary = summary.library !== null;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6 sm:pt-10 md:pb-16 lg:px-8">
      <section aria-label="Так выглядит твой профиль" className="overflow-hidden rounded-3xl border border-border-subtle bg-surface-1 shadow-2xl shadow-black/20">
        <div className="h-24 bg-[radial-gradient(ellipse_at_top_right,_rgba(124,58,237,0.34),_transparent_65%)] sm:h-32" />
        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-3 sm:-mt-14">
            <ProfileAvatar name={previewName} url={preview.avatarUrl || null} size="lg" className="border-4 border-surface-1" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-border-subtle bg-surface-2 px-3 text-xs font-medium text-text-secondary">
                <span aria-hidden className={`size-2 rounded-full ${saved.isPublic ? "bg-success" : "bg-text-muted"}`} />
                {saved.isPublic ? "Профиль виден всем" : "Профиль скрыт"}
              </span>
              {publicPath && (
                <Link href={publicPath} className="inline-flex min-h-11 items-center rounded-xl border border-accent/30 px-4 text-sm font-semibold text-accent transition hover:bg-accent/10">
                  Открыть публичную страницу
                </Link>
              )}
            </div>
          </div>
          <p className="mt-4 text-sm text-accent">{preview.username ? `@${preview.username}` : "Никнейм не задан"}</p>
          <h1 className="mt-1 break-words text-3xl font-black tracking-tight sm:text-4xl">{previewName}</h1>
          <p className="mt-3 max-w-prose whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">
            {preview.bio || "Расскажи о себе: описание увидят все, кто откроет твою публичную страницу."}
          </p>
          <p className="mt-4 break-all text-xs text-text-muted">Почту видишь только ты: {email || "не указана"}</p>
        </div>
      </section>

      {isSuspended && <AppealForm reason={profile?.suspension_reason ?? null} existingStatus={appeal} onSubmitted={() => setAppeal("open")} />}

      <div className="mt-6 grid gap-6 lg:grid-cols-[288px_minmax(0,1fr)]">
        <aside aria-label="Разделы аккаунта" className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <Link href="/account/library" className="group block rounded-2xl border border-border-subtle bg-surface-1 p-4 transition hover:border-accent/40 hover:bg-surface-2">
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold">Моя библиотека</span>
              <span aria-hidden className="text-text-muted transition group-hover:translate-x-0.5 group-hover:text-accent">›</span>
            </span>
            {hasSummary ? (
              <dl className="mt-3 grid grid-cols-3 gap-2">
                <Stat label="Всего" value={summary.library} />
                <Stat label="В процессе" value={summary.inProgress} />
                <Stat label="Завершено" value={summary.completed} />
              </dl>
            ) : (
              <span className="mt-1 block text-sm text-text-secondary">Статусы, избранное и места, где ты остановился.</span>
            )}
          </Link>

          <Link href="/friends" className="group block rounded-2xl border border-border-subtle bg-surface-1 p-4 transition hover:border-accent/40 hover:bg-surface-2">
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold">Друзья</span>
              <span className="flex items-center gap-2">
                {summary.incomingRequests ? (
                  <span className="rounded-full bg-accent-strong px-2 py-0.5 text-xs font-semibold text-white">
                    {summary.incomingRequests} {summary.incomingRequests === 1 ? "заявка" : "заявок"}
                  </span>
                ) : null}
                <span aria-hidden className="text-text-muted transition group-hover:translate-x-0.5 group-hover:text-accent">›</span>
              </span>
            </span>
            <span className="mt-1 block text-sm text-text-secondary">
              {summary.friends !== null ? `Друзей: ${summary.friends}. ` : ""}Заявки, поиск людей и блокировки.
            </span>
          </Link>

          <Link href="/minecraft/shop" className="group block rounded-2xl border border-border-subtle bg-surface-1 p-4 transition hover:border-accent/40 hover:bg-surface-2">
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold">Minecraft и SubCoins</span>
              <span aria-hidden className="text-text-muted transition group-hover:translate-x-0.5 group-hover:text-accent">›</span>
            </span>
            <span className="mt-1 block text-sm text-text-secondary">Игровая экономика, баланс и магазин — в одном месте профиля.</span>
          </Link>

          <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
            <p className="text-sm text-text-secondary">Вошёл как</p>
            <p className="mt-0.5 break-all text-sm font-medium">{email || "Почта не указана"}</p>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border-subtle px-4 text-sm font-semibold transition hover:bg-surface-2 disabled:opacity-60"
            >
              {signingOut ? "Выходим…" : "Выйти из аккаунта"}
            </button>
            {signOutError && <p role="alert" className="mt-2 text-sm text-danger">{signOutError}</p>}
          </div>
        </aside>

        <form onSubmit={handleSave} noValidate className="min-w-0 rounded-2xl border border-border-subtle bg-surface-1 p-5 sm:p-6">
          <h2 className="text-xl font-bold">Данные профиля</h2>
          <p className="mt-1 text-sm text-text-secondary">Карточка выше обновляется по мере ввода, но сохраняется только по кнопке.</p>

          <div className="mt-6 space-y-5">
            <div>
              <label htmlFor="username" className="mb-2 block text-sm text-text-secondary">Никнейм</label>
              <div className="relative">
                <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">@</span>
                <input
                  id="username"
                  name="username"
                  autoComplete="nickname"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={24}
                  value={values.username}
                  onChange={(event) => set("username", event.target.value.toLowerCase().replace(/\s/g, ""))}
                  aria-invalid={Boolean(errors.username)}
                  aria-describedby="username-hint"
                  placeholder="subreel_user"
                  className={`${inputClass(Boolean(errors.username))} pl-9`}
                />
              </div>
              <p id="username-hint" className={`mt-2 text-xs ${errors.username ? "text-danger" : "text-text-muted"}`} role={errors.username ? "alert" : undefined}>
                {errors.username ?? (preview.username && /^[a-z0-9_]{3,24}$/.test(preview.username) ? `Адрес страницы: /u/${preview.username}` : "3–24 символа: латинские буквы, цифры и подчёркивание.")}
              </p>
            </div>

            <div>
              <label htmlFor="displayName" className="mb-2 block text-sm text-text-secondary">Отображаемое имя</label>
              <input
                id="displayName"
                name="displayName"
                autoComplete="name"
                maxLength={40}
                value={values.displayName}
                onChange={(event) => set("displayName", event.target.value)}
                aria-invalid={Boolean(errors.displayName)}
                aria-describedby={errors.displayName ? "displayName-error" : undefined}
                placeholder="Как тебя будут видеть другие"
                className={inputClass(Boolean(errors.displayName))}
              />
              {errors.displayName && <p id="displayName-error" role="alert" className="mt-2 text-xs text-danger">{errors.displayName}</p>}
            </div>

            <div>
              <label htmlFor="avatarUrl" className="mb-2 block text-sm text-text-secondary">Ссылка на аватар</label>
              <div className="flex gap-2">
                <input
                  id="avatarUrl"
                  name="avatarUrl"
                  type="url"
                  inputMode="url"
                  maxLength={2048}
                  value={values.avatarUrl}
                  onChange={(event) => set("avatarUrl", event.target.value)}
                  aria-invalid={Boolean(errors.avatarUrl)}
                  aria-describedby="avatarUrl-hint"
                  placeholder="https://example.com/avatar.jpg"
                  className={inputClass(Boolean(errors.avatarUrl))}
                />
                {values.avatarUrl && (
                  <button
                    type="button"
                    onClick={() => set("avatarUrl", "")}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-border-subtle px-3 text-sm text-text-secondary transition hover:bg-surface-2 hover:text-foreground"
                  >
                    Убрать
                  </button>
                )}
              </div>
              <p id="avatarUrl-hint" className={`mt-2 text-xs ${errors.avatarUrl ? "text-danger" : "text-text-muted"}`} role={errors.avatarUrl ? "alert" : undefined}>
                {errors.avatarUrl ?? "Прямая ссылка на картинку. Превью видно в карточке выше."}
              </p>
            </div>

            <div>
              <label htmlFor="bio" className="mb-2 block text-sm text-text-secondary">О себе</label>
              <textarea
                id="bio"
                name="bio"
                maxLength={300}
                rows={4}
                value={values.bio}
                onChange={(event) => set("bio", event.target.value)}
                aria-invalid={Boolean(errors.bio)}
                aria-describedby="bio-hint"
                placeholder="Что любишь смотреть и читать?"
                className={`${inputClass(Boolean(errors.bio))} min-h-28 resize-y`}
              />
              <p id="bio-hint" className="mt-2 flex justify-between gap-3 text-xs">
                <span className={errors.bio ? "text-danger" : "text-text-muted"} role={errors.bio ? "alert" : undefined}>{errors.bio ?? ""}</span>
                <span className="text-text-muted">{values.bio.length}/300</span>
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-sm text-text-secondary">Приватность</h3>
              <label className={`flex items-start gap-4 rounded-xl border border-border-subtle bg-surface-2 p-4 transition ${isSuspended ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-accent/40"}`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Публичный профиль</span>
                  <span className="mt-1 block text-xs leading-5 text-text-secondary">
                    Другие смогут найти страницу по никнейму и увидят имя, аватар, описание и отзывы, которые ты сделал публичными. Библиотека и прогресс остаются приватными.
                  </span>
                </span>
                <span className="relative mt-0.5 inline-flex h-7 w-12 shrink-0">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={values.isPublic}
                    disabled={isSuspended}
                    onChange={(event) => set("isPublic", event.target.checked)}
                    className="peer sr-only"
                  />
                  <span aria-hidden className="absolute inset-0 rounded-full bg-border-subtle transition peer-checked:bg-accent-strong peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
                  <span aria-hidden className="absolute left-1 top-1 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </span>
              </label>
            </div>
          </div>

          <div
            className={`fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border-subtle bg-background/90 backdrop-blur-xl transition md:bottom-0 ${
              showBar ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
            }`}
            aria-hidden={!showBar}
          >
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
              {formError ? (
                <p role="alert" className="min-w-0 flex-1 text-sm text-danger">{formError}</p>
              ) : notice && !dirty ? (
                <p role="status" className="min-w-0 flex-1 text-sm text-success">{notice}</p>
              ) : (
                <p className="min-w-0 flex-1 text-sm text-text-secondary">Есть несохранённые изменения</p>
              )}
              {dirty && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={discard}
                    disabled={saving}
                    tabIndex={showBar ? 0 : -1}
                    className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-text-secondary transition hover:text-foreground disabled:opacity-50"
                  >
                    Отменить
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    tabIndex={showBar ? 0 : -1}
                    className="inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Сохраняем…" : "Сохранить"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
