"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function adjustSubCoins(formData: FormData) {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect("/login?next=%2Fadmin%2Fsubcoins");
  if (user.app_metadata?.role !== "catalog_admin") redirect("/");

  const userId = String(formData.get("user_id") ?? "").trim();
  const deltaRaw = String(formData.get("delta") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotency_key") ?? "").trim();
  const delta = Number(deltaRaw);

  if (!/^[0-9a-f-]{36}$/i.test(userId) ||
      !Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000 ||
      reason.length < 3 || reason.length > 500 ||
      !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    redirect("/admin/subcoins?error=invalid");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) redirect("/admin/subcoins?error=config");

  const result = await admin.rpc("admin_adjust_subcoins", {
    p_user_id: userId,
    p_actor_id: user.id,
    p_delta: delta,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  });

  if (result.error) {
    const code = result.error.message.includes("insufficient_subcoins")
      ? "insufficient"
      : result.error.message.includes("idempotency_key_conflict")
        ? "conflict"
        : "save";
    console.error("[admin-subcoins] Adjustment failed:", result.error.code);
    redirect(`/admin/subcoins?error=${code}`);
  }

  const row = Array.isArray(result.data) ? result.data[0] : null;
  redirect(`/admin/subcoins?success=${row?.was_duplicate ? "duplicate" : "saved"}`);
}
