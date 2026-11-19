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
<link rel="stylesheet" href="assets/design.css">
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org", "@type": "Organization", name: "Wastec",
  legalName: "Kukreja's Wastec Bio-Gas Private Limited",
  address: { "@type": "PostalAddress", streetAddress: "AIC-BARC, 1st Floor, DAE Con, Anushaktinagar", addressLocality: "Mumbai", addressRegion: "Maharashtra", postalCode: "400094", addressCountry: "IN" },
})}</script>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="i-flame" viewBox="0 0 24 24"><path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z"/></symbol>
<symbol id="i-tank" viewBox="0 0 24 24"><path d="M5 9a7 7 0 0 1 14 0v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z M5 14h14"/></symbol>
<symbol id="i-wrench" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.7-.7-2.6z"/></symbol>
<symbol id="i-gauge" viewBox="0 0 24 24"><path d="M4 17a8 8 0 1 1 16 0 M12 17l4-5 M7 17h1 M16 17h1 M12 9v1"/></symbol>
<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4"/></symbol>
<symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13 3L5 14h6l-1 7 8-11h-6z"/></symbol>
<symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 20V4 M4 20h16 M8 16l4-5 3 3 5-7"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-7-6-7-11a7 7 0 1 1 14 0c0 5-7 11-7 11z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2"/></symbol>
<symbol id="i-file" viewBox="0 0 24 24"><path d="M7 3h8l4 4v14H7z M14 3v5h5 M10 13h6 M10 17h6"/></symbol>
<symbol id="i-truck" viewBox="0 0 24 24"><path d="M3 7h11v9H3z M14 10h4l3 3v3h-7z M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M17 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></symbol>
<symbol id="i-leaf" viewBox="0 0 24 24"><path d="M5 19C5 10 11 5 20 4c0 9-5 15-13 15 M5 19l6-6"/></symbol>
<symbol id="i-cog" viewBox="0 0 24 24"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M18.4 5.6l-2.1 2.1 M7.7 16.3l-2.1 2.1"/></symbol>
<symbol id="i-users" viewBox="0 0 24 24"><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20a6 6 0 0 1 12 0 M16 11a2.5 2.5 0 1 0 0-5 M17 14a5 5 0 0 1 4 6"/></symbol>
<symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0"/></symbol>
<symbol id="i-clipboard" viewBox="0 0 24 24"><path d="M9 4h6v3H9z M7 5H5v16h14V5h-2 M9 12h6 M9 16h4"/></symbol>
</defs></svg>
<a class="skip" href="#main">Skip to content</a>
<header class="hdr"><div class="wrap">
  <a class="logo" href="index.html"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="currentColor"/><path d="M16 6c1.2 3.6 5.6 6 5.6 11a5.6 5.6 0 0 1-11.2 0c0-2.2 1.2-3.8 2.8-5 0 2.2 1.1 3.4 2.4 3.4 0-3.4-1-5.6.4-9.4z" fill="var(--flame)"/></svg>Wastec</a>
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
    <a class="logo" href="index.html" style="padding:0"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="currentColor"/><path d="M16 6c1.2 3.6 5.6 6 5.6 11a5.6 5.6 0 0 1-11.2 0c0-2.2 1.2-3.8 2.8-5 0 2.2 1.1 3.4 2.4 3.4 0-3.4-1-5.6.4-9.4z" fill="var(--flame)"/></svg>Wastec</a>
    <p class="muted" style="margin-top:12px;max-width:44ch">Biogas plants, machinery and maintenance, with monitoring that tells you about a problem before it stops the plant.</p>
    <p class="fine">Kukreja's Wastec Bio-Gas Private Limited<br>Registered office: AIC-BARC, 1st Floor, DAE Con, Anushaktinagar, Mumbai 400094<br>CIN U38210MH2025PTC438888</p>
  </div>
  <div><h3>Company</h3>
    <a href="products.html">Products</a><a href="services.html">Services</a><a href="calculator.html">Biogas calculator</a><a href="about.html">About</a></div>
  <div><h3>Contact</h3>
    <a href="contact.html">Request a quote</a><a href="contact.html#service">Report a fault</a><a href="pricing.html">Pricing</a><a href="login.html">Customer sign in</a><a href="portal.html">Live demo</a>
    <a data-email href="#"></a><a data-phone href="#"></a></div>
  <div class="legal"><span>© Kukreja's Wastec Bio-Gas Private Limited</span><span><a href="privacy.html">Privacy policy</a><a href="terms.html">Terms of service</a></span></div>
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
