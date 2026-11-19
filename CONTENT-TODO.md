# Confirm before launch

The site was written without access to wastecgroup.in (it returned 403), so these are assumptions from the brief.

- [ ] Product categories on `products.html`: remove what you do not supply, add what is missing, add makes and photos.
- [ ] Services on `services.html`: confirm AMC terms, visits per year, what "on call" means.
- [ ] Reply time ("within one working day") on the home and contact pages.
- [ ] Contact details in `src/assets/config.js`.
- [ ] Company facts on `about.html` come from the public Tracxn listing (name, CIN, address, directors). Confirm and add the real story and team.
- [ ] Calculator constants (`calculator.html`): yields, 0.43 kg LPG per m³, 1.8 kWh per m³, ₹8/kWh. Have your engineer sign these off.
- [ ] Add real projects, photos and customer quotes only when they are real. There are none on the site today.
- [ ] Privacy policy and terms pages.
- [ ] Subsidy wording on the home FAQ: link the current MNRE/state scheme.

## SaaS additions
- [ ] Plan prices in `supabase/schema.sql` (Starter ₹499, Pro ₹1,499 per plant per month) are proposals. Confirm, and change the seed and the fallback in `pricing.html` together.
- [ ] Plan limits (3 / 25 plants) and history days are not enforced in code yet. Decide whether to enforce them.
- [ ] No trial period or free tier is enforced. The `trial` plan is just the default.
- [ ] Alert thresholds in `alert_rules` are typical mesophilic values. Have your engineer review them per feedstock.
- [ ] "WhatsApp alerts" and "Email alerts" are listed as plan features, but notification sending is not built. Alerts show in the app and console only.
- [ ] Privacy policy, terms of service, and a data-ownership clause in customer contracts.
