import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Wallet = { balance: number | string };
type Transaction = {
  id: string;
  delta: number | string;
  balance_after: number | string;
  reason: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export async function SubCoinsPanel({ userId }: { userId: string }) {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const [walletResult, transactionsResult] = await Promise.all([
    admin.from("subcoin_wallets").select("balance").eq("user_id", userId).maybeSingle(),
    admin.from("subcoin_transactions")
      .select("id,delta,balance_after,reason,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const missingSchema = Boolean(walletResult.error || transactionsResult.error);
  const wallet = walletResult.data as Wallet | null;
  const transactions = (transactionsResult.data ?? []) as Transaction[];
  const balance = wallet ? Number(wallet.balance) : 0;

  return (
    <section aria-labelledby="subcoins-title" className="mx-auto mt-6 max-w-5xl px-4 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-3xl border border-violet-400/20 bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.2),transparent_55%),linear-gradient(135deg,rgba(30,27,75,0.35),rgba(17,17,25,0.9))] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">SubReel · Rewards</p>
            <h2 id="subcoins-title" className="mt-2 text-xl font-black text-white sm:text-2xl">Мои SubCoins</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-300">Внутренняя валюта SubReel для будущих наград и цифровых возможностей платформы.</p>
          </div>
          <div className="min-w-36 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-xs text-zinc-400">Баланс</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-white">{missingSchema ? "—" : balance.toLocaleString("ru-RU")}</p>
            <p className="text-xs text-violet-300">SubCoins</p>
          </div>
        </div>

        {missingSchema ? (
          <p role="status" className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
            Кошелёк появится после настройки базы экономики. Сейчас баланс не изменяется и начисления недоступны.
          </p>
        ) : (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-white">Последние операции</h3>
            {transactions.length === 0 ? (
              <p className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">Пока операций нет. История начислений и списаний появится здесь.</p>
            ) : (
              <ul className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10 bg-black/20">
                {transactions.map((transaction) => {
                  const delta = Number(transaction.delta);
                  return (
                    <li key={transaction.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium text-white">{transaction.reason}</p>
                        <p className="mt-1 text-xs text-zinc-500">{formatDate(transaction.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold tabular-nums ${delta > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                          {delta > 0 ? "+" : ""}{delta.toLocaleString("ru-RU")}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">Баланс: {Number(transaction.balance_after).toLocaleString("ru-RU")}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
