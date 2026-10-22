import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FriendsManager from "./friends-manager";

async function FriendsGate() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Ffriends");

  return <FriendsManager userId={user.id} />;
}

export default function FriendsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#080810] px-4 py-10 text-white"><div className="mx-auto max-w-3xl animate-pulse"><div className="h-9 w-40 rounded bg-white/10" /><div className="mt-6 h-12 rounded-xl bg-white/[0.05]" /><div className="mt-8 h-32 rounded-2xl bg-white/[0.04]" /></div></main>}>
      <FriendsGate />
    </Suspense>
  );
}
