/* Dynalytics Studio — login-gated content editor.
   Schema-driven: each section declares its fields; one renderer builds the forms
   and binds inputs directly to the in-memory model (no hand-written per-field code). */
(function () {
  "use strict";

  // ---------- tiny DOM helpers ----------
  function el(t, c, txt) { var e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; }
  function api(path, opts) {
    return fetch(path, Object.assign({ headers: { "Content-Type": "application/json" } }, opts))
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); });
  }
  var $ = function (id) { return document.getElementById(id); };

  // ---------- field schema ----------
  // types: text | textarea | csv (string[]) | kv (object) | object | list
  var ABOUT_FIELDS = [
    { key: "tagline", type: "text", label: "Tagline" },
    { key: "lead", type: "textarea", label: "Lead paragraph" },
    { key: "more", type: "textarea", label: "Second paragraph" },
    { key: "closing", type: "textarea", label: "Closing paragraph" },
    { key: "peopleIntro", type: "textarea", label: "People card blurb (homepage)" },
    { key: "paper", type: "object", label: "Paper link", fields: [
      { key: "label", type: "text", label: "Link label" },
      { key: "href", type: "text", label: "Paper URL" }
    ] },
    { key: "newsletter", type: "object", label: "Newsletter", fields: [
      { key: "heading", type: "text", label: "Heading" },
      { key: "blurb", type: "textarea", label: "Blurb" },
      { key: "cta", type: "text", label: "Button label" },
      { key: "note", type: "text", label: "Small note" },
      { key: "widget", type: "text", label: "EmailOctopus widget script URL (eomail*.com/form/ID.js)" },
      { key: "widgetId", type: "text", label: "EmailOctopus form ID (data-form)" },
      { key: "action", type: "text", label: "Inline form action URL (advanced; used if no widget)" },
      { key: "success", type: "text", label: "Success message (inline mode only)" },
      { key: "form", type: "text", label: "Hosted form URL (used only if widget + action blank)" },
      { key: "email", type: "text", label: "Fallback email (used only if all blank)" }
    ] },
    { key: "points", type: "list", label: "Key points", singular: "point", item: [
      { key: "h", type: "text", label: "Heading" },
      { key: "t", type: "textarea", label: "Text", full: true }
    ] }
  ];
  var SECTIONS = {
    about: { label: "About", kind: "object", fields: ABOUT_FIELDS },
    news: { label: "News", kind: "list", singular: "news item", titleKey: "title", item: [
      { key: "date", type: "text", label: "Date (YYYY-MM-DD)" },
      { key: "tag", type: "text", label: "Tag (Paper / Software / Funding…)" },
      { key: "title", type: "text", label: "Title", full: true },
      { key: "blurb", type: "textarea", label: "Blurb", full: true },
      { key: "url", type: "text", label: "Link URL", full: true }
    ] },
    people: { label: "People", kind: "list", singular: "person", titleKey: "name", item: [
      { key: "id", type: "text", label: "ID (slug)" },
      { key: "name", type: "text", label: "Name" },
      { key: "role", type: "text", label: "Role" },
      { key: "affiliation", type: "text", label: "Affiliation" },
      { key: "blurb", type: "textarea", label: "Blurb", full: true },
      { key: "url", type: "text", label: "Profile URL" },
      { key: "photo", type: "text", label: "Photo URL" }
    ] },
    papers: { label: "Papers", kind: "list", singular: "paper", titleKey: "title", item: [
      { key: "title", type: "text", label: "Title", full: true },
      { key: "authors", type: "text", label: "Authors" },
      { key: "year", type: "text", label: "Year" },
      { key: "venue", type: "text", label: "Venue" },
      { key: "url", type: "text", label: "DOI / URL", full: true },
      { key: "blurb", type: "textarea", label: "Blurb", full: true }
    ] },
    tools: { label: "Tools", kind: "list", singular: "tool", titleKey: "title", item: [
      { key: "id", type: "text", label: "ID (slug)" },
      { key: "kind", type: "text", label: "Kind (Python / jamovi module / Shiny app…)" },
      { key: "title", type: "text", label: "Title", full: true },
      { key: "blurb", type: "textarea", label: "Blurb", full: true },
      { key: "url", type: "text", label: "Primary URL", full: true },
      { key: "owner", type: "text", label: "Owner" },
      { key: "tags", type: "csv", label: "Tags (comma-separated)" },
      { key: "links", type: "kv", label: "Links (name → URL)", full: true }
    ] }
  };
  var ORDER = ["about", "news", "people", "papers", "tools"];

  // ---------- state ----------
  var model = {};     // editable sections, mirrors sources.json
  var active = "about";
  var dirty = false;

  // ---------- field renderers ----------
  function markDirty() { dirty = true; }

  function fieldText(f, obj) {
    var wrap = el("div", "fld" + (f.full ? " col-full" : ""));
    wrap.appendChild(el("label", null, f.label || f.key));
    var input = document.createElement(f.type === "textarea" ? "textarea" : "input");
    if (f.type !== "textarea") input.type = "text";
    input.value = obj[f.key] == null ? "" : obj[f.key];
    input.addEventListener("input", function () { obj[f.key] = input.value; markDirty(); });
    wrap.appendChild(input);
    return wrap;
  }
  function fieldCsv(f, obj) {
    var wrap = el("div", "fld" + (f.full ? " col-full" : ""));
    wrap.appendChild(el("label", null, f.label || f.key));
    var input = el("input"); input.type = "text";
    input.value = (obj[f.key] || []).join(", ");
    input.addEventListener("input", function () {
      obj[f.key] = input.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      markDirty();
    });
    wrap.appendChild(input);
    return wrap;
  }
  function fieldKv(f, obj) {
    var wrap = el("div", "fld col-full");
    wrap.appendChild(el("label", null, f.label || f.key));
    var rows = el("div");
    obj[f.key] = obj[f.key] || {};
    function commit(pairs) {
      var o = {};
      pairs.forEach(function (p) { if (p.k.trim()) o[p.k.trim()] = p.v.trim(); });
      obj[f.key] = o; markDirty();
    }
    var pairs = Object.keys(obj[f.key]).map(function (k) { return { k: k, v: obj[f.key][k] }; });
    function render() {
      rows.innerHTML = "";
      pairs.forEach(function (p) {
        var row = el("div", "kv-row");
        var kin = el("input"); kin.type = "text"; kin.placeholder = "name"; kin.value = p.k;
        var vin = el("input"); vin.type = "text"; vin.placeholder = "https://…"; vin.value = p.v;
        kin.addEventListener("input", function () { p.k = kin.value; commit(pairs); });
        vin.addEventListener("input", function () { p.v = vin.value; commit(pairs); });
        var x = el("button", "kv-x", "×"); x.type = "button";
        x.addEventListener("click", function () { pairs.splice(pairs.indexOf(p), 1); commit(pairs); render(); });
        row.appendChild(kin); row.appendChild(vin); row.appendChild(x);
        rows.appendChild(row);
      });
      var add = el("button", "kv-add", "+ add link"); add.type = "button";
      add.addEventListener("click", function () { pairs.push({ k: "", v: "" }); render(); });
      rows.appendChild(add);
    }
    render();
    wrap.appendChild(rows);
    return wrap;
  }
  function renderFields(fields, obj, container) {
    var grid = el("div", "fld-grid");
    fields.forEach(function (f) {
      if (f.type === "object") { container.appendChild(objectCard(f, obj)); return; }
      if (f.type === "list") { container.appendChild(nestedList(f, obj)); return; }
      var node = f.type === "csv" ? fieldCsv(f, obj) : f.type === "kv" ? fieldKv(f, obj) : fieldText(f, obj);
      grid.appendChild(node);
    });
    if (grid.children.length) container.appendChild(grid);
  }
  function objectCard(f, parent) {
    parent[f.key] = parent[f.key] || {};
    var card = el("div", "st-card sub");
    card.appendChild(el("div", "sub-title", f.label || f.key));
    renderFields(f.fields, parent[f.key], card);
    return card;
  }
  function nestedList(f, parent) {
    parent[f.key] = parent[f.key] || [];
    var card = el("div", "st-card sub");
    card.appendChild(el("div", "sub-title", f.label || f.key));
    var host = el("div");
    function render() {
      host.innerHTML = "";
      parent[f.key].forEach(function (obj, i) { host.appendChild(itemCard(f, parent[f.key], obj, i, render)); });
      card.appendChild(addBtn(f, parent[f.key], render));
    }
    card.appendChild(host); render();
    return card;
  }

  // a single repeatable item (used by top-level lists and nested lists)
  function itemCard(f, arr, obj, i, rerender) {
    var card = el("div", "st-card");
    var head = el("div", "st-item-head");
    var label = (f.singular || "item");
    var title = f.titleKey && obj[f.titleKey] ? obj[f.titleKey] : (label + " " + (i + 1));
    head.appendChild(el("span", "st-item-no", (i + 1) + " · " + title));
    var rm = el("button", "st-rm", "Remove"); rm.type = "button";
    rm.addEventListener("click", function () { arr.splice(i, 1); markDirty(); rerender(); });
    head.appendChild(rm);
    card.appendChild(head);
    renderFields(f.item, obj, card);
    return card;
  }
  function addBtn(f, arr, rerender) {
    var add = el("button", "st-add", "+ Add " + (f.singular || "item")); add.type = "button";
    add.addEventListener("click", function () {
      var blank = {}; f.item.forEach(function (fld) { blank[fld.key] = fld.type === "csv" ? [] : fld.type === "kv" ? {} : ""; });
      arr.push(blank); markDirty(); rerender();
    });
    return add;
  }

  // ---------- section + tabs ----------
  function renderSection() {
    var body = $("body"); body.innerHTML = "";
    var spec = SECTIONS[active];
    var wrap = el("div", "st-section");
    if (spec.kind === "object") {
      model.about = model.about || {};
      renderFields(spec.fields, model.about, wrap);
    } else {
      model[active] = model[active] || [];
      var host = el("div");
      function render() {
        host.innerHTML = "";
        model[active].forEach(function (obj, i) { host.appendChild(itemCard(spec, model[active], obj, i, render)); });
        host.appendChild(addBtn(spec, model[active], render));
      }
      render();
      wrap.appendChild(host);
    }
    body.appendChild(wrap);
  }
  function buildTabs() {
    var tabs = $("tabs"); tabs.innerHTML = "";
    ORDER.forEach(function (key) {
      var b = el("button", "st-tab" + (key === active ? " active" : ""), SECTIONS[key].label);
      b.addEventListener("click", function () { active = key; buildTabs(); renderSection(); });
      tabs.appendChild(b);
    });
  }

  // ---------- toast ----------
  var toastTimer = null;
  function toast(msg, kind, detail) {
    var t = $("toast"); t.innerHTML = "";
    t.className = "st-toast " + (kind || "");
    t.appendChild(document.createTextNode(msg));
    if (detail) { var pre = el("pre", null, detail); t.appendChild(pre); }
    t.hidden = false;
    requestAnimationFrame(function () { t.classList.add("show"); });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.hidden = true; }, 220); }, detail ? 9000 : 3200);
  }

  // ---------- actions ----------
  function busy(btn, on) { btn.disabled = on; }
  function save() {
    var btn = $("save"); busy(btn, true);
    return api("/api/save", { method: "POST", body: JSON.stringify(model) }).then(function (r) {
      busy(btn, false);
      if (!r.ok) { toast(r.body.error || "Save failed", "err"); return false; }
      dirty = false;
      var c = r.body.counts || {};
      toast("Saved — " + (c.news || 0) + " news · " + (c.papers || 0) + " papers · " + (c.tools || 0) + " tools · " + (c.people || 0) + " people. Preview is live.", "ok");
      return true;
    }).catch(function (e) { busy(btn, false); toast("Save failed: " + e.message, "err"); return false; });
  }
  function publish() {
    var btn = $("publish");
    function go() {
      busy(btn, true);
      api("/api/publish", { method: "POST", body: "{}" }).then(function (r) {
        busy(btn, false);
        if (!r.ok) { toast("Publish failed at " + (r.body.step || "?"), "err", r.body.log); return; }
        toast(r.body.message || "Published.", "ok");
      }).catch(function (e) { busy(btn, false); toast("Publish failed: " + e.message, "err"); });
    }
    if (dirty) { save().then(function (ok) { if (ok) go(); }); } else { go(); }
  }
  function reharvest() {
    var btn = $("reharvest"); busy(btn, true);
    toast("Re-harvesting packages, chapters & links… this hits the network and may take a minute.", "");
    api("/api/reharvest", { method: "POST", body: "{}" }).then(function (r) {
      busy(btn, false);
      if (!r.ok) { toast("Re-harvest failed", "err", r.body.log); return; }
      toast(r.body.broken ? "Re-harvested — but some links are BROKEN (see log)." : "Re-harvested & verified. Reloading content…", r.body.broken ? "err" : "ok", r.body.log);
      load();
    }).catch(function (e) { busy(btn, false); toast("Re-harvest failed: " + e.message, "err"); });
  }

  // ---------- load + boot ----------
  function load() {
    return api("/api/content").then(function (r) {
      if (!r.ok) throw new Error(r.body.error || "load failed");
      ORDER.forEach(function (k) { model[k] = r.body[k] != null ? r.body[k] : (k === "about" ? {} : []); });
      var m = r.body._meta || {};
      $("st-meta").textContent = "verified " + (m.verified_at || "—") + " · " + ((m.counts && m.counts.total) || "?") + " entries";
      buildTabs(); renderSection();
    });
  }
  function showApp() { $("gate").hidden = true; $("app").hidden = false; load().catch(function (e) { toast(e.message, "err"); }); }
  function showGate() { $("app").hidden = true; $("gate").hidden = false; setTimeout(function () { $("pw").focus(); }, 50); }

  function wire() {
    $("login").addEventListener("submit", function (e) {
      e.preventDefault();
      var err = $("gate-err"); err.hidden = true;
      api("/api/login", { method: "POST", body: JSON.stringify({ password: $("pw").value }) }).then(function (r) {
        if (r.ok) showApp();
        else { err.textContent = r.body.error || "Wrong password"; err.hidden = false; }
      });
    });
    $("save").addEventListener("click", save);
    $("publish").addEventListener("click", publish);
    $("reharvest").addEventListener("click", reharvest);
    $("logout").addEventListener("click", function () {
      api("/api/logout", { method: "POST", body: "{}" }).then(showGate);
    });
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && !$("app").hidden) { e.preventDefault(); save(); }
    });
    window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  }

  wire();
  api("/api/me").then(function (r) { if (r.body && r.body.authed) showApp(); else showGate(); });
})();
