(function(){
  var C = window.WASTEC || {};

  // mobile menu
  var mb = document.getElementById("menu-btn"), nav = document.getElementById("nav");
  if (mb && nav) mb.addEventListener("click", function(){
    var o = nav.classList.toggle("open"); mb.setAttribute("aria-expanded", o);
  });

  // theme toggle (remembered per browser, optional)
  var tb = document.getElementById("theme-btn");
  function applyTheme(t){ if (t) document.documentElement.setAttribute("data-theme", t); }
  try { applyTheme(localStorage.getItem("wastec-theme")); } catch(e){}
  if (tb) tb.addEventListener("click", function(){
    var cur = document.documentElement.getAttribute("data-theme") ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var next = cur === "dark" ? "light" : "dark";
    applyTheme(next); try { localStorage.setItem("wastec-theme", next); } catch(e){}
  });

  // contact details injected from config so they are edited in one place
  document.querySelectorAll("[data-email]").forEach(function(el){
    if (C.email) { el.textContent = C.email; el.href = "mailto:" + C.email; } else { el.hidden = true; }
  });
  document.querySelectorAll("[data-phone]").forEach(function(el){
    if (C.phone) { el.textContent = C.phone; el.href = "tel:" + C.phone.replace(/\s/g,""); } else { el.hidden = true; }
  });
  document.querySelectorAll("[data-whatsapp]").forEach(function(el){
    if (C.whatsapp) { el.href = "https://wa.me/" + C.whatsapp; } else { el.hidden = true; }
  });

  // forms: POST to the configured endpoint, else show a copyable summary
  document.querySelectorAll("form[data-lead]").forEach(function(form){
    form.addEventListener("submit", function(ev){
      ev.preventDefault();
      var out = form.querySelector(".result");
      var missing = Array.prototype.filter.call(form.querySelectorAll("[required]"), function(el){ return !el.value.trim(); });
      if (missing.length) {
        out.className = "notice bad result"; out.hidden = false;
        out.textContent = "Please fill in: " + missing.map(function(el){ return form.querySelector('label[for="' + el.id + '"]').textContent.replace(/\(optional\)/,"").trim(); }).join(", ") + ".";
        missing[0].focus(); return;
      }
      if (form.elements.company_website && form.elements.company_website.value) return; // honeypot
      var data = {}; new FormData(form).forEach(function(v,k){ if (k !== "company_website") data[k] = v; });
      data.type = form.getAttribute("data-lead"); data.page = location.pathname; data.sent_at = new Date().toISOString();
      var text = Object.keys(data).map(function(k){ return k + ": " + data[k]; }).join("\n");
      var btn = form.querySelector("button[type=submit]"); if (btn) btn.disabled = true;

      function showFallback(why){
        out.className = "notice result"; out.hidden = false; out.innerHTML = "";
        var p = document.createElement("p");
        p.textContent = why + " Copy these details and send them to us:";
        var pre = document.createElement("pre"); pre.className = "mono"; pre.style.whiteSpace = "pre-wrap"; pre.textContent = text;
        var cp = document.createElement("button"); cp.type = "button"; cp.className = "btn alt sm"; cp.textContent = "Copy details";
        cp.addEventListener("click", function(){
          if (navigator.clipboard) navigator.clipboard.writeText(text).then(function(){ cp.textContent = "Copied"; }, function(){ cp.textContent = "Select and copy manually"; });
        });
        out.appendChild(p); out.appendChild(pre); out.appendChild(cp);
        if (C.whatsapp) {
          var a = document.createElement("a"); a.className = "btn sm"; a.style.marginLeft = "8px"; a.textContent = "Open WhatsApp";
          a.href = "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(text); a.target = "_blank"; a.rel = "noopener";
          out.appendChild(a);
        }
        if (btn) btn.disabled = false;
      }

      if (!C.formEndpoint) { showFallback("Online sending is not switched on yet."); return; }
      fetch(C.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(data) })
        .then(function(r){ if (!r.ok) throw new Error(r.status);
          out.className = "notice ok result"; out.hidden = false;
          out.textContent = "Thanks. We have your request and will reply within one working day.";
          form.reset(); if (btn) btn.disabled = false; })
        .catch(function(){ showFallback("We could not send that just now."); });
    });
  });
})();
