// Edge Function: delivers queued alert emails from notification_outbox through Resend (https://resend.com).
// Secrets: RESEND_API_KEY, MAIL_FROM (a sender on a domain verified in Resend, e.g. "Wastec Alerts <alerts@yourdomain.in>"), ALERT_FN_SECRET (any long random string).
// Run it every 5 minutes. Deploy with `supabase functions deploy send-alerts --no-verify-jwt`, then in the SQL editor
// (needs the pg_net extension and your project URL; keep the secret out of version control):
//   select cron.schedule('send-alert-emails','*/5 * * * *', $$ select net.http_post(
//     url := 'https://<project-ref>.supabase.co/functions/v1/send-alerts',
//     headers := jsonb_build_object('x-fn-secret', '<ALERT_FN_SECRET>')) $$);
// Not run against a real mail provider yet.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

Deno.serve(async (req) => {
  if (req.headers.get("x-fn-secret") !== Deno.env.get("ALERT_FN_SECRET")) return new Response("forbidden", { status: 403 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rows, error } = await db.from("notification_outbox").select("*").eq("status", "pending").lt("attempts", 5).order("created_at").limit(25);
  if (error) return new Response("db error", { status: 500 });
  let sent = 0, failed = 0;
  for (const m of rows ?? []) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: Deno.env.get("MAIL_FROM"), to: [m.to_email], subject: m.subject, text: m.body }),
    });
    if (r.ok) { sent++; await db.from("notification_outbox").update({ status: "sent", sent_at: new Date().toISOString(), attempts: m.attempts + 1 }).eq("id", m.id); }
    else { failed++; await db.from("notification_outbox").update({ attempts: m.attempts + 1, status: m.attempts + 1 >= 5 ? "failed" : "pending", error: (await r.text()).slice(0, 300) }).eq("id", m.id); }
  }
  return new Response(JSON.stringify({ sent, failed }), { headers: { "Content-Type": "application/json" } });
});
