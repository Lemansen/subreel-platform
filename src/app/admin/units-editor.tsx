"use client";

import { useState } from "react";
import { updateChapter, updateEpisode, updateSeason } from "./actions";

type Title = { id: string; name: string };
type Season = { id: string; title_id: string; season_number: number; name: string | null; description: string | null; status: string };
type Episode = { id: string; title_id: string; season_id: string | null; episode_number: number; sort_order: number; name: string | null; description: string | null; duration_seconds: number | null; release_date: string | null; status: string };
type Chapter = { id: string; title_id: string; chapter_label: string; chapter_number: number | null; sort_order: number; name: string | null; description: string | null; release_date: string | null; status: string };
const field = "w-full rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
const label = "mb-1.5 block text-sm text-zinc-300";
const button = "rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50";
const statusOptions = <><option value="draft">Черновик</option><option value="published">Опубликовано</option><option value="archived">Архив</option></>;

export function UnitsEditor({ titles, videoTitles, readingTitles, seasons, episodes, chapters, initialSeasonId, initialEpisodeId, initialChapterId }: { titles: Title[]; videoTitles: Title[]; readingTitles: Title[]; seasons: Season[]; episodes: Episode[]; chapters: Chapter[]; initialSeasonId?: string; initialEpisodeId?: string; initialChapterId?: string }) {
  const [seasonId, setSeasonId] = useState(initialSeasonId ?? "");
  const [episodeId, setEpisodeId] = useState(initialEpisodeId ?? "");
  const [chapterId, setChapterId] = useState(initialChapterId ?? "");
  const season = seasons.find((item) => item.id === seasonId);
  const episode = episodes.find((item) => item.id === episodeId);
  const chapter = chapters.find((item) => item.id === chapterId);
  const titleName = (id: string) => titles.find((title) => title.id === id)?.name ?? "Тайтл";

  return <section className="mt-8 grid gap-5 lg:grid-cols-2">
    <form key={season?.id ?? "no-season"} action={updateSeason} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-xl font-bold">Редактировать сезон</h2>
      <label className={label}>Сезон<select className={field} name="season_id" required value={seasonId} onChange={(event) => setSeasonId(event.target.value)}><option value="" disabled>Выбери сезон</option>{seasons.filter((item) => videoTitles.some((title) => title.id === item.title_id)).map((item) => <option key={item.id} value={item.id}>{titleName(item.title_id)} · {item.name || `Сезон ${item.season_number}`}</option>)}</select></label>
      <label className={label}>Номер<input className={field} name="season_number" type="number" min={1} max={9999} required defaultValue={season?.season_number ?? 1} disabled={!season}/></label>
      <label className={label}>Название<input className={field} name="name" maxLength={160} defaultValue={season?.name ?? ""} disabled={!season}/></label>
      <label className={label}>Описание<textarea className={field} name="description" rows={3} maxLength={3000} defaultValue={season?.description ?? ""} disabled={!season}/></label>
      <label className={label}>Статус<select className={field} name="status" defaultValue={season?.status ?? "draft"} disabled={!season}>{statusOptions}</select></label>
      <button className={button} disabled={!season}>Сохранить сезон</button>
    </form>

    <form key={episode?.id ?? "no-episode"} action={updateEpisode} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-xl font-bold">Редактировать серию</h2>
      <label className={label}>Серия<select className={field} name="episode_id" required value={episodeId} onChange={(event) => setEpisodeId(event.target.value)}><option value="" disabled>Выбери серию</option>{episodes.filter((item) => videoTitles.some((title) => title.id === item.title_id)).map((item) => <option key={item.id} value={item.id}>{titleName(item.title_id)} · серия {item.episode_number}{item.name ? ` · ${item.name}` : ""}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Номер серии<input className={field} name="episode_number" type="number" min="0.01" max="99999.99" step="0.01" required defaultValue={episode?.episode_number ?? 1} disabled={!episode}/></label><label className={label}>Порядок<input className={field} name="sort_order" type="number" min={1} max={99999999} required defaultValue={episode?.sort_order ?? 1} disabled={!episode}/></label></div>
      <label className={label}>Название<input className={field} name="name" maxLength={160} defaultValue={episode?.name ?? ""} disabled={!episode}/></label>
      <label className={label}>Описание<textarea className={field} name="description" rows={3} maxLength={3000} defaultValue={episode?.description ?? ""} disabled={!episode}/></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Длительность, секунд<input className={field} name="duration_seconds" type="number" min={1} max={2147483647} defaultValue={episode?.duration_seconds ?? ""} disabled={!episode}/></label><label className={label}>Дата выхода<input className={field} name="release_date" type="date" defaultValue={episode?.release_date ?? ""} disabled={!episode}/></label></div>
      <label className={label}>Статус<select className={field} name="status" defaultValue={episode?.status ?? "draft"} disabled={!episode}>{statusOptions}</select></label>
      <button className={button} disabled={!episode}>Сохранить серию</button>
    </form>

    <form key={chapter?.id ?? "no-chapter"} action={updateChapter} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-xl font-bold">Редактировать главу</h2>
      <label className={label}>Глава<select className={field} name="chapter_id" required value={chapterId} onChange={(event) => setChapterId(event.target.value)}><option value="" disabled>Выбери главу</option>{chapters.filter((item) => readingTitles.some((title) => title.id === item.title_id)).map((item) => <option key={item.id} value={item.id}>{titleName(item.title_id)} · {item.chapter_label}{item.name ? ` · ${item.name}` : ""}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Номер или метка<input className={field} name="chapter_label" maxLength={80} required defaultValue={chapter?.chapter_label ?? ""} disabled={!chapter}/></label><label className={label}>Порядок<input className={field} name="sort_order" type="number" min={1} max={99999999} required defaultValue={chapter?.sort_order ?? 1} disabled={!chapter}/></label></div>
      <label className={label}>Название<input className={field} name="name" maxLength={160} defaultValue={chapter?.name ?? ""} disabled={!chapter}/></label>
      <label className={label}>Описание<textarea className={field} name="description" rows={3} maxLength={3000} defaultValue={chapter?.description ?? ""} disabled={!chapter}/></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Дата выхода<input className={field} name="release_date" type="date" defaultValue={chapter?.release_date ?? ""} disabled={!chapter}/></label><label className={label}>Статус<select className={field} name="status" defaultValue={chapter?.status ?? "draft"} disabled={!chapter}>{statusOptions}</select></label></div>
      <button className={button} disabled={!chapter}>Сохранить главу</button>
    </form>
  </section>;
}
