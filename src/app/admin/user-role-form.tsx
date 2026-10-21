"use client";

import { useState } from "react";
import { setCatalogAdminRole } from "./actions";

type AdminUser = { id: string; email: string | null; role: string | null; createdAt: string };

export function UserRoleForm({ users, currentUserId }: { users: AdminUser[]; currentUserId: string }) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  return users.length === 0 ? <p className="mt-3 text-sm text-zinc-500">Пользователей пока нет.</p> : (
    <ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">
      {users.map((user) => {
        const isAdmin = user.role === "catalog_admin";
        const isSelf = user.id === currentUserId;
        return <li key={user.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="break-all font-medium">{user.email || "Почта не указана"}{isSelf ? " · это вы" : ""}</p>
            <p className="mt-1 text-xs text-zinc-500">{isAdmin ? "Администратор каталога" : "Пользователь"} · регистрация {new Date(user.createdAt).toLocaleDateString("ru-RU")}</p>
          </div>
          {isSelf ? <span className="text-xs text-zinc-500">Свою роль здесь менять нельзя</span> : <form action={setCatalogAdminRole} onSubmit={() => setPendingId(user.id)}>
            <input type="hidden" name="user_id" value={user.id}/>
            <input type="hidden" name="role" value={isAdmin ? "user" : "catalog_admin"}/>
            <button className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:border-violet-400 disabled:opacity-50" disabled={pendingId === user.id}>
              {pendingId === user.id ? "Сохраняем…" : isAdmin ? "Снять роль администратора" : "Назначить администратором"}
            </button>
          </form>}
        </li>;
      })}
    </ul>
  );
}
