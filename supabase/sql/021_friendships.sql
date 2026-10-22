-- Private friend requests and blocks. Profile discovery remains opt-in/public.
begin;

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_requests_not_self check (requester_id <> addressee_id)
);

create unique index if not exists friend_requests_active_pair_unique
  on public.friend_requests(requester_id, addressee_id)
  where status in ('pending', 'accepted');

create index if not exists friend_requests_addressee_status_idx
  on public.friend_requests(addressee_id, status, created_at desc);
create index if not exists friend_requests_requester_status_idx
  on public.friend_requests(requester_id, status, created_at desc);

drop trigger if exists friend_requests_set_updated_at on public.friend_requests;
create trigger friend_requests_set_updated_at
  before update on public.friend_requests
  for each row execute function public.set_updated_at();

alter table public.friend_requests enable row level security;
revoke all privileges on table public.friend_requests from public, anon, authenticated;
grant select, delete on table public.friend_requests to authenticated;
grant insert (requester_id, addressee_id) on table public.friend_requests to authenticated;
grant update (status) on table public.friend_requests to authenticated;
grant all privileges on table public.friend_requests to service_role;

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);
alter table public.user_blocks enable row level security;
revoke all privileges on table public.user_blocks from public, anon, authenticated;
grant select, delete on table public.user_blocks to authenticated;
grant insert (blocker_id, blocked_id) on table public.user_blocks to authenticated;
grant all privileges on table public.user_blocks to service_role;

create policy "Users read their own blocks"
  on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy "Users block other accounts"
  on public.user_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()) and blocker_id <> blocked_id);
create policy "Users remove their own blocks"
  on public.user_blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

create or replace function public.is_user_blocked(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = (select auth.uid()) and b.blocked_id = other_user_id)
       or (b.blocker_id = other_user_id and b.blocked_id = (select auth.uid()))
  );
$$;
revoke all on function public.is_user_blocked(uuid) from public, anon;
grant execute on function public.is_user_blocked(uuid) to authenticated;

create or replace function public.has_active_friend_request(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friend_requests r
    where r.requester_id = other_user_id
      and r.addressee_id = (select auth.uid())
      and r.status in ('pending', 'accepted')
  );
$$;
revoke all on function public.has_active_friend_request(uuid) from public, anon;
grant execute on function public.has_active_friend_request(uuid) to authenticated;

create policy "Users read their friend requests"
  on public.friend_requests for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy "Users send requests to public profiles"
  on public.friend_requests for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = addressee_id and p.is_public and not p.is_suspended
    )
    and not public.has_active_friend_request(addressee_id)
    and not public.is_user_blocked(addressee_id)
  );

create policy "Recipients respond to pending requests"
  on public.friend_requests for update to authenticated
  using (addressee_id = (select auth.uid()) and status = 'pending')
  with check (addressee_id = (select auth.uid()) and status in ('accepted', 'rejected'));

create policy "Participants remove requests or friendships"
  on public.friend_requests for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

commit;
