// Shared helpers for the SaaS pages: Supabase client, safe DOM builder, formatting, session guard.
(function(){
  var C = window.WASTEC || {};
  var client = null;
  if (C.supabaseUrl && C.supabaseAnonKey && window.supabase) {
    client = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  }

  // el("div", {class:"x", onclick:fn}, "text", childNode, ...)  -> text is always set as text, never as HTML
  function el(tag, props){
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function(k){
      var v = props[k]; if (v == null || v === false) return;
      if (k.slice(0,2) === "on") n.addEventListener(k.slice(2), v);
      else if (k === "class") n.className = v;
      else n.setAttribute(k, v === true ? "" : v);
    });
    (function add(list){
      for (var i = 0; i < list.length; i++) {
        var c = list[i]; if (c == null || c === false) continue;
        if (Array.isArray(c)) add(c);
        else n.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
      }
    })(Array.prototype.slice.call(arguments, 2));
    return n;
  }
  function clear(n){ while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function mount(n, kids){ clear(n); kids.forEach(function(k){ if (k) n.appendChild(k); }); }
  function table(cols, rows, empty){
    var wrap = el("div", { class: "tbl" });
    if (!rows.length) { wrap.appendChild(el("p", { class: "muted" }, empty || "Nothing here yet.")); return wrap; }
    wrap.appendChild(el("table", null,
      el("thead", null, el("tr", null, cols.map(function(c){ return el("th", null, c); }))),
      el("tbody", null, rows.map(function(r){ return el("tr", null, r.map(function(c){ return el("td", null, c); })); }))));
    return wrap;
  }
  function pill(level, text){ return el("span", { class: "pill " + level }, text || level); }
  function fmt(n, d){ return n == null ? "–" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function when(ts){ return ts ? new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–"; }
  function say(node, kind, text){ node.className = "notice " + (kind || "") ; node.hidden = false; node.textContent = text; }

  function needSetup(root){
    mount(root, [el("div", { class: "notice" },
      el("strong", null, "Backend not connected yet. "),
      "Add your Supabase URL and anon key in assets/config.js, run supabase/schema.sql, then rebuild. See the README for the steps. ",
      el("a", { href: "portal.html" }, "Open the demo portal instead.") )]);
  }
  async function session(){ if (!client) return null; var r = await client.auth.getSession(); return r.data.session; }
  async function requireSession(){
    var s = await session();
    if (!s) { location.replace("login.html"); return null; }
    return s;
  }
  async function isStaff(){
    var s = await session(); if (!s) return false;
    var r = await client.from("platform_staff").select("role").eq("user_id", s.user.id).maybeSingle();
    return !!r.data;
  }
  async function signOut(){ if (client) await client.auth.signOut(); location.href = "login.html"; }

  window.SB = { client: client, el: el, clear: clear, mount: mount, table: table, pill: pill, fmt: fmt, when: when, say: say,
                needSetup: needSetup, session: session, requireSession: requireSession, isStaff: isStaff, signOut: signOut };
})();
