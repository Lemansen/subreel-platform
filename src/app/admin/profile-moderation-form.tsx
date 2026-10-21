"use client";

import { setProfileModeration } from "./actions";

type Profile = { id: string; username: string | null; display_name: string | null; bio: string | null; is_public: boolean; is_suspended: boolean; suspension_reason: string | null; moderated_at: string | null };
const field = "w-full rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";

export function ProfileModerationForm({ profiles }: { profiles: Profile[] }) {
  if (profiles.length === 0) return <p className="mt-3 text-sm text-zinc-400">Профили пока не созданы.</p>;

  return <ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">
    {profiles.map((profile) => <li key={profile.id} className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{profile.display_name || profile.username || "Без имени"}</p>
          <p className="mt-1 text-xs text-zinc-500">{profile.username ? `@${profile.username}` : "Ник не задан"} · {profile.is_public ? "Публичный" : "Приватный"} · {profile.is_suspended ? "Ограничен модератором" : "Без ограничений"}</p>
          {profile.bio && <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-zinc-400">{profile.bio}</p>}
          {profile.suspension_reason && <p className="mt-2 text-sm text-amber-200">Причина: {profile.suspension_reason}</p>}
        </div>
        <span className="text-xs text-zinc-600">ID {profile.id.slice(0, 8)}</span>
      </div>
      {profile.is_suspended ? <form action={setProfileModeration} className="mt-4">
        <input type="hidden" name="user_id" value={profile.id}/><input type="hidden" name="suspend" value="false"/>
        <button className="rounded-xl border border-emerald-400/20 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-400/10" onClick={(event) => { if (!window.confirm("Снять ограничение? Профиль останется приватным; владелец сможет снова включить публичность.")) event.preventDefault(); }}>Снять ограничение</button>
      </form> : <form action={setProfileModeration} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="user_id" value={profile.id}/><input type="hidden" name="suspend" value="true"/>
        <input className={field} name="reason" maxLength={500} required placeholder="Причина ограничения" aria-label={`Причина ограничения профиля ${profile.username || profile.id.slice(0, 8)}`}/>
        <button className="shrink-0 rounded-xl border border-red-400/20 px-4 py-2 text-sm text-red-200 hover:bg-red-400/10" onClick={(event) => { if (!window.confirm("Скрыть профиль и запретить владельцу снова включить публичность до снятия ограничения?")) event.preventDefault(); }}>Ограничить публичность</button>
      </form>}
      {profile.moderated_at && <p className="mt-2 text-xs text-zinc-600">Последнее решение: {new Date(profile.moderated_at).toLocaleString("ru-RU")}</p>}
    </li>)}
  </ul>;
}
