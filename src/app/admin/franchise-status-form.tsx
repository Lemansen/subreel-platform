"use client";

import { useState } from "react";
import { deleteFranchise, setFranchiseStatus } from "./actions";

type Franchise = { id: string; name: string; slug: string; status: string; description: string | null; cover_url: string | null };

const field = "w-full rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
const label = "mb-1.5 block text-sm text-zinc-300";
const button = "rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50";

export function FranchiseStatusForm({ franchises }: { franchises: Franchise[] }) {
  const [franchiseId, setFranchiseId] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  function selectFranchise(id: string) {
    const selected = franchises.find((franchise) => franchise.id === id);
    setFranchiseId(id);
    setSlug(selected?.slug ?? "");
    setStatus(selected?.status ?? "");
    setName(selected?.name ?? "");
    setDescription(selected?.description ?? "");
    setCoverUrl(selected?.cover_url ?? "");
  }

  return (
    <form action={setFranchiseStatus} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-xl font-bold">Редактирование франшизы</h2>
      <label className={label}>
        Франшиза
        <select className={field} name="franchise_id" required value={franchiseId} onChange={(event) => selectFranchise(event.target.value)}>
          <option value="" disabled>Выбери франшизу</option>
          {franchises.map((franchise) => <option key={franchise.id} value={franchise.id}>{franchise.name} · {franchise.status}</option>)}
        </select>
      </label>
      <label className={label}>
        Название
        <input className={field} name="name" required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className={label}>
        Slug (часть URL)
        <input className={field} name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={160} value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="my-franchise" />
      </label>
      <label className={label}>
        Обложка (HTTPS)
        <input className={field} name="cover_url" type="url" maxLength={2048} value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} />
      </label>
      <label className={label}>
        Описание
        <textarea className={field} name="description" rows={3} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <label className={label}>
        Статус
        <select className={field} name="status" required value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="" disabled>Выбери статус</option>
          <option value="published">Опубликовать</option>
          <option value="draft">Черновик</option>
          <option value="archived">Архив</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-3">
        <button className={button} disabled={!franchiseId}>Сохранить франшизу</button>
        <button formAction={deleteFranchise} className="rounded-xl border border-red-400/20 px-4 py-2.5 text-sm font-semibold text-red-300 disabled:opacity-50" disabled={!franchiseId} onClick={(event) => {
          if (!window.confirm("Удалить эту франшизу? Удаление доступно только если к ней не привязаны тайтлы.")) event.preventDefault();
        }}>Удалить франшизу</button>
      </div>
    </form>
  );
}
