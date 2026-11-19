-- Wastec platform schema (Supabase / Postgres). Run in the SQL editor of a NEW project.
-- Design: customers see only their own plants; staff (role in app_metadata) see everything.
-- Public site forms insert leads through an Edge Function (service role), never directly from the browser.

create extension if not exists "pgcrypto";

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text, phone text,
  role text not null default 'customer' check (role in ('customer','technician','admin')),
  created_at timestamptz default now()
);

create table plants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  name text not null, location text, feedstock text,
  digester_m3 numeric, commissioned_on date,
  created_at timestamptz default now()
);

create table sensors (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references plants(id) on delete cascade,
  kind text not null check (kind in ('gas_flow','temperature','ph','pressure','ch4','h2s')),
  unit text not null, device_key_hash text not null  -- store a hash, never the raw device key
);

create table readings (
  sensor_id uuid not null references sensors(id) on delete cascade,
  ts timestamptz not null default now(),
  value numeric not null,
  primary key (sensor_id, ts)
);
create index on readings (ts desc);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references plants(id) on delete cascade,
  sensor_id uuid references sensors(id), level text not null check (level in ('warn','alert')),
  message text not null, suggested_action text,
  raised_at timestamptz default now(), resolved_at timestamptz
);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants(id), raised_by uuid references profiles(id),
  symptom text not null, details text,
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  technician_id uuid references profiles(id),
  created_at timestamptz default now(), closed_at timestamptz
);

create table amc_contracts (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references plants(id) on delete cascade,
  plan text not null, visits_per_year int not null, starts_on date not null, ends_on date not null
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants(id), number text unique not null,
  amount_inr numeric(12,2) not null, status text not null default 'due' check (status in ('due','paid','void')),
  issued_on date not null default current_date
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('quote','service')),
  payload jsonb not null, status text not null default 'new',
  created_at timestamptz default now()
);

-- helper: is the caller staff?
create function is_staff() returns boolean language sql stable as $$
  select coalesce((select role in ('technician','admin') from profiles where id = auth.uid()), false)
$$;

alter table profiles enable row level security;
alter table plants enable row level security;
alter table sensors enable row level security;
alter table readings enable row level security;
alter table alerts enable row level security;
alter table tickets enable row level security;
alter table amc_contracts enable row level security;
alter table invoices enable row level security;
alter table leads enable row level security;  -- no policies: only the service role (Edge Function) can touch it

create policy "own profile"   on profiles for select using (id = auth.uid() or is_staff());
create policy "own plants"    on plants   for select using (owner_id = auth.uid() or is_staff());
create policy "staff manage plants" on plants for all using (is_staff()) with check (is_staff());

create policy "own sensors"   on sensors  for select using (is_staff() or exists (select 1 from plants p where p.id = plant_id and p.owner_id = auth.uid()));
create policy "own readings"  on readings for select using (is_staff() or exists (
  select 1 from sensors s join plants p on p.id = s.plant_id where s.id = sensor_id and p.owner_id = auth.uid()));
create policy "own alerts"    on alerts   for select using (is_staff() or exists (select 1 from plants p where p.id = plant_id and p.owner_id = auth.uid()));
create policy "own tickets"   on tickets  for select using (is_staff() or raised_by = auth.uid());
create policy "raise ticket"  on tickets  for insert with check (raised_by = auth.uid());
create policy "staff update tickets" on tickets for update using (is_staff());
create policy "own amc"       on amc_contracts for select using (is_staff() or exists (select 1 from plants p where p.id = plant_id and p.owner_id = auth.uid()));
create policy "own invoices"  on invoices for select using (is_staff() or exists (select 1 from plants p where p.id = plant_id and p.owner_id = auth.uid()));

-- Sensor ingestion: a gateway posts readings to an Edge Function that checks device_key_hash and inserts with the
-- service role. Customers and gateways never receive write access to readings from the browser.
