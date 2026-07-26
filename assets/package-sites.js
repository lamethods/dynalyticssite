/* Package sites — direct documentation links generated from the main catalog. */
(function () {
  "use strict";

  var catalog = window.CATALOG || {};
  var entries = Array.isArray(catalog.entries) ? catalog.entries : [];
  var packages = entries.filter(function (entry) {
    return entry.type === "package" && entry.links && entry.links.docs;
  });
  var articleCounts = {};
  entries.forEach(function (entry) {
    if (entry.type !== "vignette") return;
    (Array.isArray(entry.packages) ? entry.packages : []).forEach(function (id) {
      articleCounts[id] = (articleCounts[id] || 0) + 1;
    });
  });

  var activeFilter = "all";
  var query = "";
  var grid = document.getElementById("site-grid");
  var empty = document.getElementById("site-empty");

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function subtitle(entry) {
    var title = entry.title || entry.id;
    var split = title.indexOf("—");
    return split >= 0 ? title.slice(split + 1).trim() : title;
  }

  function initials(id) {
    return String(id || "")
      .split(/[-_.\s]+/)
      .map(function (part) { return part.charAt(0); })
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function addLink(parent, href, label, primary) {
    if (!href) return;
    var link = el("a", "site-link" + (primary ? " primary" : ""));
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener";
    link.appendChild(document.createTextNode(label + " "));
    link.appendChild(el("span", "site-link-arrow", "↗"));
    parent.appendChild(link);
  }

  function packageCard(entry) {
    var articles = articleCounts[entry.id] || 0;
    var card = el("article", "site-card");

    var top = el("div", "site-card-top");
    var identity = el("div", "site-identity");
    var logo = el("div", "site-logo");
    if (entry.logo) {
      var image = el("img");
      image.src = entry.logo;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", function () {
        logo.classList.add("mono");
        logo.textContent = initials(entry.id);
      });
      logo.appendChild(image);
    } else {
      logo.classList.add("mono");
      logo.textContent = initials(entry.id);
    }
    identity.appendChild(logo);
    var names = el("div");
    names.appendChild(el("h3", "site-name", entry.id));
    names.appendChild(el("p", "site-title", subtitle(entry)));
    identity.appendChild(names);
    top.appendChild(identity);

    var onCran = Boolean(entry.links.cran);
    var badge = el("span", "site-status " + (onCran ? "cran" : "development"));
    badge.textContent = onCran
      ? "CRAN " + (entry.cran_version || "")
      : "Development";
    top.appendChild(badge);
    card.appendChild(top);

    card.appendChild(el("p", "site-description", entry.blurb || ""));

    var facts = el("div", "site-card-facts");
    facts.appendChild(el("span", "", "v" + (entry.version || "—")));
    facts.appendChild(el("span", "", articles ? articles + (articles === 1 ? " article" : " articles") : "Reference only"));
    card.appendChild(facts);

    var links = el("div", "site-card-links");
    addLink(links, entry.links.docs, "Open site", true);
    if (articles && entry.links.articles) addLink(links, entry.links.articles, "Articles", false);
    addLink(links, entry.links.reference, "Reference", false);
    addLink(links, entry.links.cran, "CRAN", false);
    addLink(links, entry.links.github, "Source", false);
    card.appendChild(links);
    return card;
  }

  function searchableText(entry) {
    return [
      entry.id,
      entry.title,
      entry.blurb,
      (entry.tags || []).join(" ")
    ].join(" ").toLowerCase();
  }

  function visible(entry) {
    var onCran = Boolean(entry.links.cran);
    var articles = articleCounts[entry.id] || 0;
    if (activeFilter === "cran" && !onCran) return false;
    if (activeFilter === "development" && onCran) return false;
    if (activeFilter === "articles" && !articles) return false;
    return !query || searchableText(entry).indexOf(query) >= 0;
  }

  function render() {
    grid.innerHTML = "";
    var shown = packages.filter(visible);
    shown.forEach(function (entry) { grid.appendChild(packageCard(entry)); });
    empty.hidden = shown.length !== 0;
  }

  function setCount(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = String(value);
  }

  function initCounts() {
    var cran = packages.filter(function (entry) { return Boolean(entry.links.cran); }).length;
    var withArticles = packages.filter(function (entry) { return Boolean(articleCounts[entry.id]); }).length;
    setCount("count-all", packages.length);
    setCount("count-cran", cran);
    setCount("count-development", packages.length - cran);
    setCount("count-articles", withArticles);

    var stats = document.querySelectorAll("#site-stats dt");
    [packages.length, cran, withArticles].forEach(function (value, index) {
      if (stats[index]) stats[index].textContent = String(value);
    });
  }

  function initFilters() {
    document.getElementById("site-filters").addEventListener("click", function (event) {
      var button = event.target.closest("[data-filter]");
      if (!button) return;
      activeFilter = button.getAttribute("data-filter");
      document.querySelectorAll("#site-filters .filter-chip").forEach(function (chip) {
        chip.classList.toggle("active", chip === button);
      });
      render();
    });

    document.getElementById("site-search").addEventListener("input", function (event) {
      query = event.target.value.trim().toLowerCase();
      render();
    });
  }

  function setThemeColor(theme) {
    var meta = document.getElementById("theme-color");
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0c0c0d" : "#ffffff");
  }

  function initTheme() {
    var button = document.getElementById("theme-toggle");
    var current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    setThemeColor(current);
    if (!button) return;
    button.addEventListener("click", function () {
      current = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", current);
      setThemeColor(current);
      try { localStorage.setItem("dyna-theme", current); } catch (e) {}
    });
  }

  function boot() {
    var generated = document.getElementById("generated");
    if (generated) generated.textContent = catalog.verified_at || catalog.generated_at || "—";
    initTheme();
    if (!packages.length) {
      grid.innerHTML = '<div class="empty">The package catalogue is unavailable.</div>';
      return;
    }
    packages.sort(function (a, b) {
      var aCran = a.links.cran ? 0 : 1;
      var bCran = b.links.cran ? 0 : 1;
      return aCran - bCran || a.id.localeCompare(b.id, undefined, { sensitivity: "base" });
    });
    initCounts();
    initFilters();
    render();
  }

  boot();
})();
