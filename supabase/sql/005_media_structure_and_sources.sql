-- Additive media structure and reviewed sources for SubReel.
create table public.title_seasons (
 id uuid primary key default gen_random_uuid(),
 title_id uuid not null references public.titles(id) on delete cascade,
 season_number integer not null check (season_number > 0),
 name text, description text,
 status text not null default 'draft' check (status in ('draft','published','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (title_id, season_number), unique (id, title_id)
);
create table public.title_episodes (
 id uuid primary key default gen_random_uuid(),
 title_id uuid not null references public.titles(id) on delete cascade,
 season_id uuid,
 episode_number numeric(7,2) not null check (episode_number > 0),
 sort_order integer not null default 1 check (sort_order > 0),
 name text, description text,
 duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
 release_date date,
 status text not null default 'draft' check (status in ('draft','published','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key (season_id, title_id) references public.title_seasons(id, title_id) on delete cascade,
 unique (id, title_id)
);
create unique index title_episodes_season_number_uidx on public.title_episodes(season_id, episode_number) where season_id is not null;
create unique index title_episodes_title_number_uidx on public.title_episodes(title_id, episode_number) where season_id is null;
create index title_episodes_order_idx on public.title_episodes(title_id, season_id, sort_order);

create table public.title_editions (
 id uuid primary key default gen_random_uuid(),
 title_id uuid not null references public.titles(id) on delete cascade,
 edition_kind text not null check (edition_kind in ('graphic','text')),
 edition_number integer not null default 1 check (edition_number > 0),
 name text not null, language_code text, description text,
 status text not null default 'draft' check (status in ('draft','published','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (title_id, edition_kind, edition_number), unique (id, title_id)
);
create table public.title_volumes (
 id uuid primary key default gen_random_uuid(),
 title_id uuid not null references public.titles(id) on delete cascade,
 edition_id uuid,
 volume_number numeric(7,2) not null check (volume_number > 0),
 name text, description text,
 status text not null default 'draft' check (status in ('draft','published','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key (edition_id, title_id) references public.title_editions(id, title_id) on delete cascade,
 unique (id, title_id, edition_id)
);
create unique index title_volumes_edition_number_uidx on public.title_volumes(edition_id, volume_number) where edition_id is not null;
create unique index title_volumes_title_number_uidx on public.title_volumes(title_id, volume_number) where edition_id is null;
create index title_volumes_order_idx on public.title_volumes(title_id, edition_id, volume_number);

create table public.title_chapters (
 id uuid primary key default gen_random_uuid(),
 title_id uuid not null references public.titles(id) on delete cascade,
 edition_id uuid, volume_id uuid,
 chapter_number numeric(9,3), chapter_label text not null,
 sort_order integer not null default 1 check (sort_order > 0),
 name text, description text, release_date date,
 status text not null default 'draft' check (status in ('draft','published','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key (edition_id, title_id) references public.title_editions(id, title_id) on delete cascade,
 check (volume_id is null or edition_id is not null),
 foreign key (volume_id, title_id, edition_id) references public.title_volumes(id, title_id, edition_id) on delete cascade,
 unique (id, title_id)
);
create unique index title_chapters_volume_order_uidx on public.title_chapters(volume_id, sort_order) where volume_id is not null;
create unique index title_chapters_edition_order_uidx on public.title_chapters(edition_id, sort_order) where edition_id is not null and volume_id is null;
create unique index title_chapters_title_order_uidx on public.title_chapters(title_id, sort_order) where edition_id is null and volume_id is null;
create index title_chapters_order_idx on public.title_chapters(title_id, edition_id, volume_id, sort_order);

create table public.video_sources (
 id uuid primary key default gen_random_uuid(),
 title_id uuid not null references public.titles(id) on delete cascade,
 episode_id uuid,
 provider_name text,
 source_url text not null check (source_url ~* '^https://'),
 source_format text not null check (source_format in ('hls','dash','mp4','embed')),
 language_code text, quality_label text,
 availability_status text not null default 'pending' check (availability_status in ('pending','available','unavailable')),
 rights_status text not null default 'pending' check (rights_status in ('pending','approved','rejected')),
 publication_status text not null default 'draft' check (publication_status in ('draft','published','disabled')),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key (episode_id, title_id) references public.title_episodes(id, title_id) on delete cascade,
 check (publication_status <> 'published' or (rights_status = 'approved' and reviewed_at is not null))
);
create index video_sources_title_idx on public.video_sources(title_id);
create index video_sources_episode_idx on public.video_sources(episode_id) where episode_id is not null;
create index video_sources_public_idx on public.video_sources(title_id, episode_id) where publication_status='published' and rights_status='approved' and availability_status='available';

create table public.reading_sources (
 id uuid primary key default gen_random_uuid(),
 title_id uuid not null references public.titles(id) on delete cascade,
 chapter_id uuid,
 provider_name text,
 source_url text not null check (source_url ~* '^https://'),
 source_format text not null check (source_format in ('image_pages','pdf','epub','html','plain_text')),
 language_code text,
 availability_status text not null default 'pending' check (availability_status in ('pending','available','unavailable')),
 rights_status text not null default 'pending' check (rights_status in ('pending','approved','rejected')),
 publication_status text not null default 'draft' check (publication_status in ('draft','published','disabled')),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key (chapter_id, title_id) references public.title_chapters(id, title_id) on delete cascade,
 check (publication_status <> 'published' or (rights_status = 'approved' and reviewed_at is not null))
);
create index reading_sources_title_idx on public.reading_sources(title_id);
create index reading_sources_chapter_idx on public.reading_sources(chapter_id) where chapter_id is not null;
create index reading_sources_public_idx on public.reading_sources(title_id, chapter_id) where publication_status='published' and rights_status='approved' and availability_status='available';

alter table public.title_seasons enable row level security;
alter table public.title_episodes enable row level security;
alter table public.title_editions enable row level security;
alter table public.title_volumes enable row level security;
alter table public.title_chapters enable row level security;
alter table public.video_sources enable row level security;
alter table public.reading_sources enable row level security;

grant select on public.title_seasons, public.title_episodes, public.title_editions, public.title_volumes, public.title_chapters, public.video_sources, public.reading_sources to anon, authenticated;
grant all on public.title_seasons, public.title_episodes, public.title_editions, public.title_volumes, public.title_chapters, public.video_sources, public.reading_sources to service_role;

create policy "Public can read seasons of published titles" on public.title_seasons for select to anon, authenticated using (status='published' and exists (select 1 from public.titles t where t.id=title_seasons.title_id and t.status='published'));
create policy "Public can read episodes of published titles" on public.title_episodes for select to anon, authenticated using (status='published' and exists (select 1 from public.titles t where t.id=title_episodes.title_id and t.status='published'));
create policy "Public can read editions of published titles" on public.title_editions for select to anon, authenticated using (status='published' and exists (select 1 from public.titles t where t.id=title_editions.title_id and t.status='published'));
create policy "Public can read volumes of published titles" on public.title_volumes for select to anon, authenticated using (status='published' and exists (select 1 from public.titles t where t.id=title_volumes.title_id and t.status='published'));
create policy "Public can read chapters of published titles" on public.title_chapters for select to anon, authenticated using (status='published' and exists (select 1 from public.titles t where t.id=title_chapters.title_id and t.status='published'));
create policy "Public can read approved available video sources" on public.video_sources for select to anon, authenticated using (
 publication_status='published' and rights_status='approved' and availability_status='available'
 and exists (select 1 from public.titles t where t.id=video_sources.title_id and t.status='published')
 and (episode_id is null or exists (select 1 from public.title_episodes e where e.id=video_sources.episode_id and e.title_id=video_sources.title_id and e.status='published'))
);
create policy "Public can read approved available reading sources" on public.reading_sources for select to anon, authenticated using (
 publication_status='published' and rights_status='approved' and availability_status='available'
 and exists (select 1 from public.titles t where t.id=reading_sources.title_id and t.status='published')
 and (chapter_id is null or exists (select 1 from public.title_chapters c where c.id=reading_sources.chapter_id and c.title_id=reading_sources.title_id and c.status='published'))
);

