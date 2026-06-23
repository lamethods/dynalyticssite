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
    { route: "papers", label: "Papers" },
    { route: "news", label: "News" }
  ];

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
    window.addEventListener("hashchange", route);
    route();
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
  function route() {
    var h = location.hash.replace(/^#\/?/, "");
    var view = document.getElementById("view");
    window.scrollTo(0, 0);
    var m = h.match(/^pkg\/(.+)$/);
    if (m && S.byId[decodeURIComponent(m[1])]) { setActive(null); renderPackage(view, S.byId[decodeURIComponent(m[1])]); return; }
    var mp = h.match(/^people\/(.+)$/);
    if (mp) { setActive("people"); renderPeople(view, decodeURIComponent(mp[1])); return; }
    var r = (h === "" || h === "/") ? "" : h;
    setActive(r);
    if (r === "packages") renderPackages(view);
    else if (r === "tools") renderTools(view);
    else if (r === "chapters") renderChapters(view);
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
      route: "papers", label: "Papers", count: papers.length,
      miniClass: "row-docs", minis: pp.map(miniDoc), extra: papers.length - pp.length,
      sub: "The foundational and applied papers behind the framework — TNA, FTNA, ATNA, HTNA and the human–AI studies.",
      cta: "All papers"
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

  function renderMap(body) {
    if (typeof window.renderChord !== "function" || !S.packages.length) return;
    body.appendChild(secHead("", "The ecosystem map", "packages by focus, linked by what they share"));
    var wrap = el("div", "mapwrap"); body.appendChild(wrap);
    window.renderChord(wrap, S.packages, {
      width: 760, height: 760,
      onClick: function (id) { location.hash = "#/pkg/" + encodeURIComponent(id); }
    });
  }

  function renderPackages(view) {
    view.innerHTML = "";
    view.appendChild(secHead("", "Packages", S.packages.length + " R packages"));
    var idx = el("div", "index");
    S.packages.forEach(function (p) { idx.appendChild(packageRow(p)); });
    view.appendChild(idx);
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
    view.appendChild(secHead("", "Key papers", ""));
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

  // newsletter signup — static site, so hands off to a Google Form (when set) or mailto.
  function newsletterBlock() {
    var n = (S.about && S.about.newsletter) || {};
    var box = el("div", "newsletter");
    var txt = el("div", "nl-text");
    txt.appendChild(el("div", "nl-head", esc(n.heading || "Get updates")));
    if (n.blurb) txt.appendChild(el("div", "nl-sub", esc(n.blurb)));
    box.appendChild(txt);

    var form = el("form", "nl-form");
    form.innerHTML =
      '<input class="nl-input" type="email" name="email" placeholder="you@example.com" aria-label="Email address" required>' +
      '<button class="nl-btn" type="submit">' + esc(n.cta || "Subscribe") + " →</button>";
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (n.form) { window.open(n.form, "_blank", "noopener"); return; }
      var input = form.querySelector(".nl-input");
      var email = (input && input.value || "").trim();
      var subject = encodeURIComponent("Subscribe to Dynalytics updates");
      var bodyText = encodeURIComponent("Please add me to the Dynalytics updates list" + (email ? ": " + email : "") + ".");
      window.location.href = "mailto:" + esc(n.email || "") + "?subject=" + subject + "&body=" + bodyText;
    });
    box.appendChild(form);
    if (n.note) box.appendChild(el("div", "nl-note", esc(n.note)));
    return box;
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

    dgroup(view, "Articles & Vignettes", "from the package documentation site", by("vignette", p.id).map(function (e) {
      return linkItem("Article", e.title, e.blurb, e.url, "↗");
    }));
    dgroup(view, "Tutorials & Blog Posts", "long-form guides on saqr.me & sonsoles.me", by("post", p.id).map(function (e) {
      return linkItem((KIND_LABEL[e.kind] || "Post") + " · " + (SOURCE_LABEL[e.source] || ""), e.title, e.blurb, e.url, "↗");
    }));
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

  document.addEventListener("DOMContentLoaded", load);
})();
