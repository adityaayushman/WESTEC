# Wastec: website and plant-monitoring SaaS

Static front end (no framework) plus a Supabase backend. `node build.mjs` writes `dist/`; any static host serves it.

```
src/pages/        public site + SaaS pages (login, app, admin, pricing, portal demo)
src/assets/       style.css, app.js, config.js, sb.js (Supabase helpers), chart.js
supabase/schema.sql        multi-tenant database, row-level security, alert engine, RPCs
supabase/functions/        assistant (Claude), billing (Razorpay)
supabase/test/             schema tests (24 checks, run in an in-process Postgres)
tools/simulate-device.mjs  fake gateway for testing and demos
CONTENT-TODO.md            facts to confirm before launch
```

## What exists
| Capability | Where | State |
|---|---|---|
| Marketing site, calculator, quote and fault forms | public pages | Working. Forms write to the `leads` table once Supabase is connected. |
| Accounts and tenants | `login.html`, `schema.sql` | Sign-up creates an organisation and an owner. Written; needs your Supabase project. |
| Live dashboard, alerts, service requests, devices | `app.html` | Written. Needs your Supabase project. |
| Staff console: leads, customers, plants, tickets, fleet alerts, invoices, contracts | `admin.html` | Written. Needs a staff row (below). |
| Ingestion | RPC `ingest_readings`, `tools/simulate-device.mjs` | Tested in the schema tests. |
| Alert engine | SQL `evaluate_alerts()` | Tested: threshold, gas-flow drop, resolve, no duplicates. |
| Pricing page | `pricing.html` | Reads the `plans` table. Prices are PROPOSED. |
| AI assistant | Edge Function `assistant` | Written, **not run**. Needs `ANTHROPIC_API_KEY`. |
| Subscriptions | Edge Function `billing` | Written, **not run**. Needs Razorpay account, plan ids and webhook. |
| Predictive maintenance | none | Deliberately not built. Needs weeks of real readings first. |

## Go live (about 30 minutes)
1. **Supabase project.** Create one at supabase.com. In the SQL editor, run `supabase/schema.sql`.
2. **Auth settings.** Authentication > URL configuration: set Site URL to your deployed address. Decide whether to require email confirmation.
3. **Schedule alerts.** Database > Extensions: enable `pg_cron`, then run:
   `select cron.schedule('evaluate-alerts','*/5 * * * *','select evaluate_alerts()');`
4. **Connect the site.** Put the project URL and anon key in `src/assets/config.js` (anon key only, never the service_role key). Run `node build.mjs`, redeploy.
5. **Make yourself staff.** Sign up on the site, then in the SQL editor:
   `insert into platform_staff select id, 'admin' from auth.users where email = 'you@example.com';`
   Then open `/admin.html`.
6. **Add a customer plant.** In the console: Customers > add plant to their organisation > "New key". The key is shown once; it goes into the gateway.
7. **Try it without hardware.**
   `node tools/simulate-device.mjs <URL> <ANON_KEY> <DEVICE_KEY> --history 7` then `--fault temp`, then run `select evaluate_alerts();` and watch the alert appear in the app and console.
8. **Assistant (optional).** `supabase secrets set ANTHROPIC_API_KEY=...` then `supabase functions deploy assistant`.
9. **Billing (optional).** Create Starter and Pro plans in Razorpay, then set secrets `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PLAN_STARTER`, `RAZORPAY_PLAN_PRO`, deploy `billing`, and point a Razorpay webhook (subscription.* events) at its URL. Test in Razorpay test mode first.

## Security model
- The browser holds only the anon key. Every table has row-level security; customers see their own organisation, staff see all.
- Customers cannot write readings, alerts, devices or subscriptions. Gateways write only through `ingest_readings` with a device key whose hash is stored; the raw key is shown once.
- Public forms call `submit_lead`, which validates and size-limits input. `leads` is unreadable to anonymous users.
- `evaluate_alerts()` is not callable from the browser.
- The assistant never sees data the signed-in user could not read, and its prompt forbids gas-line repair instructions.

## Tests
`supabase/test/schema.test.mjs` runs the schema in PGlite (Postgres in WebAssembly): isolation between customers, device-key ingestion, alert open/resolve, leads. From a scratch folder: `npm i @electric-sql/pglite`, then `node schema.test.mjs path/to/supabase/schema.sql`. It does **not** test the edge functions, the Supabase auth service, the browser pages against a live backend, or Razorpay.

## Safety and privacy
The site gives no instructions for repairing gas-handling parts. Plant data belongs to the customer; say so in the contract. Add a privacy policy and terms before taking real sign-ups.
