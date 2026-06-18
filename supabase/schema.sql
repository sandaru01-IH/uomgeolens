-- UoM GeoLens Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── TREES ───────────────────────────────────────────────────────────────────
create table if not exists trees (
  id            uuid primary key default uuid_generate_v4(),
  tree_name     text,
  height        text,
  diameter      text,
  department    text,
  group_no      text,
  lat           double precision not null,
  lng           double precision not null,
  source_group  text not null,
  created_at    timestamptz default now()
);

create index if not exists trees_lat_lng on trees (lat, lng);
create index if not exists trees_group on trees (group_no);
create index if not exists trees_name on trees (tree_name);

-- ─── TREE PHOTOS ─────────────────────────────────────────────────────────────
create table if not exists tree_photos (
  id          uuid primary key default uuid_generate_v4(),
  tree_id     uuid references trees(id) on delete cascade,
  photo_type  text check (photo_type in ('full','trunk','branch','leaves','flower','report')),
  url         text not null,
  created_at  timestamptz default now()
);

create index if not exists tree_photos_tree_id on tree_photos (tree_id);

-- ─── INCIDENTS ───────────────────────────────────────────────────────────────
create table if not exists incidents (
  id            uuid primary key default uuid_generate_v4(),
  tree_id       uuid references trees(id) on delete cascade,
  submitted_by  text,
  description   text,
  condition     text not null check (condition in ('healthy','damaged','dangerous','visible_issue')),
  is_verified   boolean default false,
  photo_url     text,
  submitted_at  timestamptz default now()
);

create index if not exists incidents_tree_id on incidents (tree_id);
create index if not exists incidents_submitted_at on incidents (submitted_at desc);
create index if not exists incidents_condition on incidents (condition);

-- ─── ZONE BOUNDARIES ─────────────────────────────────────────────────────────
create table if not exists zone_boundaries (
  id          uuid primary key default uuid_generate_v4(),
  zone_name   text not null,
  geojson     jsonb not null
);

-- ─── STORAGE BUCKET ──────────────────────────────────────────────────────────
-- Run this in Supabase Dashboard → Storage → New bucket
-- Bucket name: tree-photos
-- Public: true

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
alter table trees enable row level security;
alter table tree_photos enable row level security;
alter table incidents enable row level security;
alter table zone_boundaries enable row level security;

-- Trees: public read, admin write
create policy "trees_public_read" on trees for select using (true);
create policy "trees_admin_insert" on trees for insert with check (auth.role() = 'authenticated');
create policy "trees_admin_update" on trees for update using (auth.role() = 'authenticated');
create policy "trees_admin_delete" on trees for delete using (auth.role() = 'authenticated');

-- Tree photos: public read, admin write
create policy "photos_public_read" on tree_photos for select using (true);
create policy "photos_admin_write" on tree_photos for insert with check (auth.role() = 'authenticated');
create policy "photos_admin_delete" on tree_photos for delete using (auth.role() = 'authenticated');

-- Incidents: public read and insert, admin update/delete
create policy "incidents_public_read" on incidents for select using (true);
create policy "incidents_public_insert" on incidents for insert with check (true);
create policy "incidents_admin_update" on incidents for update using (auth.role() = 'authenticated');
create policy "incidents_admin_delete" on incidents for delete using (auth.role() = 'authenticated');

-- Zone boundaries: public read, admin write
create policy "zones_public_read" on zone_boundaries for select using (true);
create policy "zones_admin_write" on zone_boundaries for insert with check (auth.role() = 'authenticated');

-- ─── HELPER VIEWS ────────────────────────────────────────────────────────────
-- Latest condition per tree (from most recent incident)
create or replace view tree_latest_condition as
select distinct on (tree_id)
  tree_id,
  condition as latest_condition,
  is_verified,
  submitted_at
from incidents
order by tree_id, submitted_at desc;

-- Dashboard stats helper
create or replace view incident_daily_counts as
select
  date_trunc('day', submitted_at)::date as date,
  count(*) as count
from incidents
group by 1
order by 1 desc;
