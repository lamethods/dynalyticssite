/* Dynasite — research-atlas router + renderer. No framework; Fuse.js for search.
   Views: home (numbered package index + writing/news + the book) and a per-package
   dossier that gathers docs, articles, tutorials, blogs, and book chapters. */
(function () {
  "use strict";

  var KIND_LABEL = { tutorial: "Tutorial", blog: "Blog", news: "News", article: "Article" };
  var SOURCE_LABEL = { "saqr.me": "saqr.me", "sonsoles.me": "sonsoles.me" };

  var S = { all: [], byId: {}, packages: [], fuse: null, query: "" };

  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pkgsOf(e) { var p = e.packages; return !p ? [] : (Array.isArray(p) ? p : [p]); }
  function by(type, id) { return S.all.filter(function (e) { return e.type === type && pkgsOf(e).indexOf(id) >= 0; }); }
  function subtitleOf(p) { var t = p.title || ""; var i = t.indexOf("—"); return i >= 0 ? t.slice(i + 1).trim() : (p.blurb || ""); }
  function resourceCount(id) {
    return by("vignette", id).length + by("post", id).length + by("chapter", id).length;
  }
  function monogram(id) {
    var m = (id || "?").replace(/[^a-z0-9]/gi, "");
    return esc((m.slice(0, 1) || "?").toUpperCase());
  }
  function makeIcon(p) {
    var ico = el("div", "pkg-ico");
    if (p.logo) {
      var img = el("img"); img.src = p.logo; img.alt = p.id; img.loading = "lazy";
      img.onerror = function () { ico.classList.add("mono"); ico.textContent = ""; ico.innerHTML = monogram(p.id); };
      ico.appendChild(img);
    } else {
      ico.classList.add("mono"); ico.innerHTML = monogram(p.id);
    }
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
          '<div class="empty">Could not load the catalog — ' + esc(err.message) +
          '. Rebuild with <code>Rscript build/harvest.R</code>.</div>';
      });
  }

  /* ---------- router ---------- */
  function route() {
    var h = location.hash.replace(/^#\/?/, "");
    var m = h.match(/^pkg\/(.+)$/);
    var view = document.getElementById("view");
    window.scrollTo(0, 0);
    if (m && S.byId[decodeURIComponent(m[1])]) renderPackage(view, S.byId[decodeURIComponent(m[1])]);
    else renderHome(view);
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

  /* ---------- home ---------- */
  function renderHome(view) {
    view.innerHTML = "";
    var body = el("div"); view.appendChild(body);
    renderHomeBody(body);
  }

  function renderMap(body) {
    if (typeof window.renderChord !== "function" || !S.packages.length) return;
    body.appendChild(secHead("", "The ecosystem map", "packages by focus, linked by what they share"));
    var wrap = el("div", "mapwrap");
    body.appendChild(wrap);
    window.renderChord(wrap, S.packages, {
      width: 760, height: 760,
      onClick: function (id) { location.hash = "#/pkg/" + encodeURIComponent(id); }
    });
  }

  function renderAbout(body) {
    var a = S.about; if (!a) return;
    var box = el("div", "about");
    var pipe = (a.pipeline || []).map(function (s) { return "<b>" + esc(s) + "</b>"; }).join('<span class="sep">→</span>');
    var pts = (a.points || []).map(function (p) {
      return '<div class="pt"><div class="ph">' + esc(p.h) + '</div><div class="pb">' + esc(p.t) + "</div></div>";
    }).join("");
    box.innerHTML =
      "<h2>" + esc(a.title) + "</h2>" +
      '<div class="atag">' + esc(a.tagline || "") + "</div>" +
      '<p class="lead">' + esc(a.lead || "") + "</p>" +
      (a.more ? '<p class="amore">' + esc(a.more) + "</p>" : "") +
      (pipe ? '<div class="pipe">' + pipe + "</div>" : "") +
      '<div class="points">' + pts + "</div>" +
      (a.closing ? '<p class="amore">' + esc(a.closing) + "</p>" : "") +
      '<div class="cite-row">' +
        (a.citation ? '<span class="cite">' + esc(a.citation) + "</span>" : "") +
        (a.paper ? '<a class="paper-btn" href="' + esc(a.paper.href) + '" target="_blank" rel="noopener">' + esc(a.paper.label) + " →</a>" : "") +
      "</div>";
    body.appendChild(box);
  }

  function renderHomeBody(body) {
    body.innerHTML = "";

    renderAbout(body);
    renderMap(body);

    // 1 — package index
    body.appendChild(secHead("01", "Packages", ""));
    var idx = el("div", "index");
    S.packages.forEach(function (p) {
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
      idx.appendChild(row);
    });
    body.appendChild(idx);

    // 2 — books (lamethods volumes)
    var books = S.all.filter(function (e) { return e.type === "book"; });
    if (books.length) {
      body.appendChild(secHead("", "Books", "lamethods.org"));
      var lb = el("div", "list");
      books.forEach(function (e) { lb.appendChild(linkItem("Book · lamethods.org", e.title, e.blurb, e.url, "↗")); });
      body.appendChild(lb);
    }

    // 3 — book chapters (grouped by volume)
    var vols = {};
    by_book().forEach(function (e) { (vols[e.volume] = vols[e.volume] || []).push(e); });
    var volNames = Object.keys(vols);
    if (volNames.length) {
      body.appendChild(secHead("", "Book chapters", "lamethods.org"));
      volNames.forEach(function (vn) {
        var sub = el("div", "dgroup");
        sub.appendChild(el("div", "ghint", vn));
        var l = el("div", "list cols2");
        vols[vn].forEach(function (e) {
          l.appendChild(linkItem(e.title.split("—")[0].trim(), e.title.split("—").slice(1).join("—").trim() || e.title, "", e.url, "↗"));
        });
        sub.appendChild(l);
        body.appendChild(sub);
      });
    }

    // 4 — key papers
    var papers = S.all.filter(function (e) { return e.type === "paper"; });
    if (papers.length) {
      body.appendChild(secHead("", "Key papers", ""));
      var lp = el("div", "list");
      papers.forEach(function (e) {
        var kick = [e.authors, e.year, e.venue].filter(Boolean).join(" · ");
        lp.appendChild(linkItem(kick, e.title, e.blurb, e.url, "Read →"));
      });
      body.appendChild(lp);
    }
  }
  function by_book() { return S.all.filter(function (e) { return e.type === "chapter"; }); }

  /* ---------- search results ---------- */
  function renderResults(body) {
    var hits = S.fuse.search(S.query).map(function (r) { return r.item; });
    body.appendChild(el("div", "metaline", 'Results for “' + esc(S.query) + '”'));
    if (!hits.length) { body.appendChild(el("div", "empty", "Nothing matched.")); return; }
    var order = ["package", "vignette", "post", "chapter", "docsite", "site", "book"];
    var groups = {}; hits.forEach(function (e) { (groups[e.type] = groups[e.type] || []).push(e); });
    order.forEach(function (t) {
      if (!groups[t]) return;
      var l = el("div", "list");
      groups[t].forEach(function (e) {
        if (e.type === "package") {
          var a = el("a", "item"); a.href = "#/pkg/" + encodeURIComponent(e.id);
          a.innerHTML = '<div><div class="ikick">Package</div><div class="ititle">' + esc(e.id) +
            '</div><div class="idesc">' + esc(subtitleOf(e)) + '</div></div><div class="iright">→ dossier</div>';
          l.appendChild(a);
        } else {
          var kick = (KIND_LABEL[e.kind] || e.type) + (e.source ? " · " + e.source : "");
          l.appendChild(linkItem(kick, e.title, e.blurb, e.url, "↗"));
        }
      });
      body.appendChild(l);
    });
  }

  /* ---------- package dossier ---------- */
  function renderPackage(view, p) {
    view.innerHTML = "";
    var back = el("a", "back", "← Back to the index"); back.href = "#/"; view.appendChild(back);

    var head = el("div", "dossier-head");
    var onCran = !!(p.links && p.links.cran);
    var dev = onCran && p.version && p.cran_version && p.version !== p.cran_version;
    var verFact = onCran
      ? '<span class="cran">● on CRAN <b>' + esc(p.cran_version || "") + "</b></span>" +
        (dev ? "<span>dev <b>" + esc(p.version) + "</b></span>" : "")
      : '<span>version <b>' + esc(p.version || "—") + "</b> · not on CRAN</span>";
    var ok = p.status === "VERIFIED" || p.status === "REDIRECT";
    var statusFact = '<span><span class="sdot ' + (ok ? "VERIFIED" : (p.status || "LOCAL")) + '"></span>' +
      (ok ? "links verified" : esc((p.status || "local").toLowerCase())) + "</span>";
    head.innerHTML =
      (p.logo ? '<img class="dlogo" src="' + esc(p.logo) + '" alt="" onerror="this.style.display=\'none\'">' : "") +
      '<div class="kicker">R Package · maintained by ' + esc(p.owner || "") + "</div>" +
      "<h1>" + esc(p.id) + "</h1>" +
      '<div class="subtitle">' + esc(subtitleOf(p)) + "</div>" +
      '<div class="blurb">' + esc(p.blurb || "") + "</div>" +
      '<div class="facts">' + verFact + statusFact + "</div>";
    view.appendChild(head);

    // primary actions
    if (p.links && Object.keys(p.links).length) {
      var acts = el("div", "actions");
      var prio = [["docs", "Documentation", true], ["cran", "CRAN", false], ["github", "GitHub", false], ["reference", "Function reference", false]];
      prio.forEach(function (x) {
        if (!p.links[x[0]]) return;
        var a = el("a", "btn" + (x[2] ? " primary" : "")); a.href = p.links[x[0]]; a.target = "_blank"; a.rel = "noopener"; a.textContent = x[1];
        acts.appendChild(a);
      });
      view.appendChild(acts);
    } else if (p.note) {
      view.appendChild(el("div", "empty-note", p.note));
    }

    // grouped resources
    dgroup(view, "Articles & Vignettes", "from the package documentation site", by("vignette", p.id).map(function (e) {
      return linkItem("Article", e.title, e.blurb, e.url, "↗");
    }));
    dgroup(view, "Tutorials & Blog Posts", "long-form guides on saqr.me & sonsoles.me", by("post", p.id).map(function (e) {
      return linkItem((KIND_LABEL[e.kind] || "Post") + " · " + (SOURCE_LABEL[e.source] || ""), e.title, e.blurb, e.url, "↗");
    }));
    dgroup(view, "In the Book", "relevant chapters of lamethods.org", by("chapter", p.id).map(function (e) {
      return linkItem(e.volume.split("—")[0].trim() + " · " + e.title.split("—")[0].trim(),
        e.title.split("—").slice(1).join("—").trim() || e.title, "", e.url, "↗");
    }));
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
