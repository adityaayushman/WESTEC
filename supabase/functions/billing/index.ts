// Edge Function: Razorpay subscriptions.
//   POST {action:"subscribe", org_id, plan}  (signed-in org owner)  -> creates a Razorpay subscription, returns its short_url
//   POST with header x-razorpay-signature                           -> webhook; verifies the HMAC, updates subscriptions and the org
// Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, RAZORPAY_PLAN_STARTER, RAZORPAY_PLAN_PRO (plan ids made in the Razorpay dashboard)
// Deploy the webhook path with --no-verify-jwt on a separate function name if you prefer; here one function serves both and checks auth itself.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function hmacHex(secret: string, body: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const same = (a: string, b: string) => a.length === b.length && [...a].reduce((x, c, i) => x | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const raw = await req.text();

  // ----- webhook -----
  const sig = req.headers.get("x-razorpay-signature");
  if (sig) {
    const expected = await hmacHex(Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!, raw);
    if (!same(expected, sig)) return json({ error: "bad signature" }, 401);
    const ev = JSON.parse(raw);
    const sub = ev?.payload?.subscription?.entity;
    if (!sub?.id) return json({ ok: true });
    const status = ({ "subscription.activated": "active", "subscription.charged": "active", "subscription.halted": "past_due",
                      "subscription.cancelled": "cancelled", "subscription.completed": "cancelled" } as Record<string, string>)[ev.event];
    if (!status) return json({ ok: true });
    const db = admin();
    const { data: row } = await db.from("subscriptions").update({
      status, current_period_end: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null,
    }).eq("razorpay_subscription_id", sub.id).select("org_id,plan").maybeSingle();
    if (row) await db.from("organizations").update({ plan: status === "cancelled" ? "trial" : row.plan, plan_status: status }).eq("id", row.org_id);
    return json({ ok: true });
  }

  // ----- subscribe -----
  try {
    const { action, org_id, plan } = JSON.parse(raw);
    if (action !== "subscribe" || !["starter", "pro"].includes(plan)) return json({ error: "Choose the Starter or Pro plan." }, 400);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: org } = await userClient.from("organizations").select("id,name").eq("id", org_id).maybeSingle(); // RLS: members only
    const { data: me } = await userClient.auth.getUser();
    if (!org || !me.user) return json({ error: "Not allowed." }, 403);
    const { data: m } = await userClient.from("org_members").select("role").eq("org_id", org_id).eq("user_id", me.user.id).maybeSingle();
    if (m?.role !== "owner") return json({ error: "Only the organisation owner can subscribe." }, 403);

    const { count } = await userClient.from("plants").select("id", { count: "exact", head: true }).eq("org_id", org_id);
    const quantity = Math.max(1, count ?? 1); // price is per plant per month
    const planId = Deno.env.get(plan === "pro" ? "RAZORPAY_PLAN_PRO" : "RAZORPAY_PLAN_STARTER");
    const auth = "Basic " + btoa(`${Deno.env.get("RAZORPAY_KEY_ID")}:${Deno.env.get("RAZORPAY_KEY_SECRET")}`);
    const r = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId, total_count: 120, quantity, customer_notify: 1, notes: { org_id, org_name: org.name } }),
    });
    const sub = await r.json();
    if (!r.ok) return json({ error: "Could not start the subscription. Please contact us." }, 502);
    await admin().from("subscriptions").insert({ org_id, plan, razorpay_subscription_id: sub.id, status: sub.status ?? "created" });
    return json({ url: sub.short_url });
  } catch (_e) {
    return json({ error: "Something went wrong." }, 500);
  }
});
