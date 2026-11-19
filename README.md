# Wastec website

Static site (no framework, no runtime dependencies). `node build.mjs` writes `dist/`; deploy `dist/` to any static host.

```
src/pages/*.html   page content (first line: <!-- title | description -->)
src/assets/        style.css, app.js, config.js
build.mjs          wraps pages in the shared header/footer, writes dist/, sitemap, robots, 404
supabase/schema.sql  database + row-level-security for the customer portal
CONTENT-TODO.md    facts to confirm before launch
```

## Before launch
1. Fill `src/assets/config.js`: `email`, `phone`, `whatsapp`, `formEndpoint`. Empty values hide the item or switch the form to a copy-details fallback.
2. Confirm the items in `CONTENT-TODO.md` (product list, services, company facts).
3. Add a custom domain in the host, then replace relative URLs in `sitemap.xml` with absolute ones.

## What is real and what is a demo
| Part | Status |
|---|---|
| Public pages, calculator, quote and fault forms | Working. Forms send once `formEndpoint` is set. |
| Customer portal (`portal.html`) | **Demo with simulated data.** Needs Supabase to go live. |

## Taking the portal live (phase 2 to 4)
1. Create a Supabase project, run `supabase/schema.sql`.
2. Create staff users and set `profiles.role`.
3. Edge Function `ingest`: gateway posts `{device_key, readings[]}`, function checks `device_key_hash`, inserts with the service role.
4. Edge Function `lead`: public forms post here; it inserts into `leads` and emails sales. Put its URL in `formEndpoint`.
5. Replace the sample block in `portal.html` with queries to `readings`, `alerts`, `tickets`, `amc_contracts`, `invoices`, and add Supabase Auth login.
6. Alerts: a scheduled function compares readings with the limits in the portal's Alerts tab and writes to `alerts`.
7. Predictive maintenance only after several weeks of real readings exist.

## Safety and privacy
The site gives no instructions for repairing gas-handling parts. Plant data belongs to the customer; say so in the contract. Add a privacy policy page before collecting real leads.
