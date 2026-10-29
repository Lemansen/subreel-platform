import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listAuthUsers } from "@/lib/supabase/admin-users";
import { adjustSubCoins } from "./actions";

export const instant = false;

type Props = { searchParams: Promise<{ error?: string; success?: string; q?: string }> };
type Wallet = { user_id: string; balance: number; updated_at: string };
type Transaction = { id: string; user_id: string; actor_id: string | null; delta: number; balance_after: number; reason: string; created_at: string };

const input = "w-full rounded-xl border border-white/10 bg-[#111119] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400";
const label = "mb-1.5 block text-sm text-zinc-300";

export default async function AdminSubCoinsPage({ searchParams }: Props) {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect("/login?next=%2Fadmin%2Fsubcoins");
  if (user.app_metadata?.role !== "catalog_admin") redirect("/");

  const query = await searchParams;
  const admin = createSupabaseAdminClient();
  let wallets: Wallet[] = [];
  let transactions: Transaction[] = [];
  let schemaError = !admin;

  if (admin) {
    const [walletResult, transactionResult] = await Promise.all([
      admin.from("subcoin_wallets").select("user_id,balance,updated_at").order("updated_at", { ascending: false }).limit(500),
      admin.from("subcoin_transactions").select("id,user_id,actor_id,delta,balance_after,reason,created_at").order("created_at", { ascending: false }).limit(100),
    ]);
    if (walletResult.error || transactionResult.error) {
      schemaError = true;
      console.error("[admin-subcoins] Failed to load economy tables:", walletResult.error?.code, transactionResult.error?.code);
    } else {
      wallets = (walletResult.data ?? []) as Wallet[];
      transactions = (transactionResult.data ?? []) as Transaction[];
    }
  }

  const authUsersResult = await listAuthUsers();
  const authUsers = authUsersResult.users ?? [];
  const userLabels = new Map(authUsers.map((item) => [item.id, item.email ?? item.id]));
  const q = query.q?.trim().toLowerCase() ?? "";
  const filteredWallets = wallets.filter((wallet) => {
    const label = userLabels.get(wallet.user_id) ?? wallet.user_id;
    return !q || label.toLowerCase().includes(q) || wallet.user_id.toLowerCase().includes(q);
  });
  const totalBalance = wallets.reduce((sum, wallet) => sum + Number(wallet.balance), 0);

  const errors: Record<string, string> = {
    invalid: "Проверь UUID пользователя, сумму и причину операции.",
    config: "Не настроен серверный доступ к Supabase.",
    insufficient: "Недостаточно SubCoins на балансе для списания.",
    conflict: "Ключ операции уже использован для других параметров. Повтори действие с новой загрузкой страницы.",
    save: "Не удалось провести операцию. Проверь применение миграции и серверные журналы.",
  };
  const successText = query.success === "duplicate"
    ? "Повтор запроса распознан: новая транзакция не создана."
    : query.success === "saved" ? "Транзакция записана, баланс обновлён атомарно." : null;

  return <>
    <SiteHeader />
    <main className="mx-auto min-h-screen max-w-6xl space-y-8 px-4 py-6 text-white sm:px-6 sm:py-10">
      <section className="rounded-3xl border border-violet-400/20 bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.22),transparent_55%),linear-gradient(135deg,rgba(30,27,75,0.45),rgba(17,17,25,0.95))] p-5 sm:p-8">
        <Link href="/admin" className="text-sm text-violet-300 hover:text-violet-200">← Админ-панель</Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">SubReel · Economy</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">SubCoins</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">Кошельки, история операций и ручные корректировки. Каждая операция создаёт неизменяемую запись, проверяет достаточность баланса и защищена ключом идемпотентности.</p>
        <div className="mt-4 flex flex-wrap gap-2"><Link href="/admin/minecraft" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">Minecraft-профили</Link><Link href="/admin/launcher-releases" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">Релизы лаунчера</Link></div>
      </section>

      {schemaError && <div role="alert" className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100"><p className="font-semibold">Схема экономики ещё не доступна</p><p className="mt-1">Сначала проверь и примени миграцию `20261028072000_subcoins_ledger.sql` в целевой базе. До этого страница не проводит операции.</p></div>}
      {query.error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{errors[query.error] ?? errors.save}</p>}
      {successText && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{successText}</p>}

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-zinc-400">Кошельков</p><p className="mt-2 text-2xl font-black tabular-nums">{wallets.length}</p><p className="mt-1 text-xs text-zinc-500">В выборке до 500</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-zinc-400">Суммарный баланс</p><p className="mt-2 text-2xl font-black tabular-nums">{totalBalance.toLocaleString("ru-RU")}</p><p className="mt-1 text-xs text-zinc-500">SubCoins, только загруженные кошельки</p></article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-zinc-400">Последние транзакции</p><p className="mt-2 text-2xl font-black tabular-nums">{transactions.length}</p><p className="mt-1 text-xs text-zinc-500">До 100 записей</p></article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <form action={adjustSubCoins} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div><h2 className="text-xl font-bold">Корректировка баланса</h2><p className="mt-1 text-sm text-zinc-400">Положительная сумма начисляет, отрицательная — списывает.</p></div>
          <label><span className={label}>SubReel ID пользователя</span><select name="user_id" required className={input} defaultValue=""><option value="" disabled>Выбери пользователя</option>{authUsers.map((item) => <option key={item.id} value={item.id}>{item.email ?? item.id} · {item.id.slice(0, 8)}</option>)}</select></label>
          <label><span className={label}>Изменение SubCoins</span><input name="delta" type="number" min="-1000000" max="1000000" step="1" required className={input} placeholder="Например, 100 или -25"/></label>
          <label><span className={label}>Причина операции</span><textarea name="reason" minLength={3} maxLength={500} required rows={3} className={input} placeholder="Например, компенсация за сбой лаунчера"/></label>
          <input type="hidden" name="idempotency_key" value={crypto.randomUUID()} />
          <button disabled={schemaError || !authUsers.length} className="rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">Провести операцию</button>
          <p className="text-xs leading-5 text-zinc-500">Лимит ±1 000 000 за операцию. Списание не может увести баланс ниже нуля. Операции нельзя удалить из журнала.</p>
        </form>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">Кошельки пользователей</h2>
          <form action="/admin/subcoins" method="get" className="flex gap-2"><input name="q" defaultValue={q} placeholder="Email или UUID" className={input}/><button className="rounded-xl border border-white/10 px-4 text-sm hover:bg-white/5">Найти</button></form>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {schemaError ? <p className="p-4 text-sm text-zinc-500">Нет данных до применения миграции.</p> : filteredWallets.length === 0 ? <p className="p-4 text-sm text-zinc-500">Кошельков пока нет.</p> : <ul className="divide-y divide-white/10">{filteredWallets.map((wallet) => <li key={wallet.user_id} className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate text-sm font-medium">{userLabels.get(wallet.user_id) ?? wallet.user_id}</p><p className="mt-1 font-mono text-xs text-zinc-500">{wallet.user_id}</p></div><p className="shrink-0 font-semibold tabular-nums">{Number(wallet.balance).toLocaleString("ru-RU")} <span className="text-xs text-violet-300">SC</span></p></li>)}</ul>}
          </div>
        </section>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">История операций</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          {schemaError ? <p className="p-4 text-sm text-zinc-500">Журнал станет доступен после применения миграции.</p> : transactions.length === 0 ? <p className="p-4 text-sm text-zinc-500">Транзакций пока нет.</p> : <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-4 py-3 font-medium">Пользователь</th><th className="px-4 py-3 font-medium">Изменение</th><th className="px-4 py-3 font-medium">Баланс после</th><th className="px-4 py-3 font-medium">Причина</th><th className="px-4 py-3 font-medium">Дата</th></tr></thead><tbody className="divide-y divide-white/10">{transactions.map((tx) => <tr key={tx.id}><td className="px-4 py-3 text-xs text-zinc-300">{userLabels.get(tx.user_id) ?? tx.user_id}</td><td className={`px-4 py-3 font-semibold tabular-nums ${tx.delta > 0 ? "text-emerald-300" : "text-rose-300"}`}>{tx.delta > 0 ? "+" : ""}{Number(tx.delta).toLocaleString("ru-RU")} SC</td><td className="px-4 py-3 tabular-nums">{Number(tx.balance_after).toLocaleString("ru-RU")}</td><td className="max-w-xs whitespace-normal px-4 py-3 text-zinc-300">{tx.reason}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">{new Date(tx.created_at).toLocaleString("ru-RU")}</td></tr>)}</tbody></table>}
        </div>
      </section>
    </main>
  </>;
}
