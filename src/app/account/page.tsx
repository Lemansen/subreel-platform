import { Suspense } from "react";
import { redirect } from "next/navigation";
import AccountForm from "./account-form";
import { createClient } from "@/lib/supabase/server";

async function AccountGate() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return <AccountForm />;
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#080810] px-4 py-12 text-white">
          <section className="mx-auto w-full max-w-2xl animate-pulse rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-9">
            <div className="h-4 w-20 rounded bg-white/10" />
            <div className="mt-8 h-9 w-48 rounded bg-white/10" />
            <div className="mt-8 h-14 rounded-xl bg-white/[0.06]" />
            <div className="mt-5 h-14 rounded-xl bg-white/[0.06]" />
            <div className="mt-5 h-14 rounded-xl bg-white/[0.06]" />
          </section>
        </main>
      }
    >
      <AccountGate />
    </Suspense>
  );
}
