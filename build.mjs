// Zero-dependency static build: wraps each src/pages/*.html fragment in the shared layout.
// Usage: node build.mjs   ->  writes ./dist
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const src = path.join(root, "src");
const dist = path.join(root, "dist");
fs.mkdirSync(dist, { recursive: true });
for (const f of fs.readdirSync(dist)) fs.rmSync(path.join(dist, f), { recursive: true, force: true });
fs.cpSync(path.join(src, "assets"), path.join(dist, "assets"), { recursive: true });

const NAV = [
  ["products", "Products"], ["services", "Services"], ["calculator", "Biogas calculator"],
  ["pricing", "Pricing"], ["about", "About"], ["portal", "Live demo"],
];

const layout = ({ title, desc, key, body }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="theme-color" content="#1d4a37">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="assets/style.css">
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org", "@type": "Organization", name: "Wastec",
  legalName: "Kukreja's Wastec Bio-Gas Private Limited",
  address: { "@type": "PostalAddress", streetAddress: "AIC-BARC, 1st Floor, DAE Con, Anushaktinagar", addressLocality: "Mumbai", addressRegion: "Maharashtra", postalCode: "400094", addressCountry: "IN" },
})}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="hdr"><div class="wrap">
  <a class="logo" href="index.html"><i aria-hidden="true"></i>Wastec</a>
  <button class="icon-btn menu-btn" id="menu-btn" aria-expanded="false" aria-controls="nav">Menu</button>
  <nav class="nav" id="nav" aria-label="Main">
    ${NAV.map(([k, l]) => `<a href="${k}.html"${k === key ? ' aria-current="page"' : ""}>${l}</a>`).join("\n    ")}
    <a href="login.html">Sign in</a>
    <a class="btn sm" href="contact.html">Get a quote</a>
    <button class="icon-btn" id="theme-btn" type="button" aria-label="Switch light and dark theme">Theme</button>
  </nav>
</div></header>
<main id="main">
${body}
</main>
<footer class="ftr"><div class="wrap">
  <div>
    <a class="logo" href="index.html" style="padding:0"><i aria-hidden="true"></i>Wastec</a>
    <p class="muted" style="margin-top:12px;max-width:44ch">Biogas plants, machinery and maintenance, with monitoring that tells you about a problem before it stops the plant.</p>
    <p class="fine">Kukreja's Wastec Bio-Gas Private Limited<br>Registered office: AIC-BARC, 1st Floor, DAE Con, Anushaktinagar, Mumbai 400094<br>CIN U38210MH2025PTC438888</p>
  </div>
  <div><h3>Company</h3>
    <a href="products.html">Products</a><a href="services.html">Services</a><a href="calculator.html">Biogas calculator</a><a href="about.html">About</a></div>
  <div><h3>Contact</h3>
    <a href="contact.html">Request a quote</a><a href="contact.html#service">Report a fault</a><a href="pricing.html">Pricing</a><a href="login.html">Customer sign in</a><a href="portal.html">Live demo</a>
    <a data-email href="#"></a><a data-phone href="#"></a></div>
</div></footer>
<script src="assets/config.js"></script>
<script src="assets/app.js"></script>
</body>
</html>
`;

const pages = fs.readdirSync(path.join(src, "pages")).filter(f => f.endsWith(".html"));
const urls = [];
for (const f of pages) {
  let raw = fs.readFileSync(path.join(src, "pages", f), "utf8");
  const m = raw.match(/^<!--\s*(.+?)\s*\|\s*(.+?)\s*-->\s*/);
  if (!m) throw new Error(f + ": missing <!-- title | description --> header");
  const key = f.replace(".html", "");
  raw = raw.slice(m[0].length);
  const scripts = raw.match(/<script data-page(?:\s[^>]*)?>[\s\S]*?<\/script>/g) || [];
  scripts.forEach(s => (raw = raw.replace(s, "")));
  let html = layout({ title: m[1], desc: m[2], key, body: raw });
  html = html.replace("</body>", scripts.map(s => s.replace(" data-page", "")).join("\n") + "\n</body>");
  fs.writeFileSync(path.join(dist, f), html);
  urls.push(f);
}
fs.writeFileSync(path.join(dist, "404.html"), layout({
  title: "Page not found | Wastec", desc: "Page not found", key: "",
  body: `<section><div class="wrap"><h1>Page not found</h1><p class="lead" style="margin-top:12px">That address does not exist. Try the <a href="index.html">home page</a> or <a href="contact.html">contact us</a>.</p></div></section>`,
}));
fs.writeFileSync(path.join(dist, "robots.txt"), "User-agent: *\nAllow: /\n");
fs.writeFileSync(path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>/${u}</loc></url>`).join("\n")}\n</urlset>\n`);
console.log("built", urls.length, "pages ->", dist);
