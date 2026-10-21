-- Public profile visibility is opt-in. Existing profiles stay private.

begin;

alter table public.profiles
    add column if not exists is_public boolean not null default false;

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can read own or public profiles" on public.profiles;

create policy "Users can read own or public profiles"
    on public.profiles
    for select to authenticated
    using ((select auth.uid()) = id or is_public);

create policy "Public profiles are viewable by everyone"
    on public.profiles
    for select to anon
    using (is_public);

grant select on public.profiles to anon;
grant select on public.profiles to authenticated;
grant update (is_public) on public.profiles to authenticated;

commit;
