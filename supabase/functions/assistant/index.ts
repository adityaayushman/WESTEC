// Edge Function: plant assistant. Signed-in customers ask about a fault; the answer is grounded in that plant's own readings and alerts.
// Secrets: ANTHROPIC_API_KEY. Deploy: supabase functions deploy assistant   (verify_jwt stays ON, so only signed-in users can call it)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `You are the plant assistant for Wastec, a biogas machinery and maintenance company in India.
You help plant owners understand what their readings may mean and what to check. Rules:
- Use only the plant data provided. If a number is missing, say so. Never invent readings.
- Give likely causes in order of probability and the simplest safe checks first.
- Never give instructions for opening, repairing or welding gas lines, gas holders or anything that holds biogas. For those, tell the person to stop and raise a service request.
- If the person describes a gas smell, hissing, or a flame where there should not be one: tell them to put out flames, ventilate, keep away from switches, leave the area and call Wastec or emergency services. Say nothing else first.
- H2S is toxic. Never suggest sniffing to test for it.
- Be short and plain. End with whether a technician visit is advisable (yes, no, or only if it continues) and why.
- You are advice, not a diagnosis. The technician decides.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const { plant_id, question } = await req.json();
    if (typeof question !== "string" || !question.trim() || question.length > 1500) return json({ error: "Ask a question of up to 1500 characters." }, 400);

    // Query as the caller so row-level security decides what they may see.
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: plant } = await sb.from("plants").select("id,name,feedstock,digester_m3,location").eq("id", plant_id).maybeSingle();
    if (!plant) return json({ error: "Plant not found." }, 404);
    const [{ data: latest }, { data: alerts }, { data: series }] = await Promise.all([
      sb.rpc("latest_readings", { p_plant: plant_id }),
      sb.from("alerts").select("kind,level,message,raised_at").eq("plant_id", plant_id).is("resolved_at", null),
      sb.rpc("hourly_series", { p_plant: plant_id, p_hours: 24 }),
    ]);

    const context = JSON.stringify({ plant, latest_readings: latest, open_alerts: alerts, last_24h_hourly_average: series }, null, 1).slice(0, 12000);
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-5-5", max_tokens: 700, system: SYSTEM,
        messages: [{ role: "user", content: `Plant data:\n${context}\n\nOwner's question:\n${question.trim()}` }],
      }),
    });
    if (!r.ok) return json({ error: "The assistant is unavailable right now. Please raise a service request." }, 502);
    const out = await r.json();
    return json({ answer: out.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "" });
  } catch (_e) {
    return json({ error: "Something went wrong." }, 500);
  }
});
