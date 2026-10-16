// Runs before the app bundle to apply theme, accent and font size without a
// flash of the wrong theme. Kept tiny and dependency-free.
(function () {
  try {
    var raw = localStorage.getItem("blinkchat.settings");
    var s = raw ? JSON.parse(raw) : {};
    var pref = s.theme || "system";
    var dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    root.setAttribute("data-theme", dark ? "blinkdark" : "blink");
    root.setAttribute("data-font", s.fontSize || "md");
    var accents = {
      violet: "54.13% 0.2466 293.01",
      emerald: "50.81% 0.1049 165.61",
      rose: "58.58% 0.2220 17.58",
      orange: "55.34% 0.1739 38.40",
      teal: "54.39% 0.0932 186.17",
    };
    if (s.accent && accents[s.accent]) root.style.setProperty("--p", accents[s.accent]);
  } catch (e) {
    /* storage unavailable: defaults apply */
  }
})();
