-- SubReel: profiles are private until explicit public-profile visibility exists.
-- Run after 002_profiles.sql and 003_audit_fixes.sql.

begin;

drop policy if exists "Public can read profiles" on public.profiles;
drop policy if exists "Users can read their own profile" on public.profiles;

create policy "Users can read their own profile"
    on public.profiles
    for select to authenticated
    using ((select auth.uid()) = id);

revoke select on public.profiles from anon;
grant select on public.profiles to authenticated;

commit;
