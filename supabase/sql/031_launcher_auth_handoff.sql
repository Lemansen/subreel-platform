create table if not exists public.launcher_auth_requests (
    id uuid primary key,
    state_hash text not null check (state_hash ~ '^[0-9a-f]{64}$'),
    code_challenge text not null check (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
    redirect_uri text not null check (redirect_uri ~ '^http://127\.0\.0\.1:[0-9]{1,5}/callback$'),
    ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
    user_id uuid references auth.users(id) on delete cascade,
    code_hash text check (code_hash is null or code_hash ~ '^[0-9a-f]{64}$'),
    encrypted_session text,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    approved_at timestamptz,
    constraint launcher_auth_approval_pair check (
        (user_id is null and code_hash is null and encrypted_session is null and approved_at is null)
        or
        (user_id is not null and code_hash is not null and encrypted_session is not null and approved_at is not null)
    )
);

create index if not exists launcher_auth_requests_expiry_idx
    on public.launcher_auth_requests (expires_at);

create index if not exists launcher_auth_requests_user_id_idx
    on public.launcher_auth_requests (user_id)
    where user_id is not null;

alter table public.launcher_auth_requests enable row level security;
revoke all on public.launcher_auth_requests from public, anon, authenticated;
grant all on public.launcher_auth_requests to service_role;

create table if not exists public.launcher_auth_rate_limits (
    ip_hash text primary key check (ip_hash ~ '^[0-9a-f]{64}$'),
    window_started_at timestamptz not null,
    request_count integer not null check (request_count > 0)
);

alter table public.launcher_auth_rate_limits enable row level security;
revoke all on public.launcher_auth_rate_limits from public, anon, authenticated;
grant all on public.launcher_auth_rate_limits to service_role;

create or replace function public.create_launcher_auth_request(
    p_id uuid,
    p_state_hash text,
    p_code_challenge text,
    p_redirect_uri text,
    p_ip_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_now timestamptz := pg_catalog.clock_timestamp();
    v_count integer;
begin
    insert into public.launcher_auth_rate_limits (ip_hash, window_started_at, request_count)
    values (p_ip_hash, v_now, 1)
    on conflict (ip_hash) do update set
        window_started_at = case
            when public.launcher_auth_rate_limits.window_started_at < v_now - interval '1 minute' then v_now
            else public.launcher_auth_rate_limits.window_started_at
        end,
        request_count = case
            when public.launcher_auth_rate_limits.window_started_at < v_now - interval '1 minute' then 1
            else public.launcher_auth_rate_limits.request_count + 1
        end
    returning request_count into v_count;

    delete from public.launcher_auth_rate_limits
    where window_started_at < v_now - interval '1 day'
      and ip_hash <> p_ip_hash;

    if v_count > 8 then
        return null;
    end if;

    insert into public.launcher_auth_requests (id, state_hash, code_challenge, redirect_uri, ip_hash, expires_at)
    values (p_id, p_state_hash, p_code_challenge, p_redirect_uri, p_ip_hash, v_now + interval '5 minutes');

    delete from public.launcher_auth_requests where expires_at < v_now;
    return p_id;
end;
$function$;

revoke all on function public.create_launcher_auth_request(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_launcher_auth_request(uuid, text, text, text, text) to service_role;

create or replace function public.consume_launcher_auth_request(
    p_id uuid,
    p_code_hash text,
    p_code_challenge text
)
returns table (encrypted_session text)
language sql
security definer
set search_path = ''
as $function$
    delete from public.launcher_auth_requests as request
    where request.id = p_id
      and request.code_hash = p_code_hash
      and request.code_challenge = p_code_challenge
      and request.expires_at > pg_catalog.clock_timestamp()
      and request.approved_at is not null
    returning request.encrypted_session;
$function$;

revoke all on function public.consume_launcher_auth_request(uuid, text, text) from public, anon, authenticated;
grant execute on function public.consume_launcher_auth_request(uuid, text, text) to service_role;
