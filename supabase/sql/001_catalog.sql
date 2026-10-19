
-- SubReel: initial catalog schema

create table if not exists public.franchises (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    description text,
    cover_url text,
    status text not null default 'draft'
        check (status in ('draft', 'published', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.titles (
    id uuid primary key default gen_random_uuid(),
    franchise_id uuid references public.franchises(id) on delete set null,
    name text not null,
    original_name text,
    slug text not null unique,
    description text,
    cover_url text,
    banner_url text,
    content_type text not null check (content_type in (
        'anime', 'movie', 'series', 'drama', 'cartoon',
        'manga', 'manhwa', 'manhua', 'light_novel',
        'web_novel', 'book'
    )),
    release_year integer check (
        release_year is null or release_year between 1800 and 2200
    ),
    status text not null default 'draft'
        check (status in ('draft', 'published', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.title_relationships (
    id uuid primary key default gen_random_uuid(),
    source_title_id uuid not null
        references public.titles(id) on delete cascade,
    target_title_id uuid not null
        references public.titles(id) on delete cascade,
    relationship_type text not null check (relationship_type in (
        'adaptation', 'sequel', 'prequel', 'spin_off',
        'remake', 'side_story', 'alternative_version',
        'same_universe'
    )),
    created_at timestamptz not null default now(),
    constraint title_relationships_not_self
        check (source_title_id <> target_title_id),
    constraint title_relationships_unique
        unique (source_title_id, target_title_id, relationship_type)
);

create table if not exists public.genres (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    slug text not null unique,
    created_at timestamptz not null default now()
);

create table if not exists public.title_genres (
    title_id uuid not null references public.titles(id) on delete cascade,
    genre_id uuid not null references public.genres(id) on delete cascade,
    primary key (title_id, genre_id)
);

create index if not exists titles_franchise_id_idx
    on public.titles(franchise_id);

create index if not exists titles_content_type_status_idx
    on public.titles(content_type, status);

create index if not exists titles_release_year_idx
    on public.titles(release_year desc);

create index if not exists title_relationships_target_idx
    on public.title_relationships(target_title_id);

create index if not exists title_genres_genre_id_idx
    on public.title_genres(genre_id);

alter table public.franchises enable row level security;
alter table public.titles enable row level security;
alter table public.title_relationships enable row level security;
alter table public.genres enable row level security;
alter table public.title_genres enable row level security;

grant select on public.franchises to anon, authenticated;
grant select on public.titles to anon, authenticated;
grant select on public.title_relationships to anon, authenticated;
grant select on public.genres to anon, authenticated;
grant select on public.title_genres to anon, authenticated;

grant all on public.franchises to service_role;
grant all on public.titles to service_role;
grant all on public.title_relationships to service_role;
grant all on public.genres to service_role;
grant all on public.title_genres to service_role;

drop policy if exists "Public can read published franchises"
    on public.franchises;
create policy "Public can read published franchises"
    on public.franchises for select to anon, authenticated
    using (status = 'published');

drop policy if exists "Public can read published titles"
    on public.titles;
create policy "Public can read published titles"
    on public.titles for select to anon, authenticated
    using (status = 'published');

drop policy if exists "Public can read relationships between published titles"
    on public.title_relationships;
create policy "Public can read relationships between published titles"
    on public.title_relationships for select to anon, authenticated
    using (
        exists (
            select 1
            from public.titles source_title
            join public.titles target_title
              on target_title.id = title_relationships.target_title_id
            where source_title.id = title_relationships.source_title_id
              and source_title.status = 'published'
              and target_title.status = 'published'
        )
    );

drop policy if exists "Public can read genres"
    on public.genres;
create policy "Public can read genres"
    on public.genres for select to anon, authenticated
    using (true);

drop policy if exists "Public can read genres of published titles"
    on public.title_genres;
create policy "Public can read genres of published titles"
    on public.title_genres for select to anon, authenticated
    using (
        exists (
            select 1
            from public.titles
            where titles.id = title_genres.title_id
              and titles.status = 'published'
        )
    );
