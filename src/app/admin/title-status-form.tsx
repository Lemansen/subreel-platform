"use client";

import { useState } from "react";
import { setTitleStatus } from "./actions";

type Title = { id: string; name: string; slug: string; status: string };

const field = "w-full rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
const label = "mb-1.5 block text-sm text-zinc-300";
const button = "rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold hover:bg-violet-400";

export function TitleStatusForm({ titles }: { titles: Title[] }) {
  const [titleId, setTitleId] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("");

  function selectTitle(id: string) {
    const selected = titles.find((title) => title.id === id);
    setTitleId(id);
    setSlug(selected?.slug ?? "");
    setStatus(selected?.status ?? "");
  }

  return (
    <form action={setTitleStatus} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-xl font-bold">Статус и slug тайтла</h2>
      <label className={label}>
        Тайтл
        <select className={field} name="title_id" required value={titleId} onChange={(event) => selectTitle(event.target.value)}>
          <option value="" disabled>Выбери тайтл</option>
          {titles.map((title) => <option key={title.id} value={title.id}>{title.name} · {title.status}</option>)}
        </select>
      </label>
      <label className={label}>
        Slug (часть URL)
        <input className={field} name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={160} value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="my-title" />
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
      <button className={button} disabled={!titleId}>Сохранить статус и slug</button>
    </form>
  );
}
