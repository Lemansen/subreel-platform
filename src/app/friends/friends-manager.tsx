"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type RequestRow = { id: string; requester_id: string; addressee_id: string; status: "pending" | "accepted" | "rejected"; created_at: string };
type PublicProfile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
type BlockRow = { blocked_id: string };

const button = "rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";

export default function FriendsManager({ userId }: { userId: string }) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [{ data, error: requestError }, { data: blockRows, error: blockError }] = await Promise.all([
      supabase.from("friend_requests").select("id, requester_id, addressee_id, status, created_at")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`).order("created_at", { ascending: false }).limit(200),
      supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId),
    ]);
    if (requestError || blockError) throw requestError ?? blockError;
    const rows = (data ?? []) as RequestRow[];
    const ownBlocks = (blockRows ?? []) as BlockRow[];
    setRequests(rows);
    const ownBlockedIds = ownBlocks.map((row) => row.blocked_id);
    setBlockedIds(ownBlockedIds);
    const ids = [...new Set([...rows.flatMap((row) => [row.requester_id, row.addressee_id]), ...ownBlockedIds].filter((id) => id !== userId))];
    if (ids.length) {
      const { data: profileRows } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids);
      setProfiles(Object.fromEntries(((profileRows ?? []) as PublicProfile[]).map((profile) => [profile.id, profile])));
    } else setProfiles({});
  }, [userId]);

  useEffect(() => {
    // This is an async Supabase read; its result updates the screen after the network response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().catch(() => setError("Не удалось загрузить список друзей. Проверь применение миграции 021 в Supabase."))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const term = query.trim().replace(/^@/, "");
    if (term.length < 2) { setError("Введи минимум 2 символа никнейма."); return; }
    const supabase = createClient();
    const { data, error: searchError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .ilike("username", `%${term}%`)
      .neq("id", userId)
      .limit(20);
    if (searchError) { setError("Не удалось выполнить поиск профилей."); return; }
    setResults(((data ?? []) as PublicProfile[]).filter((profile) => !blockedIds.includes(profile.id)));
  }

  async function mutate(id: string, operation: "accept" | "reject" | "remove" | "send", targetId?: string) {
    setBusyId(id);
    setError("");
    setNotice("");
    const supabase = createClient();
    const result = operation === "send"
      ? await supabase.from("friend_requests").insert({ requester_id: userId, addressee_id: targetId! })
      : operation === "remove"
        ? await supabase.from("friend_requests").delete().eq("id", id)
        : await supabase.from("friend_requests").update({ status: operation === "accept" ? "accepted" : "rejected" }).eq("id", id).eq("status", "pending");
    if (result.error) {
      setError(operation === "send" ? "Заявка не отправлена. Возможно, она уже существует или профиль закрыл доступ." : "Не удалось обновить заявку.");
      setBusyId(null);
      return;
    }
    setNotice(operation === "send" ? "Заявка отправлена." : operation === "accept" ? "Заявка принята." : operation === "reject" ? "Заявка отклонена." : "Запись удалена.");
    if (operation === "send") setResults((current) => current.filter((profile) => profile.id !== targetId));
    await refresh().catch(() => setError("Изменение сохранено, но список не удалось обновить."));
    setBusyId(null);
  }

  async function blockUser(targetId: string) {
    setBusyId(targetId);
    setError("");
    setNotice("");
    const supabase = createClient();
    const { error: blockError } = await supabase.from("user_blocks").insert({ blocker_id: userId, blocked_id: targetId });
    if (blockError && blockError.code !== "23505") {
      setError("Не удалось заблокировать пользователя.");
      setBusyId(null);
      return;
    }
    const [forward, reverse] = await Promise.all([
      supabase.from("friend_requests").delete().eq("requester_id", userId).eq("addressee_id", targetId),
      supabase.from("friend_requests").delete().eq("requester_id", targetId).eq("addressee_id", userId),
    ]);
    setResults((current) => current.filter((profile) => profile.id !== targetId));
    setNotice("Пользователь заблокирован; заявки и дружба удалены.");
    if (forward.error || reverse.error) setError("Блокировка сохранена, но не все старые заявки удалось удалить.");
    await refresh().catch(() => setError("Блокировка сохранена, но список не удалось обновить."));
    setBusyId(null);
  }

  async function unblockUser(targetId: string) {
    setBusyId(targetId);
    setError("");
    setNotice("");
    const { error: unblockError } = await createClient().from("user_blocks").delete().eq("blocker_id", userId).eq("blocked_id", targetId);
    if (unblockError) setError("Не удалось снять блокировку.");
    else setNotice("Блокировка снята.");
    await refresh().catch(() => setError("Изменение сохранено, но список не удалось обновить."));
    setBusyId(null);
  }

  function profileName(id: string) {
    const profile = profiles[id];
    return profile?.display_name || (profile?.username ? `@${profile.username}` : "Закрытый профиль");
  }

  const accepted = requests.filter((row) => row.status === "accepted");
  const incoming = requests.filter((row) => row.status === "pending" && row.addressee_id === userId);
  const outgoing = requests.filter((row) => row.status === "pending" && row.requester_id === userId);

  return (
    <main className="min-h-screen bg-[#080810] px-4 py-10 text-white sm:py-14">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/account" className="text-sm text-violet-300 hover:text-violet-200">← Аккаунт</Link>
        <h1 className="mt-5 text-3xl font-black sm:text-4xl">Друзья</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">Поиск доступен по никнеймам пользователей с публичным профилем. Заявки и список друзей видны только участникам.</p>
        <form onSubmit={search} className="mt-7 flex gap-2">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти по никнейму" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 outline-none focus:border-violet-400" />
          <button className="rounded-xl bg-violet-500 px-4 py-3 font-bold transition hover:bg-violet-400">Найти</button>
        </form>
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}

        {results.length > 0 && <section className="mt-7"><h2 className="text-lg font-bold">Результаты поиска</h2><ul className="mt-3 grid gap-2">{results.map((profile) => {
          const incomingRequest = requests.find((row) => row.requester_id === profile.id && row.addressee_id === userId && row.status === "pending");
          const outgoingRequest = requests.find((row) => row.requester_id === userId && row.addressee_id === profile.id && row.status === "pending");
          const isFriend = requests.some((row) => row.status === "accepted" && [row.requester_id, row.addressee_id].includes(profile.id));
          return <li key={profile.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="min-w-0"><p className="truncate font-semibold">{profile.display_name || `@${profile.username}`}</p><p className="truncate text-sm text-zinc-500">@{profile.username}</p></div><div className="flex gap-2">{incomingRequest ? <button className={button} disabled={busyId === incomingRequest.id} onClick={() => void mutate(incomingRequest.id, "accept")}>Принять</button> : <button className={button} disabled={Boolean(outgoingRequest || isFriend) || busyId === profile.id} onClick={() => void mutate(profile.id, "send", profile.id)}>{isFriend ? "Уже друзья" : outgoingRequest ? "Заявка отправлена" : "Добавить"}</button>}<button className={button} disabled={busyId === profile.id} onClick={() => void blockUser(profile.id)}>Заблокировать</button></div></li>;
        })}</ul></section>}

        {loading ? <p className="mt-8 text-sm text-zinc-500">Загружаем…</p> : <div className="mt-9 grid gap-8">
          <section><h2 className="text-xl font-bold">Входящие заявки <span className="text-sm text-zinc-500">{incoming.length}</span></h2>{incoming.length ? <ul className="mt-3 grid gap-2">{incoming.map((row) => <li key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><span className="truncate font-semibold">{profileName(row.requester_id)}</span><div className="flex gap-2"><button className={button} disabled={busyId === row.id} onClick={() => void mutate(row.id, "accept")}>Принять</button><button className={button} disabled={busyId === row.id} onClick={() => void mutate(row.id, "reject")}>Отклонить</button></div></li>)}</ul> : <p className="mt-3 text-sm text-zinc-500">Новых заявок нет.</p>}</section>
          <section><h2 className="text-xl font-bold">Мои друзья <span className="text-sm text-zinc-500">{accepted.length}</span></h2>{accepted.length ? <ul className="mt-3 grid gap-2">{accepted.map((row) => { const friendId = row.requester_id === userId ? row.addressee_id : row.requester_id; return <li key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><Link href={profiles[friendId]?.username ? `/u/${profiles[friendId].username}` : "/friends"} className="truncate font-semibold hover:text-violet-200">{profileName(friendId)}</Link><div className="flex gap-2"><button className={button} disabled={busyId === row.id} onClick={() => void mutate(row.id, "remove")}>Удалить</button><button className={button} disabled={busyId === friendId} onClick={() => void blockUser(friendId)}>Заблокировать</button></div></li>; })}</ul> : <p className="mt-3 text-sm text-zinc-500">Пока никого нет.</p>}</section>
          <section><h2 className="text-xl font-bold">Отправленные заявки <span className="text-sm text-zinc-500">{outgoing.length}</span></h2>{outgoing.length ? <ul className="mt-3 grid gap-2">{outgoing.map((row) => <li key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><span className="truncate font-semibold">{profileName(row.addressee_id)}</span><button className={button} disabled={busyId === row.id} onClick={() => void mutate(row.id, "remove")}>Отменить</button></li>)}</ul> : <p className="mt-3 text-sm text-zinc-500">Отправленных заявок нет.</p>}</section>
          <section><h2 className="text-xl font-bold">Заблокированные <span className="text-sm text-zinc-500">{blockedIds.length}</span></h2>{blockedIds.length ? <ul className="mt-3 grid gap-2">{blockedIds.map((id) => <li key={id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><span className="truncate font-semibold">{profileName(id)}</span><button className={button} disabled={busyId === id} onClick={() => void unblockUser(id)}>Разблокировать</button></li>)}</ul> : <p className="mt-3 text-sm text-zinc-500">Список блокировок пуст.</p>}</section>
        </div>}
      </div>
    </main>
  );
}
