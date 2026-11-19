// Runs supabase/schema.sql in an in-process Postgres (PGlite) with Supabase-style auth stubs and checks isolation and alerting.
// Usage: from a folder where `npm i @electric-sql/pglite` was run:  node schema.test.mjs <path-to-schema.sql>
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const sql = fs.readFileSync(process.argv[2], "utf8");
const db = new PGlite();
let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
  create role anon; create role authenticated;
`);
await db.exec(sql);
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated; grant select on all tables in schema public to anon;
               grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
await db.exec("revoke select on leads from anon; revoke insert, update, delete on readings, alerts, devices, subscriptions from authenticated;");

const as = async (uid, role = "authenticated") => { await db.exec(`reset role; set request.jwt.sub = '${uid ?? ""}'; set role ${role}`); };
const su = async () => db.exec("reset role");
const q = async (s, p) => (await db.query(s, p)).rows;

// users
await su();
const [A] = await q("insert into auth.users(raw_user_meta_data) values ('{\"full_name\":\"Asha\",\"org_name\":\"Green Dairy\"}') returning id");
const [B] = await q("insert into auth.users(raw_user_meta_data) values ('{\"org_name\":\"City Hotel\"}') returning id");
const [S] = await q("insert into auth.users default values returning id");
await db.exec(`insert into platform_staff values ('${S.id}','admin')`);
ok((await q("select count(*)::int c from org_members group by user_id having user_id in ($1,$2)", [A.id, B.id])).every(r => r.c === 1) && (await q("select count(*)::int c from organizations"))[0].c === 3, "sign-up trigger creates one organization and one owner membership per user");
const orgA = (await q("select org_id from org_members where user_id=$1", [A.id]))[0].org_id;
const orgB = (await q("select org_id from org_members where user_id=$1", [B.id]))[0].org_id;

// staff create plants
await as(S.id);
const [pa] = await q("insert into plants(org_id,name) values ($1,'Dairy 40') returning id", [orgA]);
const [pb] = await q("insert into plants(org_id,name) values ($1,'Hotel 12') returning id", [orgB]);

// isolation
await as(A.id);
ok((await q("select count(*)::int c from plants"))[0].c === 1, "customer A sees only their own plant");
ok((await q("select count(*)::int c from organizations"))[0].c === 1, "customer A sees only their own organization");
let blocked = false; try { await q("insert into plants(org_id,name) values ($1,'x')", [orgA]); } catch { blocked = true; }
ok(blocked, "customer cannot create plants");
blocked = false; try { await q("insert into readings(plant_id,kind,value) values ($1,'temperature',36)", [pa.id]); } catch { blocked = true; }
ok(blocked, "customer cannot write readings directly");
blocked = false; try { await q("insert into tickets(org_id,symptom,raised_by) values ($1,'x',$2)", [orgB, A.id]); } catch { blocked = true; }
ok(blocked, "customer cannot raise a ticket in another organization");
await q("insert into tickets(org_id,plant_id,symptom,raised_by) values ($1,$2,'Weak flame',$3)", [orgA, pa.id, A.id]);
ok((await q("select count(*)::int c from tickets"))[0].c === 1, "customer can raise a ticket in their own organization");

// devices and ingestion
await as(B.id);
blocked = false; try { await q("select create_device($1)", [pa.id]); } catch { blocked = true; }
ok(blocked, "customer cannot create a device for another organization's plant");
await as(A.id);
blocked = false; try { await q("select create_device($1)", [pa.id]); } catch { blocked = true; }
ok(blocked === false, "organization owner can create a device for their plant");
const key = (await q("select create_device($1) k", [pa.id]))[0].k;
await as(null, "anon");
const t = (h) => new Date(Date.now() - h * 3600e3).toISOString();
let rows = [];
for (let h = 168; h > 6; h--) rows.push({ kind: "gas_flow", value: 2.5, ts: t(h) });
rows.push({ kind: "temperature", value: 36.4 });
ok((await q("select ingest_readings($1,$2) n", [key, JSON.stringify(rows)]))[0].n === rows.length, "device key ingests readings");
blocked = false; try { await q("select ingest_readings($1,$2)", [key.slice(0, -2) + "00", "[]"]); } catch { blocked = true; }
ok(blocked, "wrong device key is rejected");
blocked = false; try { await q("select count(*) from readings"); const r = await q("select count(*)::int c from readings"); blocked = r[0].c === 0; } catch { blocked = true; }
ok(blocked, "anonymous users cannot read readings");

// alerts
await su();
await q("select evaluate_alerts()");
ok((await q("select count(*)::int c from alerts"))[0].c === 0, "normal readings raise no alert");
await q("insert into readings(plant_id,kind,value,ts) values ($1,'temperature',45,now())", [pa.id]);
await q("select evaluate_alerts()");
let al = await q("select level,message from alerts where resolved_at is null");
ok(al.length === 1 && al[0].level === "alert", "temperature 45 °C opens an alert: " + (al[0]?.message ?? ""));
await q("select evaluate_alerts()");
ok((await q("select count(*)::int c from alerts where resolved_at is null"))[0].c === 1, "re-running does not duplicate the alert");
await q("insert into readings(plant_id,kind,value,ts) values ($1,'temperature',36.8,now() + interval '1 second')", [pa.id]);
await q("select evaluate_alerts()");
ok((await q("select count(*)::int c from alerts where resolved_at is null"))[0].c === 0, "alert resolves when the reading returns to normal");
for (let h = 5; h >= 0; h--) await q("insert into readings(plant_id,kind,value,ts) values ($1,'gas_flow',1.2,now() - make_interval(hours=>$2))", [pa.id, h]);
await q("select evaluate_alerts()");
al = await q("select level,message from alerts where resolved_at is null and kind='gas_flow'");
ok(al.length === 1 && al[0].level === "alert", "gas flow 52% below the 7-day average opens an alert: " + (al[0]?.message ?? ""));

// visibility of alerts and series
await as(A.id);
ok((await q("select count(*)::int c from alerts"))[0].c >= 1, "customer sees alerts for their plant");
ok((await q("select count(*)::int c from hourly_series($1, 24)", [pa.id]))[0].c > 0, "hourly series returns rows");
ok((await q("select count(*)::int c from latest_readings($1)", [pa.id]))[0].c >= 2, "latest readings returns rows");
await as(B.id);
ok((await q("select count(*)::int c from alerts"))[0].c === 0, "customer B sees none of A's alerts");

// leads
await as(null, "anon");
await q("select submit_lead('quote', $1)", [JSON.stringify({ name: "Ravi", phone: "9000000000" })]);
blocked = false; try { await q("select submit_lead('spam', '{}')"); } catch { blocked = true; }
ok(blocked, "invalid lead kind is rejected");
blocked = false; try { await q("select count(*)::int c from leads").then(r => { if (r[0].c === 0) throw 0; }); } catch { blocked = true; }
ok(blocked, "anonymous users cannot read leads");
await as(S.id);
ok((await q("select count(*)::int c from leads"))[0].c === 1, "staff can read leads");

console.log(fails ? `\n${fails} FAILED` : "\nAll checks passed");
process.exit(fails ? 1 : 0);
