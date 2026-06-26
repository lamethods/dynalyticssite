/* Dynasite — top-level menu navigation. No framework.
   Views: Overview (Dynalytics + chord map), Packages, Tools, Books, Chapters,
   Papers, and a per-package dossier (#/pkg/<id>). */
(function () {
  "use strict";

  var KIND_LABEL = { tutorial: "Tutorial", blog: "Blog", news: "News", article: "Article" };
  var SOURCE_LABEL = { "saqr.me": "saqr.me", "sonsoles.me": "sonsoles.me" };
  var NAV = [
    { route: "", label: "Overview" },
    { route: "people", label: "People" },
    { route: "packages", label: "Packages" },
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
      var a = el("a", "navlink"); a.href = "#/" + n.route; a.textContent = n.label; a.setAttribute("data-route", n.route);
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
    var m = h.match(/^pkg\/(.+)$/);
    if (m && S.byId[decodeURIComponent(m[1])]) { setActive(null); var pk = S.byId[decodeURIComponent(m[1])]; setTitle(pk.id); renderPackage(view, pk); return; }
    var mp = h.match(/^people\/(.+)$/);
    if (mp) { setActive("people"); setTitle("People"); renderPeople(view, decodeURIComponent(mp[1])); return; }
    var mw = h.match(/^writing(?:\/(tutorials|articles|blogs))?$/);
    if (mw) { setActive("writing"); setTitle("Readings"); renderWriting(view, mw[1] || "tutorials"); return; }
    var r = (h === "" || h === "/") ? "" : h;
    setActive(r);
    var labels = { packages: "Packages", tools: "Tools", chapters: "Book chapters", writing: "Readings", papers: "Selected articles", news: "News", people: "People" };
    setTitle(labels[r] || "");
    if (r === "packages") renderPackages(view);
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

  // Order a list so TNA-related items lead, otherwise keeping the harvested order.
  // "tna" is the flagship package, so its tutorials/vignettes/posts surface first.
  function tnaFirst(list) {
    return list.slice().sort(function (a, b) {
      return (pkgsOf(a).indexOf("tna") >= 0 ? 0 : 1) - (pkgsOf(b).indexOf("tna") >= 0 ? 0 : 1);
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
      tnaFirst(active.items).forEach(function (e) { grid.appendChild(resourceCard(e, active.c.opts)); });
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
  var TYPE_LABEL = {
    package: "Package", person: "Person", paper: "Paper", news: "News",
    tool: "Tool", vignette: "Article", post: "Tutorial", chapter: "Chapter",
    book: "Book", docsite: "Doc site", site: "Site"
  };
  var TYPE_RANK = { package: 0, person: 1, paper: 2, tool: 3, post: 4, chapter: 5, vignette: 6, news: 7, book: 8, docsite: 9, site: 9 };
  var TYPE_BOOST = { package: 1, person: 0.8, tool: 0.4, paper: 0.3 };
  var _cmdkIndex = null, _cmdk = null, _cmdkActive = 0, _cmdkRows = [];

  function buildSearchIndex() {
    _cmdkIndex = S.all.map(function (e) {
      var name = e.name || "";
      var hay = [e.title, name, e.blurb, (e.tags || []).join(" "), e.type, e.kind, e.authors, e.owner]
        .filter(Boolean).join(" ").toLowerCase();
      return { e: e, hay: hay, title: (e.title || name || e.id || "").toLowerCase() };
    });
  }
  function searchTarget(e) {
    if (e.type === "package") return { hash: "#/pkg/" + encodeURIComponent(e.id) };
    if (e.type === "person") return { hash: "#/people/" + encodeURIComponent(e.id) };
    var url = (e.type === "chapter" && e.links && e.links.read) ? e.links.read : e.url;
    return { url: url };
  }
  function searchSub(e) {
    if (e.type === "package") return subtitleOf(e);
    if (e.type === "person") return [e.role, e.affiliation].filter(Boolean).join(" · ");
    if (e.type === "chapter") return e.volume ? e.volume.replace(/—.*/, "").trim() + " · " + (e.blurb || "") : (e.blurb || "");
    return e.blurb || "";
  }
  function runSearch(q) {
    q = (q || "").trim().toLowerCase();
    var items;
    if (!q) {
      // empty query → a useful default browse: packages, then people, then tools
      items = _cmdkIndex.filter(function (it) { return ["package", "person", "tool"].indexOf(it.e.type) >= 0; });
    } else {
      var toks = q.split(/\s+/);
      items = _cmdkIndex.map(function (it) {
        var score = 0;
        for (var i = 0; i < toks.length; i++) {
          var t = toks[i];
          if (it.hay.indexOf(t) < 0) return null;        // AND across tokens
          // widely spaced tiers so a title match always beats a blurb/tag match,
          // and the small per-type boost only breaks near-ties.
          score += it.title.indexOf(t) === 0 ? 10 : (it.title.indexOf(t) >= 0 ? 6 : 2);
        }
        return { it: it, score: score + (TYPE_BOOST[it.e.type] || 0) };
      }).filter(Boolean)
        .sort(function (a, b) { return b.score - a.score || (TYPE_RANK[a.it.e.type] - TYPE_RANK[b.it.e.type]); })
        .map(function (x) { return x.it; });
    }
    return items.slice(0, 40);
  }
  function renderCmdkResults(q) {
    var box = _cmdk.querySelector(".cmdk-results");
    box.innerHTML = "";
    _cmdkRows = []; _cmdkActive = 0;
    var hits = runSearch(q);
    if (!hits.length) { box.appendChild(el("div", "cmdk-empty", "No matches for “" + esc(q) + "”")); return; }
    hits.forEach(function (it, i) {
      var e = it.e, tgt = searchTarget(e);
      var row = el("div", "cmdk-item" + (i === 0 ? " active" : ""));
      row.innerHTML =
        '<span class="ci-type">' + esc(TYPE_LABEL[e.type] || e.type) + "</span>" +
        '<span class="ci-main"><span class="ci-title">' + esc(e.title || e.name || e.id) + "</span>" +
        '<span class="ci-sub">' + esc(searchSub(e)) + "</span></span>" +
        '<span class="ci-go">' + (tgt.hash ? "→" : "↗") + "</span>";
      row.addEventListener("click", function () { activateTarget(tgt); });
      row.addEventListener("mousemove", function () { setActiveRow(i); });
      box.appendChild(row);
      _cmdkRows.push({ row: row, tgt: tgt });
    });
  }
  function setActiveRow(i) {
    if (!_cmdkRows.length) return;
    _cmdkActive = (i + _cmdkRows.length) % _cmdkRows.length;
    _cmdkRows.forEach(function (r, j) { r.row.classList.toggle("active", j === _cmdkActive); });
    _cmdkRows[_cmdkActive].row.scrollIntoView({ block: "nearest" });
  }
  function activateTarget(tgt) {
    closeCmdK();
    if (tgt.hash) location.hash = tgt.hash;
    else if (tgt.url) window.open(tgt.url, "_blank", "noopener");
  }
  function openCmdK() {
    if (!_cmdkIndex) buildSearchIndex();
    if (!_cmdk) {
      _cmdk = el("div", "cmdk");
      _cmdk.innerHTML =
        '<div class="cmdk-box" role="dialog" aria-label="Search">' +
          '<div class="cmdk-inputwrap">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
            '<input class="cmdk-input" type="text" placeholder="Search packages, people, papers, chapters…" aria-label="Search" autocomplete="off" spellcheck="false">' +
            '<span class="cmdk-hint">esc</span>' +
          "</div>" +
          '<div class="cmdk-results"></div>' +
          '<div class="cmdk-foot"><span><b>↑↓</b> navigate</span><span><b>↵</b> open</span><span><b>esc</b> close</span></div>' +
        "</div>";
      document.body.appendChild(_cmdk);
      var input = _cmdk.querySelector(".cmdk-input");
      input.addEventListener("input", function () { renderCmdkResults(input.value); });
      _cmdk.addEventListener("click", function (ev) { if (ev.target === _cmdk) closeCmdK(); });
      _cmdk.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") { ev.preventDefault(); closeCmdK(); }
        else if (ev.key === "ArrowDown") { ev.preventDefault(); setActiveRow(_cmdkActive + 1); }
        else if (ev.key === "ArrowUp") { ev.preventDefault(); setActiveRow(_cmdkActive - 1); }
        else if (ev.key === "Enter") { ev.preventDefault(); if (_cmdkRows[_cmdkActive]) activateTarget(_cmdkRows[_cmdkActive].tgt); }
      });
    }
    var inp = _cmdk.querySelector(".cmdk-input");
    inp.value = "";
    renderCmdkResults("");
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
    if (btn) btn.addEventListener("click", openCmdK);
    document.addEventListener("keydown", function (ev) {
      var mod = ev.metaKey || ev.ctrlKey;
      if (mod && (ev.key === "k" || ev.key === "K")) { ev.preventDefault(); openCmdK(); return; }
      if (ev.key === "/" && !_cmdk) {
        var t = ev.target, tag = t && t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) return;
        ev.preventDefault(); openCmdK();
      }
    });
  }

  /* ---------- package dossier ---------- */
  function renderPackage(view, p) {
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
      '<div class="kicker">R Package · maintained by ' + esc(p.owner || "") + "</div>" +
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

    var posts = by("post", p.id);
    // Same reading order as the Readings view, every group as cards: tutorials
    // first, then vignettes/articles, then blog posts, then the book. Here the
    // package is implied, so each card's badge shows the kind instead.
    dcards(view, "Tutorials", "step-by-step guides — start here",
      posts.filter(function (e) { return e.kind === "tutorial"; })
        .map(function (e) { return resourceCard(e, { badge: "Tutorial", read: "Read the tutorial" }); }));
    dcards(view, "Vignettes & articles", "from the package documentation site",
      by("vignette", p.id).map(function (e) { return resourceCard(e, { badge: "Article", read: "Read the article", foot: "" }); }));
    dcards(view, "Blog posts & more", "long-form guides on saqr.me & sonsoles.me",
      posts.filter(function (e) { return e.kind !== "tutorial" && e.kind !== "news"; })
        .map(function (e) { return resourceCard(e, { badge: KIND_LABEL[e.kind] || "Post", read: "Read the post" }); }));
    dgroup(view, "In the Book", "relevant chapters of lamethods.org", by("chapter", p.id).map(chapterRow));
  }
  function dgroup(view, title, hint, items) {
    if (!items.length) return;
    var g = el("div", "dgroup");
    g.appendChild(el("h3", null, esc(title)));
    g.appendChild(el("div", "ghint", esc(hint)));
    var l = el("div", "list"); items.forEach(function (it) { l.appendChild(it); });
    g.appendChild(l);
    view.appendChild(g);
  }
  // like dgroup, but lays the items out as chapter-style cards (two-col grid)
  function dcards(view, title, hint, cards) {
    if (!cards.length) return;
    var g = el("div", "dgroup");
    g.appendChild(el("h3", null, esc(title)));
    g.appendChild(el("div", "ghint", esc(hint)));
    var grid = el("div", "chap-grid"); cards.forEach(function (c) { grid.appendChild(c); });
    g.appendChild(grid);
    view.appendChild(g);
  }

  document.addEventListener("DOMContentLoaded", load);
})();
