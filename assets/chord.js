/* Dynasite — package chord diagram (d3 v7), styled after saqr.me's chord2.
   Arcs = packages, grouped/coloured by conceptual focus; ribbons = shared focus areas. */
(function () {
  "use strict";

  // Primary groups (coloured arc blocks + legend), in ring order.
  var GROUPS = [
    { key: "networks",  label: "Networks",      color: "#1f5fa8", pkgs: ["tna", "htna", "Nestimate", "cooccure", "cograph", "bibnets", "psychnet"] },
    { key: "dynamics",  label: "Dynamics",      color: "#c0392b", pkgs: ["codyna", "tsn", "Saqrlab"] },
    { key: "sequences", label: "Sequences",     color: "#1e8449", pkgs: ["transitiontrees", "lagseq", "snakeplot"] },
    { key: "utilities", label: "Utilities",     color: "#7f8c8d", pkgs: ["Saqrmisc"] }
  ];
  var OTHER = { key: "other", label: "Other", color: "#b0b0b0", pkgs: [] };

  // Conceptual focus areas per package (drive ribbons + plain-language descriptions).
  var FOCUS = {
    tna:             ["networks", "dynamics", "sequences", "validation"],
    htna:            ["networks", "dynamics", "sequences"],
    Nestimate:       ["networks", "validation", "psychometrics"],
    cooccure:        ["networks", "co-occurrence"],
    cograph:         ["networks", "visualization"],
    bibnets:         ["networks", "bibliometrics"],
    psychnet:        ["networks", "psychometrics"],
    codyna:          ["dynamics", "sequences", "complexity"],
    tsn:             ["networks", "dynamics", "time series"],
    transitiontrees: ["sequences", "dynamics"],
    lagseq:          ["sequences", "dynamics", "validation"],
    snakeplot:       ["sequences", "visualization"],
    Saqrlab:         ["dynamics", "simulation", "validation"],
    Saqrmisc:        ["visualization", "clustering"]
  };
  function titleCase(s) { return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function focusOf(id) { return FOCUS[id] || []; }
  function groupOf(id) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].pkgs.indexOf(id) >= 0) return GROUPS[i]; return OTHER; }

  // expose taxonomy so other views (e.g. the matrix) can reuse it
  window.Dyna = { GROUPS: GROUPS, focusOf: focusOf, groupOf: groupOf, titleCase: titleCase };

  window.renderChord = function (container, packages, opts) {
    opts = opts || {};
    if (typeof d3 === "undefined") { container.innerHTML = '<div style="padding:30px;color:#888;font-family:monospace">d3 not loaded</div>'; return; }

    var present = {}; packages.forEach(function (p) { present[p.id] = p; });
    var order = [];
    GROUPS.concat([OTHER]).forEach(function (grp) {
      var ids = grp.key === "other"
        ? packages.filter(function (p) { return groupOf(p.id) === OTHER; }).map(function (p) { return p.id; })
        : grp.pkgs.filter(function (id) { return present[id]; });
      ids.forEach(function (id) { order.push({ id: id, grp: grp }); });
    });
    var n = order.length;
    if (!n) return;

    // shared-focus matrix + the shared focus labels (for tooltips)
    var M = [], shared = [];
    for (var i = 0; i < n; i++) { M[i] = []; shared[i] = []; for (var j = 0; j < n; j++) { M[i][j] = 0; shared[i][j] = []; } }
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      var a = focusOf(order[i].id), b = focusOf(order[j].id);
      var common = a.filter(function (t) { return b.indexOf(t) >= 0; });
      M[i][j] = M[j][i] = common.length;
      shared[i][j] = shared[j][i] = common;
    }

    var W = opts.width || 760, H = opts.height || 760;
    var outer = Math.min(W, H) / 2 - 120, inner = outer - 13;

    var chord = d3.chord().padAngle(0.05).sortSubgroups(d3.descending).sortChords(d3.descending);
    var chords = chord(M);
    var arc = d3.arc().innerRadius(inner).outerRadius(outer);
    var ribbon = d3.ribbon().radius(inner);

    container.innerHTML = "";
    var svg = d3.select(container).append("svg").attr("viewBox", [-W / 2, -H / 2, W, H]).attr("class", "chord-svg");
    var g = svg.append("g");

    g.append("g").attr("class", "ribbons").selectAll("path").data(chords).join("path")
      .attr("class", "chord2-ribbon").attr("d", ribbon)
      .attr("fill", function (d) { return order[d.source.index].grp.color; })
      .attr("stroke", function (d) { return d3.color(order[d.source.index].grp.color).darker(0.7); })
      .on("mouseover", function (ev, d) { highlight(d.source.index, d.target.index); })
      .on("mouseout", function () { clearHi(); });

    var groupG = g.append("g").attr("class", "arcs").selectAll("g").data(chords.groups).join("g").attr("class", "chord2-arc");
    groupG.append("path").attr("d", arc)
      .attr("fill", function (d) { return order[d.index].grp.color; })
      .attr("stroke", function (d) { return d3.color(order[d.index].grp.color).darker(0.7); })
      .style("cursor", "pointer")
      .on("click", function (ev, d) { if (opts.onClick) opts.onClick(order[d.index].id); })
      .on("mouseover", function (ev, d) { highlight(d.index, null); tip(ev, buildArcCard(d.index)); })
      .on("mousemove", moveTip).on("mouseout", function () { clearHi(); hideTip(); });

    // radial labels — each rotated to its own angle, so they never overlap
    groupG.append("g").attr("class", "chord2-label").each(function (d) {
      d.mid = (d.startAngle + d.endAngle) / 2;
    });
    groupG.append("line").attr("class", "chord2-leader")
      .attr("x1", function (d) { return Math.cos(d.mid - Math.PI / 2) * (outer + 2); })
      .attr("y1", function (d) { return Math.sin(d.mid - Math.PI / 2) * (outer + 2); })
      .attr("x2", function (d) { return Math.cos(d.mid - Math.PI / 2) * (outer + 9); })
      .attr("y2", function (d) { return Math.sin(d.mid - Math.PI / 2) * (outer + 9); });
    groupG.append("text").attr("class", "chord2-sub-label")
      .attr("dy", "0.32em")
      .attr("transform", function (d) {
        var deg = d.mid * 180 / Math.PI - 90;
        return "rotate(" + deg + ") translate(" + (outer + 13) + ",0)" + (d.mid > Math.PI ? " rotate(180)" : "");
      })
      .attr("text-anchor", function (d) { return d.mid > Math.PI ? "end" : "start"; })
      .style("cursor", "pointer")
      .text(function (d) { return order[d.index].id; })
      .on("click", function (ev, d) { if (opts.onClick) opts.onClick(order[d.index].id); })
      .on("mouseover", function (ev, d) { highlight(d.index, null); }).on("mouseout", clearHi);

    if (opts.legend !== false) {
      var used = {}; order.forEach(function (o) { used[o.grp.key] = o.grp; });
      var legend = d3.select(container).append("div").attr("class", "chord2-legend");
      GROUPS.concat([OTHER]).forEach(function (grp) {
        if (!used[grp.key]) return;
        var item = legend.append("div").attr("class", "chord2-legend-item");
        item.append("span").attr("class", "chord2-legend-swatch").style("background", grp.color);
        item.append("span").text(grp.label);
      });
    }

    var ribbons = g.selectAll(".chord2-ribbon"), arcs = g.selectAll(".chord2-arc");
    function highlight(a, b) {
      ribbons.style("fill-opacity", function (d) {
        var hit = d.source.index === a || d.target.index === a || (b != null && (d.source.index === b || d.target.index === b));
        return hit ? 0.85 : 0.04;
      });
      arcs.style("opacity", function (d) {
        if (d.index === a || d.index === b) return 1;
        return (M[a] && M[a][d.index] > 0) ? 1 : 0.28;
      });
    }
    function clearHi() { ribbons.style("fill-opacity", null); arcs.style("opacity", 1); }

    // ---- rich hover cards ----
    function mono(id) { return (id || "?").replace(/[^a-z0-9]/gi, "").slice(0, 1).toUpperCase(); }
    function elx(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
    function trunc(s, nn) { s = (s || "").trim(); return s.length > nn ? s.slice(0, nn - 1).replace(/\s+\S*$/, "") + "…" : s; }
    function iconNode(id, color) {
      var p = present[id] || {}, ico = elx("span", "pcard-ico");
      ico.style.setProperty("--c", color);
      if (p.logo) {
        var img = new Image(); img.src = p.logo; img.alt = id;
        img.onerror = function () { ico.classList.add("mono"); ico.textContent = mono(id); };
        ico.appendChild(img);
      } else { ico.classList.add("mono"); ico.textContent = mono(id); }
      return ico;
    }
    function chip(text, on) { return elx("span", "chip" + (on ? " sh" : ""), text); }

    function buildArcCard(i) {
      var id = order[i].id, grp = order[i].grp, p = present[id] || {};
      var card = elx("div", "pcard"); card.style.setProperty("--c", grp.color);
      card.appendChild(elx("div", "pcard-accent"));
      var body = elx("div", "pcard-body"); card.appendChild(body);
      var top = elx("div", "pcard-top"); body.appendChild(top);
      top.appendChild(iconNode(id, grp.color));
      var who = elx("div", "pcard-who");
      who.appendChild(elx("div", "pcard-name", id));
      var fam = elx("div", "pcard-fam"); fam.appendChild(elx("span", "dot")); fam.appendChild(elx("span", null, grp.label));
      who.appendChild(fam); top.appendChild(who);
      if (p.links && p.links.cran) top.appendChild(elx("span", "pcard-cran", "CRAN " + (p.cran_version || "")));
      var sub = p.title ? p.title.split("—").slice(1).join("—").trim() : "";
      if (sub) body.appendChild(elx("div", "pcard-sub", sub));
      if (p.blurb) body.appendChild(elx("div", "pcard-desc", trunc(p.blurb, 150)));
      var chips = elx("div", "pcard-chips"); focusOf(id).forEach(function (f) { chips.appendChild(chip(titleCase(f))); });
      body.appendChild(chips);
      var conn = []; for (var j = 0; j < n; j++) if (M[i][j] > 0) conn.push(order[j].id);
      var foot = elx("div", "pcard-foot");
      foot.appendChild(elx("span", null, conn.length ? "Linked with " + trunc(conn.join(", "), 56) : "No shared focus"));
      foot.appendChild(elx("span", "pcard-go", "click to open →"));
      body.appendChild(foot);
      return card;
    }
    function buildRelCard(d) {
      var i = d.source.index, j = d.target.index, color = order[i].grp.color;
      var f = shared[i][j];
      var card = elx("div", "pcard"); card.style.setProperty("--c", color);
      card.appendChild(elx("div", "pcard-accent"));
      var body = elx("div", "pcard-body"); card.appendChild(body);
      var head = elx("div", "pcard-rel"); body.appendChild(head);
      head.appendChild(iconNode(order[i].id, order[i].grp.color));
      head.appendChild(elx("span", "pcard-name", order[i].id));
      head.appendChild(elx("span", "ar", "↔"));
      head.appendChild(elx("span", "pcard-name", order[j].id));
      head.appendChild(iconNode(order[j].id, order[j].grp.color));
      var sentence = f.length
        ? "Both work on " + f.map(titleCase).join(" & ") + "."
        : "Related across the ecosystem.";
      body.appendChild(elx("div", "pcard-desc", sentence));
      var chips = elx("div", "pcard-chips"); f.forEach(function (x) { chips.appendChild(chip(titleCase(x), true)); });
      body.appendChild(chips);
      return card;
    }

    var tipEl;
    function tip(ev, node) {
      if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "chord2-tooltip"; document.body.appendChild(tipEl); }
      tipEl.innerHTML = ""; tipEl.appendChild(node); tipEl.classList.add("show"); moveTip(ev);
    }
    function moveTip(ev) {
      if (!tipEl) return;
      var x = ev.clientX + 18, y = ev.clientY + 18;
      var w = 312, h = tipEl.offsetHeight || 200;
      if (x + w > window.innerWidth) x = ev.clientX - w - 14;
      if (y + h > window.innerHeight) y = Math.max(10, window.innerHeight - h - 10);
      tipEl.style.left = x + "px"; tipEl.style.top = y + "px";
    }
    function hideTip() { if (tipEl) tipEl.classList.remove("show"); }
  };
})();
