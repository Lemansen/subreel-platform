"use client";

import { useState } from "react";
import { updateEdition, updateVolume } from "./actions";

type Edition = { id: string; title_id: string; edition_kind: string; edition_number: number; name: string; language_code: string | null; description: string | null; status: string };
type Volume = { id: string; title_id: string; volume_number: number; name: string | null; description: string | null; status: string };
type Title = { id: string; name: string };
const field = "w-full rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
const label = "mb-1.5 block text-sm text-zinc-300";
const button = "rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50";

export function StructureEditor({ editions, volumes, titles }: { editions: Edition[]; volumes: Volume[]; titles: Title[] }) {
  const [editionId, setEditionId] = useState("");
  const [volumeId, setVolumeId] = useState("");
  const edition = editions.find((item) => item.id === editionId);
  const volume = volumes.find((item) => item.id === volumeId);

  return <section className="mt-8 grid gap-5 lg:grid-cols-2">
    <form key={edition?.id ?? "no-edition"} action={updateEdition} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-xl font-bold">Редактировать издание</h2>
      <label className={label}>Издание<select className={field} name="edition_id" required value={editionId} onChange={(event) => setEditionId(event.target.value)}><option value="" disabled>Выбери издание</option>{editions.map((item) => <option key={item.id} value={item.id}>{titles.find((title) => title.id === item.title_id)?.name} · {item.name}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Вид<select className={field} name="edition_kind" defaultValue={edition?.edition_kind ?? "graphic"} disabled={!edition}><option value="graphic">Графическое</option><option value="text">Текстовое</option></select></label><label className={label}>Номер<input className={field} name="edition_number" type="number" min={1} max={999999} defaultValue={edition?.edition_number ?? 1} required disabled={!edition}/></label></div>
      <label className={label}>Название<input className={field} name="name" maxLength={160} required defaultValue={edition?.name ?? ""} disabled={!edition}/></label>
      <label className={label}>Язык<input className={field} name="language_code" maxLength={35} defaultValue={edition?.language_code ?? ""} disabled={!edition}/></label>
      <label className={label}>Описание<textarea className={field} name="description" rows={3} maxLength={3000} defaultValue={edition?.description ?? ""} disabled={!edition}/></label>
      <label className={label}>Статус<select className={field} name="status" defaultValue={edition?.status ?? "draft"} disabled={!edition}><option value="draft">Черновик</option><option value="published">Опубликовано</option><option value="archived">Архив</option></select></label>
      <button className={button} disabled={!edition}>Сохранить издание</button>
    </form>

    <form key={volume?.id ?? "no-volume"} action={updateVolume} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-xl font-bold">Редактировать том</h2>
      <label className={label}>Том<select className={field} name="volume_id" required value={volumeId} onChange={(event) => setVolumeId(event.target.value)}><option value="" disabled>Выбери том</option>{volumes.map((item) => <option key={item.id} value={item.id}>{titles.find((title) => title.id === item.title_id)?.name} · {item.name || `Том ${item.volume_number}`}</option>)}</select></label>
      <label className={label}>Номер<input className={field} name="volume_number" type="number" min="0.01" max="99999.99" step="0.01" required defaultValue={volume?.volume_number ?? 1} disabled={!volume}/></label>
      <label className={label}>Название<input className={field} name="name" maxLength={160} defaultValue={volume?.name ?? ""} disabled={!volume}/></label>
      <label className={label}>Описание<textarea className={field} name="description" rows={3} maxLength={3000} defaultValue={volume?.description ?? ""} disabled={!volume}/></label>
      <label className={label}>Статус<select className={field} name="status" defaultValue={volume?.status ?? "draft"} disabled={!volume}><option value="draft">Черновик</option><option value="published">Опубликован</option><option value="archived">Архив</option></select></label>
      <button className={button} disabled={!volume}>Сохранить том</button>
    </form>
  </section>;
}
