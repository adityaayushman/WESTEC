// Delivers queued alert emails from notification_outbox through Resend.
// Auth: the scheduler (public.dispatch_alert_emails, run by pg_cron every 5 minutes) passes x-fn-secret,
// which this function checks against the database with verify_fn_secret. Deploy with verify_jwt = false.
// Secrets: RESEND_API_KEY (required). MAIL_FROM (optional; defaults to Resend's test sender, which can only email the Resend account owner).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: ok } = await db.rpc("verify_fn_secret", { p_name: "send_alerts", p_value: req.headers.get("x-fn-secret") ?? "" });
  if (ok !== true) return json({ error: "forbidden" }, 403);

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ error: "RESEND_API_KEY is not set" }, 500);
  const from = Deno.env.get("MAIL_FROM") ?? "Wastec Alerts <onboarding@resend.dev>";

  const { data: rows, error } = await db.from("notification_outbox").select("*").eq("status", "pending").lt("attempts", 5).order("created_at").limit(25);
  if (error) return json({ error: "db error" }, 500);

  let sent = 0, failed = 0;
  for (const m of rows ?? []) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [m.to_email], subject: m.subject, text: m.body }),
    });
    if (r.ok) {
      sent++;
      await db.from("notification_outbox").update({ status: "sent", sent_at: new Date().toISOString(), attempts: m.attempts + 1, error: null }).eq("id", m.id);
    } else {
      failed++;
      const msg = (await r.text()).slice(0, 300);
      await db.from("notification_outbox").update({ attempts: m.attempts + 1, status: m.attempts + 1 >= 5 ? "failed" : "pending", error: msg }).eq("id", m.id);
    }
  }
  return json({ sent, failed });
});
