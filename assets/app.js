/* Dynasite — top-level menu navigation. No framework.
   Views: Overview (Dynalytics + chord map), Packages, Tools, Books, Chapters,
   Papers, and a per-package dossier (#/pkg/<id>). */
(function () {
  "use strict";

  var KIND_LABEL = { tutorial: "Tutorial", blog: "Blog", news: "News", article: "Article" };
  var SOURCE_LABEL = { "saqr.me": "saqr.me", "sonsoles.me": "sonsoles.me", "dynasite": "Dynalytics" };
  var NAV = [
    { route: "", label: "Overview" },
    { route: "people", label: "People" },
    { route: "packages", label: "Packages" },
    { route: "package-sites", label: "Package sites" },
    { href: "carmnotes", label: "CarmNotes" },
    { route: "tools", label: "Tools" },
    { route: "chapters", label: "Chapters" },
    { route: "writing", label: "Readings" },
    { route: "papers", label: "Selected articles" },
    { route: "news", label: "News" }
  ];
  var TITLE_BASE = "Dynalytics";

  var S = { all: [], byId: {}, packages: [], about: null };

  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pkgsOf(e) { var p = e.packages; return !p ? [] : (Array.isArray(p) ? p : [p]); }
  function by(type, id) { return S.all.filter(function (e) { return e.type === type && pkgsOf(e).indexOf(id) >= 0; }); }
  function ofType(t) { return S.all.filter(function (e) { return e.type === t; }); }
  // exact id first; then case-insensitively, so links made before a rename that only
  // changed case (VaSStra -> VaSSTra) still resolve
  function packageById(id) {
    if (S.byId[id] && S.byId[id].type === "package") return S.byId[id];
    var low = String(id).toLowerCase();
    return S.packages.filter(function (p) { return p.id.toLowerCase() === low; })[0] || null;
  }
  function subtitleOf(p) { var t = p.title || ""; var i = t.indexOf("—"); return i >= 0 ? t.slice(i + 1).trim() : (p.blurb || ""); }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(d) { var m = String(d || "").match(/^(\d{4})-(\d{2})/); return m ? MONTHS[(+m[2]) - 1] + " " + m[1] : (d || ""); }
  function newsSorted() { return ofType("news").slice().sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); }); }
  function normName(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  var _peopleByName = null;
  function personByName(name) {
    if (!_peopleByName) { _peopleByName = {}; ofType("person").forEach(function (p) { _peopleByName[normName(p.name)] = p; }); }
    return _peopleByName[normName(name)] || null;
  }
  function monogram(id) { var m = (id || "?").replace(/[^a-z0-9]/gi, ""); return esc((m.slice(0, 1) || "?").toUpperCase()); }
  function makeIcon(p) {
    var ico = el("div", "pkg-ico");
    if (p.logo) {
      var img = el("img"); img.src = p.logo; img.alt = p.id; img.loading = "lazy";
      img.onerror = function () { ico.classList.add("mono"); ico.textContent = ""; ico.innerHTML = monogram(p.id); };
      ico.appendChild(img);
    } else { ico.classList.add("mono"); ico.innerHTML = monogram(p.id); }
    return ico;
  }

  /* ---------- boot ---------- */
  function boot(cat) {
    S.all = Array.isArray(cat.entries) ? cat.entries : [];
    S.all.forEach(function (e) { S.byId[e.id] = e; });
    S.packages = S.all.filter(function (e) { return e.type === "package"; });
    S.about = cat.about || null;
    S.functionsVersion = cat.functions_version || "";
    var gen = document.getElementById("generated");
    if (gen) gen.textContent = cat.verified_at || cat.generated_at || "";
    buildNav();
    var logo = document.getElementById("logo");
    if (logo) logo.addEventListener("click", function () { openLightbox("assets/logo-dynalytics.png", "Dynalytics"); });
    initTheme();
    initSearch();
    window.addEventListener("hashchange", route);
    route();
  }

  /* ---------- theme toggle (opt-in dark mode; default light, never OS-driven) ---------- */
  function setThemeColor(theme) {
    var m = document.getElementById("theme-color");
    if (m) m.setAttribute("content", theme === "dark" ? "#0c0c0d" : "#ffffff");
  }
  function initTheme() {
    setThemeColor(document.documentElement.getAttribute("data-theme"));
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      setThemeColor(next);
      try { localStorage.setItem("dyna-theme", next); } catch (e) {}
    });
  }
  function load() {
    if (window.CATALOG && window.CATALOG.entries) { boot(window.CATALOG); return; }
    fetch("catalog.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("catalog.json " + r.status); return r.json(); })
      .then(boot)
      .catch(function (err) {
        document.getElementById("view").innerHTML =
          '<div class="empty">Could not load the catalog — ' + esc(err.message) + ". Rebuild with <code>npm run build</code>.</div>";
      });
  }

  /* ---------- nav + router ---------- */
  function buildNav() {
    var nav = document.getElementById("nav"); if (!nav) return;
    nav.innerHTML = "";
    NAV.forEach(function (n) {
      var a = el("a", "navlink");
      a.href = n.href || ("#/" + n.route);
      a.textContent = n.label;
      if (n.route != null) a.setAttribute("data-route", n.route);
      nav.appendChild(a);
    });
  }
  function setActive(route) {
    var links = document.querySelectorAll("#nav .navlink");
    for (var i = 0; i < links.length; i++) links[i].classList.toggle("active", links[i].getAttribute("data-route") === route);
  }
  function setTitle(label) { document.title = label ? label + " — " + TITLE_BASE : TITLE_BASE + " — Rigorous analytics of dynamics"; }
  function route() {
    var h = location.hash.replace(/^#\/?/, "");
    var view = document.getElementById("view");
    window.scrollTo(0, 0);
    var m = h.match(/^pkg\/([^/]+)(?:\/(tutorials|articles|blogs|book))?$/);
    var pk = m && packageById(decodeURIComponent(m[1]));
    if (pk) { setActive(null); setTitle(pk.id); renderPackage(view, pk, m[2]); return; }
    var mp = h.match(/^people\/(.+)$/);
    if (mp) { setActive("people"); setTitle("People"); renderPeople(view, decodeURIComponent(mp[1])); return; }
    var mw = h.match(/^writing(?:\/(tutorials|articles|blogs))?$/);
    if (mw) { setActive("writing"); setTitle("Readings"); renderWriting(view, mw[1] || "tutorials"); return; }
    var r = (h === "" || h === "/") ? "" : h;
    setActive(r);
    var labels = { packages: "Packages", "package-sites": "Package sites", tools: "Tools", chapters: "Book chapters", writing: "Readings", papers: "Selected articles", news: "News", people: "People" };
    setTitle(labels[r] || "");
    if (r === "packages") renderPackages(view);
    else if (r === "package-sites") renderPackageSites(view);
    else if (r === "tools") renderTools(view);
    else if (r === "chapters") renderChapters(view);
    else if (r === "writing") renderWriting(view);
    else if (r === "papers") renderPapers(view);
    else if (r === "news") renderNews(view);
    else if (r === "people") renderPeople(view);
    else renderOverview(view);
  }

  /* ---------- shared bits ---------- */
  function secHead(num, title, sub) {
    var h = el("div", "sec-head");
    h.appendChild(el("span", "num", num));
    h.appendChild(el("h2", null, esc(title)));
    h.appendChild(el("span", "rule"));
    if (sub) h.appendChild(el("span", "sec-sub", esc(sub)));
    return h;
  }
  function linkItem(kick, title, desc, url, right) {
    var a = el("a", "item"); a.href = url; a.target = "_blank"; a.rel = "noopener";
    var main = el("div");
    main.appendChild(el("div", "ikick", esc(kick)));
    main.appendChild(el("div", "ititle", esc(title)));
    if (desc) main.appendChild(el("div", "idesc", esc(desc)));
    a.appendChild(main);
    a.appendChild(el("div", "iright", right || "↗"));
    return a;
  }
  function packageRow(p) {
    var row = el("div", "row");
    row.onclick = function () { location.hash = "#/pkg/" + encodeURIComponent(p.id); };
    row.appendChild(makeIcon(p));
    var main = el("div", "rmain");
    var cran = p.links && p.links.cran
      ? '<span class="cran">CRAN ' + esc(p.cran_version || "") + "</span>"
      : '<span class="local">' + (p.links && p.links.github ? "GitHub" : "local") + "</span>";
    main.innerHTML =
      '<div class="rname">' + esc(p.id) + "</div>" +
      '<div class="rsub">' + esc(subtitleOf(p)) + "</div>" +
      '<div class="rdesc">' + esc(p.blurb || "") + "</div>" +
      '<div class="rtags">' + (p.tags || []).slice(0, 5).join(" · ") + "</div>";
    row.appendChild(main);
    var meta = el("div", "rmeta"); meta.innerHTML = cran;
    row.appendChild(meta);
    return row;
  }

  /* ---------- views ---------- */
  function renderOverview(view) {
    view.innerHTML = "";
    var body = el("div");
    renderAbout(body);
    renderMap(body);
    renderBrowse(body);
    body.appendChild(newsletterBlock());
    view.appendChild(body);
  }

  /* ---------- overview "browse" strip: mini preview cards per section ---------- */
  function miniLogo(p) {
    var d = el("div", "mini-logo");
    if (p.logo) {
      var img = el("img"); img.src = p.logo; img.alt = ""; img.loading = "lazy";
      img.onerror = function () { d.classList.add("mono"); d.textContent = ""; d.innerHTML = monogram(p.id); };
      d.appendChild(img);
    } else { d.classList.add("mono"); d.innerHTML = monogram(p.id); }
    return d;
  }
  function miniFace(p) {
    var d = el("div", "mini-face");
    var img = el("img"); img.src = p.photo; img.alt = ""; img.loading = "lazy";
    img.onerror = function () { d.classList.add("mono"); d.textContent = monogram(p.name); };
    d.appendChild(img);
    return d;
  }
  function miniDoc() { return el("div", "mini-doc", '<i></i><i></i><i class="s"></i>'); }
  function miniNews(n) {
    var d = el("div", "mini-news");
    d.appendChild(el("span", "mini-news-tag", esc(n.tag || "News")));
    d.appendChild(el("span", "mini-news-date", esc(fmtDate(n.date))));
    return d;
  }
  function miniTool(t) { return el("div", "mini-tool", esc(t.kind || "Tool")); }
  function miniCover(b) {
    var d = el("div", "mini-cover");
    if (b.cover) { var img = el("img"); img.src = b.cover; img.alt = b.title; img.loading = "lazy"; img.onerror = function () { d.style.display = "none"; }; d.appendChild(img); }
    return d;
  }
  function browseCard(opts) {
    var a = el("a", "bcard"); a.href = "#/" + opts.route;
    var head = el("div", "bcard-head");
    head.appendChild(el("span", "bcard-label", esc(opts.label)));
    head.appendChild(el("span", "bcard-count", opts.count + ""));
    a.appendChild(head);
    var minis = el("div", "bcard-minis " + opts.miniClass);
    opts.minis.forEach(function (m) { minis.appendChild(m); });
    if (opts.extra > 0) minis.appendChild(el("span", "mini-more", "+" + opts.extra));
    a.appendChild(minis);
    a.appendChild(el("div", "bcard-sub", esc(opts.sub)));
    a.appendChild(el("div", "bcard-cta", esc(opts.cta) + " →"));
    return a;
  }
  function renderBrowse(body) {
    var people = ofType("person"), papers = ofType("paper"), tools = ofType("tool");
    var books = ofType("book").filter(function (b) { return b.cover; });  // the two volumes (not the book-home link)
    if (!S.packages.length && !people.length) return;
    body.appendChild(secHead("", "Browse the ecosystem", "miniatures — open a section to see it all"));
    var grid = el("div", "browse");

    var pe = people.slice(0, 4);
    grid.appendChild(browseCard({
      route: "people", label: "People", count: people.length,
      miniClass: "row-faces", minis: pe.map(miniFace), extra: people.length - pe.length,
      sub: (S.about && S.about.peopleIntro) || "The researchers who build and maintain the Dynalytics toolkit across University of Eastern Finland, FernUniversität in Hagen, and University of Melbourne.",
      cta: "Meet the team"
    }));

    var pk = S.packages.slice(0, 5);
    grid.appendChild(browseCard({
      route: "packages", label: "Packages", count: S.packages.length,
      miniClass: "row-logos", minis: pk.map(miniLogo), extra: S.packages.length - pk.length,
      sub: "R packages for transition, co-occurrence & psychological networks, sequences and bootstrapped validation.",
      cta: "All packages"
    }));

    grid.appendChild(browseCard({
      route: "tools", label: "Tools", count: tools.length,
      miniClass: "row-tools", minis: tools.slice(0, 5).map(miniTool), extra: Math.max(0, tools.length - 5),
      sub: "Beyond R — point-and-click jamovi (JTNA), a Python port (tnapy), and browser-based Shiny apps.",
      cta: "All tools"
    }));

    grid.appendChild(browseCard({
      route: "chapters", label: "Books", count: books.length,
      miniClass: "row-covers", minis: books.map(miniCover), extra: 0,
      sub: "Two open-access volumes of Learning Analytics Methods — read online, with code, chapter by chapter.",
      cta: "All chapters"
    }));

    var pp = papers.slice(0, 5);
    grid.appendChild(browseCard({
      route: "papers", label: "Selected articles", count: papers.length,
      miniClass: "row-docs", minis: pp.map(miniDoc), extra: papers.length - pp.length,
      sub: "The foundational and applied papers behind the framework — TNA, FTNA, ATNA, HTNA and the human–AI studies.",
      cta: "All articles"
    }));

    var news = newsSorted();
    if (news.length) {
      var nn = news.slice(0, 3);
      grid.appendChild(browseCard({
        route: "news", label: "News", count: news.length,
        miniClass: "row-news", minis: nn.map(miniNews), extra: news.length - nn.length,
        sub: "Releases, papers, funding and events from across the Dynalytics ecosystem.",
        cta: "All news"
      }));
    }

    body.appendChild(grid);
  }

  function renderAbout(body) {
    var a = S.about; if (!a) return;
    var box = el("div", "about");
    var pts = (a.points || []).map(function (p) {
      return '<div class="pt"><div class="ph">' + esc(p.h) + '</div><div class="pb">' + esc(p.t) + "</div></div>";
    }).join("");
    box.innerHTML =
      '<figure class="layers-fig" tabindex="0" role="button" aria-label="Enlarge the Dynalytics layers diagram">' +
        '<img src="assets/dynalytics-layers.png" alt="Overview of Dynalytics’ layers" loading="lazy">' +
        '<figcaption>Overview of Dynalytics’ layers<span class="zoom">⤢</span></figcaption>' +
      "</figure>" +
      '<p class="lead">' + esc(a.lead || "") + "</p>" +
      (a.more ? '<p class="amore">' + esc(a.more) + "</p>" : "") +
      '<div class="points">' + pts + "</div>" +
      (a.closing ? '<p class="amore">' + esc(a.closing) +
        (a.paper ? ' <a class="paper-link" href="' + esc(a.paper.href) + '" target="_blank" rel="noopener">' + esc(a.paper.label) + " →</a>" : "") +
      "</p>" : "");
    body.appendChild(box);
    var fig = box.querySelector(".layers-fig");
    if (fig) {
      var open = function () { openLightbox("assets/dynalytics-layers.png", "Overview of Dynalytics’ layers"); };
      fig.addEventListener("click", open);
      fig.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    }
  }

  // full-screen image overlay; closes on click or Esc
  function openLightbox(src, caption) {
    var ov = el("div", "lightbox");
    ov.innerHTML =
      '<button class="lb-close" aria-label="Close">×</button>' +
      "<figure><img src=\"" + esc(src) + "\" alt=\"" + esc(caption) + "\"><figcaption>" + esc(caption) + "</figcaption></figure>";
    function close() { document.removeEventListener("keydown", onKey); ov.remove(); }
    function onKey(e) { if (e.key === "Escape") close(); }
    ov.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("show"); });
  }

  // Load d3 + the chord renderer once, on demand (kept out of the critical path).
  var _scripts = {};
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (_scripts[src]) return resolve();
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = function () { _scripts[src] = true; resolve(); };
      s.onerror = function () { reject(new Error("failed to load " + src)); };
      document.head.appendChild(s);
    });
  }
  function renderMap(body) {
    if (!S.packages.length) return;
    var sec = el("div");
    sec.appendChild(secHead("", "The ecosystem map", "packages by focus, linked by what they share"));
    var wrap = el("div", "mapwrap"); sec.appendChild(wrap);
    body.appendChild(sec);
    loadScript("assets/d3.min.js")
      .then(function () { return loadScript("assets/chord.js"); })
      .then(function () {
        if (typeof window.renderChord === "function") {
          window.renderChord(wrap, S.packages, {
            width: 760, height: 760,
            onClick: function (id) { location.hash = "#/pkg/" + encodeURIComponent(id); }
          });
        }
      })
      .catch(function () { sec.remove(); });  // network-less / offline: drop the map quietly
  }

  var _pkgFilter = null;
  function renderPackages(view) {
    view.innerHTML = "";
    view.appendChild(secHead("", "Packages", S.packages.length + " R packages"));

    // focus chips — tags shared by ≥2 packages, most common first
    var freq = {};
    S.packages.forEach(function (p) { (p.tags || []).forEach(function (t) { freq[t] = (freq[t] || 0) + 1; }); });
    var tags = Object.keys(freq).filter(function (t) { return freq[t] >= 2; })
      .sort(function (a, b) { return freq[b] - freq[a] || a.localeCompare(b); });
    if (_pkgFilter && tags.indexOf(_pkgFilter) < 0) _pkgFilter = null;
    if (tags.length) {
      var bar = el("div", "filters");
      var allChip = el("button", "filter-chip" + (_pkgFilter ? "" : " active"), 'All <span class="fc-n">' + S.packages.length + "</span>");
      allChip.onclick = function () { _pkgFilter = null; renderPackages(view); };
      bar.appendChild(allChip);
      tags.forEach(function (t) {
        var c = el("button", "filter-chip" + (_pkgFilter === t ? " active" : ""), esc(t) + ' <span class="fc-n">' + freq[t] + "</span>");
        c.onclick = function () { _pkgFilter = (_pkgFilter === t ? null : t); renderPackages(view); };
        bar.appendChild(c);
      });
      view.appendChild(bar);
    }

    var list = _pkgFilter ? S.packages.filter(function (p) { return (p.tags || []).indexOf(_pkgFilter) >= 0; }) : S.packages;
    var idx = el("div", "index");
    list.forEach(function (p) { idx.appendChild(packageRow(p)); });
    view.appendChild(idx);
  }

  /* ---------- package documentation sites ---------- */
  function packageSiteLink(parent, href, label, primary) {
    if (!href) return;
    var link = el("a", "site-link" + (primary ? " primary" : ""));
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener";
    link.appendChild(document.createTextNode(label + " "));
    link.appendChild(el("span", "site-link-arrow", "↗"));
    parent.appendChild(link);
  }

  function packageSiteCard(entry, articleCount) {
    var card = el("article", "site-card clickable");
    var docs = entry.links.docs;
    card.tabIndex = 0;
    card.setAttribute("role", "link");
    card.setAttribute("aria-label", "Open the " + entry.id + " package website");

    function openSite() {
      var opened = window.open(docs, "_blank");
      if (opened) opened.opener = null;
      else location.href = docs;
    }
    card.addEventListener("click", function (event) {
      if (event.target.closest("a, button, input")) return;
      openSite();
    });
    card.addEventListener("keydown", function (event) {
      if (event.target !== card || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      openSite();
    });

    var top = el("div", "site-card-top");
    var identity = el("div", "site-identity");
    var logo = el("div", "site-logo");
    if (entry.logo) {
      var image = el("img");
      image.src = entry.logo;
      image.alt = "";
      image.loading = "lazy";
      image.onerror = function () {
        logo.classList.add("mono");
        logo.textContent = monogram(entry.id);
      };
      logo.appendChild(image);
    } else {
      logo.classList.add("mono");
      logo.textContent = monogram(entry.id);
    }
    identity.appendChild(logo);
    var names = el("div");
    names.appendChild(el("h3", "site-name", esc(entry.id)));
    names.appendChild(el("p", "site-title", esc(subtitleOf(entry))));
    identity.appendChild(names);
    top.appendChild(identity);

    var onCran = Boolean(entry.links.cran);
    var badge = el("span", "site-status " + (onCran ? "cran" : "development"));
    badge.textContent = onCran ? "CRAN " + (entry.cran_version || "") : "Development";
    top.appendChild(badge);
    card.appendChild(top);

    card.appendChild(el("p", "site-description", esc(entry.blurb || "")));
    var facts = el("div", "site-card-facts");
    facts.appendChild(el("span", "", "v" + (entry.version || "—")));
    facts.appendChild(el("span", "", articleCount ? articleCount + (articleCount === 1 ? " article" : " articles") : "Reference only"));
    card.appendChild(facts);

    var links = el("div", "site-card-links");
    packageSiteLink(links, docs, "Open package site", true);
    if (articleCount && entry.links.articles) packageSiteLink(links, entry.links.articles, "Articles", false);
    packageSiteLink(links, entry.links.reference, "Reference", false);
    packageSiteLink(links, entry.links.cran, "CRAN", false);
    packageSiteLink(links, entry.links.github, "Source", false);
    card.appendChild(links);
    return card;
  }

  function renderPackageSites(view) {
    view.innerHTML = "";
    var packages = S.packages.filter(function (entry) {
      return entry.links && entry.links.docs;
    });
    var articleCounts = {};
    ofType("vignette").forEach(function (entry) {
      pkgsOf(entry).forEach(function (id) {
        articleCounts[id] = (articleCounts[id] || 0) + 1;
      });
    });
    var cranCount = packages.filter(function (entry) { return Boolean(entry.links.cran); }).length;
    var articleSiteCount = packages.filter(function (entry) { return Boolean(articleCounts[entry.id]); }).length;

    view.appendChild(secHead(
      "",
      "Package sites",
      packages.length + " documentation sites · " + cranCount + " on CRAN · " + articleSiteCount + " with articles"
    ));
    view.appendChild(el(
      "p",
      "directory-intro",
      "Open a card anywhere to visit the package website, or use its direct links for articles, function reference, CRAN, and source code."
    ));

    var tools = el("div", "site-tools integrated");
    var search = el("label", "site-search");
    search.appendChild(el("span", "", "Find a package"));
    var input = el("input");
    input.type = "search";
    input.placeholder = "Search names, topics, or descriptions";
    input.autocomplete = "off";
    search.appendChild(input);
    tools.appendChild(search);

    var filters = el("div", "filters");
    var filterDefs = [
      ["all", "All", packages.length],
      ["cran", "On CRAN", cranCount],
      ["development", "Development", packages.length - cranCount],
      ["articles", "With articles", articleSiteCount]
    ];
    filterDefs.forEach(function (definition, index) {
      var button = el("button", "filter-chip" + (index === 0 ? " active" : ""));
      button.type = "button";
      button.setAttribute("data-filter", definition[0]);
      button.innerHTML = esc(definition[1]) + ' <span class="fc-n">' + definition[2] + "</span>";
      filters.appendChild(button);
    });
    tools.appendChild(filters);
    view.appendChild(tools);

    var grid = el("div", "site-grid integrated");
    var empty = el("p", "site-empty", "No package sites match this filter.");
    empty.hidden = true;
    view.appendChild(grid);
    view.appendChild(empty);

    var activeFilter = "all";
    var query = [];
    packages.sort(function (a, b) {
      return (a.links.cran ? 0 : 1) - (b.links.cran ? 0 : 1)
        || a.id.localeCompare(b.id, undefined, { sensitivity: "base" });
    });

    function renderCards() {
      grid.innerHTML = "";
      var shown = packages.filter(function (entry) {
        var onCran = Boolean(entry.links.cran);
        var articles = articleCounts[entry.id] || 0;
        if (activeFilter === "cran" && !onCran) return false;
        if (activeFilter === "development" && onCran) return false;
        if (activeFilter === "articles" && !articles) return false;
        if (!query.length) return true;
        var hay = fold([entry.id, entry.title, entry.blurb, (entry.tags || []).join(" "), (entry.authors || []).join(" ")].join(" "));
        return query.every(function (t) { return hay.indexOf(t) >= 0; });
      });
      shown.forEach(function (entry) {
        grid.appendChild(packageSiteCard(entry, articleCounts[entry.id] || 0));
      });
      empty.hidden = shown.length !== 0;
    }

    filters.addEventListener("click", function (event) {
      var button = event.target.closest("[data-filter]");
      if (!button) return;
      activeFilter = button.getAttribute("data-filter");
      filters.querySelectorAll(".filter-chip").forEach(function (chip) {
        chip.classList.toggle("active", chip === button);
      });
      renderCards();
    });
    input.addEventListener("input", function () {
      query = queryTokens(input.value);
      renderCards();
    });
    renderCards();
  }

  // Order a list so TNA-related items lead, otherwise keeping the harvested order.
  // "tna" is the flagship package, so its tutorials/vignettes/posts surface first.
  function tnaFirst(list) {
    return list.slice().sort(function (a, b) {
      return (pkgsOf(a).indexOf("tna") >= 0 ? 0 : 1) - (pkgsOf(b).indexOf("tna") >= 0 ? 0 : 1);
    });
  }
  // Newest first. Articles carry the last-modified date of their source vignette,
  // tutorials the date of their HTML in this repo, blog posts nothing — so items
  // without a date sort last, and ties (a package whose vignettes all landed in
  // one commit) fall back to the TNA-first ordering rather than shuffling.
  function recentFirst(list) {
    var rank = {};
    tnaFirst(list).forEach(function (e, i) { rank[e.id] = i; });
    return list.slice().sort(function (a, b) {
      var da = a.date || "", db = b.date || "";
      if (da !== db) return (db ? 1 : 0) - (da ? 1 : 0) || db.localeCompare(da);
      return rank[a.id] - rank[b.id];
    });
  }
  // Resource card — a book-chapter-style card (chap/chap-grid) for ANY reading:
  // tutorial, vignette/article, or blog post. The chapter-number slot carries a
  // badge; opts let each context choose what the badge, read-label, and footer
  // say. Default badge is the package (so the Readings view shows every package).
  function resourceCard(e, opts) {
    opts = opts || {};
    var badge = opts.badge != null ? opts.badge : (pkgsOf(e)[0] || "");
    var card = el("div", "chap");
    var top = el("div", "chap-top");
    if (badge) top.appendChild(el("span", "chap-no tut-badge", esc(badge)));
    var a = el("a", "chap-title"); a.href = e.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = e.title;
    top.appendChild(a);
    card.appendChild(top);
    if (e.blurb) card.appendChild(el("div", "chap-desc", esc(e.blurb)));
    var cl = el("div", "chap-links");
    var read = el("a", "chlink primary"); read.href = e.url; read.target = "_blank"; read.rel = "noopener";
    read.innerHTML = esc(opts.read || "Read") + ' <span class="m">↗</span>';
    cl.appendChild(read);
    var foot = opts.foot != null ? opts.foot : (e.source ? (SOURCE_LABEL[e.source] || e.source) : "");
    if (foot) cl.appendChild(el("span", "chlink", esc(foot)));
    // makes the newest-first ordering legible rather than arbitrary-looking
    if (e.date) cl.appendChild(el("span", "chlink meta", esc(fmtDate(e.date))));
    card.appendChild(cl);
    return card;
  }

  // Readings view — every tutorial, vignette/article, and blog post across all
  // packages, as cards. A secondary menu (below the main nav) switches between
  // categories so each page shows ONE category, not an endless scroll of all.
  var READING_CATS = [
    { key: "tutorials", label: "Tutorials", hint: "step-by-step guides — start here",
      get: function () { return ofType("post").filter(function (e) { return e.kind === "tutorial"; }); },
      opts: { read: "Read the tutorial" } },
    { key: "articles", label: "Articles", hint: "reference articles & vignettes from the package doc sites and CRAN",
      get: function () { return ofType("vignette"); },
      opts: { read: "Read the article", foot: "Article" } },
    { key: "blogs", label: "Blogs", hint: "longer-form writing on saqr.me & sonsoles.me",
      get: function () { return ofType("post").filter(function (e) { return e.kind !== "news" && e.kind !== "tutorial"; }); },
      opts: { read: "Read the post" } }
  ];
  function renderWriting(view, tab) {
    view.innerHTML = "";
    var cats = READING_CATS.map(function (c) { return { c: c, items: c.get() }; });
    var active = cats.filter(function (x) { return x.c.key === tab; })[0] || cats[0];
    var total = cats.reduce(function (n, x) { return n + x.items.length; }, 0);
    view.appendChild(secHead("", "Readings", total + " tutorials, articles & blog posts"));

    // secondary menu — one card view per category
    var sub = el("nav", "subnav");
    cats.forEach(function (x) {
      var a = el("a", "subnav-link" + (x === active ? " active" : ""));
      a.href = "#/writing/" + x.c.key;
      a.innerHTML = esc(x.c.label) + ' <span class="sn-n">' + x.items.length + "</span>";
      sub.appendChild(a);
    });
    view.appendChild(sub);

    var g = el("div", "write-group");
    g.appendChild(secHead("", active.c.label, active.c.hint));
    if (active.items.length) {
      var grid = el("div", "chap-grid");
      recentFirst(active.items).forEach(function (e) { grid.appendChild(resourceCard(e, active.c.opts)); });
      g.appendChild(grid);
    } else {
      g.appendChild(el("div", "empty", "Nothing here yet."));
    }
    view.appendChild(g);
  }

  function renderTools(view) {
    view.innerHTML = "";
    view.appendChild(secHead("", "Tools & apps", "beyond R — Python, jamovi, Shiny"));
    var l = el("div", "list");
    ofType("tool").forEach(function (e) { l.appendChild(linkItem(e.kind, e.title, e.blurb, e.url, "↗")); });
    view.appendChild(l);
  }

  // split "Ch 17 — Temporal Networks (TNA)" -> { num:"17", title:"Temporal Networks (TNA)" }
  function chapterParts(e) {
    var head = e.title.split("—")[0].trim();
    var num = (head.match(/(\d+)/) || [])[1] || "";
    var title = e.title.split("—").slice(1).join("—").trim() || e.title;
    return { num: num, title: title };
  }
  function chapterLinks(e) {
    var cl = el("div", "chap-links");
    [["read", "Read the chapter", "↗"], ["pdf", "PDF", ""], ["code", "Code", ""]].forEach(function (x) {
      if (e.links && e.links[x[0]]) {
        var a = el("a", "chlink" + (x[0] === "read" ? " primary" : ""));
        a.href = e.links[x[0]]; a.target = "_blank"; a.rel = "noopener";
        a.innerHTML = esc(x[1]) + (x[2] ? ' <span class="m">' + x[2] + "</span>" : "");
        cl.appendChild(a);
      }
    });
    return cl;
  }
  // chapter card for the Chapters view (2-col grid): number + title + abstract + actions
  function chapterCard(e) {
    var p = chapterParts(e);
    var row = el("div", "chap");
    var top = el("div", "chap-top");
    top.appendChild(el("span", "chap-no", esc(p.num)));
    var a = el("a", "chap-title"); a.href = (e.links && e.links.read) || e.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = p.title;
    top.appendChild(a);
    row.appendChild(top);
    if (e.blurb) row.appendChild(el("div", "chap-desc", esc(e.blurb)));
    row.appendChild(chapterLinks(e));
    return row;
  }
  // compact chapter reused inside the package dossier's "In the Book" group
  function chapterRow(e) {
    var p = chapterParts(e);
    var row = el("div", "chap compact");
    row.appendChild(el("div", "chap-kick", (e.volume.split("—")[0].trim()) + " · Chapter " + esc(p.num)));
    var a = el("a", "chap-title"); a.href = (e.links && e.links.read) || e.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = p.title;
    row.appendChild(a);
    if (e.blurb) row.appendChild(el("div", "chap-desc", esc(e.blurb)));
    row.appendChild(chapterLinks(e));
    return row;
  }
  function renderChapters(view) {
    view.innerHTML = "";
    view.appendChild(secHead("", "Book chapters", "read online · open-access PDF · code"));
    var vols = {};
    ofType("chapter").forEach(function (e) { (vols[e.volume] = vols[e.volume] || []).push(e); });
    Object.keys(vols).forEach(function (vn) {
      var parts = vn.split("—");
      var lead = parts[0].trim();              // e.g. "Vol 1"
      var rest = parts.slice(1).join("—").trim(); // e.g. "LA Methods & Tutorials"
      var g = el("div", "vol");
      var h = el("div", "vol-head");
      h.appendChild(el("div", "vol-lead", esc(lead.replace(/^Vol\b/i, "Volume"))));
      if (rest) h.appendChild(el("div", "vol-name", esc(rest)));
      h.appendChild(el("div", "vol-count", vols[vn].length + " chapters"));
      g.appendChild(h);
      var list = el("div", "chap-grid");
      vols[vn].forEach(function (e) { list.appendChild(chapterCard(e)); });
      g.appendChild(list);
      view.appendChild(g);
    });
  }

  function renderPeople(view, focusId) {
    view.innerHTML = "";
    view.appendChild(secHead("", "People", "the team behind the toolkit"));
    var grid = el("div", "people");
    ofType("person").forEach(function (p) {
      var card = el("a", "person"); card.href = p.url; card.target = "_blank"; card.rel = "noopener";
      card.setAttribute("data-id", p.id);
      var ph = el("div", "person-photo");
      var img = el("img"); img.src = p.photo; img.alt = p.name; img.loading = "lazy";
      img.onerror = function () { ph.classList.add("mono"); ph.textContent = monogram(p.name); };
      ph.appendChild(img); card.appendChild(ph);
      var main = el("div", "person-main");
      main.innerHTML =
        '<div class="person-name">' + esc(p.name) + "</div>" +
        '<div class="person-role">' + esc(p.role) + " · " + esc(p.affiliation) + "</div>" +
        '<div class="person-blurb">' + esc(p.blurb) + "</div>";
      card.appendChild(main);
      grid.appendChild(card);
    });
    view.appendChild(grid);
    if (focusId) {
      var target = grid.querySelector('[data-id="' + focusId.replace(/"/g, '\\"') + '"]');
      if (target) {
        target.classList.add("focus");
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(function () { target.classList.remove("focus"); }, 2400);
      }
    }
  }

  function renderPapers(view) {
    view.innerHTML = "";
    view.appendChild(secHead("", "Selected articles", ""));
    var l = el("div", "list");
    ofType("paper").forEach(function (e) {
      var kick = [e.authors, e.year, e.venue].filter(Boolean).join(" · ");
      l.appendChild(linkItem(kick, e.title, e.blurb, e.url, "Read →"));
    });
    view.appendChild(l);
  }

  function renderNews(view) {
    view.innerHTML = "";
    var news = newsSorted();
    view.appendChild(secHead("", "News", news.length + " updates — releases, papers, funding & events"));
    if (news.length) {
      var l = el("div", "news");
      news.forEach(function (e) {
        var a = el("a", "news-item"); a.href = e.url; a.target = "_blank"; a.rel = "noopener";
        a.innerHTML =
          '<div class="news-when"><span class="news-date">' + esc(fmtDate(e.date)) + "</span>" +
            (e.tag ? '<span class="news-tag">' + esc(e.tag) + "</span>" : "") + "</div>" +
          '<div class="news-main"><div class="news-title">' + esc(e.title) + "</div>" +
            (e.blurb ? '<div class="news-blurb">' + esc(e.blurb) + "</div>" : "") + "</div>" +
          '<div class="news-go">↗</div>';
        l.appendChild(a);
      });
      view.appendChild(l);
    } else {
      view.appendChild(el("div", "empty", "No news yet — check back soon."));
    }
    view.appendChild(newsletterBlock());
  }

  // Newsletter signup. Static site, so the email is captured inline and POSTed
  // straight to EmailOctopus's public embed endpoint (no API key in the page,
  // no redirect). Order of preference: EmailOctopus action → hosted form → mailto.
  function newsletterBlock() {
    var n = (S.about && S.about.newsletter) || {};
    var box = el("div", "newsletter");
    // EmailOctopus embeds via an async <script> widget that renders its own
    // self-contained, titled card. Mount it standalone (its title/subtitle/button
    // are edited in the EmailOctopus form designer) so we don't duplicate headings.
    // The script must be a real element — innerHTML <script> doesn't execute.
    if (n.widget) {
      box.classList.add("has-embed");
      var mount = el("div", "nl-embed");
      var s = document.createElement("script");
      s.async = true; s.src = n.widget;
      if (n.widgetId) s.setAttribute("data-form", n.widgetId);
      mount.appendChild(s);
      box.appendChild(mount);
      return box;
    }

    var txt = el("div", "nl-text");
    txt.appendChild(el("div", "nl-head", esc(n.heading || "Get updates")));
    if (n.blurb) txt.appendChild(el("div", "nl-sub", esc(n.blurb)));
    box.appendChild(txt);

    var form = el("form", "nl-form");
    form.setAttribute("novalidate", "");
    form.innerHTML =
      '<input class="nl-input" type="email" name="email" placeholder="you@example.com" aria-label="Email address" autocomplete="email" required>' +
      '<button class="nl-btn" type="submit">' + esc(n.cta || "Subscribe") + " →</button>";
    box.appendChild(form);
    if (n.note) box.appendChild(el("div", "nl-note", esc(n.note)));

    var status = el("div", "nl-status"); status.hidden = true; box.appendChild(status);
    function setStatus(ok, msg) { status.hidden = false; status.className = "nl-status " + (ok ? "ok" : "err"); status.textContent = msg; }

    var action = n.action && String(n.action).trim();
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var input = form.querySelector(".nl-input");
      var btn = form.querySelector(".nl-btn");
      var email = (input && input.value || "").trim();
      if (!email || email.indexOf("@") < 1) { setStatus(false, "Please enter a valid email address."); if (input) input.focus(); return; }

      if (action) {
        btn.disabled = true; btn.textContent = "…";
        var data = new FormData();
        data.append(n.emailField || "field_0", email);
        // EmailOctopus anti-bot honeypot field is "hp" + the list UUID in the action URL.
        var uuid = (action.match(/lists\/([0-9a-fA-F-]+)/) || [])[1];
        if (uuid) data.append("hp" + uuid, "");
        // no-cors: the embed endpoint returns an opaque response we can't read, so we
        // treat a completed request as success and only surface true network failures.
        fetch(action, { method: "POST", mode: "no-cors", body: data })
          .then(function () { form.reset(); setStatus(true, n.success || "Thanks — please check your inbox to confirm."); })
          .catch(function () { setStatus(false, "Couldn’t reach the signup service — please try again in a moment."); })
          .then(function () { btn.disabled = false; btn.innerHTML = esc(n.cta || "Subscribe") + " →"; });
        return;
      }
      if (n.form) { window.open(n.form, "_blank", "noopener"); return; }
      // last-resort fallback while no provider is configured
      var subject = encodeURIComponent("Subscribe to Dynalytics updates");
      var bodyText = encodeURIComponent("Please add me to the Dynalytics updates list: " + email + ".");
      window.location.href = "mailto:" + (n.email || "") + "?subject=" + subject + "&body=" + bodyText;
    });
    return box;
  }

  /* ---------- search command palette (⌘K / /) ---------- */
  // A small field-weighted search engine over the catalog plus every package's
  // function reference (assets/functions.js, loaded on first use). It folds case
  // and accents ("lopez" finds López-Pernas), knows identifiers ("build model"
  // finds build_model()), matches prefixes while typing, and tolerates a typo
  // (one edit; two for words of 8+ letters), so "bootsrap" still finds bootstrap.
  var TYPE_LABEL = {
    package: "Package", person: "Person", paper: "Paper", news: "News", "function": "Function",
    tool: "Tool", vignette: "Article", post: "Tutorial", chapter: "Chapter",
    book: "Book", docsite: "Doc site", site: "Site"
  };
  var TYPE_PLURAL = {
    package: "Packages", "function": "Functions", vignette: "Articles", post: "Tutorials & posts",
    chapter: "Chapters", paper: "Papers", person: "People", tool: "Tools", news: "News", book: "Books", site: "Sites"
  };
  var TYPE_RANK = { package: 0, "function": 1, person: 2, paper: 3, tool: 4, post: 5, chapter: 6, vignette: 7, news: 8, book: 9, docsite: 10, site: 10 };
  // Percent added to an item's match score. Multiplicative on purpose: an additive
  // boost let a package that merely mentions a word in its blurb outrank a function
  // named after it. A boost scales relevance; it never substitutes for it.
  var TYPE_BOOST = { package: 30, person: 20, tool: 10, paper: 8, "function": 5, post: 5, vignette: 5, chapter: 3 };
  var FIELD_WEIGHT = { name: 10, title: 6, tags: 3, text: 1 };
  var STOPWORDS = { a: 1, an: 1, and: 1, the: 1, of: 1, "for": 1, "in": 1, to: 1, "with": 1, on: 1, by: 1, how: 1, is: 1, r: 1 };
  var SUGGESTIONS = ["splot", "bootstrap", "sequence analysis", "López-Pernas", "psychological network", "latent profile"];
  var RESULT_LIMIT = 60;
  var _idx = null, _cmdk = null, _cmdkActive = 0, _cmdkRows = [], _cmdkFilter = "all";
  var _fnState = "idle";

  function fold(s) { return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function trimWord(w) { return w.replace(/^[._]+|[._]+$/g, ""); }
  // whole identifiers (build_model, splot.netobject) plus their parts
  function wordsOf(s) {
    var out = [];
    fold(s).split(/[^a-z0-9_.]+/).forEach(function (w) {
      w = trimWord(w);
      if (!w) return;
      out.push(w);
      if (/[._]/.test(w)) w.split(/[._]+/).forEach(function (p) { if (p) out.push(p); });
    });
    return out;
  }
  function queryTokens(q) {
    var all = fold(q).split(/[^a-z0-9_.]+/).map(trimWord).filter(Boolean);
    var content = all.filter(function (w) { return !STOPWORDS[w]; });
    return content.length ? content : all;
  }
  // Damerau–Levenshtein (optimal string alignment) distance, true when <= k.
  // Exits as soon as a whole row exceeds k, so non-matches are cheap.
  function withinEdits(a, b, k) {
    if (Math.abs(a.length - b.length) > k) return false;
    var prev2 = null, prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      var rowMin = i;
      for (j = 1; j <= b.length; j++) {
        var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > k) return false;
      prev2 = prev; prev = cur;
    }
    return prev[b.length] <= k;
  }

  function searchTarget(e) {
    if (e.type === "package") return { hash: "#/pkg/" + encodeURIComponent(e.id) };
    if (e.type === "person") return { hash: "#/people/" + encodeURIComponent(e.id) };
    var url = (e.type === "chapter" && e.links && e.links.read) ? e.links.read : e.url;
    return { url: url };
  }
  function searchSub(e) {
    if (e.type === "package") return subtitleOf(e) + (e.links && e.links.cran ? " · on CRAN" : "");
    if (e.type === "person") return [e.role, e.affiliation].filter(Boolean).join(" · ");
    if (e.type === "chapter") return e.volume ? e.volume.replace(/—.*/, "").trim() + " · " + (e.blurb || "") : (e.blurb || "");
    if (e.type === "vignette") return pkgsOf(e).join(", ") + " · article";
    return e.blurb || "";
  }
  function entryItem(e) {
    var name = e.type === "package" ? e.id : (e.name || "");
    var authors = Array.isArray(e.authors) ? e.authors.join(" ") : e.authors;
    return {
      type: e.type === "docsite" ? "site" : e.type,
      title: e.title || e.name || e.id,
      sub: searchSub(e),
      target: searchTarget(e),
      keys: [fold(name || e.title || e.id)],
      fields: {
        name: name,
        title: e.title || "",
        tags: [(e.tags || []).join(" "), pkgsOf(e).join(" "), e.kind, e.tag, e.owner, authors, e.venue, e.year, e.role, e.affiliation, e.volume]
          .filter(Boolean).join(" "),
        text: e.blurb || ""
      }
    };
  }
  // f = { p: package, n: [aliases], t: topic title, u: page under <docs>/reference/ }
  function functionItem(f) {
    var pkg = S.byId[f.p], ref = pkg && pkg.links && pkg.links.reference;
    if (!ref || !f.n || !f.n.length) return null;
    var bare = f.n.map(function (n) { return n.replace(/\(\)$/, ""); });
    var main = f.n[Math.max(0, bare.indexOf(f.u.replace(/\.html$/, "")))];
    var others = f.n.filter(function (n) { return n !== main; });
    return {
      type: "function",
      title: main,
      sub: f.p + " · " + f.t + (others.length ? " · also " + others.slice(0, 4).join(", ") + (others.length > 4 ? "…" : "") : ""),
      target: { url: ref + f.u },
      keys: bare.map(fold),
      fields: { name: f.n.join(" "), title: f.t, tags: f.p, text: "" }
    };
  }
  function buildSearchIndex() {
    var items = S.all.map(entryItem)
      .concat((window.DYNASITE_FUNCTIONS || []).map(functionItem).filter(Boolean));
    // inverted index: word -> { itemIndex: heaviest field weight it appears in }
    var vocab = Object.create(null);
    items.forEach(function (it, i) {
      Object.keys(FIELD_WEIGHT).forEach(function (field) {
        var w = FIELD_WEIGHT[field];
        wordsOf(it.fields[field]).forEach(function (word) {
          var post = vocab[word] || (vocab[word] = Object.create(null));
          if (!(post[i] >= w)) post[i] = w;
        });
      });
      it.phrase = fold(it.title + " " + it.fields.title);
    });
    _idx = { items: items, vocab: vocab, words: Object.keys(vocab) };
  }
  // every vocabulary word a query token can stand for, with a match quality in (0, 1]
  function tokenMatches(tok, isLast) {
    var k = tok.length >= 8 ? 2 : (tok.length >= 4 ? 1 : 0);
    var out = [];
    _idx.words.forEach(function (w) {
      var q = 0;
      if (w === tok) q = 1;
      else if (w.indexOf(tok) === 0) q = isLast ? 0.85 : 0.7;      // still typing
      else if (tok.length >= 3 && w.indexOf(tok) > 0) q = 0.4;     // inside a word
      else if (k && withinEdits(tok, w, k)) q = 0.45;              // a typo
      if (q) out.push([w, q]);
    });
    return out;
  }
  function browseItems() {
    return _idx.items.filter(function (it) { return it.type === "package" || it.type === "person" || it.type === "tool"; });
  }
  // -> { items: ranked hits, partial: true when no item matched every word }
  function runSearch(q) {
    var toks = queryTokens(q);
    if (!toks.length) return { items: browseItems(), toks: [], partial: false };
    var perToken = toks.map(function (t, ti) {
      var best = Object.create(null);
      tokenMatches(t, ti === toks.length - 1).forEach(function (m) {
        var post = _idx.vocab[m[0]];
        for (var i in post) { var s = post[i] * m[1]; if (!(best[i] >= s)) best[i] = s; }
      });
      return best;
    });
    var score = Object.create(null), hits = Object.create(null);
    perToken.forEach(function (best) {
      for (var i in best) { score[i] = (score[i] || 0) + best[i]; hits[i] = (hits[i] || 0) + 1; }
    });
    var ids = Object.keys(score).filter(function (i) { return hits[i] === toks.length; });
    var partial = false;
    if (!ids.length && toks.length > 1) {
      // nothing has every word: fall back to items matching most of them, and say so
      partial = true;
      ids = Object.keys(score).filter(function (i) { return hits[i] >= Math.ceil(toks.length / 2); });
    }
    var whole = fold(q).trim().replace(/\(\)$/, ""), joined = toks.join(" ");
    return {
      toks: toks, partial: partial,
      items: ids.map(function (i) {
        var it = _idx.items[i], s = score[i] * (1 + (TYPE_BOOST[it.type] || 0) / 100);
        if (it.keys.indexOf(whole) >= 0 || it.keys.indexOf(joined) >= 0) s += 40;          // exact name
        else if (it.keys.some(function (k) { return k.indexOf(joined) === 0; })) s += 8;    // name begins with it
        if (toks.length > 1 && it.phrase.indexOf(joined) >= 0) s += 6;                     // phrase in title
        return { it: it, s: s };
      }).sort(function (a, b) {
        return b.s - a.s || (TYPE_RANK[a.it.type] - TYPE_RANK[b.it.type]) || a.it.title.localeCompare(b.it.title);
      }).map(function (x) { return x.it; })
    };
  }
  // wrap the query's words in <mark>; only when folding kept the text's length,
  // so positions in the folded copy are positions in the original
  function highlight(text, toks) {
    text = String(text == null ? "" : text);
    var f = fold(text), marks = [], i, k;
    toks = toks.filter(function (t) { return t.length >= 2; });
    if (f.length !== text.length || !toks.length) return esc(text);
    toks.forEach(function (t) {
      var from = 0;
      while ((i = f.indexOf(t, from)) >= 0) { for (k = i; k < i + t.length; k++) marks[k] = true; from = i + t.length; }
    });
    var out = "", open = false;
    for (i = 0; i < text.length; i++) {
      if (marks[i] && !open) { out += "<mark>"; open = true; }
      if (!marks[i] && open) { out += "</mark>"; open = false; }
      out += esc(text[i]);
    }
    return out + (open ? "</mark>" : "");
  }

  function loadFunctions() {
    if (window.DYNASITE_FUNCTIONS) { _fnState = "ready"; return; }
    if (_fnState === "loading" || _fnState === "failed") return;
    _fnState = "loading";
    var s = document.createElement("script");
    s.src = "assets/functions.js" + (S.functionsVersion ? "?v=" + S.functionsVersion : "");
    s.async = true;
    s.onload = function () { _fnState = "ready"; _idx = null; refreshCmdK(); };
    s.onerror = function () { _fnState = "failed"; refreshCmdK(); };
    document.head.appendChild(s);
  }

  // Analytics: one `search` event per settled query, one `select_content` per opened result.
  var _trackTimer = null, _lastTracked = "";
  function trackSearch(q) {
    clearTimeout(_trackTimer);
    q = String(q || "").trim();
    if (q.length < 2 || typeof window.gtag !== "function") return;
    _trackTimer = setTimeout(function () {
      if (q === _lastTracked) return;
      _lastTracked = q;
      window.gtag("event", "search", { search_term: q });
    }, 1200);
  }

  function refreshCmdK() {
    if (!_cmdk) return;
    renderCmdkResults(_cmdk.querySelector(".cmdk-input").value);
  }
  function renderCmdkResults(q) {
    if (!_idx) buildSearchIndex();
    var box = _cmdk.querySelector(".cmdk-results");
    var bar = _cmdk.querySelector(".cmdk-filters");
    var meta = _cmdk.querySelector(".cmdk-meta");
    box.innerHTML = ""; bar.innerHTML = "";
    _cmdkRows = []; _cmdkActive = 0;
    var res = runSearch(q);

    // filter chips, one per result type present
    var counts = {};
    res.items.forEach(function (it) { counts[it.type] = (counts[it.type] || 0) + 1; });
    var types = Object.keys(counts).sort(function (a, b) { return TYPE_RANK[a] - TYPE_RANK[b]; });
    if (_cmdkFilter !== "all" && !counts[_cmdkFilter]) _cmdkFilter = "all";
    if (res.toks.length && types.length > 1) {
      [["all", "All", res.items.length]].concat(types.map(function (t) { return [t, TYPE_PLURAL[t] || t, counts[t]]; }))
        .forEach(function (c) {
          var chip = el("button", "cmdk-chip" + (c[0] === _cmdkFilter ? " active" : ""),
            esc(c[1]) + ' <span class="fc-n">' + c[2] + "</span>");
          chip.type = "button";
          chip.setAttribute("data-filter", c[0]);
          bar.appendChild(chip);
        });
    }
    bar.hidden = !bar.childNodes.length;

    var shown = _cmdkFilter === "all" ? res.items : res.items.filter(function (it) { return it.type === _cmdkFilter; });
    var fnNote = _fnState === "loading" ? " · loading function index…" : (_fnState === "failed" ? " · function index unavailable" : "");
    meta.innerHTML = res.toks.length
      ? (shown.length ? shown.length + " result" + (shown.length === 1 ? "" : "s") + (shown.length > RESULT_LIMIT ? " · showing the best " + RESULT_LIMIT : "") : "")
        + (res.partial ? ' · <span class="cmdk-warn">no result has every word — showing the closest</span>' : "") + fnNote
      : "Try " + SUGGESTIONS.map(function (s) { return '<button type="button" class="cmdk-try">' + esc(s) + "</button>"; }).join(" ") + fnNote;

    if (!shown.length) { box.appendChild(el("div", "cmdk-empty", "No matches for “" + esc(q) + "”")); return; }
    shown.slice(0, RESULT_LIMIT).forEach(function (it, i) {
      var row = el("div", "cmdk-item" + (i === 0 ? " active" : "") + (it.type === "function" ? " fn" : ""));
      row.setAttribute("role", "option");
      row.innerHTML =
        '<span class="ci-type">' + esc(TYPE_LABEL[it.type] || it.type) + "</span>" +
        '<span class="ci-main"><span class="ci-title">' + highlight(it.title, res.toks) + "</span>" +
        '<span class="ci-sub">' + highlight(it.sub, res.toks) + "</span></span>" +
        '<span class="ci-go">' + (it.target.hash ? "→" : "↗") + "</span>";
      row.addEventListener("click", function () { activateResult(it); });
      row.addEventListener("mousemove", function () { setActiveRow(i); });
      box.appendChild(row);
      _cmdkRows.push({ row: row, it: it });
    });
  }
  function setActiveRow(i) {
    if (!_cmdkRows.length) return;
    _cmdkActive = (i + _cmdkRows.length) % _cmdkRows.length;
    _cmdkRows.forEach(function (r, j) { r.row.classList.toggle("active", j === _cmdkActive); });
    _cmdkRows[_cmdkActive].row.scrollIntoView({ block: "nearest" });
  }
  function activateResult(it) {
    if (typeof window.gtag === "function") {
      window.gtag("event", "select_content", { content_type: it.type, item_id: it.title });
    }
    var tgt = it.target;
    closeCmdK();
    if (tgt.hash) location.hash = tgt.hash;
    else if (tgt.url) window.open(tgt.url, "_blank", "noopener");
  }
  function cycleFilter(step) {
    var chips = _cmdk.querySelectorAll(".cmdk-chip");
    if (!chips.length) return;
    var keys = Array.prototype.map.call(chips, function (c) { return c.getAttribute("data-filter"); });
    _cmdkFilter = keys[(keys.indexOf(_cmdkFilter) + step + keys.length) % keys.length];
    refreshCmdK();
  }
  function openCmdK(initial) {
    loadFunctions();
    if (!_cmdk) {
      _cmdk = el("div", "cmdk");
      _cmdk.innerHTML =
        '<div class="cmdk-box" role="dialog" aria-label="Search">' +
          '<div class="cmdk-inputwrap">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
            '<input class="cmdk-input" type="text" placeholder="Search packages, functions, people, papers, chapters…" aria-label="Search" autocomplete="off" spellcheck="false">' +
            '<span class="cmdk-hint">esc</span>' +
          "</div>" +
          '<div class="cmdk-filters" hidden></div>' +
          '<div class="cmdk-meta"></div>' +
          '<div class="cmdk-results" role="listbox"></div>' +
          '<div class="cmdk-foot"><span><b>↑↓</b> navigate</span><span><b>↵</b> open</span><span><b>tab</b> filter</span><span><b>esc</b> close</span></div>' +
        "</div>";
      document.body.appendChild(_cmdk);
      var input = _cmdk.querySelector(".cmdk-input");
      input.addEventListener("input", function () { _cmdkFilter = "all"; renderCmdkResults(input.value); trackSearch(input.value); });
      _cmdk.addEventListener("click", function (ev) {
        if (ev.target === _cmdk) { closeCmdK(); return; }
        var chip = ev.target.closest(".cmdk-chip");
        if (chip) { _cmdkFilter = chip.getAttribute("data-filter"); refreshCmdK(); input.focus(); return; }
        var t = ev.target.closest(".cmdk-try");
        if (t) { input.value = t.textContent; _cmdkFilter = "all"; renderCmdkResults(input.value); trackSearch(input.value); input.focus(); }
      });
      _cmdk.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") { ev.preventDefault(); closeCmdK(); }
        else if (ev.key === "ArrowDown") { ev.preventDefault(); setActiveRow(_cmdkActive + 1); }
        else if (ev.key === "ArrowUp") { ev.preventDefault(); setActiveRow(_cmdkActive - 1); }
        else if (ev.key === "Tab") { ev.preventDefault(); cycleFilter(ev.shiftKey ? -1 : 1); }
        else if (ev.key === "Enter") { ev.preventDefault(); if (_cmdkRows[_cmdkActive]) activateResult(_cmdkRows[_cmdkActive].it); }
      });
    }
    var inp = _cmdk.querySelector(".cmdk-input");
    inp.value = initial || "";
    _cmdkFilter = "all";
    renderCmdkResults(inp.value);
    if (initial) trackSearch(initial);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(function () { _cmdk.classList.add("show"); inp.focus(); });
  }
  function closeCmdK() {
    if (!_cmdk) return;
    _cmdk.classList.remove("show");
    document.body.style.overflow = "";
    setTimeout(function () { if (_cmdk && !_cmdk.classList.contains("show")) _cmdk.remove(); _cmdk = null; }, 160);
  }
  function initSearch() {
    var btn = document.getElementById("search-open");
    if (btn) {
      btn.addEventListener("click", function () { openCmdK(); });
      btn.addEventListener("pointerenter", loadFunctions);   // warm the index before the click
    }
    document.addEventListener("keydown", function (ev) {
      var mod = ev.metaKey || ev.ctrlKey;
      if (mod && (ev.key === "k" || ev.key === "K")) { ev.preventDefault(); openCmdK(); return; }
      if (ev.key === "/" && !_cmdk) {
        var t = ev.target, tag = t && t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) return;
        ev.preventDefault(); openCmdK();
      }
    });
    // shareable searches: https://dynasite.org/?q=bootstrap
    var q = null;
    try { q = new URLSearchParams(location.search).get("q"); } catch (e) {}
    if (q) openCmdK(q);
  }

  /* ---------- package dossier ---------- */
  function renderPackage(view, p, tab) {
    view.innerHTML = "";
    var back = el("a", "back", "← Packages"); back.href = "#/packages"; view.appendChild(back);

    var head = el("div", "dossier-head");
    var onCran = !!(p.links && p.links.cran);
    var dev = onCran && p.version && p.cran_version && p.version !== p.cran_version;
    var verFact = onCran
      ? '<span class="cran">● on CRAN <b>' + esc(p.cran_version || "") + "</b></span>" + (dev ? "<span>dev <b>" + esc(p.version) + "</b></span>" : "")
      : '<span>version <b>' + esc(p.version || "—") + "</b> · not on CRAN</span>";
    var authors = Array.isArray(p.authors) ? p.authors : [];
    var authorFact = authors.length
      ? '<span class="by">by ' + authors.map(function (a, i) {
          var label = esc(a) + (i < authors.length - 1 ? "," : "");
          var person = personByName(a);
          return person
            ? '<a class="aut" href="#/people/' + encodeURIComponent(person.id) + '">' + label + "</a>"
            : '<span class="aut">' + label + "</span>";
        }).join(" ") + "</span>"
      : "";
    head.innerHTML =
      (p.logo ? '<img class="dlogo" src="' + esc(p.logo) + '" alt="" onerror="this.style.display=\'none\'">' : "") +
      "<h1>" + esc(p.id) + "</h1>" +
      '<div class="subtitle">' + esc(subtitleOf(p)) + "</div>" +
      '<div class="blurb">' + esc(p.blurb || "") + "</div>" +
      '<div class="facts">' + verFact + authorFact + "</div>";
    view.appendChild(head);

    if (p.links && Object.keys(p.links).length) {
      var acts = el("div", "actions");
      [["docs", "Documentation", true], ["cran", "CRAN", false], ["github", "GitHub", false], ["reference", "Function reference", false]].forEach(function (x) {
        if (!p.links[x[0]]) return;
        var a = el("a", "btn" + (x[2] ? " primary" : "")); a.href = p.links[x[0]]; a.target = "_blank"; a.rel = "noopener"; a.textContent = x[1];
        acts.appendChild(a);
      });
      view.appendChild(acts);
    } else if (p.note) {
      view.appendChild(el("div", "empty-note", p.note));
    }

    // Resource categories for this package, shown one at a time via a secondary
    // menu (like the Readings view) so the dossier doesn't stack every group.
    var posts = by("post", p.id);
    var cardsGrid = function (cards) { var grid = el("div", "chap-grid"); cards.forEach(function (c) { grid.appendChild(c); }); return grid; };
    var cats = [
      { key: "tutorials", label: "Tutorials", hint: "step-by-step guides — start here",
        items: posts.filter(function (e) { return e.kind === "tutorial"; }),
        body: function (items) { return cardsGrid(items.map(function (e) { return resourceCard(e, { badge: "Tutorial", read: "Read the tutorial" }); })); } },
      { key: "articles", label: "Articles", hint: "from the package documentation site & CRAN",
        items: by("vignette", p.id),
        body: function (items) { return cardsGrid(items.map(function (e) { return resourceCard(e, { badge: "Article", read: "Read the article", foot: "" }); })); } },
      { key: "blogs", label: "Blogs", hint: "long-form guides on saqr.me & sonsoles.me",
        items: posts.filter(function (e) { return e.kind !== "tutorial" && e.kind !== "news"; }),
        body: function (items) { return cardsGrid(items.map(function (e) { return resourceCard(e, { badge: KIND_LABEL[e.kind] || "Post", read: "Read the post" }); })); } },
      { key: "book", label: "In the Book", hint: "relevant chapters of lamethods.org",
        items: by("chapter", p.id),
        body: function (items) { var l = el("div", "list"); items.map(chapterRow).forEach(function (c) { l.appendChild(c); }); return l; } }
    ];
    var avail = cats.filter(function (c) { return c.items.length; });
    if (!avail.length) return;
    var active = avail.filter(function (c) { return c.key === tab; })[0] || avail[0];

    var sub = el("nav", "subnav");
    avail.forEach(function (c) {
      var a = el("a", "subnav-link" + (c === active ? " active" : ""));
      a.href = "#/pkg/" + encodeURIComponent(p.id) + "/" + c.key;
      a.innerHTML = esc(c.label) + ' <span class="sn-n">' + c.items.length + "</span>";
      sub.appendChild(a);
    });
    view.appendChild(sub);

    var g = el("div", "dgroup");
    g.appendChild(el("h3", null, esc(active.label)));
    g.appendChild(el("div", "ghint", esc(active.hint)));
    g.appendChild(active.body(active.items));
    view.appendChild(g);
  }

  document.addEventListener("DOMContentLoaded", load);
})();
