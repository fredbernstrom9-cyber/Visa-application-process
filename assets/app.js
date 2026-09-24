/* ClearEntry: checker, compare view, change log and routing. No dependencies. */
(function () {
  "use strict";
  var D = window.CE_DATA;
  var STORE_KEY = "clearentry:v1";

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function val(x, o) { return typeof x === "function" ? x(o) : x; }
  function eur(n, dec) {
    if (n == null) return "–";
    var d = dec == null ? (n % 1 === 0 ? 0 : 2) : dec;
    return "€" + n.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(iso) {
    var p = iso.split("-");
    if (p.length === 2) return MONTHS[+p[1] - 1] + " " + p[0];
    return (+p[2]) + " " + MONTHS[+p[1] - 1] + " " + p[0];
  }
  function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch (e) { return {}; } }
  function save(obj) { try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch (e) { /* storage unavailable */ } }
  var CONF_LABEL = { official: "Official source", multi: "2+ sources", check: "Verify" };
  function conf(c) { return c ? '<span class="conf ' + c + '" title="' + esc(CONF_LABEL[c]) + '">' + esc(CONF_LABEL[c]) + "</span>" : ""; }

  var ORIGIN = {}; D.ORIGINS.forEach(function (o) { ORIGIN[o.code] = o; });
  var BASIC = {}; D.BASIC.forEach(function (b) { BASIC[b.code] = b; });
  var FULL_ORDER = ["FRA", "DEU", "NLD", "ESP", "ITA", "IRL", "POL", "SWE"];
  function destName(code) { return D.DEST[code] ? D.DEST[code].name : (BASIC[code] ? BASIC[code].name : code); }

  /* ---------- state ---------- */
  var saved = load();
  var state = {
    origin: ORIGIN[saved.origin] ? saved.origin : "IND",
    dest: (D.DEST[saved.dest] || BASIC[saved.dest]) ? saved.dest : "FRA",
    purpose: saved.purpose === "short" ? "short" : "study"
  };
  var checks = saved.checks || {};

  function persist() { save({ origin: state.origin, dest: state.dest, purpose: state.purpose, checks: checks }); }

  /* ---------- selectors ---------- */
  function buildSelectors() {
    var os = $("#origin");
    var groups = {};
    D.ORIGINS.forEach(function (o) { (groups[o.group] = groups[o.group] || []).push(o); });
    os.innerHTML = Object.keys(groups).map(function (g) {
      return '<optgroup label="' + esc(g) + '">' + groups[g].map(function (o) {
        return '<option value="' + o.code + '">' + esc(o.name) + "</option>";
      }).join("") + "</optgroup>";
    }).join("");
    var ds = $("#dest");
    var full = FULL_ORDER.map(function (c) { return '<option value="' + c + '">' + esc(D.DEST[c].name) + "</option>"; }).join("");
    var basic = D.BASIC.map(function (b) { return '<option value="' + b.code + '">' + esc(b.name) + "</option>"; }).join("");
    ds.innerHTML = '<optgroup label="Full guides">' + full + '</optgroup><optgroup label="Basic guides (other EU countries)">' + basic + "</optgroup>";
    os.value = state.origin; ds.value = state.dest;
    $("#p-" + state.purpose).checked = true;

    os.addEventListener("change", function () { state.origin = os.value; persist(); renderAll(); });
    ds.addEventListener("change", function () { state.dest = ds.value; persist(); renderAll(); });
    $all('input[name="purpose"]').forEach(function (r) {
      r.addEventListener("change", function () { if (r.checked) { state.purpose = r.value; persist(); renderAll(); } });
    });
  }

  /* ---------- MRZ strip ---------- */
  function pad(s, n) { s = s.toUpperCase().replace(/[^A-Z0-9]/g, "<"); while (s.length < n) s += "<"; return s.slice(0, n); }
  function renderMRZ() {
    var o = ORIGIN[state.origin];
    var l1 = pad("P<" + o.code + "<<" + o.name.replace(/\s+/g, "<") + "<<APPLICANT", 44);
    var l2 = pad(state.dest + "<<" + (state.purpose === "study" ? "STUDY<GT<90D" : "VISIT<LE<90D") + "<<CHECKED<" + D.VERIFIED.replace(/-/g, ""), 44);
    $("#mrz").textContent = l1 + "\n" + l2;
  }

  /* ---------- rule resolution ---------- */
  function resolve() {
    var o = ORIGIN[state.origin];
    var code = state.dest;
    var d = D.DEST[code];
    var b = BASIC[code];
    var schengen = d ? d.schengen : b.schengen;
    var r = { o: o, code: code, name: destName(code), schengen: schengen, full: !!d, purpose: state.purpose };

    if (state.purpose === "short") return resolveShort(r);
    if (d) return resolveStudyFull(r, d);
    return resolveStudyBasic(r, b);
  }

  function recentChange(code) {
    var cutoff = "2025-09";
    return D.CHANGES.filter(function (c) { return c.where === code && c.date >= cutoff; });
  }

  function resolveStudyFull(r, d) {
    var o = r.o;
    var cta = code2cta(r);
    r.headline = val(d.headline, o);
    r.permit = d.permit;
    r.visaBefore = cta ? false : d.visaBefore(o);
    r.chips = [];
    if (cta) r.chips.push(["ok", "No visa, permit or registration"]);
    else r.chips.push(r.visaBefore ? ["req", "Visa before travel"] : ["ok", "No entry visa needed"]);
    if (!cta) r.chips.push(["info", "Residence step after arrival"]);
    if (!d.schengen) r.chips.push(["warn", "Not in Schengen"]);
    var rc = recentChange(r.code);
    if (rc.length) r.chips.push(["warn", "Rules changed " + fmtDate(rc[rc.length - 1].date)]);

    r.figures = cta ? [
      ["Visa before travel", "No", "Common Travel Area"],
      ["Funds to prove", "None", "No immigration check on funds"],
      ["Work while studying", "Unrestricted", "Same rights as Irish citizens"],
      ["Stay after graduating", "Unlimited", "Common Travel Area"]
    ] : [
      ["Visa before travel", r.visaBefore ? "Yes" : "No", r.visaBefore ? "Apply at the consulate first" : "Apply for the permit after arrival"],
      ["Funds to prove", d.funds.short, fundsSub(d)],
      ["Work while studying", d.work.short, ""],
      ["Stay after graduating", d.post.short, "to look for work"]
    ];

    r.steps = cta ? d.ctaSteps : d.steps.filter(function (s) { return !s.if || s.if(o); });
    r.docs = d.docs.filter(function (x) { return !x.when || x.when(o); }).map(function (x) { return x.label; });
    r.watch = cta ? [] : d.watch.slice();
    if (!cta && o.note && /study|long stay|Long stays/i.test(o.note)) r.watch.push(o.note);

    // money
    if (!cta) {
      var rows = d.fees.filter(function (f) { return !f.when || f.when(o); }).map(function (f) {
        return { label: f.label, eur: f.eur, note: f.note, conf: f.conf };
      });
      rows.push({ label: "Funds to show for 12 months", eur: Math.round(d.fundsYearEUR), note: d.fundsCurrency ? "Converted from " + d.fundsCurrency + " at approx. " + D.FX[d.fundsCurrency] + " per €" : null, conf: d.funds.conf, funds: true });
      r.money = rows;
      r.tuition = d.tuition;
    }
    r.facts = cta ? [] : [
      ["Funds", d.funds.text + ". " + d.funds.note, d.funds.conf],
      ["Tuition (indicative)", d.tuition.text, d.tuition.conf],
      ["Work while studying", d.work.text, d.work.conf],
      ["After graduating", d.post.text, d.post.conf],
      ["Health insurance", d.insurance, null],
      ["Processing time", d.processing, null]
    ];
    if (o.aps && r.code === "DEU") r.links = d.links.concat([{ label: D.APS[o.aps].label, url: D.APS[o.aps].url }]);
    else r.links = d.links;
    r.sources = uniq((d.funds.src || []).concat(d.src || []).concat(d.tuition.src || []));
    if (o.code === "QAT" || o.code === "KWT") r.sources.push("ec-qatar-kuwait");
    return r;
  }

  function code2cta(r) { return r.code === "IRL" && r.o.cta; }
  function fundsSub(d) {
    if (d.code === "ITA") return "per academic year";
    if (d.code === "IRL") return "for courses > 8 months";
    if (d.code === "POL") return "plus a return ticket";
    if (d.code === "SWE") return "≈ " + eur(Math.round(d.fundsEURmonth)) + " a month";
    return "";
  }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  function resolveStudyBasic(r, b) {
    var o = r.o;
    r.headline = "Apply for a national long-stay visa or residence permit for studies in " + b.name + ", usually before you travel.";
    r.visaBefore = true;
    r.chips = [["req", "Usually a visa before travel"], ["info", "Basic guide"], ["info", "Residence step after arrival"]];
    if (!b.schengen) r.chips.push(["warn", "Not in Schengen"]);
    var danish = b.code === "DNK";
    r.figures = [
      ["Visa before travel", "Usually", "Check the national authority"],
      ["Funds to prove", "Set nationally", "Ask your university"],
      ["Work while studying", danish ? "National rules" : "15+ h/week", danish ? "Denmark sets its own" : "EU minimum"],
      ["Stay after graduating", danish ? "National rules" : "9+ months", danish ? "Denmark sets its own" : "EU minimum to look for work"]
    ];
    r.steps = [
      { when: "6–9 months before", title: "Get admitted to a recognised institution", body: "Choose a full-time programme at an accredited institution and keep the official admission letter." },
      { when: "3–4 months before", title: "Check the national procedure", body: "Most EU countries require a national long-stay (type D) visa and/or a residence permit for studies, requested at the embassy before you travel. " + (o.schengenVisa ? "" : "Some countries let visa-free nationals apply after arriving. Confirm with the national authority before relying on this. ") + "Your university's international office usually knows the exact route." },
      { when: "Before applying", title: "Prepare the core documents", body: "Admission letter, proof of funds (amount set nationally), health insurance, accommodation and often a police certificate, apostilled and translated where required." },
      { when: "After arrival", title: "Register and collect your residence card", body: "Register your address and collect or apply for your residence permit card within the deadline on your visa." }
    ];
    r.docs = ["Passport valid for the whole stay", "Admission letter", "Proof of funds (national amount)", "Health insurance", "Proof of accommodation", "Police certificate, if required"];
    r.watch = [];
    if (b.note) r.watch.push(b.note);
    r.watch.push("This is a basic guide. We have not yet verified " + b.name + "'s national figures in detail, so check the official link before you act.");
    r.money = null;
    r.facts = [
      ["EU minimum rights", danish ? "Denmark is not bound by the EU students directive (2016/801), so its national rules apply." : "Under Directive (EU) 2016/801, students may work at least 15 hours a week and may stay at least 9 months after graduating to look for work or start a business.", "official"],
      ["Where to check", b.auth + ".", null]
    ];
    r.links = [{ label: b.auth, url: b.url }, { label: "EU Immigration Portal", url: D.SOURCES["ec-portal"].url }];
    r.sources = ["dir-2016-801", "ec-portal"];
    return r;
  }

  function resolveShort(r) {
    var o = r.o, S = D.SHORT;
    r.money = null; r.tuition = null;
    if (r.code === "IRL") {
      if (o.cta) {
        r.headline = "No visa or permission needed. British citizens travel freely to Ireland under the Common Travel Area.";
        r.chips = [["ok", "No visa"], ["warn", "Not in Schengen"]];
        r.figures = [["Visa", "Not needed", "Common Travel Area"], ["Max stay", "No limit", ""], ["Visa fee", "€0", ""], ["At the border", "Passport or ID", ""]];
        r.steps = [{ when: "Before you travel", title: "Carry valid ID", body: "Airlines usually ask for a passport or photo ID." }];
        r.docs = ["Passport or accepted photo ID"];
      } else if (o.irelandVisa) {
        r.headline = "You need an Irish short-stay (C) visa. A Schengen visa is not valid for Ireland.";
        r.chips = [["req", "Irish visa required"], ["warn", "Not in Schengen"]];
        r.figures = [["Visa", "Irish C visa", "Apply online (AVATS)"], ["Max stay", "Up to 90 days", "Irish rules, separate from Schengen"], ["Visa fee", "€60", "Single entry"], ["Processing", "≈ 8 weeks", "Apply early"]];
        r.steps = [
          { when: "Up to 3 months before", title: "Apply online on AVATS", body: "Complete the online form and follow the instructions for your country's visa office." },
          { when: "After applying", title: "Send your documents", body: "Send your passport and supporting documents to the embassy or visa office named on your AVATS summary." },
          { when: "Check first", title: "Check the Short Stay Visa Waiver Programme", body: "Some nationalities holding a valid UK visa can enter Ireland without an Irish visa. Check the current list first." }
        ];
        r.docs = ["AVATS application summary, signed", "Passport and photos", "Proof of funds", "Accommodation and return travel", "Letter explaining the purpose of the trip"];
      } else {
        r.headline = "No visa needed for a short stay in Ireland. Ireland is not in Schengen, so its 90 days are counted separately.";
        r.chips = [["ok", "Visa-free"], ["warn", "Not in Schengen"]];
        r.figures = [["Visa", "Not needed", ""], ["Max stay", "Up to 90 days", "Decided at the border"], ["Visa fee", "€0", ""], ["At the border", "Passport check", "No EES or ETIAS"]];
        r.steps = [{ when: "At the border", title: "Show why you are visiting", body: "Immigration officers decide how long you can stay (up to 90 days). Carry your return ticket and accommodation details." }];
        r.docs = S.freeDocs.slice();
      }
      r.watch = ["A Schengen visa does not let you enter Ireland, and days in Ireland do not count toward the Schengen 90/180 limit."];
      r.facts = [];
      r.links = [{ label: "Irish Immigration Service Delivery", url: "https://www.irishimmigration.ie" }];
      r.sources = [];
      return r;
    }

    var cyprus = r.code === "CYP";
    if (o.schengenVisa) {
      r.headline = cyprus
        ? "Cyprus is not in Schengen. You need a Cyprus visa, although valid multiple-entry Schengen visas are often accepted. Check first."
        : "You need a Schengen short-stay visa (type C) before you travel. It covers all 29 Schengen countries.";
      r.chips = [["req", "Visa required"], ["info", "EES biometrics at border"]];
      if (cyprus) r.chips.push(["warn", "Not in Schengen"]);
      r.figures = [["Visa", cyprus ? "Cyprus visa" : "Schengen C visa", "Apply at a consulate"], ["Max stay", "90 days", "in any 180 days"], ["Visa fee", "€90", "€45 for ages 6–12"], ["Decision", "15 days", "up to 45"]];
      r.steps = S.visaSteps.slice();
      r.docs = S.visaDocs.slice();
      r.money = [
        { label: "Visa fee (adult)", eur: S.feeAdult, conf: "multi" },
        { label: "Visa centre service fee", eur: null, note: "Varies by provider, often €30–€50", conf: "check" },
        { label: "Travel medical insurance", eur: null, note: "At least €30,000 cover; price varies", conf: "official" }
      ];
    } else {
      r.headline = cyprus
        ? "No visa needed for up to 90 days in Cyprus. Cyprus counts days separately from Schengen."
        : "No visa needed for up to 90 days in any 180 across the Schengen area. Your fingerprints and photo are recorded at the border (EES).";
      r.chips = [["ok", "Visa-free"], ["info", "EES biometrics at border"], ["warn", "ETIAS not in force yet"]];
      r.figures = [["Visa", "Not needed", ""], ["Max stay", "90 days", "in any 180 days"], ["Visa fee", "€0", "ETIAS €20 once it starts"], ["At the border", "EES", "Fingerprints + photo"]];
      r.steps = S.freeSteps.slice();
      r.docs = S.freeDocs.slice();
    }
    r.watch = [];
    if (o.refusal) r.watch.push(o.refusal + ". Complete, consistent documents matter more than anything else.");
    if (o.cascade) r.watch.push(o.cascade);
    if (o.note && !/study|Long stays/i.test(o.note)) r.watch.push(o.note);
    if (!o.schengenVisa) r.watch.push("Be wary of websites that charge for \"ETIAS\" today. The official system has not started.");
    r.watch.push("Studying for more than 90 days needs a national visa or permit. Switch to \"Study > 90 days\".");
    r.facts = [
      ["The 90/180 rule", "Count every day in any Schengen country within the last 180 days. Entry and exit days both count.", "official"],
      ["ETIAS", "Planned €20 travel authorisation for visa-free travellers. No launch date since July 2026; 2027 widely expected.", "multi"]
    ];
    r.links = [
      { label: "EU visa policy (European Commission)", url: "https://home-affairs.ec.europa.eu/policies/schengen/visa-policy_en" },
      { label: "Entry/Exit System (official)", url: "https://travel-europe.europa.eu/en/ees" },
      { label: "ETIAS (official)", url: "https://travel-europe.europa.eu/en/etias" }
    ];
    r.sources = ["reg-visa-code", "reg-visa-list", "ec-ees", "fragomen-etias", "ec-stats"];
    if (o.code === "IND") r.sources.push("eeas-india", "bt-india");
    if (/Saudi|Bahrain|Oman/.test(o.name)) r.sources.push("ey-gcc");
    if (o.code === "QAT" || o.code === "KWT") r.sources.push("ec-qatar-kuwait");
    return r;
  }

  /* ---------- render result ---------- */
  function renderResult() {
    var r = resolve();
    var o = r.o;
    var purposeLabel = r.purpose === "study" ? "STUDY > 90 DAYS" : "SHORT STAY ≤ 90 DAYS";
    $("#band-route").textContent = o.code + " → " + r.code + " · " + purposeLabel;
    $("#band-checked").textContent = "RULES CHECKED " + fmtDate(D.VERIFIED).toUpperCase();
    $("#r-title").textContent = o.name + " passport → " + r.name;
    $("#r-headline").textContent = r.headline;
    $("#r-chips").innerHTML = r.chips.map(function (c) { return '<span class="chip ' + c[0] + '">' + esc(c[1]) + "</span>"; }).join("");
    $("#r-figures").innerHTML = r.figures.map(function (f) {
      return '<div class="figure"><span class="k">' + esc(f[0]) + '</span><span class="v">' + esc(f[1]) + "</span>" + (f[2] ? '<span class="s">' + esc(f[2]) + "</span>" : "") + "</div>";
    }).join("");

    $("#r-steps").innerHTML = r.steps.map(function (s) {
      return '<li><span class="when">' + esc(val(s.when, o)) + "</span><h4>" + esc(val(s.title, o)) + "</h4><p>" + esc(val(s.body, o)) + "</p></li>";
    }).join("");

    // watch-outs
    var w = $("#r-watch");
    w.hidden = !r.watch.length;
    $("#r-watch-list").innerHTML = r.watch.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");

    // checklist
    var key = o.code + "-" + r.code + "-" + r.purpose;
    var done = checks[key] || [];
    $("#r-docs").innerHTML = r.docs.map(function (label, i) {
      var id = "doc-" + i;
      return '<li><label for="' + id + '"><input type="checkbox" id="' + id + '" data-i="' + i + '"' + (done.indexOf(i) > -1 ? " checked" : "") + "><span>" + esc(label) + "</span></label></li>";
    }).join("");
    updateProgress(r.docs.length, done.length);
    $all("#r-docs input").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var i = +cb.getAttribute("data-i");
        var list = checks[key] || [];
        if (cb.checked) { if (list.indexOf(i) < 0) list.push(i); } else { list = list.filter(function (x) { return x !== i; }); }
        checks[key] = list; persist(); updateProgress(r.docs.length, list.length);
      });
    });
    $("#copy-docs").onclick = function () { copyChecklist(r); };

    // money
    var m = $("#r-money");
    if (r.money) {
      m.hidden = false;
      var total = 0;
      var rows = r.money.map(function (x) {
        if (x.eur != null) total += x.eur;
        return "<tr><td>" + esc(x.label) + (x.note ? '<span class="note">' + esc(x.note) + "</span>" : "") + " " + conf(x.conf) + "</td><td>" + (x.eur != null ? eur(x.eur, 0) : "varies") + "</td></tr>";
      }).join("");
      var totalLabel = r.purpose === "study" ? "Cash to line up before you apply" : "Known fees";
      $("#r-money-table").innerHTML = rows + '<tr class="total"><td>' + totalLabel + "</td><td>" + eur(total, 0) + "</td></tr>";
      $("#r-money-note").textContent = r.tuition ? "Plus tuition. " + r.tuition.text : "Travel, accommodation and insurance come on top.";
    } else {
      m.hidden = true;
    }

    // facts
    $("#r-facts").innerHTML = r.facts.map(function (f) {
      return "<div><dt>" + esc(f[0]) + " " + conf(f[2]) + "</dt><dd>" + esc(f[1]) + "</dd></div>";
    }).join("");
    $("#r-facts-panel").hidden = !r.facts.length;

    // links + sources
    $("#r-links").innerHTML = r.links.map(function (l) { return '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + "</a></li>"; }).join("");
    var srcs = r.sources.filter(function (k) { return D.SOURCES[k]; });
    $("#r-sources").innerHTML = srcs.length ? srcs.map(function (k) {
      var s = D.SOURCES[k];
      return "<li>" + esc(s.apa) + (s.url ? ' <a href="' + esc(s.url) + '" target="_blank" rel="noopener">Link</a>' : "") + ' <span class="conf ' + (s.type === "official" ? "official" : "multi") + '">' + (s.type === "official" ? "Official" : "Secondary") + "</span></li>";
    }).join("") : '<li class="muted">Official links above.</li>';
  }

  function updateProgress(total, n) {
    $("#r-progress").style.width = (total ? Math.round(n / total * 100) : 0) + "%";
    $("#r-progress-label").textContent = n + " of " + total + " ready";
  }

  function copyChecklist(r) {
    var o = r.o;
    var lines = ["ClearEntry checklist: " + o.name + " passport → " + r.name + " (" + (r.purpose === "study" ? "study > 90 days" : "short stay") + ")", "Rules checked " + fmtDate(D.VERIFIED), "", "Steps:"];
    r.steps.forEach(function (s, i) { lines.push((i + 1) + ". " + val(s.title, o) + " (" + val(s.when, o) + ")"); });
    lines.push("", "Documents:");
    r.docs.forEach(function (d) { lines.push("[ ] " + d); });
    lines.push("", "Official links:");
    r.links.forEach(function (l) { lines.push("- " + l.label + ": " + l.url); });
    var text = lines.join("\n");
    var btn = $("#copy-docs");
    function done(ok) { btn.textContent = ok ? "Copied" : "Select the text below"; setTimeout(function () { btn.textContent = "Copy checklist"; }, 2000); }
    try {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallback(); });
    } catch (e) { fallback(); }
    function fallback() {
      var ta = $("#copy-fallback");
      ta.hidden = false; ta.value = text; ta.focus(); ta.select(); done(false);
    }
  }

  /* ---------- compare ---------- */
  function renderCompare() {
    var o = ORIGIN[state.origin];
    $("#cmp-origin").textContent = (/^[AEIOU]/.test(o.adj) ? "an " : "a ") + o.adj;
    var rows = FULL_ORDER.map(function (c) {
      var d = D.DEST[c];
      var cta = c === "IRL" && o.cta;
      var entry;
      if (cta) entry = "No visa (Common Travel Area)";
      else if (c === "NLD") entry = o.mvvExempt ? "University applies; no MVV" : "University applies; MVV visa";
      else if (c === "DEU" && o.de41 === "full") entry = "Visa-free entry, permit in Germany";
      else if (c === "IRL" && !o.irelandVisa) entry = "No visa; register on arrival";
      else if (c === "SWE") entry = "Residence permit before travel";
      else entry = "Visa before travel";
      return { code: c, name: d.name, entry: entry, funds: cta ? 0 : d.fundsEURmonth, fundsCur: d.fundsCurrency, work: cta ? "Unrestricted" : d.work.short, post: cta ? "Unlimited" : d.post.short, tuition: d.tuition, cta: cta };
    });
    $("#cmp-body").innerHTML = rows.map(function (x) {
      return '<tr class="' + (x.code === state.dest ? "is-selected" : "") + '"><th scope="row"><button class="linklike" data-dest="' + x.code + '">' + esc(x.name) + "</button></th>" +
        "<td>" + esc(x.entry) + "</td>" +
        '<td class="num">' + (x.cta ? "None" : eur(Math.round(x.funds)) + (x.fundsCur ? " *" : "")) + "</td>" +
        "<td>" + esc(x.work) + "</td>" +
        "<td>" + esc(x.post) + "</td>" +
        '<td class="num">' + (x.tuition.low === 0 ? "€0 – " + eur(x.tuition.high) + "†" : eur(x.tuition.low) + " – " + eur(x.tuition.high)) + "</td></tr>";
    }).join("");
    $all("#cmp-body button[data-dest]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.dest = b.getAttribute("data-dest"); state.purpose = "study";
        $("#dest").value = state.dest; $("#p-study").checked = true; persist(); renderAll();
        document.getElementById("result").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    var chartRows = rows.filter(function (x) { return !x.cta; }).map(function (x) {
      return { label: x.name, value: Math.round(x.funds), sel: x.code === state.dest, tip: x.name + ": " + eur(Math.round(x.funds)) + " a month" + (x.fundsCur ? " (converted from " + x.fundsCur + ")" : "") };
    }).sort(function (a, b) { return b.value - a.value; });
    hbar($("#cmp-chart"), chartRows, { unit: "€" });
  }

  /* ---------- charts (plain SVG) ---------- */
  function niceMax(v, step) { return Math.ceil(v / step) * step; }
  function barPath(x, y, w, h, r) {
    // square at the baseline (left), 4px rounded data-end (right)
    r = Math.min(r, h / 2, w);
    if (w <= 0) return "";
    return "M" + x + "," + y + "h" + (w - r) + "a" + r + "," + r + " 0 0 1 " + r + "," + r + "v" + (h - 2 * r) + "a" + r + "," + r + " 0 0 1 " + (-r) + "," + r + "h" + (-(w - r)) + "z";
  }
  function colPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    if (h <= 0) return "";
    return "M" + x + "," + (y + h) + "v" + (-(h - r)) + "a" + r + "," + r + " 0 0 1 " + r + "," + (-r) + "h" + (w - 2 * r) + "a" + r + "," + r + " 0 0 1 " + r + "," + r + "v" + (h - r) + "z";
  }
  function tooltip(container) {
    var t = container.querySelector(".tooltip");
    if (!t) { t = document.createElement("div"); t.className = "tooltip"; t.hidden = true; container.appendChild(t); }
    return t;
  }

  function hbar(container, rows, opts) {
    var svgHost = container.querySelector(".svg-host");
    var W = Math.max(300, svgHost.clientWidth || 600);
    var labelW = W < 420 ? 92 : 120, valW = 70, rowH = 30, barH = 18, top = 8, axisH = 22;
    var max = niceMax(Math.max.apply(null, rows.map(function (r) { return r.value; })), 250);
    var plotW = W - labelW - valW;
    var H = top + rows.length * rowH + axisH;
    var x = function (v) { return labelW + (v / max) * plotW; };
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Monthly funds you must prove, by destination">';
    for (var t = 0; t <= max; t += 250) {
      s += '<line class="gridline" x1="' + x(t) + '" x2="' + x(t) + '" y1="' + top + '" y2="' + (top + rows.length * rowH) + '"/>';
      s += '<text class="tick" x="' + x(t) + '" y="' + (H - 4) + '" text-anchor="middle">' + (t === 0 ? "0" : "€" + t.toLocaleString("en-GB")) + "</text>";
    }
    s += '<line class="axis" x1="' + labelW + '" x2="' + labelW + '" y1="' + top + '" y2="' + (top + rows.length * rowH) + '"/>';
    rows.forEach(function (r, i) {
      var y = top + i * rowH + (rowH - barH) / 2;
      var w = x(r.value) - labelW;
      s += '<text class="lbl' + (r.sel ? " sel" : "") + '" x="' + (labelW - 8) + '" y="' + (y + barH / 2 + 4) + '" text-anchor="end">' + esc(r.label) + "</text>";
      s += '<path class="bar' + (r.sel ? " sel" : "") + '" d="' + barPath(labelW, y, w, barH, 4) + '"/>';
      s += '<text class="val" x="' + (labelW + w + 6) + '" y="' + (y + barH / 2 + 4) + '">' + opts.unit + r.value.toLocaleString("en-GB") + "</text>";
      s += '<rect class="hit" data-i="' + i + '" x="0" y="' + (top + i * rowH) + '" width="' + W + '" height="' + rowH + '"/>';
    });
    s += "</svg>";
    svgHost.innerHTML = s;
    var tip = tooltip(container);
    $all(".hit", svgHost).forEach(function (h) {
      h.addEventListener("mouseenter", function () {
        var i = +h.getAttribute("data-i"), r = rows[i];
        var box = svgHost.getBoundingClientRect(), cbox = container.getBoundingClientRect();
        var scale = box.width / W;
        tip.textContent = r.tip; tip.hidden = false;
        tip.style.left = (box.left - cbox.left + (x(r.value) / 1) * scale) + "px";
        tip.style.top = (box.top - cbox.top + (top + i * rowH) * scale) + "px";
      });
      h.addEventListener("mouseleave", function () { tip.hidden = true; });
    });
  }

  function columns(container, cats, series, opts) {
    var svgHost = container.querySelector(".svg-host");
    var W = Math.max(300, svgHost.clientWidth || 600);
    var left = 64, right = 8, top = 24, bottom = 28, H = 280;
    var plotW = W - left - right, plotH = H - top - bottom;
    var all = [];
    series.forEach(function (s) { all = all.concat(s.values); });
    var step = opts.step, max = niceMax(Math.max.apply(null, all), step);
    var y = function (v) { return top + plotH - (v / max) * plotH; };
    var band = plotW / cats.length;
    var bw = Math.min(24, (band * 0.6) / series.length);
    var gap = 2;
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(opts.label) + '">';
    for (var t = 0; t <= max; t += step) {
      s += '<line class="gridline" x1="' + left + '" x2="' + (W - right) + '" y1="' + y(t) + '" y2="' + y(t) + '"/>';
      s += '<text class="tick" x="' + (left - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + (t === 0 ? "0" : "€" + (t / 1000) + "k") + "</text>";
    }
    s += '<line class="axis" x1="' + left + '" x2="' + (W - right) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
    cats.forEach(function (c, ci) {
      var cx = left + band * ci + band / 2;
      var groupW = series.length * bw + (series.length - 1) * gap;
      series.forEach(function (se, si) {
        var v = se.values[ci];
        var bx = cx - groupW / 2 + si * (bw + gap);
        s += '<path class="bar ' + se.cls + '" d="' + colPath(bx, y(v), bw, y(0) - y(v), 4) + '"/>';
        // first bar's label hangs left from its right edge, later bars' labels run right from their left edge,
        // so neighbouring labels never overlap across the 2px gap
        var anchor = series.length > 1 ? (si === 0 ? "end" : "start") : "middle";
        var lx = anchor === "end" ? bx + bw : anchor === "start" ? bx : bx + bw / 2;
        s += '<text class="val" x="' + lx + '" y="' + (y(v) - 6) + '" text-anchor="' + anchor + '">€' + Math.round(v / 1000) + "k</text>";
      });
      s += '<text class="lbl" x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(c) + "</text>";
      s += '<rect class="hit" data-i="' + ci + '" x="' + (left + band * ci) + '" y="' + top + '" width="' + band + '" height="' + plotH + '"/>';
    });
    s += "</svg>";
    svgHost.innerHTML = s;
    var tip = tooltip(container);
    $all(".hit", svgHost).forEach(function (h) {
      h.addEventListener("mouseenter", function () {
        var i = +h.getAttribute("data-i");
        var box = svgHost.getBoundingClientRect(), cbox = container.getBoundingClientRect();
        var scale = box.width / W;
        tip.textContent = cats[i] + ": " + series.map(function (se) { return se.name + " " + eur(se.values[i], 0); }).join(" · ");
        tip.hidden = false;
        tip.style.left = (box.left - cbox.left + (left + band * i + band / 2) * scale) + "px";
        tip.style.top = (box.top - cbox.top + top * scale) + "px";
      });
      h.addEventListener("mouseleave", function () { tip.hidden = true; });
    });
  }

  /* ---------- change log ---------- */
  function renderChanges() {
    var list = D.CHANGES.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    $("#changes-list").innerHTML = list.map(function (c) {
      var s = D.SOURCES[c.src];
      return '<li><time datetime="' + c.date + '">' + fmtDate(c.date) + '</time><span class="where">' + c.where + "</span><span>" + esc(c.what) + (s && s.url ? ' <a href="' + esc(s.url) + '" target="_blank" rel="noopener" class="small">Source</a>' : "") + "</span></li>";
    }).join("");
    $("#changes-count").textContent = D.CHANGES.length;
    $all("[data-verified]").forEach(function (el) { el.textContent = fmtDate(D.VERIFIED); });
  }

  /* ---------- references list (sources view) ---------- */
  function renderRefs() {
    var host = $("#ref-list");
    if (!host) return;
    var items = Object.keys(D.SOURCES).map(function (k) { return D.SOURCES[k]; });
    items.sort(function (a, b) { return a.apa.localeCompare(b.apa); });
    var label = { official: "Official", secondary: "Secondary", academic: "Academic" };
    host.innerHTML = items.map(function (s) {
      return "<li>" + esc(s.apa) + (s.url ? ' <a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.url) + "</a>" : "") + '<span class="t">' + label[s.type] + "</span></li>";
    }).join("");
    var counts = { official: 0, secondary: 0, academic: 0 };
    items.forEach(function (s) { counts[s.type]++; });
    $("#ref-counts").textContent = items.length + " sources: " + counts.official + " official, " + counts.secondary + " secondary, " + counts.academic + " academic.";
  }

  /* ---------- business case chart ---------- */
  function renderFinance() {
    var host = $("#fin-chart");
    if (!host || host.offsetParent === null) return;
    columns(host, ["Year 1", "Year 2", "Year 3"], [
      { name: "Revenue", cls: "s1", values: [49400, 225500, 515000] },
      { name: "Operating costs", cls: "s2", values: [78000, 190000, 340000] }
    ], { step: 100000, label: "Projected revenue and operating costs, years 1 to 3" });
  }

  /* ---------- routing between views ---------- */
  var VIEWS = ["tool", "strategy", "sources"];
  function route() {
    var id = (location.hash || "#tool").slice(1);
    var el = id ? document.getElementById(id) : null;
    var viewEl = el ? (el.hasAttribute("data-view") ? el : el.closest("[data-view]")) : null;
    var view = viewEl ? viewEl.id : "tool";
    VIEWS.forEach(function (v) { document.getElementById(v).hidden = v !== view; });
    var links = $all(".nav a");
    var targets = links.map(function (a) { return a.getAttribute("href").slice(1); });
    var current = targets.indexOf(id) > -1 ? id : view;
    links.forEach(function (a) {
      if (a.getAttribute("href").slice(1) === current) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (view === "tool") renderCompare();
    if (view === "strategy") renderFinance();
    if (el && el !== viewEl) el.scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
  }

  function renderAll() {
    renderMRZ();
    renderResult();
    if (!$("#tool").hidden) renderCompare();
  }

  /* ---------- boot ---------- */
  buildSelectors();
  renderChanges();
  renderRefs();
  renderAll();
  route();
  window.addEventListener("hashchange", route);
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (!$("#tool").hidden) renderCompare(); renderFinance(); }, 150);
  });
})();
