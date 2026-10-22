"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeTitleReview, saveTitleReview } from "@/app/reviews/actions";

export type ReviewItem = { id: string; userId: string; name: string; rating: number; body: string; createdAt: string };
type InitialReview = { rating: number; body: string; isPublic: boolean } | null;

export function TitleReviews({
  titleId, slug, signedIn, initialReview, reviews, average, count, available,
}: {
  titleId: string; slug: string; signedIn: boolean; initialReview: InitialReview;
  reviews: ReviewItem[]; average: number; count: number; available: boolean;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(initialReview?.rating ?? 0);
  const [body, setBody] = useState(initialReview?.body ?? "");
  const [isPublic, setIsPublic] = useState(initialReview?.isPublic ?? false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setMessage("");
    if (rating < 1 || rating > 10) { setMessage("Выбери оценку от 1 до 10."); return; }
    setPending(true);
    const result = await saveTitleReview(titleId, rating, body, isPublic);
    setPending(false);
    if (!result.ok) {
      setMessage(result.reason === "sign-in" ? "Войди в аккаунт, чтобы сохранить оценку." : result.reason === "invalid" ? "Проверь текст отзыва (до 3000 символов)." : result.reason === "title" ? "Этот тайтл сейчас недоступен." : "Не удалось сохранить. Проверь, применена ли миграция 019.");
      return;
    }
    setMessage("Оценка сохранена.");
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Удалить свою оценку и отзыв?")) return;
    setPending(true);
    setMessage("");
    const result = await removeTitleReview(titleId);
    setPending(false);
    if (!result.ok) { setMessage("Не удалось удалить. Попробуй ещё раз."); return; }
    setRating(0); setBody(""); setIsPublic(false);
    setMessage("Оценка удалена.");
    router.refresh();
  }

  return <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="text-2xl font-bold tracking-tight">Оценки и отзывы</h2><p className="mt-2 text-sm text-text-secondary">{count ? `${average.toFixed(1)} из 10 · ${count} ${count === 1 ? "оценка" : "оценок"}` : "Публичных оценок пока нет"}</p></div>
      <span aria-label={`Средняя оценка ${average} из 10`} className="text-3xl font-black text-accent">{count ? average.toFixed(1) : "—"}<span className="text-base text-text-muted"> / 10</span></span>
    </div>

    {!available ? <p role="status" className="mt-5 rounded-xl border border-warning/20 bg-warning/5 p-4 text-sm text-warning">Для оценок нужно применить миграцию 019.</p> : <>
      {signedIn ? <div className="mt-6 max-w-2xl rounded-2xl border border-border-subtle bg-surface-1 p-5">
        <h3 className="font-semibold">{initialReview ? "Твоя оценка" : "Оцени произведение"}</h3>
        <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="Оценка от 1 до 10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => <button key={value} type="button" aria-label={`${value} из 10`} aria-pressed={rating === value} onClick={() => setRating(value)} disabled={pending} className={`grid size-11 place-items-center rounded-lg text-sm font-semibold transition ${rating >= value ? "bg-accent-strong text-white" : "bg-surface-2 text-text-secondary hover:bg-surface-hover"}`}>{value}</button>)}
        </div>
        <label className="mt-4 block text-sm text-text-secondary">Отзыв <span className="text-text-muted">(необязательно)</span>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={3000} rows={4} disabled={pending} placeholder="Поделись впечатлением без спойлеров…" className="mt-2 w-full rounded-xl border border-border-subtle bg-surface-1 px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent" />
          <span className="mt-1 block text-right text-xs text-text-muted">{body.length}/3000</span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm leading-5 text-text-secondary"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} disabled={pending} className="mt-1 accent-accent"/><span>Показывать мою оценку и отзыв публично. Без этого согласия они видны только мне. Для публикации также должен быть открыт профиль.</span></label>
        {message && <p role="status" className="mt-3 text-sm text-accent">{message}</p>}
        <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={save} disabled={pending} className="min-h-11 rounded-xl bg-accent-strong px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">{pending ? "Сохраняем…" : "Сохранить оценку"}</button>{initialReview && <button type="button" onClick={remove} disabled={pending} className="min-h-11 rounded-xl border border-border-subtle px-4 text-sm text-text-secondary hover:border-danger/40 hover:text-danger disabled:opacity-50">Удалить</button>}</div>
      </div> : <p className="mt-6 rounded-xl border border-border-subtle p-4 text-sm text-text-secondary"><Link className="text-accent hover:brightness-125" href={`/login?next=${encodeURIComponent(`/title/${slug}`)}`}>Войди</Link>, чтобы оставить оценку.</p>}

      {reviews.length > 0 && <ul className="mt-8 grid gap-3 md:grid-cols-2">{reviews.map((review) => <li key={review.id} className="rounded-2xl border border-border-subtle bg-surface-1 p-5"><div className="flex items-center justify-between gap-3"><p className="truncate font-medium">{review.name}</p><span className="shrink-0 rounded-lg bg-accent/15 px-2.5 py-1 text-sm font-bold text-accent">{review.rating}/10</span></div><time className="mt-1 block text-xs text-text-muted">{new Date(review.createdAt).toLocaleDateString("ru-RU")}</time>{review.body && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-text-secondary">{review.body}</p>}</li>)}</ul>}
    </>}
  </section>;
}
