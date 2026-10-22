import { processCatalogImportJob } from "@/app/admin/import/actions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createSupabaseAdminClient();
  if (!db) return Response.json({ error: "Queue database client is not configured." }, { status: 503 });

  const now = new Date().toISOString();
  const { data: queued, error: queuedError } = await db.from("catalog_import_jobs").select("id").eq("status", "queued").order("created_at", { ascending: true }).limit(1);
  if (queuedError) return Response.json({ error: "Could not read queued jobs." }, { status: 500 });
  const remaining = queued?.length ? 0 : 1;
  const { data: expired, error: expiredError } = remaining
    ? await db.from("catalog_import_jobs").select("id").eq("status", "running").or(`lease_until.is.null,lease_until.lt.${now}`).order("lease_until", { ascending: true, nullsFirst: true }).limit(remaining)
    : { data: [], error: null };
  if (expiredError) return Response.json({ error: "Could not read expired jobs." }, { status: 500 });

  const jobs = [...(queued ?? []), ...(expired ?? [])];
  const results = [];
  for (const job of jobs) {
    let result;
    for (let batch = 0; batch < 12; batch += 1) {
      result = await processCatalogImportJob(job.id, secret);
      if (!result.ok || !result.summary || result.summary.status !== "queued") break;
    }
    results.push({ jobId: job.id, ok: result?.ok ?? false, status: result?.summary?.status ?? "error", progress: result?.summary?.progress ?? null });
  }

  return Response.json({ processedJobs: results.length, results }, { headers: { "Cache-Control": "no-store" } });
}
