-- Wastec SaaS schema (Supabase / Postgres 15+). Run once in the SQL editor of a NEW project.
-- Multi-tenant: every customer company is an organization; users belong to organizations.
-- Wastec staff are listed in platform_staff and can see and manage every organization.
-- Browser code only ever uses the anon/authenticated roles. All writes go through RLS or the RPC functions below.

-- ---------- tenants and people ----------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'trial' check (plan in ('trial','starter','pro','enterprise')),
  plan_status text not null default 'active' check (plan_status in ('active','past_due','cancelled')),
  razorpay_customer_id text,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text, phone text,
  created_at timestamptz not null default now()
);

create table org_members (
  org_id uuid not null references organizations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'viewer' check (role in ('owner','manager','viewer')),
  primary key (org_id, user_id)
);

create table platform_staff (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null default 'technician' check (role in ('technician','admin'))
);

-- ---------- plans and billing ----------
create table plans (
  code text primary key check (code in ('starter','pro','enterprise')),
  name text not null,
  price_inr_per_plant_month numeric(10,2),         -- null = "contact us". Values seeded below are PROPOSED, confirm before launch.
  max_plants int, history_days int not null, features jsonb not null default '[]'
);
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  plan text not null references plans(code),
  razorpay_subscription_id text unique, status text not null default 'created',
  current_period_end timestamptz, created_at timestamptz not null default now()
);

-- ---------- plants, devices, readings ----------
create table plants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  name text not null, location text, feedstock text,
  digester_m3 numeric check (digester_m3 > 0), commissioned_on date,
  created_at timestamptz not null default now()
);
create index on plants(org_id);

create table devices (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references plants on delete cascade,
  name text not null default 'Gateway',
  key_hash text not null,                           -- sha256 of the device key; the raw key is shown once at creation
  last_seen timestamptz, created_at timestamptz not null default now()
);

create table readings (
  plant_id uuid not null references plants on delete cascade,
  kind text not null check (kind in ('gas_flow','temperature','ph','pressure','ch4','h2s')),
  ts timestamptz not null default now(),
  value numeric not null,
  primary key (plant_id, kind, ts)
);
create index on readings (plant_id, ts desc);

-- ---------- alerting ----------
create table alert_rules (
  kind text primary key check (kind in ('gas_flow','temperature','ph','pressure','ch4','h2s')),
  label text not null, unit text not null,
  warn_low numeric, warn_high numeric, alert_low numeric, alert_high numeric,
  action text not null
);
create table alerts (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references plants on delete cascade,
  kind text not null, level text not null check (level in ('warn','alert')),
  message text not null, suggested_action text,
  raised_at timestamptz not null default now(), resolved_at timestamptz
);
create unique index one_open_alert on alerts (plant_id, kind) where resolved_at is null;

-- ---------- service ----------
create table tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  plant_id uuid references plants, raised_by uuid references auth.users,
  symptom text not null, details text,
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  technician_id uuid references auth.users,
  created_at timestamptz not null default now(), closed_at timestamptz
);
create table amc_contracts (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references plants on delete cascade,
  plan text not null, visits_per_year int not null check (visits_per_year > 0),
  starts_on date not null, ends_on date not null check (ends_on > starts_on)
);
create table invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  number text unique not null, amount_inr numeric(12,2) not null check (amount_inr >= 0),
  status text not null default 'due' check (status in ('due','paid','void')),
  issued_on date not null default current_date
);
create table leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('quote','service')),
  payload jsonb not null, status text not null default 'new' check (status in ('new','contacted','won','lost')),
  created_at timestamptz not null default now()
);

-- ---------- access helpers (security definer so they bypass RLS recursion) ----------
create function is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_staff where user_id = auth.uid()) $$;
create function is_member(p_org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members where org_id = p_org and user_id = auth.uid()) $$;
create function is_org_admin(p_org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members where org_id = p_org and user_id = auth.uid() and role in ('owner','manager')) $$;
create function can_see_plant(p_plant uuid) returns boolean language sql stable security definer set search_path = public as $$
  select is_staff() or exists (select 1 from plants p join org_members m on m.org_id = p.org_id
                                where p.id = p_plant and m.user_id = auth.uid()) $$;

-- ---------- row level security ----------
alter table organizations enable row level security;  alter table profiles enable row level security;
alter table org_members enable row level security;    alter table platform_staff enable row level security;
alter table plans enable row level security;          alter table subscriptions enable row level security;
alter table plants enable row level security;         alter table devices enable row level security;
alter table readings enable row level security;       alter table alert_rules enable row level security;
alter table alerts enable row level security;         alter table tickets enable row level security;
alter table amc_contracts enable row level security;  alter table invoices enable row level security;
alter table leads enable row level security;

create policy plans_public     on plans for select using (true);
create policy rules_public     on alert_rules for select using (true);
create policy org_read         on organizations for select using (is_member(id) or is_staff());
create policy org_rename       on organizations for update using (is_org_admin(id)) with check (is_org_admin(id));
create policy profile_read     on profiles for select using (id = auth.uid() or is_staff());
create policy profile_write    on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy members_read     on org_members for select using (user_id = auth.uid() or is_member(org_id) or is_staff());
create policy members_manage   on org_members for all using (is_org_admin(org_id) or is_staff()) with check (is_org_admin(org_id) or is_staff());
create policy staff_read       on platform_staff for select using (user_id = auth.uid());
create policy subs_read        on subscriptions for select using (is_member(org_id) or is_staff());
create policy plants_read      on plants for select using (is_member(org_id) or is_staff());
create policy plants_staff     on plants for all using (is_staff()) with check (is_staff());
create policy devices_read     on devices for select using (can_see_plant(plant_id));
create policy readings_read    on readings for select using (can_see_plant(plant_id));
create policy alerts_read      on alerts for select using (can_see_plant(plant_id));
create policy tickets_read     on tickets for select using (is_member(org_id) or is_staff());
create policy tickets_raise    on tickets for insert with check (is_member(org_id) and raised_by = auth.uid());
create policy tickets_staff    on tickets for update using (is_staff()) with check (is_staff());
create policy amc_read         on amc_contracts for select using (can_see_plant(plant_id));
create policy amc_staff        on amc_contracts for all using (is_staff()) with check (is_staff());
create policy invoices_read    on invoices for select using (is_member(org_id) or is_staff());
create policy invoices_staff   on invoices for all using (is_staff()) with check (is_staff());
create policy leads_staff      on leads for all using (is_staff()) with check (is_staff());
-- readings, alerts, devices, subscriptions have no insert/update policies for users: only the RPCs and service role write them.

-- ---------- sign-up: create profile, organization and owner membership ----------
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  insert into profiles (id, full_name, phone) values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
  insert into organizations (name) values (coalesce(nullif(trim(new.raw_user_meta_data->>'org_name'), ''), 'My organisation')) returning id into v_org;
  insert into org_members (org_id, user_id, role) values (v_org, new.id, 'owner');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ---------- RPC: public lead form (anon can call, nothing else is exposed) ----------
create function submit_lead(p_kind text, p_payload jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('quote','service') then raise exception 'invalid kind'; end if;
  if jsonb_typeof(p_payload) <> 'object' or length(p_payload::text) > 4000 then raise exception 'invalid payload'; end if;
  insert into leads (kind, payload) values (p_kind, p_payload);
end $$;

-- ---------- RPC: device registration and ingestion ----------
create function create_device(p_plant uuid, p_name text default 'Gateway') returns text language plpgsql security definer set search_path = public as $$
declare v_key text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''); v_id uuid;
begin
  if not (is_staff() or exists (select 1 from plants p where p.id = p_plant and is_org_admin(p.org_id))) then raise exception 'not allowed'; end if;
  insert into devices (plant_id, name, key_hash) values (p_plant, p_name, encode(sha256(convert_to(v_key,'utf8')),'hex')) returning id into v_id;
  return v_id::text || '.' || v_key;               -- "<device id>.<key>": shown once, never stored in clear
end $$;

create function ingest_readings(p_device_key text, p_readings jsonb) returns int language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_key text; v_plant uuid; v_n int := 0; r jsonb; v_cnt int;
begin
  begin v_id := split_part(p_device_key,'.',1)::uuid; v_key := split_part(p_device_key,'.',2);
  exception when others then raise exception 'invalid device key'; end;
  select plant_id into v_plant from devices where id = v_id and key_hash = encode(sha256(convert_to(v_key,'utf8')),'hex');
  if v_plant is null then raise exception 'invalid device key'; end if;
  if jsonb_typeof(p_readings) <> 'array' or jsonb_array_length(p_readings) > 500 then raise exception 'send an array of at most 500 readings'; end if;
  for r in select * from jsonb_array_elements(p_readings) loop
    insert into readings (plant_id, kind, ts, value)
      values (v_plant, r->>'kind', coalesce((r->>'ts')::timestamptz, now()), (r->>'value')::numeric)
      on conflict do nothing;
    get diagnostics v_cnt = row_count; v_n := v_n + v_cnt;
  end loop;
  update devices set last_seen = now() where id = v_id;
  return v_n;
end $$;

-- ---------- alert rules and evaluation ----------
insert into alert_rules (kind,label,unit,warn_low,warn_high,alert_low,alert_high,action) values
 ('temperature','Digester temperature','°C',34,40,30,43,'Check heating, insulation and recent feed temperature.'),
 ('ch4','Methane','%',52,null,48,null,'Check feed mix and for air ingress; schedule a gas analysis.'),
 ('pressure','Gas pressure','mbar',8,35,4,45,'Check gas holder, valves and pipework for leaks or blockages.'),
 ('h2s','H2S after scrubber','ppm',null,300,null,500,'Inspect scrubber media; replace if saturated.'),
 ('ph','Slurry pH','',6.6,7.6,6.2,8.0,'Reduce feed rate and check for acidification.'),
 ('gas_flow','Gas flow','m3/h',null,null,null,null,'Check feeding, mixing and slurry level.');

insert into plans (code,name,price_inr_per_plant_month,max_plants,history_days,features) values
 ('starter','Starter',499,3,30,'["Live dashboard","Email alerts","Service requests","30-day history"]'),
 ('pro','Pro',1499,25,365,'["Everything in Starter","WhatsApp alerts","Performance reports","1-year history","AMC and invoices","Priority technician dispatch"]'),
 ('enterprise','Enterprise',null,null,1825,'["Everything in Pro","Unlimited plants","Custom alert rules","API access","Dedicated support"]');

-- Evaluates the latest reading per plant and kind. Opens, upgrades or resolves alerts. Run every 5 minutes.
create function evaluate_alerts() returns int language plpgsql security definer set search_path = public as $$
declare r record; v_level text; v_msg text; v_changes int := 0; v_open alerts%rowtype; v_avg7 numeric; v_avg6h numeric; p record;
begin
  for r in
    select distinct on (rd.plant_id, rd.kind) rd.plant_id, rd.kind, rd.value, rd.ts, ar.label, ar.unit, ar.warn_low, ar.warn_high, ar.alert_low, ar.alert_high, ar.action
    from readings rd join alert_rules ar on ar.kind = rd.kind
    where rd.kind <> 'gas_flow' and rd.ts > now() - interval '30 minutes'
    order by rd.plant_id, rd.kind, rd.ts desc
  loop
    v_level := case
      when (r.alert_low  is not null and r.value < r.alert_low)  or (r.alert_high is not null and r.value > r.alert_high) then 'alert'
      when (r.warn_low   is not null and r.value < r.warn_low)   or (r.warn_high  is not null and r.value > r.warn_high)  then 'warn'
      else null end;
    select * into v_open from alerts where plant_id = r.plant_id and kind = r.kind and resolved_at is null;
    if v_level is null then
      if v_open.id is not null then update alerts set resolved_at = now() where id = v_open.id; v_changes := v_changes + 1; end if;
    else
      v_msg := r.label || ' ' || round(r.value,1) || ' ' || r.unit;
      if v_open.id is null then
        insert into alerts (plant_id, kind, level, message, suggested_action) values (r.plant_id, r.kind, v_level, v_msg, r.action); v_changes := v_changes + 1;
      elsif v_open.level = 'warn' and v_level = 'alert' then
        update alerts set level = 'alert', message = v_msg where id = v_open.id; v_changes := v_changes + 1;
      end if;
    end if;
  end loop;

  -- gas flow: last 6 h average against the previous 7-day average
  for p in select distinct plant_id from readings where kind = 'gas_flow' and ts > now() - interval '6 hours' loop
    select avg(value) into v_avg6h from readings where plant_id = p.plant_id and kind = 'gas_flow' and ts > now() - interval '6 hours';
    select avg(value) into v_avg7 from readings where plant_id = p.plant_id and kind = 'gas_flow' and ts between now() - interval '7 days' and now() - interval '6 hours';
    v_level := null;
    if v_avg7 is not null and v_avg7 > 0 then
      if v_avg6h < v_avg7 * 0.60 then v_level := 'alert'; elsif v_avg6h < v_avg7 * 0.80 then v_level := 'warn'; end if;
    end if;
    select * into v_open from alerts where plant_id = p.plant_id and kind = 'gas_flow' and resolved_at is null;
    if v_level is null then
      if v_open.id is not null then update alerts set resolved_at = now() where id = v_open.id; v_changes := v_changes + 1; end if;
    else
      v_msg := 'Gas flow ' || round((1 - v_avg6h / v_avg7) * 100) || '% below 7-day average';
      if v_open.id is null then
        insert into alerts (plant_id, kind, level, message, suggested_action) select p.plant_id, 'gas_flow', v_level, v_msg, action from alert_rules where kind = 'gas_flow'; v_changes := v_changes + 1;
      elsif v_open.level = 'warn' and v_level = 'alert' then
        update alerts set level = 'alert', message = v_msg where id = v_open.id; v_changes := v_changes + 1;
      end if;
    end if;
  end loop;

  -- device offline: no data for 30 minutes from a device that has reported before
  for p in select d.plant_id from devices d where d.last_seen is not null group by d.plant_id having max(d.last_seen) < now() - interval '30 minutes' loop
    insert into alerts (plant_id, kind, level, message, suggested_action)
      values (p.plant_id, 'offline', 'warn', 'No data from the gateway for over 30 minutes', 'Check power and network at the plant.') on conflict do nothing;
  end loop;
  update alerts a set resolved_at = now() where a.kind = 'offline' and a.resolved_at is null
    and exists (select 1 from devices d where d.plant_id = a.plant_id and d.last_seen > now() - interval '30 minutes');
  return v_changes;
end $$;

-- Schedule it (Supabase: enable the pg_cron extension in Database > Extensions first, then run this line once):
-- select cron.schedule('evaluate-alerts', '*/5 * * * *', 'select evaluate_alerts()');

-- Latest value of each reading kind for a plant (used by the dashboard header)
create function latest_readings(p_plant uuid) returns table (kind text, value numeric, ts timestamptz)
language sql stable security invoker set search_path = public as $$
  select distinct on (kind) kind, value, ts from readings where plant_id = p_plant order by kind, ts desc $$;

-- Hourly series for charts
create function hourly_series(p_plant uuid, p_hours int default 24) returns table (hour timestamptz, kind text, avg_value numeric)
language sql stable security invoker set search_path = public as $$
  select date_trunc('hour', ts), kind, round(avg(value), 2) from readings
  where plant_id = p_plant and ts > now() - make_interval(hours => least(greatest(p_hours,1), 720))
  group by 1, 2 order by 1 $$;

grant usage on schema public to anon, authenticated;
grant select on plans, alert_rules to anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function submit_lead(text, jsonb), ingest_readings(text, jsonb) to anon, authenticated;
grant execute on function create_device(uuid, text), latest_readings(uuid), hourly_series(uuid, int) to authenticated;
grant execute on function is_staff(), is_member(uuid), is_org_admin(uuid), can_see_plant(uuid) to authenticated;
