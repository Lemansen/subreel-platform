"use client";

import { deleteGenre, updateGenre } from "./actions";

type Genre = { id: string; name: string; slug: string };

export function GenreManager({ genres }: { genres: Genre[] }) {
  if (!genres.length) return <p className="mt-3 text-sm text-zinc-400">Жанров пока нет.</p>;
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {genres.map((genre) => (
        <li key={genre.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <form action={updateGenre} className="grid gap-2">
            <input type="hidden" name="genre_id" value={genre.id}/>
            <label className="text-xs text-zinc-400">Название<input className="mt-1 w-full rounded-lg border border-white/10 bg-[#111119] px-3 py-2 text-sm text-white" name="name" required maxLength={120} defaultValue={genre.name}/></label>
            <label className="text-xs text-zinc-400">Slug<input className="mt-1 w-full rounded-lg border border-white/10 bg-[#111119] px-3 py-2 text-sm text-white" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} defaultValue={genre.slug}/></label>
            <p className="text-xs text-zinc-500">Удаление разрешено только если жанр не привязан к тайтлам.</p>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-lg border border-white/15 px-3 py-2 text-sm">Сохранить</button>
              <button formAction={deleteGenre} className="rounded-lg border border-red-400/20 px-3 py-2 text-sm text-red-300" onClick={(event) => {
                if (!window.confirm(`Удалить жанр «${genre.name}»?`)) event.preventDefault();
              }}>Удалить</button>
            </div>
          </form>
        </li>
      ))}
    </ul>
  );
}
