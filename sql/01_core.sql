-- SHAMLOKO BOOST core schema, isolated in its own "boost" schema so it cannot touch SHAMLOKO tables.
-- Safe to re-run. Supabase > SQL Editor > New query > paste > Run.
create schema if not exists boost;
create extension if not exists pgcrypto;

create table if not exists boost.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, phone text, avatar_url text,
  visibility text not null default 'public' check (visibility in ('public','private')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);
create table if not exists boost.user_roles (
  user_id uuid references boost.profiles(id) on delete cascade,
  role text check (role in ('earner','creator','admin')),
  primary key (user_id, role)
);
create table if not exists boost.creator_profiles (
  user_id uuid primary key references boost.profiles(id) on delete cascade,
  display_name text not null,
  category text not null check (category in ('Musician/Artist','Influencer/Content Creator','Video Producer','Photographer','Graphic Designer','Business','Brand','Other')),
  bio text, created_at timestamptz not null default now()
);
create table if not exists boost.genres (
  id uuid primary key default gen_random_uuid(),
  name text unique not null, active boolean not null default true
);
insert into boost.genres(name) values ('Zed Hip-Hop'),('Hip-Hop'),('Afro-Pop'),('R&B'),('Amapiano'),('Dancehall'),('Reggae'),('Gospel'),('Kalindula'),('Afrobeats'),('Other') on conflict do nothing;
create table if not exists boost.user_preferences (
  user_id uuid references boost.profiles(id) on delete cascade,
  genre_id uuid references boost.genres(id) on delete cascade,
  primary key (user_id, genre_id)
);
create table if not exists boost.wallets (
  user_id uuid primary key references boost.profiles(id) on delete cascade,
  currency text not null default 'ZMW', created_at timestamptz not null default now()
);
-- LEDGER: the only source of truth for money. Balances are always derived from it.
create table if not exists boost.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references boost.profiles(id),
  bucket text not null check (bucket in ('available','pending','reserved')),
  amount numeric(12,2) not null check (amount <> 0),
  type text not null,
  reference text unique,            -- idempotency key: blocks duplicate credits
  note text, created_by uuid, created_at timestamptz not null default now()
);
create index if not exists wt_user_idx on boost.wallet_transactions(user_id, created_at desc);
create table if not exists boost.platform_settings (key text primary key, value jsonb not null);
insert into boost.platform_settings values ('platform_fee_percent','10'),('min_withdrawal','20') on conflict do nothing;
create table if not exists boost.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references boost.profiles(id) on delete cascade,
  title text not null, body text, is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists boost.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid, action text not null, target text, details jsonb,
  created_at timestamptz not null default now()
);

create or replace view boost.wallet_balances with (security_invoker = true) as
select user_id,
  coalesce(sum(amount) filter (where bucket='available'),0) as available,
  coalesce(sum(amount) filter (where bucket='pending'),0)   as pending,
  coalesce(sum(amount) filter (where bucket='reserved'),0)  as reserved
from boost.wallet_transactions group by user_id;

create or replace function boost.is_admin() returns boolean
language sql security definer set search_path = boost stable as
$$ select exists(select 1 from boost.user_roles where user_id = auth.uid() and role = 'admin') $$;

create or replace function boost.handle_new_user() returns trigger
language plpgsql security definer set search_path = boost as $$
begin
  insert into boost.profiles(id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
  insert into boost.wallets(user_id) values (new.id);
  insert into boost.user_roles(user_id, role) values (new.id, 'earner');
  return new;
end $$;
drop trigger if exists boost_on_auth_user_created on auth.users;
create trigger boost_on_auth_user_created after insert on auth.users for each row execute function boost.handle_new_user();

-- One account can hold both roles. Users cannot write user_roles directly.
create or replace function boost.become_creator(p_name text, p_category text, p_bio text default null) returns void
language plpgsql security definer set search_path = boost as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into boost.creator_profiles(user_id, display_name, category, bio) values (auth.uid(), p_name, p_category, p_bio)
    on conflict (user_id) do update set display_name = excluded.display_name, category = excluded.category, bio = excluded.bio;
  insert into boost.user_roles(user_id, role) values (auth.uid(), 'creator') on conflict do nothing;
end $$;

-- Row Level Security
alter table boost.profiles enable row level security;
alter table boost.user_roles enable row level security;
alter table boost.creator_profiles enable row level security;
alter table boost.genres enable row level security;
alter table boost.user_preferences enable row level security;
alter table boost.wallets enable row level security;
alter table boost.wallet_transactions enable row level security;
alter table boost.platform_settings enable row level security;
alter table boost.notifications enable row level security;
alter table boost.admin_audit_logs enable row level security;

drop policy if exists p_sel on boost.profiles; create policy p_sel on boost.profiles for select to authenticated using (id = auth.uid() or visibility = 'public' or boost.is_admin());
drop policy if exists p_upd on boost.profiles; create policy p_upd on boost.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on boost.profiles from authenticated; grant update (full_name, phone, avatar_url, visibility) on boost.profiles to authenticated;
drop policy if exists r_sel on boost.user_roles; create policy r_sel on boost.user_roles for select to authenticated using (user_id = auth.uid() or boost.is_admin());
drop policy if exists c_sel on boost.creator_profiles; create policy c_sel on boost.creator_profiles for select to authenticated using (true);
drop policy if exists g_sel on boost.genres; create policy g_sel on boost.genres for select to authenticated using (true);
drop policy if exists up_all on boost.user_preferences; create policy up_all on boost.user_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists w_sel on boost.wallets; create policy w_sel on boost.wallets for select to authenticated using (user_id = auth.uid() or boost.is_admin());
drop policy if exists wt_sel on boost.wallet_transactions; create policy wt_sel on boost.wallet_transactions for select to authenticated using (user_id = auth.uid() or boost.is_admin());
drop policy if exists ps_sel on boost.platform_settings; create policy ps_sel on boost.platform_settings for select to authenticated using (true);
drop policy if exists ps_upd on boost.platform_settings; create policy ps_upd on boost.platform_settings for update to authenticated using (boost.is_admin());
drop policy if exists n_sel on boost.notifications; create policy n_sel on boost.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists n_upd on boost.notifications; create policy n_upd on boost.notifications for update to authenticated using (user_id = auth.uid());
revoke update on boost.notifications from authenticated; grant update (is_read) on boost.notifications to authenticated;
drop policy if exists a_sel on boost.admin_audit_logs; create policy a_sel on boost.admin_audit_logs for select to authenticated using (boost.is_admin());
-- No insert/update/delete policies exist on the ledger, wallets or roles: the browser cannot change money.

-- Backfill for users created before this script ran
insert into boost.profiles(id, full_name) select id, raw_user_meta_data->>'full_name' from auth.users on conflict do nothing;
insert into boost.wallets(user_id) select id from boost.profiles on conflict do nothing;
insert into boost.user_roles(user_id, role) select id, 'earner' from boost.profiles on conflict do nothing;

-- API access (RLS above still decides which rows). The ledger and roles are read-only for the app.
grant usage on schema boost to authenticated;
revoke all on all tables in schema boost from anon, authenticated;
grant select on all tables in schema boost to authenticated;
grant insert, delete on boost.user_preferences to authenticated;
grant update (full_name, phone, avatar_url, visibility) on boost.profiles to authenticated;
grant update (is_read) on boost.notifications to authenticated;
grant update on boost.platform_settings to authenticated;
grant execute on function boost.become_creator(text, text, text) to authenticated;
grant execute on function boost.is_admin() to authenticated;
