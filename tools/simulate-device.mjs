// Sends realistic readings for one plant, as a gateway would. For testing and demos.
// Usage: node tools/simulate-device.mjs <SUPABASE_URL> <ANON_KEY> <DEVICE_KEY> [--history 7] [--fault temp|flow]
//   --history N   backfill N days of hourly data first (so charts and the 7-day average have something to compare)
//   --fault temp  then send an overheating digester;  --fault flow  then send a sharp drop in gas flow
//   without --fault it keeps sending a normal reading every 60 seconds (Ctrl+C to stop)
const [url, anon, key, ...rest] = process.argv.slice(2);
if (!url || !anon || !key) { console.error("Usage: node tools/simulate-device.mjs <SUPABASE_URL> <ANON_KEY> <DEVICE_KEY> [--history 7] [--fault temp|flow]"); process.exit(1); }
const opt = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : null; };
const days = +opt("--history") || 0, fault = opt("--fault");

const post = async (readings) => {
  const r = await fetch(`${url}/rest/v1/rpc/ingest_readings`, { method: "POST", headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
    body: JSON.stringify({ p_device_key: key, p_readings: readings }) });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
};
const noise = (a) => (Math.random() - 0.5) * a;
const point = (t, flowScale = 1, tempBias = 0) => {
  const h = new Date(t).getHours() + new Date(t).getMinutes() / 60;
  const day = 0.75 + 0.25 * Math.sin(((h - 6) / 24) * 2 * Math.PI);
  const ts = new Date(t).toISOString();
  return [
    { kind: "gas_flow", value: +(2.6 * day * flowScale + noise(0.3)).toFixed(2), ts },
    { kind: "temperature", value: +(36.5 + tempBias + 0.6 * Math.sin(((h - 10) / 24) * 2 * Math.PI) + noise(0.3)).toFixed(2), ts },
    { kind: "ch4", value: +(59 + noise(2)).toFixed(1), ts }, { kind: "pressure", value: +(18 + noise(3)).toFixed(1), ts },
    { kind: "h2s", value: +(120 + noise(40)).toFixed(0), ts }, { kind: "ph", value: +(7.1 + noise(0.2)).toFixed(2), ts },
  ];
};

if (days) {
  const batch = [];
  for (let h = days * 24; h >= 7; h--) batch.push(...point(Date.now() - h * 3600e3));
  for (let i = 0; i < batch.length; i += 480) console.log("backfilled", await post(batch.slice(i, i + 480)), "readings");
}
if (fault) {
  const batch = [];
  for (let m = 360; m >= 0; m -= 10) batch.push(...point(Date.now() - m * 60e3, fault === "flow" ? 0.45 : 1, fault === "temp" ? 8.5 : 0));
  console.log(`sent ${fault} fault:`, await post(batch), "readings. Run select evaluate_alerts(); or wait for the 5-minute schedule.");
} else {
  console.log("sending a normal reading every 60 s. Ctrl+C to stop.");
  for (;;) { console.log(new Date().toISOString(), await post(point(Date.now()))); await new Promise((r) => setTimeout(r, 60000)); }
}
