// Two-axis line chart on canvas. series: [{values:[{t:Date,v:Number}], color, axis:"left"|"right", unit}]
window.WastecChart = (function(){
  function nice(min, max, n){
    var span = (max - min) || 1, step = Math.pow(10, Math.floor(Math.log10(span / n))), e = span / n / step;
    step *= e < 1.5 ? 1 : e < 3 ? 2 : e < 7 ? 5 : 10;
    return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step: step };
  }
  function draw(canvas, series, hours){
    var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    var x = canvas.getContext("2d"); x.scale(dpr, dpr); x.clearRect(0, 0, w, h);
    var cs = getComputedStyle(document.documentElement), col = function(n){ return cs.getPropertyValue(n).trim(); };
    var padL = 44, padR = 44, padT = 10, padB = 28, iw = w - padL - padR, ih = h - padT - padB;
    var now = Date.now(), t0 = now - hours * 3600e3;
    var X = function(t){ return padL + iw * (t - t0) / (now - t0); };
    x.font = "11px " + getComputedStyle(document.body).fontFamily;
    var any = series.some(function(s){ return s.values.length; });
    if (!any) { x.fillStyle = col("--ink-2"); x.textAlign = "center"; x.fillText("No readings in this period yet.", w / 2, h / 2); return; }
    var scales = {};
    ["left", "right"].forEach(function(side){
      var vals = []; series.forEach(function(s){ if (s.axis === side) s.values.forEach(function(p){ vals.push(p.v); }); });
      if (vals.length) scales[side] = nice(side === "left" ? Math.min(0, Math.min.apply(null, vals)) : Math.min.apply(null, vals) - 0.5, Math.max.apply(null, vals) + (side === "left" ? 0 : 0.5), 4);
    });
    var Y = function(side, v){ var s = scales[side]; return padT + ih * (1 - (v - s.min) / (s.max - s.min)); };
    x.textBaseline = "middle"; x.lineWidth = 1;
    var gl = scales.left || scales.right;
    for (var v = gl.min; v <= gl.max + 1e-9; v += gl.step) {
      var y = Y(scales.left ? "left" : "right", v);
      x.strokeStyle = col("--line"); x.beginPath(); x.moveTo(padL, y); x.lineTo(w - padR, y); x.stroke();
      x.fillStyle = col("--ink-2"); x.textAlign = "right"; x.fillText(v.toLocaleString("en-IN", { maximumFractionDigits: gl.step < 1 ? 1 : 0 }), padL - 8, y);
    }
    if (scales.right && scales.left) for (var u = scales.right.min; u <= scales.right.max + 1e-9; u += scales.right.step) {
      x.fillStyle = col("--ink-2"); x.textAlign = "left"; x.fillText(u.toLocaleString("en-IN", { maximumFractionDigits: scales.right.step < 1 ? 1 : 0 }), w - padR + 8, Y("right", u));
    }
    x.textBaseline = "top"; x.textAlign = "center"; x.fillStyle = col("--ink-2");
    for (var i = 0; i <= 4; i++) {
      var t = t0 + (now - t0) * i / 4, d = new Date(t);
      x.fillText(hours > 48 ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ("0" + d.getHours()).slice(-2) + ":00", X(t), h - padB + 8);
    }
    series.forEach(function(s){
      if (!s.values.length) return;
      x.strokeStyle = col(s.color); x.lineWidth = 2; x.beginPath();
      s.values.forEach(function(p, k){ var px = X(p.t.getTime()), py = Y(s.axis, p.v); k ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
      var last = s.values[s.values.length - 1]; x.fillStyle = col(s.color); x.beginPath(); x.arc(X(last.t.getTime()), Y(s.axis, last.v), 3.5, 0, 7); x.fill();
    });
  }
  return { draw: draw };
})();
