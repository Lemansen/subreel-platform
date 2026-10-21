import "server-only";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "./admin";

export type ListedAuthUser = Pick<User, "id" | "email" | "created_at" | "app_metadata">;

export async function listAuthUsers() {
  const admin = createSupabaseAdminClient();
  if (!admin) return { admin: null, users: null, error: "missing-config" as const };

  const users: ListedAuthUser[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return { admin, users: null, error: "load-failed" as const };
    users.push(...data.users.map(({ id, email, created_at, app_metadata }) => ({ id, email, created_at, app_metadata })));
    if (data.users.length < 1000) return { admin, users, error: null };
  }

  return { admin, users: null, error: "too-many-users" as const };
}
