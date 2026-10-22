"use client";

import { deleteReadingSource, deleteVideoSource, updateReadingSource, updateVideoSource } from "./actions";

type Source = {
  id: string;
  title_id: string;
  source_url: string;
  source_format: string;
  provider_name: string | null;
  language_code: string | null;
  quality_label?: string | null;
  rights_status: string;
  availability_status: string;
  publication_status: string;
};

const field = "w-full rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
const label = "mb-1.5 block text-sm text-zinc-300";
const button = "rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold hover:bg-violet-400";

export function SourceManager({ title, items, kind }: { title: string; items: Source[]; kind: "video" | "reading" }) {
  const formats = kind === "video" ? ["hls", "dash", "mp4", "embed"] : ["image_pages", "pdf", "epub", "html", "plain_text"];
  const updateAction = kind === "video" ? updateVideoSource : updateReadingSource;
  const deleteAction = kind === "video" ? deleteVideoSource : deleteReadingSource;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {items.length === 0 ? <p className="mt-3 text-sm text-zinc-500">Источников пока нет.</p> : (
        <ul className="mt-3 space-y-3">
          {items.map((source) => (
            <li key={source.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <form action={updateAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="source_id" value={source.id} />
                <label className={label}>HTTPS URL<input className={field} name="source_url" type="url" required maxLength={2048} defaultValue={source.source_url} /></label>
                <label className={label}>Формат<select className={field} name="source_format" defaultValue={source.source_format}>{formats.map((format) => <option key={format} value={format}>{format}</option>)}</select></label>
                <label className={label}>Провайдер<input className={field} name="provider_name" maxLength={120} defaultValue={source.provider_name ?? ""} /></label>
                <label className={label}>Язык<input className={field} name="language_code" maxLength={35} defaultValue={source.language_code ?? ""} /></label>
                {kind === "video" && <label className={label}>Качество<input className={field} name="quality_label" maxLength={80} defaultValue={source.quality_label ?? ""} /></label>}
                <label className={label}>Доступность<select className={field} name="availability_status" defaultValue={source.availability_status}><option value="available">Доступен</option><option value="pending">Проверяется</option><option value="unavailable">Недоступен</option></select></label>
                <label className={label}>Публикация<select className={field} name="publication_status" defaultValue={source.publication_status}><option value="draft">Черновик</option><option value="published">Опубликован</option><option value="disabled">Отключён</option></select></label>
                <label className="flex items-center gap-2 text-xs text-zinc-400 sm:col-span-2"><input type="checkbox" name="rights_confirmed" value="yes" />Подтверждаю права на распространение, если публикую источник.</label>
                <div className="flex flex-wrap gap-3 sm:col-span-2">
                  <button className={button}>Сохранить источник</button>
                  <button
                    formAction={deleteAction}
                    className="rounded-xl border border-red-400/20 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-400/10"
                    onClick={(event) => {
                      if (!window.confirm("Удалить источник без возможности восстановления?")) event.preventDefault();
                    }}
                  >Удалить источник</button>
                </div>
              </form>
              <p className="mt-2 break-all text-xs text-zinc-500">Запись: {source.id} · права: {source.rights_status}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
