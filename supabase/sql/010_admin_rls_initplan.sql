-- Make the trusted JWT lookup a statement-level init plan in admin RLS policies.
do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('franchises','Catalog admins can manage franchises'),
      ('titles','Catalog admins can manage titles'),
      ('title_relationships','Catalog admins can manage title relationships'),
      ('genres','Catalog admins can manage genres'),
      ('title_genres','Catalog admins can manage title genres'),
      ('title_seasons','Catalog admins can manage seasons'),
      ('title_episodes','Catalog admins can manage episodes'),
      ('title_editions','Catalog admins can manage editions'),
      ('title_volumes','Catalog admins can manage volumes'),
      ('title_chapters','Catalog admins can manage chapters'),
      ('video_sources','Catalog admins can manage video sources'),
      ('reading_sources','Catalog admins can manage reading sources')
    ) as policies(table_name, policy_name)
  loop
    execute format('drop policy %I on public.%I', item.policy_name, item.table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (((select auth.jwt()) -> ''app_metadata'' ->> ''role'') = ''catalog_admin'') with check (((select auth.jwt()) -> ''app_metadata'' ->> ''role'') = ''catalog_admin'')',
      item.policy_name, item.table_name
    );
  end loop;
end $$;

