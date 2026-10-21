"use client";

import { useState } from "react";
import { contentLabels } from "@/lib/catalog";
import { updateTitle } from "./actions";

type Title = {
  id: string; name: string; original_name: string | null; slug: string;
  content_type: string; status: string; release_year: number | null;
  franchise_id: string | null; description: string | null;
  cover_url: string | null; banner_url: string | null;
};
type Franchise = { id: string; name: string; status: string };

const field = "w-full rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
const label = "mb-1.5 block text-sm text-zinc-300";
const button = "rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50";

export function TitleStatusForm({ titles, franchises }: { titles: Title[]; franchises: Franchise[] }) {
  const [titleId, setTitleId] = useState("");
  const selected = titles.find((title) => title.id === titleId);

  return (
    <form key={selected?.id ?? "empty"} action={updateTitle} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-xl font-bold">Редактировать тайтл</h2>
      <label className={label}>
        Тайтл
        <select className={field} name="title_id" required value={titleId} onChange={(event) => setTitleId(event.target.value)}>
          <option value="" disabled>Выбери тайтл</option>
          {titles.map((title) => <option key={title.id} value={title.id}>{title.name} · {title.status}</option>)}
        </select>
      </label>
      <label className={label}>Название<input className={field} name="name" required maxLength={160} defaultValue={selected?.name ?? ""} disabled={!selected} /></label>
      <label className={label}>Оригинальное название<input className={field} name="original_name" maxLength={200} defaultValue={selected?.original_name ?? ""} disabled={!selected} /></label>
      <label className={label}>Slug<input className={field} name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={160} defaultValue={selected?.slug ?? ""} disabled={!selected} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Тип<select className={field} name="content_type" defaultValue={selected?.content_type ?? "anime"} disabled={!selected}>{Object.entries(contentLabels).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
        <label className={label}>Статус<select className={field} name="status" defaultValue={selected?.status ?? "draft"} disabled={!selected}><option value="draft">Черновик</option><option value="published">Опубликован</option><option value="archived">Архив</option></select></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Год<input className={field} name="release_year" type="number" min={1800} max={2200} defaultValue={selected?.release_year ?? ""} disabled={!selected} /></label>
        <label className={label}>Франшиза<select className={field} name="franchise_id" defaultValue={selected?.franchise_id ?? ""} disabled={!selected}><option value="">Без франшизы</option>{franchises.map((franchise) => <option key={franchise.id} value={franchise.id}>{franchise.name} · {franchise.status}</option>)}</select></label>
      </div>
      <label className={label}>Обложка (HTTPS)<input className={field} name="cover_url" type="url" maxLength={2048} defaultValue={selected?.cover_url ?? ""} disabled={!selected} /></label>
      <label className={label}>Баннер (HTTPS)<input className={field} name="banner_url" type="url" maxLength={2048} defaultValue={selected?.banner_url ?? ""} disabled={!selected} /></label>
      <label className={label}>Описание<textarea className={field} name="description" rows={4} maxLength={5000} defaultValue={selected?.description ?? ""} disabled={!selected} /></label>
      <button className={button} disabled={!selected}>Сохранить изменения</button>
    </form>
  );
}
