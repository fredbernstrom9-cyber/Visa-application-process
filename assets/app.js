/* ClearEntry: checker, per-result citations, compare view, change log and routing. No dependencies. */
(function () {
  "use strict";
  var D = window.CE_DATA;
  var EMB = window.CE_EMB || {};
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
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  var CONF_LABEL = { official: "Official source", multi: "2+ sources", check: "Verify" };
  function conf(c) { return c ? '<span class="conf ' + c + '" title="' + esc(CONF_LABEL[c]) + '">' + esc(CONF_LABEL[c]) + "</span>" : ""; }
  function link(label, url) { return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + "</a>"; }

  /* APA 7 style reference text for a source: Publisher. (Date). Title. URL */
  function apa(s) {
    var end = /[.?!]$/.test(s.title) ? " " : ". ";
    return esc(s.pub) + (/\.$/.test(s.pub) ? " (" : ". (") + esc(s.date) + "). <i>" + esc(s.title) + "</i>" + end;
  }

  var ORIGIN = {}; D.ORIGINS.forEach(function (o) { ORIGIN[o.code] = o; });
  var BASIC = {}; D.BASIC.forEach(function (b) { BASIC[b.code] = b; });
  var FULL_ORDER = ["FRA", "DEU", "NLD", "ESP", "ITA", "IRL", "POL", "SWE"];
  function destObj(code) { return D.DEST[code] || BASIC[code]; }

  /* ---------- citations: numbered in order of first use within one result ---------- */
  var refs = [], refNum = {};
  function resetRefs() { refs = []; refNum = {}; }
  function cite(ids) {
    ids = uniq([].concat(ids || [])).filter(function (k) { return D.SOURCES[k]; });
    if (!ids.length) return "";
    return ' <sup class="cites">[' + ids.map(function (k) {
      if (!refNum[k]) { refs.push(k); refNum[k] = refs.length; }
      var s = D.SOURCES[k];
      return '<a href="#ref-' + refNum[k] + '" title="' + esc(s.pub + ": " + s.title) + '">' + refNum[k] + "</a>";
    }).join(", ") + "]</sup>";
  }

  /* ---------- state ---------- */
  var saved = load();
  var state = {
    origin: ORIGIN[saved.origin] ? saved.origin : "IND",
    dest: destObj(saved.dest) ? saved.dest : "FRA",
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
      var list = groups[g].slice();
      if (g !== "Most requested") list.sort(function (a, b) { return a.name.localeCompare(b.name); });
      return '<optgroup label="' + esc(g) + '">' + list.map(function (o) {
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

  /* ---------- rule resolution ----------
   * Every text item is { text, src } so the renderer can attach numbered citations. */
  function resolve() {
    var o = ORIGIN[state.origin];
    var code = state.dest;
    var d = D.DEST[code], b = BASIC[code];
    var r = { o: o, code: code, dest: d || b, name: (d || b).name, schengen: (d || b).schengen, full: !!d, purpose: state.purpose };
    if (state.purpose === "short") resolveShort(r);
    else if (d) resolveStudyFull(r, d);
    else resolveStudyBasic(r, b);
    addOriginNotes(r);
    return r;
  }

  function originNotes(o, purpose, code) {
    return o.notes.filter(function (n) {
      return (n.scope === "all" || n.scope === purpose) && (!n.dest || n.dest === code);
    });
  }
  function addOriginNotes(r) {
    originNotes(r.o, r.purpose, r.code).forEach(function (n) { r.watch.push({ text: n.text, src: n.src }); });
  }

  function recentChanges(where) {
    return D.CHANGES.filter(function (c) { return c.where === where && c.date >= "2025-09"; });
  }
  function changeChip(r, where, label) {
    var rc = recentChanges(where);
    if (rc.length) r.chips.push(["warn", label + " " + fmtDate(rc[rc.length - 1].date)]);
  }

  function resolveStudyFull(r, d) {
    var o = r.o;
    var cta = r.code === "IRL" && o.cta;
    r.headline = { text: val(d.headline, o), src: val(d.headSrc, o) };
    r.visaBefore = cta ? false : d.visaBefore(o);
    r.chips = [];
    if (cta) r.chips.push(["ok", "No visa, permit or registration"]);
    else r.chips.push(r.visaBefore ? ["req", "Visa before travel"] : ["ok", "No entry visa needed"]);
    if (!cta) r.chips.push(["info", "Residence step after arrival"]);
    if (!d.schengen) r.chips.push(["warn", "Not in Schengen"]);
    changeChip(r, r.code, "Rules changed");

    var headSrc = val(d.headSrc, o);
    r.figures = cta ? [
      ["Visa before travel", "No", "Common Travel Area", ["ie-cta"]],
      ["Funds to prove", "None", "No immigration check on funds", ["uk-cta"]],
      ["Work while studying", "Unrestricted", "Same rights as Irish citizens", ["ie-cta", "uk-cta"]],
      ["Stay after graduating", "Unlimited", "Common Travel Area", ["uk-living-ie"]]
    ] : [
      ["Visa before travel", r.visaBefore ? "Yes" : "No", r.visaBefore ? "Apply at the consulate first" : "Apply for the permit after arrival", headSrc],
      ["Funds to prove", d.funds.short, fundsSub(d), d.funds.src],
      ["Work while studying", d.work.short, "", d.work.src],
      ["Stay after graduating", d.post.short, "to look for work", d.post.src]
    ];

    r.steps = (cta ? d.ctaSteps : d.steps.filter(function (s) { return !s.if || s.if(o); })).map(function (s) {
      return { when: val(s.when, o), title: val(s.title, o), body: val(s.body, o), src: val(s.src, o) };
    });
    r.docs = d.docs.filter(function (x) { return !x.when || x.when(o); }).map(function (x) { return x.label; });
    r.docsSrc = cta ? ["uk-cta"] : d.docsSrc;
    r.watch = cta ? [] : d.watch.map(function (w) { return { text: w.text, src: w.src }; });

    if (!cta) {
      var rows = d.fees.filter(function (f) { return !f.when || f.when(o); }).map(function (f) {
        return { label: f.label, eur: f.eur, note: f.note, conf: f.conf, src: f.src };
      });
      var months = d.fundsMonths || 12;
      var fundsNote = d.code === "ITA" ? "One academic year" : d.code === "IRL" ? "One academic year" : months + " months";
      if (d.fundsCurrency) fundsNote += "; converted from " + d.fundsCurrency + " at about " + D.FX[d.fundsCurrency] + " per euro";
      rows.push({ label: "Funds to show for one year", eur: Math.round(d.fundsYearEUR), note: fundsNote, conf: d.funds.conf, src: d.funds.src });
      r.money = rows;
      r.moneyNote = "Tuition is set by each institution and is not included. Travel, housing and insurance come on top.";
    }
    r.facts = cta ? [
      ["Common Travel Area", "British and Irish citizens can live, work and study in each other's countries without permission, and can access social welfare and health services.", "official", ["ie-cta", "uk-cta"]],
      ["Education", "Access to all levels of education on terms no less favourable than for Irish citizens.", "official", ["uk-cta"]]
    ] : [
      ["Funds", d.funds.text + ". " + d.funds.note, d.funds.conf, d.funds.src],
      ["Work while studying", d.work.text, d.work.conf, d.work.src],
      ["After graduating", d.post.text, d.post.conf, d.post.src],
      ["Health insurance", d.insurance.text, null, d.insurance.src],
      ["Processing time", d.processing.text, null, d.processing.src]
    ];
    r.links = d.links.slice();
    if (o.aps && r.code === "DEU") r.links.push({ label: D.APS[o.aps].label, url: D.APS[o.aps].url });
  }

  function fundsSub(d) {
    if (d.code === "ITA") return "per academic year";
    if (d.code === "IRL") return "per academic year";
    if (d.code === "POL") return "plus a return ticket";
    if (d.code === "SWE") return "≈ " + eur(Math.round(d.fundsEURmonth)) + " a month, 10 months a year";
    return "";
  }

  function resolveStudyBasic(r, b) {
    var o = r.o;
    var danish = b.code === "DNK";
    var euMin = danish ? [b.src] : ["dir-2016-801"];
    r.headline = { text: "Apply for a national long-stay visa or residence permit for studies in " + b.name + ", usually before you travel.", src: [b.src, "ec-portal"] };
    r.visaBefore = true;
    r.chips = [["req", "Usually a visa before travel"], ["info", "Basic guide"], ["info", "Residence step after arrival"]];
    if (!b.schengen) r.chips.push(["warn", "Not in Schengen"]);
    r.figures = [
      ["Visa before travel", "Usually", "Check the national authority", [b.src]],
      ["Funds to prove", "Set nationally", b.funds ? "See Key rules" : "Check the national authority", [b.src]],
      ["Work while studying", danish ? "National rules" : "15+ h/week", danish ? "Denmark sets its own" : "EU minimum", euMin],
      ["Stay after graduating", danish ? "National rules" : "9+ months", danish ? "Denmark sets its own" : "EU minimum, to look for work", euMin]
    ];
    r.steps = [
      { when: "6–9 months before", title: "Get admitted to a recognised institution", body: "Choose a full-time programme at an accredited institution and keep the official admission letter.", src: ["dir-2016-801"] },
      { when: "3–4 months before", title: "Check the national procedure", body: "Most EU countries require a national long-stay (type D) visa and/or a residence permit for studies, requested before you travel. " + (o.schengenVisa ? "" : "Some countries let visa-free nationals apply after arriving; confirm with the national authority before relying on this. ") + "Your university's international office usually knows the exact route.", src: [b.src, "ec-portal"] },
      { when: "Before applying", title: "Prepare the core documents", body: "Admission letter, proof of funds (amount set nationally), health insurance, accommodation and often a police certificate, apostilled and translated where required.", src: ["dir-2016-801", b.src] },
      { when: "After arrival", title: "Register and collect your residence card", body: "Register your address and collect or apply for your residence permit card within the deadline on your visa.", src: [b.src] }
    ];
    r.docs = ["Passport valid for the whole stay", "Admission letter", "Proof of funds (national amount)", "Health insurance", "Proof of accommodation", "Police certificate, if required"];
    r.docsSrc = ["dir-2016-801", b.src];
    r.watch = [];
    if (b.note) r.watch.push({ text: b.note, src: [b.src] });
    r.watch.push({ text: "This is a basic guide. We checked " + b.name + "'s official study-permit page but have not broken down every national figure, so read that page before you act.", src: [b.src] });
    r.money = null;
    r.facts = [
      ["EU minimum rights", danish ? "Denmark is not bound by the EU students directive (2016/801), so its national rules apply." : "Under Directive (EU) 2016/801, students may work at least 15 hours a week and may stay at least 9 months after graduating to look for work or start a business.", "official", danish ? [b.src, "dir-2016-801"] : ["dir-2016-801"]]
    ];
    if (b.funds) r.facts.push(["Funds", b.funds, "official", [b.src]]);
    r.facts.push(["Where to check", b.auth + ".", null, [b.src]]);
    r.links = [{ label: b.auth, url: b.url }, { label: "EU Immigration Portal", url: D.SOURCES["ec-portal"].url }];
  }

  function resolveShort(r) {
    var o = r.o, S = D.SHORT;
    r.money = null;
    r.chips = [];
    if (r.code === "IRL") return resolveShortIreland(r);
    if (r.code === "CYP") return resolveShortCyprus(r);

    if (o.schengenVisa) {
      r.headline = { text: "You need a Schengen short-stay visa (type C) before you travel. It covers all 29 Schengen countries.", src: ["reg-visa-list", "eu-apply-schengen"] };
      r.chips.push(["req", "Visa required"], ["info", "EES biometrics at border"]);
      r.figures = [
        ["Visa", "Schengen C visa", "Apply at a consulate", ["reg-visa-list"]],
        ["Max stay", "90 days", "in any 180 days", ["reg-visa-list"]],
        ["Visa fee", "€90", "€45 for ages 6–12", ["eu-fee-2024"]],
        ["Decision", "15 days", "can be extended", ["reg-visa-code"]]
      ];
      r.steps = S.visaSteps.slice();
      r.docs = S.visaDocs.slice();
      r.docsSrc = S.visaDocsSrc;
      r.money = [
        { label: "Visa fee (adult)", eur: S.feeAdult, conf: "official", src: ["eu-fee-2024"] },
        { label: "Visa fee (child 6–12)", eur: S.feeChild, conf: "official", src: ["eu-fee-2024"] },
        { label: "Visa centre service fee", eur: null, note: "Set by the provider; shown on the consulate's website", src: ["reg-visa-code"] },
        { label: "Travel medical insurance", eur: null, note: "At least €30,000 cover; price varies", conf: "official", src: ["reg-visa-code"] }
      ];
      r.moneyNote = "Pupils and students travelling for study or training pay no visa fee. Travel and accommodation come on top.";
    } else {
      r.headline = { text: "No visa needed for up to 90 days in any 180 across the Schengen area. Your fingerprints and photo are recorded at the border (EES).", src: ["etias-who", "reg-visa-list", "ees-full"] };
      r.chips.push(["ok", "Visa-free"], ["info", "EES biometrics at border"], ["warn", "ETIAS not in force yet"]);
      r.figures = [
        ["Visa", "Not needed", "", ["etias-who"]],
        ["Max stay", "90 days", "in any 180 days", ["reg-visa-list"]],
        ["Visa fee", "€0", "ETIAS €20 once it starts", ["etias-fee"]],
        ["At the border", "EES", "Fingerprints + photo", ["ees-full"]]
      ];
      r.steps = S.freeSteps.slice();
      r.docs = S.freeDocs.slice();
      r.docsSrc = S.freeDocsSrc;
    }
    changeChip(r, o.code, "Rules for " + o.adj + " citizens changed");
    r.watch = [];
    if (!o.schengenVisa) r.watch.push({ text: "Be wary of websites that charge for \"ETIAS\" today. The official system has not started.", src: ["etias-home"] });
    r.watch.push({ text: "Studying for more than 90 days needs a national visa or permit. Switch to \"Study > 90 days\".", src: ["youreurope-docs"] });
    r.facts = [
      ["The 90/180 rule", "Count every day in any Schengen country within the last 180 days. Entry and exit days both count.", "official", ["reg-visa-list", "youreurope-docs"]],
      ["Entry/Exit System", "Fingerprints and a face photo are recorded at your first entry; passport stamping has ended.", "official", ["ees-full", "ees-faq"]]
    ];
    if (o.schengenVisa) r.facts.unshift(["Where to apply", "At the consulate of the country where you spend the most days; if equal, the country you enter first.", "official", ["eu-apply-schengen"]]);
    else r.facts.push(["ETIAS", "Planned €20 travel authorisation for visa-free travellers. It is not in operation and has no start date yet.", "official", ["etias-home", "etias-fee", "fragomen-etias"]]);
    r.links = [
      { label: "EU: applying for a Schengen visa", url: D.SOURCES["eu-apply-schengen"].url },
      { label: "Entry/Exit System (official)", url: "https://travel-europe.europa.eu/en/ees" },
      { label: "ETIAS (official)", url: "https://travel-europe.europa.eu/en/etias" }
    ];
  }

  function resolveShortIreland(r) {
    var o = r.o, S = D.SHORT;
    if (o.cta) {
      r.headline = { text: "No visa or permission needed. British citizens travel freely to Ireland under the Common Travel Area.", src: ["ie-cta", "uk-cta"] };
      r.chips.push(["ok", "No visa"], ["warn", "Not in Schengen"]);
      r.figures = [["Visa", "Not needed", "Common Travel Area", ["ie-cta"]], ["Max stay", "No limit", "", ["uk-cta"]], ["Visa fee", "€0", "", ["ie-cta"]], ["At the border", "Passport or ID", "", ["uk-living-ie"]]];
      r.steps = [{ when: "Before you travel", title: "Carry valid ID", body: "Airlines usually ask for a passport or photo ID.", src: ["uk-living-ie"] }];
      r.docs = ["Passport or accepted photo ID"];
      r.docsSrc = ["ie-cta"];
    } else if (o.irelandVisa) {
      r.headline = { text: "You need an Irish short-stay (C) visa. A Schengen visa is not valid for Ireland.", src: ["ie-visa-list"] };
      r.chips.push(["req", "Irish visa required"], ["warn", "Not in Schengen"]);
      r.figures = [
        ["Visa", "Irish C visa", "Apply online (AVATS)", ["ie-visa-list"]],
        ["Max stay", "Up to 90 days", "Decided at the border", ["ie-visa-list"]],
        ["Visa fee", "€60", "Single entry", ["ie-fees"]],
        ["Processing", "See office", o.irlOffice ? o.irlOffice + " visa office" : "Your visa office", ["ie-visa-offices"]]
      ];
      r.steps = [
        { when: "Up to 3 months before", title: "Apply online on AVATS", body: "Complete the online form and follow the instructions for your country's visa office" + (o.irlOffice ? " (" + o.irlOffice + ")" : "") + ".", src: ["ie-visa-offices"] },
        { when: "After applying", title: "Send your documents", body: "Send your passport and supporting documents to the embassy or visa office named on your AVATS summary.", src: ["ie-visa-offices"] },
        { when: "Check first", title: "Check the Short Stay Visa Waiver Programme", body: "Some nationalities holding a valid UK visa can enter Ireland without an Irish visa. Check whether yours is on the list.", src: ["ie-ssvwp"] }
      ];
      r.docs = ["AVATS application summary, signed", "Passport and photos", "Proof of funds", "Accommodation and return travel", "Letter explaining the purpose of the trip"];
      r.docsSrc = ["ie-visa-offices"];
      r.money = [{ label: "Irish visa (single entry)", eur: 60, conf: "official", src: ["ie-fees"] }];
      r.moneyNote = "Travel and accommodation come on top.";
    } else {
      r.headline = { text: "No visa needed for a short stay in Ireland. Ireland is not in Schengen, so its 90 days are counted separately.", src: ["ie-visa-list"] };
      r.chips.push(["ok", "Visa-free"], ["warn", "Not in Schengen"]);
      r.figures = [["Visa", "Not needed", "", ["ie-visa-list"]], ["Max stay", "Up to 90 days", "Decided at the border", ["ie-visa-list"]], ["Visa fee", "€0", "", ["ie-visa-list"]], ["At the border", "Passport check", "No EES or ETIAS", ["ees-faq", "etias-who"]]];
      r.steps = [{ when: "At the border", title: "Show why you are visiting", body: "Immigration officers decide how long you can stay (up to 90 days). Carry your return ticket and accommodation details.", src: ["ie-visa-list"] }];
      r.docs = S.freeDocs.slice();
      r.docsSrc = ["ie-visa-list"];
    }
    r.watch = [{ text: "A Schengen visa does not let you enter Ireland, and days in Ireland do not count toward the Schengen 90/180 limit.", src: ["ie-visa-list", "youreurope-docs"] }];
    r.facts = o.cta ? [["Common Travel Area", "British and Irish citizens can move and live freely between the UK and Ireland.", "official", ["ie-cta", "uk-cta"]]] : [
      ["Separate from Schengen", "Ireland runs its own visa system and its own limit of up to 90 days, decided by the immigration officer at the border.", "official", ["ie-visa-list"]],
      ["EES and ETIAS", "Neither the Entry/Exit System nor ETIAS applies to trips to Ireland.", "official", ["ees-faq", "etias-who"]]
    ];
    r.links = [{ label: "Irish Immigration: visa and non-visa nationalities", url: D.SOURCES["ie-visa-list"].url }, { label: "Irish Immigration: visa offices", url: D.SOURCES["ie-visa-offices"].url }];
  }

  function resolveShortCyprus(r) {
    var o = r.o, S = D.SHORT;
    var tur = o.code === "TUR";
    if (o.schengenVisa) {
      r.headline = { text: tur
        ? "Cyprus is not in Schengen. Turkish citizens need a Cyprus visa; a Schengen visa is not accepted for them."
        : "Cyprus is not in Schengen. You need a Cyprus visa, unless you already hold a valid double- or multiple-entry Schengen visa, which Cyprus accepts for up to 90 days.", src: ["cy-visa", "reg-visa-list"] };
      r.chips.push(["req", "Visa required"], ["warn", "Not in Schengen"]);
      r.figures = [
        ["Visa", "Cyprus visa", tur ? "Schengen visa not accepted" : "or a multi-entry Schengen visa", ["cy-visa"]],
        ["Max stay", "90 days", "in any 180 days", ["cy-visa"]],
        ["Visa fee", "See embassy", "Set by Cyprus", ["cy-visa"]],
        ["At the border", "Passport check", "Purpose may be checked", ["cy-visa"]]
      ];
      r.steps = [
        { when: "First", title: tur ? "Apply for a Cyprus visa" : "Check the Schengen visa you already have", body: tur ? "Apply at the Cyprus embassy or consulate that covers your country of residence." : "A valid double- or multiple-entry Schengen visa lets you enter Cyprus for up to 90 days in any 180. A single-entry visa does not.", src: ["cy-visa"] },
        { when: "Otherwise", title: "Apply at a Cyprus embassy or consulate", body: "Apply for a Cyprus short-stay visa where you live. The border can still check the purpose of your trip.", src: ["cy-visa"] }
      ];
      r.docs = S.visaDocs.slice();
      r.docsSrc = ["cy-visa"];
    } else {
      r.headline = { text: "No visa needed for up to 90 days in Cyprus. Cyprus is not in Schengen and counts days separately.", src: ["cy-visa", "reg-visa-list"] };
      r.chips.push(["ok", "Visa-free"], ["warn", "Not in Schengen"]);
      r.figures = [["Visa", "Not needed", "", ["cy-visa"]], ["Max stay", "90 days", "in any 180 days", ["reg-visa-list"]], ["Visa fee", "€0", "", ["cy-visa"]], ["At the border", "Passport check", "", ["cy-visa"]]];
      r.steps = [{ when: "At the border", title: "Carry proof of your trip", body: "Carry your return ticket and accommodation details. Days in Cyprus don't count toward the Schengen 90/180 limit.", src: ["cy-visa"] }];
      r.docs = S.freeDocs.slice();
      r.docsSrc = S.freeDocsSrc;
    }
    r.watch = [{ text: "Cyprus is an EU country but not in Schengen: days in Cyprus don't count toward the Schengen 90/180 limit, and a Cyprus visa doesn't let you enter Schengen countries.", src: ["cy-visa", "youreurope-docs"] }];
    r.facts = [
      ["Who needs a visa", "Cyprus applies the EU's common visa list, so the same nationalities need a visa as for Schengen.", "official", ["reg-visa-list", "cy-visa"]],
      ["Passport rules", "Your passport must have been issued within the last 10 years and be valid at least 3 months after you leave.", "official", ["youreurope-docs"]]
    ];
    r.links = [{ label: "Cyprus MFA: who needs a visa", url: D.SOURCES["cy-visa"].url }];
  }

  /* ---------- where to apply / your government ---------- */
  function embassyLinks(r) {
    var o = r.o, out = [], note = "";
    var own = EMB[o.code] && EMB[o.code][r.code];
    if (r.code === "IRL" && o.cta) return { items: [], note: "British citizens don't apply anywhere: no visa or permission is needed." };
    if (own) out.push({ label: own[0], url: own[1], tag: "Embassy for " + o.name });
    if (r.full) {
      r.dest.portal.forEach(function (p) { out.push({ label: p.label, url: p.url, tag: "Worldwide" }); });
      if (!own) note = "We did not find a " + r.name + " embassy page specific to " + o.name + ". Use the worldwide link to find the mission that covers where you live.";
      if (r.code === "IRL" && o.irelandVisa && o.irlOffice) note = (note ? note + " " : "") + "Irish visa applications from " + o.name + " are handled by the " + o.irlOffice + " visa office.";
      if (r.code === "DEU" && o.aps && r.purpose === "study") out.push({ label: D.APS[o.aps].label, url: D.APS[o.aps].url, tag: "Required first" });
    } else {
      out.push({ label: r.dest.auth, url: r.dest.url, tag: "National authority" });
      note = "Embassy pages for " + r.name + " are not in our list yet. The national authority page explains where to apply.";
    }
    return { items: out, note: note };
  }

  function govLinks(r) {
    var o = r.o, out = [];
    if (o.advice && D.ADVICE[o.advice]) {
      var url = D.ADVICE[o.advice](r.dest);
      if (url) out.push({ label: D.ADVICE_LABEL[o.advice].replace("{d}", r.name), url: url, tag: "Travel advice" });
    }
    var oe = D.ORIGIN_EMB[o.code] && D.ORIGIN_EMB[o.code][r.code];
    if (oe) out.push({ label: oe[0], url: oe[1], tag: "Your embassy in " + r.name });
    if (o.gov) out.push({ label: o.gov[0], url: o.gov[1], tag: "Find your embassy in " + r.name });
    return out;
  }

  /* ---------- render result ---------- */
  function renderResult() {
    resetRefs();
    var r = resolve();
    var o = r.o;
    var purposeLabel = r.purpose === "study" ? "STUDY > 90 DAYS" : "SHORT STAY ≤ 90 DAYS";
    $("#band-route").textContent = o.code + " → " + r.code + " · " + purposeLabel;
    $("#band-checked").textContent = "RULES CHECKED " + fmtDate(D.VERIFIED).toUpperCase();
    $("#r-title").textContent = o.name + " passport → " + r.name;
    $("#r-headline").innerHTML = esc(r.headline.text) + cite(r.headline.src);
    $("#r-chips").innerHTML = r.chips.map(function (c) { return '<span class="chip ' + c[0] + '">' + esc(c[1]) + "</span>"; }).join("");
    $("#r-figures").innerHTML = r.figures.map(function (f) {
      return '<div class="figure"><span class="k">' + esc(f[0]) + '</span><span class="v">' + esc(f[1]) + "</span>" + '<span class="s">' + esc(f[2] || "") + cite(f[3]) + "</span></div>";
    }).join("");

    // watch-outs
    $("#r-watch").hidden = !r.watch.length;
    $("#r-watch-list").innerHTML = r.watch.map(function (x) { return "<li>" + esc(x.text) + cite(x.src) + "</li>"; }).join("");

    $("#r-steps").innerHTML = r.steps.map(function (s) {
      return '<li><span class="when">' + esc(s.when) + "</span><h4>" + esc(s.title) + "</h4><p>" + esc(s.body) + cite(s.src) + "</p></li>";
    }).join("");

    // checklist
    $("#r-docs-cite").innerHTML = cite(r.docsSrc);
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
      var total = 0, open = false;
      var rows = r.money.map(function (x) {
        if (x.eur != null && !/child/.test(x.label)) total += x.eur;
        if (x.eur == null) open = true;
        return "<tr><td>" + esc(x.label) + cite(x.src) + (x.note ? '<span class="note">' + esc(x.note) + "</span>" : "") + " " + conf(x.conf) + "</td><td>" + (x.eur != null ? eur(x.eur, 0) : "varies") + "</td></tr>";
      }).join("");
      var totalLabel = r.purpose === "study" ? "Cash to line up before you apply" : "Known fees (one adult)";
      $("#r-money-table").innerHTML = rows + '<tr class="total"><td>' + totalLabel + (open ? '<span class="note">Plus the items marked "varies"</span>' : "") + "</td><td>" + eur(total, 0) + "</td></tr>";
      $("#r-money-note").textContent = r.moneyNote || "";
    } else {
      m.hidden = true;
      $("#r-money-table").innerHTML = "";
      $("#r-money-note").textContent = "";
    }

    // facts
    $("#r-facts").innerHTML = r.facts.map(function (f) {
      return "<div><dt>" + esc(f[0]) + " " + conf(f[2]) + "</dt><dd>" + esc(f[1]) + cite(f[3]) + "</dd></div>";
    }).join("");
    $("#r-facts-panel").hidden = !r.facts.length;

    // quick links
    $("#r-links").innerHTML = r.links.map(function (l) { return "<li>" + link(l.label, l.url) + "</li>"; }).join("");

    renderResultSources(r);
  }

  function linkItems(list) {
    return list.map(function (l) { return "<li>" + link(l.label, l.url) + (l.tag ? ' <span class="tag">' + esc(l.tag) + "</span>" : "") + "</li>"; }).join("");
  }

  function renderResultSources(r) {
    var o = r.o;
    $("#refs-title").textContent = "Sources for " + o.name + " → " + r.name;
    var emb = embassyLinks(r);
    $("#r-emb-h").textContent = r.name + " embassy / where to apply";
    $("#r-emb").innerHTML = linkItems(emb.items);
    $("#r-emb-note").textContent = emb.note;
    $("#r-emb-note").hidden = !emb.note;
    $("#r-gov-h").textContent = o.name + ": your government";
    $("#r-gov").innerHTML = linkItems(govLinks(r));

    var official = 0;
    $("#r-sources").innerHTML = refs.map(function (k, i) {
      var s = D.SOURCES[k];
      if (s.type === "official") official++;
      return '<li id="ref-' + (i + 1) + '"><span class="n">[' + (i + 1) + "]</span><span>" + apa(s) + link(s.url, s.url) +
        ' <span class="t ' + s.type + '">' + (s.type === "official" ? "Official" : "Secondary") + "</span></span></li>";
    }).join("");
    $("#r-refs-count").textContent = refs.length + " cited · " + official + " official";
  }

  function updateProgress(total, n) {
    $("#r-progress").style.width = (total ? Math.round(n / total * 100) : 0) + "%";
    $("#r-progress-label").textContent = n + " of " + total + " ready";
  }

  function copyChecklist(r) {
    var o = r.o;
    var lines = ["ClearEntry checklist: " + o.name + " passport → " + r.name + " (" + (r.purpose === "study" ? "study > 90 days" : "short stay") + ")", "Rules checked " + fmtDate(D.VERIFIED), "", "Steps:"];
    r.steps.forEach(function (s, i) { lines.push((i + 1) + ". " + s.title + " (" + s.when + ")"); });
    lines.push("", "Documents:");
    r.docs.forEach(function (d) { lines.push("[ ] " + d); });
    lines.push("", "Where to apply:");
    embassyLinks(r).items.forEach(function (l) { lines.push("- " + l.label + ": " + l.url); });
    lines.push("", "Sources:");
    refs.forEach(function (k, i) { var s = D.SOURCES[k]; lines.push("[" + (i + 1) + "] " + s.pub + " (" + s.date + "). " + s.title + ". " + s.url); });
    var text = lines.join("\n");
    var btn = $("#copy-docs");
    function done(ok) { btn.textContent = ok ? "Copied" : "Select the text below"; setTimeout(function () { btn.textContent = "Copy checklist"; }, 2000); }
    function fallback() {
      var ta = $("#copy-fallback");
      ta.hidden = false; ta.value = text; ta.focus(); ta.select(); done(false);
    }
    try {
      navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    } catch (e) { fallback(); }
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
      else if (c === "DEU" && o.de41) entry = "Visa-free entry, permit in Germany (or visa first)";
      else if (c === "IRL" && !o.irelandVisa) entry = "No visa; register on arrival";
      else if (c === "SWE") entry = "Residence permit before travel";
      else if (c === "ESP" && !o.schengenVisa) entry = "Visa first, or apply in Spain within 60 days";
      else entry = "Visa before travel";
      var fees = cta ? [] : d.fees.filter(function (f) { return !f.when || f.when(o); });
      var known = 0, open = false;
      fees.forEach(function (f) { if (f.eur == null) open = true; else known += f.eur; });
      return { code: c, name: d.name, entry: entry, funds: cta ? 0 : d.fundsEURmonth, fundsCur: d.fundsCurrency, work: cta ? "Unrestricted" : d.work.short, post: cta ? "Unlimited" : d.post.short, fees: known, feesOpen: open, cta: cta };
    });
    $("#cmp-body").innerHTML = rows.map(function (x) {
      return '<tr class="' + (x.code === state.dest ? "is-selected" : "") + '"><th scope="row"><button class="linklike" data-dest="' + x.code + '">' + esc(x.name) + "</button></th>" +
        "<td>" + esc(x.entry) + "</td>" +
        '<td class="num">' + (x.cta ? "None" : eur(Math.round(x.funds)) + (x.fundsCur ? " *" : "")) + "</td>" +
        '<td class="num">' + (x.cta ? "€0" : x.fees === 0 && x.feesOpen ? "Varies" : eur(Math.round(x.fees)) + (x.feesOpen ? " +" : "")) + "</td>" +
        "<td>" + esc(x.work) + "</td>" +
        "<td>" + esc(x.post) + "</td></tr>";
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

  /* ---------- chart (plain SVG) ---------- */
  function niceMax(v, step) { return Math.ceil(v / step) * step; }
  function barPath(x, y, w, h, r) {
    // square at the baseline (left), 4px rounded data-end (right)
    r = Math.min(r, h / 2, w);
    if (w <= 0) return "";
    return "M" + x + "," + y + "h" + (w - r) + "a" + r + "," + r + " 0 0 1 " + r + "," + r + "v" + (h - 2 * r) + "a" + r + "," + r + " 0 0 1 " + (-r) + "," + r + "h" + (-(w - r)) + "z";
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
        tip.style.left = (box.left - cbox.left + x(r.value) * scale) + "px";
        tip.style.top = (box.top - cbox.top + (top + i * rowH) * scale) + "px";
      });
      h.addEventListener("mouseleave", function () { tip.hidden = true; });
    });
  }

  /* ---------- change log ---------- */
  function renderChanges() {
    var list = D.CHANGES.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    $("#changes-list").innerHTML = list.map(function (c) {
      var s = D.SOURCES[c.src];
      return '<li><time datetime="' + c.date + '">' + fmtDate(c.date) + '</time><span class="where">' + c.where + "</span><span>" + esc(c.what) + (s ? " " + link("Source: " + s.pub, s.url) : "") + "</span></li>";
    }).join("");
    $("#changes-count").textContent = D.CHANGES.length;
    $all("[data-verified]").forEach(function (el) { el.textContent = fmtDate(D.VERIFIED); });
  }

  /* ---------- sources view: full reference list, embassy directory ---------- */
  function renderRefs() {
    var host = $("#ref-list");
    var items = Object.keys(D.SOURCES).map(function (k) { return D.SOURCES[k]; });
    items.sort(function (a, b) { return (a.pub + a.date + a.title).localeCompare(b.pub + b.date + b.title); });
    host.innerHTML = items.map(function (s) {
      return "<li>" + apa(s) + link(s.url, s.url) + ' <span class="t ' + s.type + '">' + (s.type === "official" ? "Official" : "Secondary") + "</span></li>";
    }).join("");
    var off = items.filter(function (s) { return s.type === "official"; }).length;
    var embCount = 0;
    Object.keys(EMB).forEach(function (k) { embCount += Object.keys(EMB[k]).length; });
    var govCount = D.ORIGINS.filter(function (o) { return o.gov; }).length;
    $("#ref-counts").textContent = items.length + " cited sources (" + off + " official, " + (items.length - off) + " secondary), plus " + embCount + " embassy and consulate pages and " + govCount + " foreign-ministry directories listed below.";
    $all("[data-count-emb]").forEach(function (el) { el.textContent = embCount; });
    $all("[data-count-src]").forEach(function (el) { el.textContent = items.length; });
    $all("[data-count-origins]").forEach(function (el) { el.textContent = D.ORIGINS.length; });

    var names = {};
    FULL_ORDER.forEach(function (c) { names[c] = D.DEST[c].name; });
    var sorted = D.ORIGINS.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    $("#emb-list").innerHTML = sorted.map(function (o) {
      var e = EMB[o.code] || {};
      var li = FULL_ORDER.filter(function (c) { return e[c]; }).map(function (c) { return "<li><b>" + esc(names[c]) + ":</b> " + link(e[c][0], e[c][1]) + "</li>"; });
      if (o.gov) li.push("<li><b>Own government:</b> " + link(o.gov[0], o.gov[1]) + "</li>");
      return "<details><summary>" + esc(o.name) + ' <span class="muted small">' + li.length + " links</span></summary><ul>" + li.join("") + "</ul></details>";
    }).join("");
  }

  /* ---------- routing between views ---------- */
  var VIEWS = ["tool", "sources"];
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
    rt = setTimeout(function () { if (!$("#tool").hidden) renderCompare(); }, 150);
  });
})();
