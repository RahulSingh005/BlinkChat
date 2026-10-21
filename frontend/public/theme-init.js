// Runs before the app bundle to apply theme, accent and font size without a
// flash of the wrong theme. Kept tiny and dependency-free; mirrors
// src/lib/theme.js (accentVars).
(function () {
  // iPhone/iPad zoom into any focused field under 16px. maximum-scale=1 stops
  // that while iOS still allows pinch-to-zoom (Android keeps full zoom).
  try {
    var ua = navigator.userAgent;
    var iOS = /iPad|iPhone|iPod/.test(ua) || (ua.indexOf("Mac") > -1 && "ontouchend" in document);
    var vp = iOS && document.querySelector('meta[name="viewport"]');
    if (vp && vp.content.indexOf("maximum-scale") === -1) vp.content += ", maximum-scale=1";
  } catch (e) {
    /* ignore */
  }
  try {
    var raw = localStorage.getItem("blinkchat.settings");
    var s = raw ? JSON.parse(raw) : {};
    var pref = s.theme || "system";
    var dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    root.setAttribute("data-theme", dark ? "blinkdark" : "blink");
    root.setAttribute("data-font", s.fontSize || "md");

    var A = {
      blue: [267, "55.5% 0.236 267", "64% 0.19 267", "49% 0.2 267"],
      violet: [293, "54% 0.246 293", "64% 0.2 293", "47% 0.21 293"],
      emerald: [163, "52% 0.115 163", "66% 0.13 163", "42% 0.08 170"],
      rose: [17, "58% 0.22 17", "65% 0.2 17", "50% 0.17 17"],
      orange: [45, "60% 0.19 41", "70% 0.17 50", "52% 0.15 42"],
      teal: [186, "54% 0.093 186", "67% 0.1 186", "44% 0.07 190"],
    };
    var soft = s.bubbleStyle === "soft";
    var v;
    if (s.accent === "mono") {
      v = dark
        ? { p: "92% 0 0", pc: "18% 0 0", bo: soft ? "30% 0 0" : "34% 0 0", boc: "98% 0 0", tick: "86% 0.11 215" }
        : { p: "24% 0 0", pc: "100% 0 0", bo: soft ? "91% 0 0" : "26% 0 0", boc: soft ? "18% 0 0" : "100% 0 0", tick: soft ? "55% 0.15 240" : "86% 0.11 215" };
    } else {
      var a = A[s.accent] || A.blue;
      var p = dark ? a[2] : a[1];
      if (soft) {
        v = dark
          ? { p: p, pc: "100% 0 0", bo: "33% 0.055 " + a[0], boc: "96% 0.01 0", tick: "74% 0.13 " + a[0] }
          : { p: p, pc: "100% 0 0", bo: "93% 0.045 " + a[0], boc: "20% 0.02 0", tick: "55% 0.2 " + a[0] };
      } else {
        v = { p: p, pc: "100% 0 0", bo: dark ? a[3] : a[1], boc: "100% 0 0", tick: "86% 0.11 215" };
      }
    }
    root.style.setProperty("--p", v.p);
    root.style.setProperty("--pc", v.pc);
    root.style.setProperty("--bo", v.bo);
    root.style.setProperty("--boc", v.boc);
    root.style.setProperty("--tick", v.tick);
  } catch (e) {
    /* storage unavailable: defaults apply */
  }
})();
