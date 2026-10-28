-- SubCoins wallet and immutable transaction ledger.
-- Apply only after reviewing the corresponding server-side admin action.
create table if not exists public.subcoin_wallets (
  user_id uuid primary key references auth.users(id) on delete restrict,
  balance bigint not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subcoin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  delta bigint not null check (delta <> 0 and abs(delta) <= 1000000),
  balance_after bigint not null check (balance_after >= 0),
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);

create index if not exists subcoin_transactions_user_created_idx
  on public.subcoin_transactions (user_id, created_at desc);
create index if not exists subcoin_transactions_actor_created_idx
  on public.subcoin_transactions (actor_id, created_at desc);

alter table public.subcoin_wallets enable row level security;
alter table public.subcoin_transactions enable row level security;

-- No direct browser access. All reads and writes go through guarded server code.
revoke all on public.subcoin_wallets from anon, authenticated;
revoke all on public.subcoin_transactions from anon, authenticated;
grant select on public.subcoin_wallets to service_role;
grant select on public.subcoin_transactions to service_role;
revoke insert, update, delete, truncate on public.subcoin_wallets from anon, authenticated, service_role;
revoke insert, update, delete, truncate on public.subcoin_transactions from anon, authenticated, service_role;

create or replace function public.admin_adjust_subcoins(
  p_user_id uuid,
  p_actor_id uuid,
  p_delta bigint,
  p_reason text,
  p_idempotency_key uuid
)
returns table (
  transaction_id uuid,
  current_balance bigint,
  was_duplicate boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_wallet public.subcoin_wallets%rowtype;
  v_existing public.subcoin_transactions%rowtype;
  v_transaction_id uuid;
begin
  if p_user_id is null or p_actor_id is null or p_idempotency_key is null then
    raise exception 'invalid_arguments' using errcode = '22023';
  end if;
  if p_delta = 0 or abs(p_delta) > 1000000 then
    raise exception 'invalid_delta' using errcode = '22023';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 or char_length(p_reason) > 500 then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;

  -- Serialize retries using the same key, even if they target different users.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_existing
  from public.subcoin_transactions
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.user_id <> p_user_id
      or v_existing.actor_id is distinct from p_actor_id
      or v_existing.delta <> p_delta
      or v_existing.reason <> trim(p_reason) then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return query select v_existing.id, v_existing.balance_after, true;
    return;
  end if;

  insert into public.subcoin_wallets(user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from public.subcoin_wallets
  where user_id = p_user_id
  for update;

  if v_wallet.balance + p_delta < 0 then
    raise exception 'insufficient_subcoins' using errcode = '22003';
  end if;

  update public.subcoin_wallets
  set balance = balance + p_delta, updated_at = now()
  where user_id = p_user_id
  returning * into v_wallet;

  insert into public.subcoin_transactions(
    user_id, actor_id, delta, balance_after, reason, idempotency_key
  ) values (
    p_user_id, p_actor_id, p_delta, v_wallet.balance, trim(p_reason), p_idempotency_key
  ) returning id into v_transaction_id;

  return query select v_transaction_id, v_wallet.balance, false;
end;
$$;

revoke all on function public.admin_adjust_subcoins(uuid, uuid, bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_adjust_subcoins(uuid, uuid, bigint, text, uuid) to service_role;
