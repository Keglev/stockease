// =============================================================================
// StockEase Docs — Runtime
// Theme toggle, mobile nav drawer, active-link marking, and Mermaid init.
// Lives outside the Pandoc template so regex/`$` characters never collide with
// Pandoc's variable syntax during the build.
// =============================================================================

// Guarded: the landing pages load docs.js but no Mermaid, so the global is absent.
if (typeof mermaid !== "undefined") {
  mermaid.initialize({ startOnLoad: true });
}

// Theme toggle flips the attribute tokens.css keys off and persists the choice.
var toggle = document.querySelector(".theme-toggle");
if (toggle) {
  toggle.addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("ssp-theme", next); } catch (e) {}
  });
}

var menu = document.querySelector(".menu-btn");
if (menu) {
  menu.addEventListener("click", function () {
    document.querySelector(".layout").classList.toggle("nav-open");
  });
}

// Mark the current page in the sidebar at runtime, avoiding per-page build logic.
(function () {
  var here = location.pathname.replace(/index\.html$/, "");
  document.querySelectorAll(".sidebar a").forEach(function (a) {
    if (a.getAttribute("href").replace(/index\.html$/, "") === here) {
      a.setAttribute("aria-current", "page");
    }
  });
})();

// Language switch: point EN/DE at the current page's translated twin when one
// exists. Only the overview pages and the landing are translated, so any other
// page routes DE to the German landing rather than a missing -de file. Done at
// runtime to avoid wiring a per-page twin URL through the build.
(function () {
  var links = document.querySelectorAll(".lang-switch a");
  if (links.length < 2) return;
  var en = links[0], de = links[1];
  var base = "/stockease";
  var path = location.pathname;
  var file = path.substring(path.lastIndexOf("/") + 1);
  var dir = path.substring(0, path.lastIndexOf("/") + 1);

  function current(active) {
    en.removeAttribute("aria-current");
    de.removeAttribute("aria-current");
    active.setAttribute("aria-current", "true");
  }

  // The site landing is base/ or base/index.html specifically — a deep section
  // index.html (e.g. enums/index.html) must not be mistaken for it.
  if (path === base + "/" || path === base + "/index.html") {
    en.href = base + "/"; de.href = base + "/index-de.html"; current(en);
  } else if (path === base + "/index-de.html") {
    en.href = base + "/"; de.href = base + "/index-de.html"; current(de);
  } else if (file === "overview.html") {
    en.href = path; de.href = dir + "overview-de.html"; current(en);
  } else if (file === "overview-de.html") {
    en.href = dir + "overview.html"; de.href = path; current(de);
  } else if (file === "index.html" && (dir === base + "/frontend/architecture/" || dir === base + "/backend/architecture/")) {
    // The two arc42 section-1 pages are translated; deep indexes elsewhere are not.
    en.href = path; de.href = dir + "index-de.html"; current(en);
  } else if (file === "index-de.html" && (dir === base + "/frontend/architecture/" || dir === base + "/backend/architecture/")) {
    en.href = dir + "index.html"; de.href = path; current(de);
  } else {
    // English-only page: there is no German twin, so EN stays active and DE is
    // shown disabled (greyed, not clickable) rather than sending the reader off
    // to an unrelated page.
    en.href = path;
    de.removeAttribute("href");
    de.setAttribute("aria-disabled", "true");
    de.setAttribute("title", "Diese Seite ist nur auf Englisch verfügbar");
    current(en);
  }
})();