/*
 * ClearEntry rulebook (rules checked 24 September 2026)
 * ------------------------------------------------------------------
 * Every rule the checker shows lives here and cites its sources by id (see SOURCES at the bottom).
 *   conf: "official" = confirmed on an official government or EU source
 *         "multi"    = confirmed by two or more independent sources
 *         "check"    = one source only, or sources disagree: verify before acting
 *   src:  ids from SOURCES, rendered as numbered citations [1], [2] ... under each result.
 * Embassy links per passport country live in assets/embassies.js.
 * When a rule changes: edit it, update its src, add a CHANGES entry and bump VERIFIED.
 */
window.CE_DATA = (function () {
  "use strict";

  var VERIFIED = "2026-09-24";

  // Approximate rates used only to show SEK / PLN amounts in euros.
  var FX = { SEK: 11.0, PLN: 4.25, asOf: "September 2026 (approx.)" };

  /* ----------------------------------------------------------------
   * PASSPORTS. Codes are ICAO 3-letter codes (as in a passport's machine-readable zone).
   *   schengenVisa  needs a Schengen short-stay visa      [etias-who, reg-visa-list]
   *   irelandVisa   needs an Irish visa                    [ie-visa-list]
   *   eef           uses Campus France "Études en France"  [fr-cf-eef]
   *   aps           Germany requires an APS certificate    [de-aps-*]
   *   de41          may enter Germany visa-free and apply for a study permit there [de-uk-41, de-bamf-entry]
   *   mvvExempt     exempt from the Dutch MVV entry visa   [nl-ind-mvv]
   * ---------------------------------------------------------------- */
  function O(code, name, adj, group, f) {
    var o = { code: code, name: name, adj: adj, group: group,
      schengenVisa: true, irelandVisa: true, eef: false, aps: null, de41: false, mvvExempt: false, cta: false,
      irlOffice: null, gov: null, advice: null, notes: [] };
    for (var k in f) o[k] = f[k];
    return o;
  }

  var ORIGINS = [
    // Most requested
    O("IND", "India", "Indian", "Most requested", { eef: true, aps: "IND", irlOffice: "New Delhi",
      gov: ["Ministry of External Affairs: Indian embassies and consulates", "https://eoi.gov.in/"],
      notes: [
        { scope: "short", text: "Visa \"cascade\": after two Schengen visas used lawfully in the last 3 years, Indian residents can get a 2-year multiple-entry visa, then up to 5 years.", src: ["eeas-india"] }
      ] }),
    O("CHN", "China", "Chinese", "Most requested", { eef: true, aps: "CHN", irlOffice: "Beijing",
      gov: ["Ministry of Foreign Affairs of China: overseas missions", "https://www.fmprc.gov.cn/eng/zwjg/"] }),
    O("USA", "United States", "US", "Most requested", { schengenVisa: false, irelandVisa: false, eef: true, de41: true, mvvExempt: true, advice: "us",
      gov: ["U.S. Department of State: country information", "https://travel.state.gov/content/travel/en/international-travel/International-Travel-Country-Information-Pages.html"] }),
    O("CAN", "Canada", "Canadian", "Most requested", { schengenVisa: false, irelandVisa: false, eef: true, de41: true, mvvExempt: true, advice: "ca",
      gov: ["Government of Canada: travel advice and advisories", "https://travel.gc.ca/travelling/advisories"] }),

    // Gulf states
    O("ARE", "United Arab Emirates", "Emirati", "Gulf states", { schengenVisa: false, irelandVisa: false, eef: true,
      gov: ["UAE Ministry of Foreign Affairs: UAE missions abroad", "https://www.mofa.gov.ae/en/missions/uae-missions-abroad"] }),
    O("SAU", "Saudi Arabia", "Saudi", "Gulf states", { eef: true, irlOffice: "Ankara or Abu Dhabi (see the Visa Offices page)",
      gov: ["Saudi Ministry of Foreign Affairs", "https://www.mofa.gov.sa/sites/mofaen/pages/default.aspx"],
      notes: [{ scope: "short", text: "Since April 2024, first-time applicants who live in and apply from Saudi Arabia can be given a 5-year multiple-entry Schengen visa, at the consulate's discretion.", src: ["ec-gcc-2024", "ey-gcc"] }] }),
    O("QAT", "Qatar", "Qatari", "Gulf states", { eef: true, irlOffice: "Abu Dhabi",
      gov: ["Qatar Ministry of Foreign Affairs: embassy services", "https://mofa.gov.qa/en/consular-services/consular-services/embassy-services"],
      notes: [{ scope: "short", text: "The EU proposed visa-free travel for Qatari citizens in 2022, but it is not in force. Do not assume visa-free access.", src: ["ec-qatar-kuwait"] }] }),
    O("KWT", "Kuwait", "Kuwaiti", "Gulf states", { eef: true, irlOffice: "Abu Dhabi",
      gov: ["Kuwait Ministry of Foreign Affairs: Kuwaiti missions abroad", "https://www.mofa.gov.kw/en/kuwaiti-diplomatic-missions-abroad/"],
      notes: [
        { scope: "short", text: "Kuwait has its own Schengen visa cascade (longer multiple-entry visas after good travel history).", src: ["ec-legal-docs"] },
        { scope: "short", text: "The EU proposed visa-free travel for Kuwaiti citizens in 2022, but it is not in force.", src: ["ec-qatar-kuwait"] }
      ] }),
    O("BHR", "Bahrain", "Bahraini", "Gulf states", { eef: true, irlOffice: "Abu Dhabi",
      gov: ["Bahrain Ministry of Foreign Affairs", "https://www.mofa.gov.bh/"],
      notes: [{ scope: "short", text: "Since April 2024, first-time applicants who live in and apply from Bahrain can be given a 5-year multiple-entry Schengen visa, at the consulate's discretion.", src: ["ec-gcc-2024", "ey-gcc"] }] }),
    O("OMN", "Oman", "Omani", "Gulf states", { irlOffice: "Abu Dhabi",
      gov: ["Oman Ministry of Foreign Affairs: embassies and consulates abroad", "https://www.fm.gov.om/en/ministry/embassies/embassies-and-consulates-abroad/"],
      notes: [{ scope: "short", text: "Since April 2024, first-time applicants who live in and apply from Oman can be given a 5-year multiple-entry Schengen visa, at the consulate's discretion.", src: ["ec-gcc-2024", "ey-gcc"] }] }),

    // Africa
    O("DZA", "Algeria", "Algerian", "Africa", { eef: true, irlOffice: "Abu Dhabi",
      gov: ["Algeria Ministry of Foreign Affairs: Algerian representations abroad", "https://www.mfa.gov.dz/embassys-locations-list"],
      notes: [{ scope: "short", text: "In 2025, about 31% of Schengen short-stay applications in Algeria were refused, against a 14.6% global average.", src: ["ec-stats-2025"] }] }),
    O("CMR", "Cameroon", "Cameroonian", "Africa", { eef: true,
      gov: ["Cameroon Ministry of External Relations (MINREX)", "https://diplocam.cm/index.php/en/"] }),
    O("EGY", "Egypt", "Egyptian", "Africa", { eef: true,
      gov: ["Egypt Ministry of Foreign Affairs: consular services", "https://cs.mfa.gov.eg/en"] }),
    O("GHA", "Ghana", "Ghanaian", "Africa", { eef: true, irlOffice: "Abuja",
      gov: ["Ghana Ministry of Foreign Affairs", "https://mfa.gov.gh/"],
      notes: [{ scope: "short", text: "In 2025, about 46.5% of Schengen short-stay applications in Ghana were refused, against a 14.6% global average.", src: ["ec-stats-2025"] }] }),
    O("KEN", "Kenya", "Kenyan", "Africa", { eef: true,
      gov: ["Kenya Ministry of Foreign and Diaspora Affairs", "https://www.mfa.go.ke/"] }),
    O("MAR", "Morocco", "Moroccan", "Africa", { eef: true, irlOffice: "Abu Dhabi",
      gov: ["Morocco Ministry of Foreign Affairs: directory of missions", "https://diplomatie.ma/en/directory"] }),
    O("NGA", "Nigeria", "Nigerian", "Africa", { eef: true, irlOffice: "Abuja",
      gov: ["Nigeria Ministry of Foreign Affairs: diplomatic missions", "https://www.foreignaffairs.gov.ng/diplomatic-missions/"],
      notes: [{ scope: "short", text: "In 2025, close to 48% of Schengen short-stay applications in Nigeria were refused, against a 14.6% global average.", src: ["ec-stats-2025"] }] }),
    O("SEN", "Senegal", "Senegalese", "Africa", { eef: true, irlOffice: "Abuja",
      gov: ["Senegal Ministry of Foreign Affairs: embassies and consulates", "https://www.diplomatie.gouv.sn/services/les-consulats-du-senegal"],
      notes: [{ scope: "short", text: "In 2025, about 51.9% of Schengen short-stay applications in Senegal were refused, against a 14.6% global average.", src: ["ec-stats-2025"] }] }),
    O("ZAF", "South Africa", "South African", "Africa", { eef: true, irlOffice: "Dublin (South Africa desk)",
      gov: ["DIRCO: South African representation abroad", "https://dirco.gov.za/south-african-representation-abroad/"],
      notes: [{ scope: "all", dest: "IRL", text: "Ireland has required visas from South African citizens since 10 July 2024.", src: ["ie-za"] }] }),
    O("TUN", "Tunisia", "Tunisian", "Africa", { eef: true, irlOffice: "Abu Dhabi",
      gov: ["Tunisia Ministry of Foreign Affairs", "https://www.diplomatie.gov.tn"] }),

    // Asia
    O("BGD", "Bangladesh", "Bangladeshi", "Asia", { eef: true, irlOffice: "New Delhi",
      gov: ["Bangladesh Ministry of Foreign Affairs: missions abroad", "https://mofa.gov.bd/site/view/service_box_items/BANGLADESH%20MISSIONS%20ABROAD"],
      notes: [{ scope: "study", dest: "DEU", text: "The German Embassy in Dhaka reports very long waiting times for student visa appointments because of demand. Read its student visa FAQ before planning an intake.", src: ["de-dhaka-faq"] }] }),
    O("IDN", "Indonesia", "Indonesian", "Asia", { eef: true,
      gov: ["Indonesia Ministry of Foreign Affairs: Indonesian missions", "https://kemlu.go.id/perwakilan"],
      notes: [{ scope: "short", text: "Since July 2025, Indonesian residents can be given a 5-year multiple-entry Schengen visa after one visa used lawfully in the previous 3 years.", src: ["eeas-indonesia"] }] }),
    O("IRN", "Iran", "Iranian", "Asia", { eef: true,
      gov: ["Iran Ministry of Foreign Affairs: embassies and consulates", "https://en.mfa.gov.ir/portal/viewpage/15154"],
      notes: [{ scope: "all", text: "Some European embassies in Tehran have reduced or moved their visa services in 2026 (Italy's visa applications, for example, are being taken at other Italian embassies). Check the embassy site before booking.", src: ["it-iran-2026"] }] }),
    O("JPN", "Japan", "Japanese", "Asia", { schengenVisa: false, irelandVisa: false, eef: true, de41: true, mvvExempt: true,
      gov: ["Ministry of Foreign Affairs of Japan", "https://www.mofa.go.jp/"] }),
    O("MYS", "Malaysia", "Malaysian", "Asia", { schengenVisa: false, irelandVisa: false, eef: true,
      gov: ["Ministry of Foreign Affairs Malaysia", "https://www.kln.gov.my/"] }),
    O("NPL", "Nepal", "Nepali", "Asia", { eef: true, irlOffice: "New Delhi",
      gov: ["Nepal Ministry of Foreign Affairs", "https://mofa.gov.np/pages/introduction-10/"] }),
    O("PAK", "Pakistan", "Pakistani", "Asia", { eef: true,
      gov: ["Pakistan Ministry of Foreign Affairs: overseas missions", "https://www.mofa.gov.pk/overseas-missions"] }),
    O("PHL", "Philippines", "Filipino", "Asia", {
      gov: ["Philippine Department of Foreign Affairs: embassies and consulates", "https://dfa.gov.ph/index.php/2013-03-21-05-48-17"] }),
    O("KOR", "South Korea", "South Korean", "Asia", { schengenVisa: false, irelandVisa: false, eef: true, de41: true, mvvExempt: true,
      gov: ["Ministry of Foreign Affairs of Korea", "https://www.mofa.go.kr/eng/index.do"] }),
    O("LKA", "Sri Lanka", "Sri Lankan", "Asia", { irlOffice: "New Delhi",
      gov: ["Sri Lanka Ministry of Foreign Affairs: missions abroad", "https://mfa.gov.lk/en/sri-lanka-missions/"] }),
    O("VNM", "Vietnam", "Vietnamese", "Asia", { eef: true, aps: "VNM",
      gov: ["Vietnam Ministry of Foreign Affairs: overseas missions", "https://mofa.gov.vn/web/ministry-of-foreign-affairs/overseas-missions"] }),

    // Europe & Central Asia
    O("KAZ", "Kazakhstan", "Kazakh", "Europe & Central Asia", { irlOffice: "Moscow",
      gov: ["Kazakhstan Ministry of Foreign Affairs", "http://mfa.gov.kz/en/"] }),
    O("RUS", "Russia", "Russian", "Europe & Central Asia", { eef: true, irlOffice: "Moscow",
      gov: ["Russian Ministry of Foreign Affairs", "https://www.mid.ru/en/"],
      notes: [{ scope: "short", text: "Since November 2025, Schengen consulates generally issue Russian citizens single-entry visas only, with a few exceptions.", src: ["ec-russia"] }] }),
    O("TUR", "Türkiye", "Turkish", "Europe & Central Asia", { eef: true, irlOffice: "Ankara",
      gov: ["Türkiye Ministry of Foreign Affairs: Turkish representations", "https://www.mfa.gov.tr/turkish-representations.en.mfa"],
      notes: [{ scope: "short", text: "Since July 2025, Turkish residents can move up from 1-year to 3-year and 5-year multiple-entry Schengen visas after good travel history.", src: ["ec-turkiye"] }] }),
    O("UKR", "Ukraine", "Ukrainian", "Europe & Central Asia", { schengenVisa: false, irelandVisa: false, eef: true,
      gov: ["Ministry of Foreign Affairs of Ukraine: diplomatic missions", "https://mfa.gov.ua/en/diplomatic-missions"],
      notes: [
        { scope: "short", text: "Visa-free Schengen travel requires a biometric passport.", src: ["etias-who"] },
        { scope: "all", dest: "IRL", text: "Ireland has waived its visa requirement for Ukrainian citizens (stays up to 90 days) as an emergency measure.", src: ["ie-ukr"] },
        { scope: "all", text: "Several embassies in Kyiv offer limited visa services; the German embassy's visa section, for example, is not open to the public. Check before you plan.", src: ["de-kyiv"] }
      ] }),
    O("GBR", "United Kingdom", "British", "Europe & Central Asia", { schengenVisa: false, irelandVisa: false, cta: true, eef: true, de41: true, mvvExempt: true, advice: "uk",
      gov: ["GOV.UK: foreign travel advice", "https://www.gov.uk/foreign-travel-advice"],
      notes: [{ scope: "study", text: "Since Brexit, British citizens need a national visa or residence permit to study in every EU country except Ireland.", src: ["uk-travel-eu"] }] }),
    O("UZB", "Uzbekistan", "Uzbek", "Europe & Central Asia", { irlOffice: "Moscow",
      gov: ["Uzbekistan Ministry of Foreign Affairs: embassies abroad", "https://gov.uz/en/mfa/sections/o-zbekiston-respublikasining-xorijdagi-diplomatik-vakolatxonalari-va-konsullik-muassasalari"] }),

    // Americas & Oceania
    O("ARG", "Argentina", "Argentine", "Americas & Oceania", { schengenVisa: false, irelandVisa: false, eef: true,
      gov: ["Argentina Foreign Ministry: embassies and consulates", "https://www.cancilleria.gob.ar/es/representaciones"] }),
    O("AUS", "Australia", "Australian", "Americas & Oceania", { schengenVisa: false, irelandVisa: false, de41: true, mvvExempt: true, advice: "au",
      gov: ["Smartraveller (Australian Government): Europe", "https://www.smartraveller.gov.au/destinations/Europe"] }),
    O("BRA", "Brazil", "Brazilian", "Americas & Oceania", { schengenVisa: false, irelandVisa: false, eef: true, de41: true,
      gov: ["Brazil Foreign Ministry: consular offices", "https://www.gov.br/mre/pt-br/assuntos/portal-consular/reparticoes-consulares-do-brasil"] }),
    O("CHL", "Chile", "Chilean", "Americas & Oceania", { schengenVisa: false, irelandVisa: false, eef: true,
      gov: ["Chile Foreign Ministry: Chile abroad", "https://www.minrel.gob.cl/embajadas-y-consulados"] }),
    O("COL", "Colombia", "Colombian", "Americas & Oceania", { schengenVisa: false, eef: true,
      gov: ["Colombia Foreign Ministry: embassies and consulates", "https://www.cancilleria.gov.co/en/node/20645"] }),
    O("MEX", "Mexico", "Mexican", "Americas & Oceania", { schengenVisa: false, irelandVisa: false, eef: true,
      gov: ["Mexico Foreign Ministry: embassies of Mexico", "https://directorio.sre.gob.mx/index.php/embajadas-de-mexico-en-el-exterior"] })
  ];

  var APS = {
    IND: { label: "APS India (Academic Evaluation Centre)", url: "https://aps-india.de/faqs/", src: "de-aps-india" },
    CHN: { label: "APS China", url: "https://www.aps.org.cn/", src: "de-aps-china" },
    VNM: { label: "APS Vietnam (German Embassy Hanoi)", url: "https://vietnam.diplo.de/vn-de/willkommen/aktuelles/aps/1236800", src: "de-aps-vietnam" }
  };

  /* Your own country's embassy in the destination (verified pairs only). */
  var ORIGIN_EMB = {
    IND: { FRA: ["Embassy of India, Paris", "https://www.eoiparis.gov.in/"], DEU: ["Embassy of India, Berlin", "https://indianembassyberlin.gov.in/"] }
  };

  /* Official travel advice by your own government, per destination (URL patterns verified on each site). */
  var ADVICE = {
    us: function (d) { return d.us ? "https://travel.state.gov/content/travel/en/international-travel/International-Travel-Country-Information-Pages/" + d.us + ".html" : null; },
    uk: function (d) { return "https://www.gov.uk/foreign-travel-advice/" + d.slug + "/entry-requirements"; },
    ca: function (d) { return "https://travel.gc.ca/destinations/" + (d.ca || d.slug); },
    au: function (d) { return d.slug === "czech-republic" ? null : "https://www.smartraveller.gov.au/destinations/europe/" + d.slug; }
  };
  var ADVICE_LABEL = { us: "U.S. State Department: {d} country information", uk: "GOV.UK: {d} entry requirements", ca: "Travel.gc.ca: travel advice for {d}", au: "Smartraveller: {d}" };

  /* ----------------------------------------------------------------
   * FULL GUIDES: eight destinations (study > 90 days). Text may be a function of the passport `o`.
   * ---------------------------------------------------------------- */
  var DEST = {};

  DEST.FRA = {
    code: "FRA", name: "France", slug: "france", us: "France", schengen: true, full: true,
    permit: "VLS-TS \"étudiant\" (long-stay visa that works as a residence permit)",
    visaBefore: function () { return true; },
    headline: function () { return "Get a long-stay student visa (VLS-TS) before you travel, then validate it online within 3 months."; },
    headSrc: ["fr-sp-f2231", "fr-fv-student"],
    fundsEURmonth: 877.5, fundsYearEUR: 10530,
    funds: { short: "€877.50/month", text: "€877.50 a month (€10,530 a year)", note: "For applications from 1 August 2026 (was €615). Set at 47% of the gross minimum wage, so it rises with the minimum wage.", conf: "official", src: ["fr-decree-2026-526", "fr-cf-funds-2026"] },
    fees: [
      { label: "Long-stay student visa", eur: 50, conf: "official", src: ["fr-fv-fees"] },
      { label: "VLS-TS validation (online, after arrival)", eur: 150, note: "Since 1 May 2026 (was €75)", conf: "official", src: ["fr-sp-r52684", "fr-sp-a18881"] },
      { label: "Campus France / Études en France fee", eur: null, note: "Set per country", conf: "official", src: ["fr-cf-eef-proc"], when: function (o) { return o.eef; } },
      { label: "CVEC student life contribution (2026/27)", eur: 105, conf: "official", src: ["fr-cvec"] }
    ],
    work: { short: "964 h/year", text: "Up to 964 hours a year (60% of full-time), with no separate permit.", conf: "official", src: ["fr-sp-f2713"] },
    post: { short: "12 months", text: "Graduates of eligible diplomas (such as a master's) can get a 12-month residence card to look for work or start a business.", conf: "official", src: ["fr-sp-f17319"] },
    processing: { text: "Apply at least 3 months before departure. The Études en France stage adds several weeks, so start 6–9 months ahead.", src: ["fr-cf-eef-proc"] },
    insurance: { text: "Register with French social security after arrival (free basic cover for students).", src: ["fr-sp-f2231"] },
    steps: [
      { when: "6–9 months before", title: function (o) { return o.eef ? "Apply through Études en France (Campus France)" : "Apply to your programme"; },
        body: function (o) { return o.eef
          ? o.name + " is on Campus France's list of Études en France countries. You apply to most programmes through the platform, pay the fee for your country and usually have an interview. Once admitted, you complete the pre-consular step on the same platform."
          : o.name + " is not on Campus France's Études en France list, so you apply directly to the institution (or through the preliminary admission request for a first-year bachelor's) and go straight to the visa once admitted. Confirm with Campus France, as its country list changes."; },
        src: function (o) { return o.eef ? ["fr-cf-eef", "fr-cf-eef-proc"] : ["fr-cf-eef", "fr-cf-noneef"]; } },
      { when: "3 months before, at the latest", title: "Apply for the long-stay student visa",
        body: "Create the application on France-Visas and book an appointment at the visa centre for your area to give fingerprints and a photo. Bring the admission letter, proof of funds (€877.50 a month) and proof of accommodation.",
        src: ["fr-fv-student", "fr-decree-2026-526"] },
      { when: "Within 3 months of arrival", title: "Validate your visa online",
        body: "The VLS-TS only works as a residence permit once you validate it on the ANEF website and pay the tax online (€150 for students since 1 May 2026). Without it you must apply for a new visa.",
        src: ["fr-sp-r52684", "fr-cf-validate"] },
      { when: "Before enrolling", title: "Pay the CVEC and register for health cover",
        body: "Pay the student life contribution (CVEC, €105 for 2026/27) before you enrol, then register with French social security.",
        src: ["fr-cvec", "fr-sp-f2231"] },
      { when: "2–4 months before the visa expires", title: "Renew online",
        body: "Apply on ANEF for a multi-year student residence card before your VLS-TS expires. At renewal you must meet the funds threshold in force at that time.",
        src: ["fr-sp-f2231", "fr-cf-funds-2026"] }
    ],
    docs: [
      { label: "Passport valid for your whole stay, plus copies" },
      { label: "Admission letter from the French institution" },
      { label: "Études en France / Campus France confirmation", when: function (o) { return o.eef; } },
      { label: "Proof of funds: €877.50 a month (bank statements, scholarship or sponsor letter)" },
      { label: "Proof of accommodation for the first months" },
      { label: "Passport photos" },
      { label: "France-Visas application receipt" }
    ],
    docsSrc: ["fr-fv-student", "fr-sp-f2231"],
    watch: [
      { text: "The funds threshold rose from €615 to €877.50 a month on 1 August 2026. Older guides and some agents still quote €615.", src: ["fr-decree-2026-526", "fr-cf-funds-2026"] },
      { text: "The VLS-TS validation fee for students rose to €150 on 1 May 2026.", src: ["fr-sp-a18881"] }
    ],
    links: [
      { label: "France-Visas: check your visa need", url: "https://france-visas.gouv.fr/en/assistant-visa" },
      { label: "France-Visas: student visa", url: "https://france-visas.gouv.fr/en/etudiant" },
      { label: "Campus France: Études en France procedure", url: "https://www.campusfrance.org/en/application-etudes-en-france-procedure" },
      { label: "ANEF: validate or renew your permit", url: "https://administration-etrangers-en-france.interieur.gouv.fr" },
      { label: "CVEC payment", url: "https://cvec.etudiant.gouv.fr/" }
    ],
    portal: [
      { label: "France-Visas (official visa portal for all countries)", url: "https://france-visas.gouv.fr/en/" },
      { label: "Campus France offices around the world", url: "https://www.campusfrance.org/en/Campus-France-offices-world" }
    ]
  };

  DEST.DEU = {
    code: "DEU", name: "Germany", slug: "germany", us: "Germany", schengen: true, full: true,
    permit: "National (D) visa for study, then a residence permit under §16b Residence Act",
    visaBefore: function (o) { return !o.de41; },
    headline: function (o) { return o.de41
      ? "You may enter visa-free and apply for your student residence permit in Germany within 90 days, or get a visa first."
      : "Get a national (D) study visa before you travel, then a residence permit from the local foreigners office."; },
    headSrc: function (o) { return o.de41 ? ["de-uk-41", "de-bamf-entry"] : ["de-ffo-visa", "de-csp-study"]; },
    fundsEURmonth: 992, fundsYearEUR: 11904,
    funds: { short: "€992/month", text: "€992 a month (€11,904 a year), usually in a blocked account", note: "A recognised scholarship or a formal obligation letter (Verpflichtungserklärung) can replace the blocked account.", conf: "official", src: ["de-ffo-sperrkonto", "de-daad-costs"] },
    fees: [
      { label: "National (D) visa", eur: 75, conf: "official", src: ["de-ffo-visa"], when: function (o) { return !o.de41; } },
      { label: "Residence permit (foreigners office)", eur: 100, conf: "official", src: ["de-berlin-permit"] }
    ],
    work: { short: "140 days/yr", text: "140 full days or 280 half days a year without approval from the Federal Employment Agency, or up to 20 hours a week during lectures and without limit in semester breaks.", conf: "official", src: ["de-mig-students"] },
    post: { short: "18 months", text: "Up to 18 months residence permit to look for a job after graduating; you may take any job meanwhile.", conf: "official", src: ["de-mig-after"] },
    processing: { text: "Processing usually takes several weeks after the appointment; in high-demand countries the wait for an appointment can be far longer.", src: ["de-ffo-visa"] },
    insurance: { text: "Health insurance from entry: incoming/travel insurance until you enrol, then statutory or approved private student insurance.", src: ["de-ffo-visa"] },
    steps: [
      { when: "9–12 months before", title: "Get your APS certificate", if: function (o) { return !!o.aps; },
        body: function (o) { return "Germany requires applicants with " + o.adj + " academic records to have them checked by the Academic Evaluation Centre (APS) before university admission and the visa. Do this first."; },
        src: function (o) { return [APS[o.aps].src]; } },
      { when: "6–9 months before", title: "Get admitted",
        body: "Apply to the university (directly or through uni-assist) and keep the admission letter (Zulassungsbescheid).", src: ["de-csp-study"] },
      { when: "3–4 months before", title: "Open a blocked account (or other funds proof)",
        body: "Deposit €11,904 with an approved provider; you can then withdraw €992 a month in Germany. Only the official opening confirmation is accepted.", src: ["de-ffo-sperrkonto"] },
      { when: "3–4 months before", title: "Apply for the national (D) study visa", if: function (o) { return !o.de41; },
        body: "Apply through the Federal Foreign Office's Consular Services Portal and book an appointment at the German mission or its visa centre. The fee is €75.", src: ["de-csp-study", "de-ffo-visa"] },
      { when: "Before you travel", title: "Choose: visa first, or apply in Germany", if: function (o) { return o.de41; },
        body: function (o) { return o.name + " citizens may enter Germany visa-free and apply for the student residence permit at the local foreigners office (Ausländerbehörde) within 90 days. You may not work until a permit allowing it is issued."; },
        src: ["de-uk-41", "de-bamf-entry"] },
      { when: "After arrival", title: "Register your address and apply for the residence permit",
        body: "Register your address at the local citizens' office, then apply at the foreigners office with your enrolment certificate, insurance and funds proof. The fee is €100.",
        src: ["de-berlin-permit"] }
    ],
    docs: [
      { label: "Passport, plus copies" },
      { label: "Admission letter (Zulassungsbescheid)" },
      { label: "APS certificate", when: function (o) { return !!o.aps; } },
      { label: "Blocked account confirmation (€11,904) or scholarship / obligation letter" },
      { label: "Health insurance confirmation" },
      { label: "Certificates, transcripts and language certificate" },
      { label: "Visa application from the Consular Services Portal", when: function (o) { return !o.de41; } }
    ],
    docsSrc: ["de-csp-study", "de-ffo-sperrkonto"],
    watch: [
      { text: "Keep within the work limit (140 full / 280 half days a year). Working more without approval can cost you your permit.", src: ["de-mig-students"] }
    ],
    links: [
      { label: "Consular Services Portal: visa for study", url: "https://digital.diplo.de/studium" },
      { label: "Visa Navigator (Federal Foreign Office)", url: "https://digital.diplo.de/navigator/en/visa" },
      { label: "Federal Foreign Office: blocked account", url: "https://www.auswaertiges-amt.de/en/sperrkonto-388600" },
      { label: "Make it in Germany: students from abroad", url: "https://www.make-it-in-germany.com/en/looking-for-foreign-professionals/entering/admission-labour-market/students" }
    ],
    portal: [
      { label: "Consular Services Portal (apply online)", url: "https://digital.diplo.de/studium" },
      { label: "Visa Navigator: find your requirements", url: "https://digital.diplo.de/navigator/en/visa" }
    ]
  };

  DEST.NLD = {
    code: "NLD", name: "Netherlands", slug: "netherlands", us: "Netherlands", schengen: true, full: true,
    permit: "Residence permit for study; your university applies to the IND for you",
    visaBefore: function (o) { return !o.mvvExempt; },
    headline: function (o) { return o.mvvExempt
      ? "Your university applies to the IND for you. You need no entry visa (MVV); you collect your residence card after arrival."
      : "Your university applies to the IND for you. After approval you collect an MVV entry visa before you travel."; },
    headSrc: ["nl-ind-student", "nl-ind-mvv"],
    fundsEURmonth: 1130.77, fundsYearEUR: 13569.24,
    funds: { short: "€1,130.77/month", text: "€1,130.77 a month (≈ €13,569 a year)", note: "2026 amount for university and HBO students. The IND can adjust required amounts during the year; check before you pay.", conf: "multi", src: ["nl-ind-income", "nl-ind-2026", "nl-studypath"] },
    fees: [
      { label: "IND application fee (study)", eur: 254, note: "2026 (was €243)", conf: "official", src: ["nl-rug-fee", "nl-ind-fees"] }
    ],
    work: { short: "16 h/week", text: "Up to 16 hours a week in term, or full-time in June, July and August. Your employer must get a work permit (TWV).", conf: "official", src: ["nl-ind-intl-students", "nl-business-twv"] },
    post: { short: "12 months", text: "Orientation year: up to 1 year to look for work, without needing a work permit.", conf: "official", src: ["nl-ind-orientation"] },
    processing: { text: "After the IND approves, you have 3 months to collect the MVV sticker; collection can take up to 10 working days.", src: ["nl-nw-mvv"] },
    insurance: { text: "Health insurance is required during your studies.", src: ["nl-ind-student"] },
    steps: [
      { when: "6–9 months before", title: "Get admitted by a recognised sponsor",
        body: "Only institutions on the IND's public register of recognised sponsors can bring non-EU students. Check yours is listed.", src: ["nl-ind-student"] },
      { when: "3–4 months before", title: "Let the university apply to the IND",
        body: "Your university submits the application for entry and residence. You pay the fee to the university and prove funds of €1,130.77 a month.", src: ["nl-ind-student", "nl-ind-income"] },
      { when: "Within 3 months of approval", title: "Collect your MVV entry visa", if: function (o) { return !o.mvvExempt; },
        body: "Book an appointment at the Dutch embassy or consulate named in the IND letter; the MVV sticker goes in your passport.", src: ["nl-nw-mvv"] },
      { when: "Before you travel", title: "Travel without an MVV", if: function (o) { return o.mvvExempt; },
        body: function (o) { return o.name + " citizens are exempt from the MVV entry visa. Travel on your passport and collect the residence card after arrival."; }, src: ["nl-ind-mvv"] },
      { when: "First weeks", title: "Register and collect your residence card",
        body: "Register your address with the municipality, then pick up your residence permit at an IND desk. Keep up your study progress: universities report students who fall behind.", src: ["nl-ind-student"] }
    ],
    docs: [
      { label: "Passport, plus copies" },
      { label: "Admission from a recognised-sponsor institution" },
      { label: "Proof of funds: €1,130.77 a month (or a deposit with the university)" },
      { label: "Signed antecedents certificate (IND form)" },
      { label: "Health insurance" }
    ],
    docsSrc: ["nl-ind-student"],
    watch: [
      { text: "The IND can adjust its required amounts during the year. Check the income requirements page right before you pay.", src: ["nl-ind-income"] }
    ],
    links: [
      { label: "IND: student residence permit", url: "https://ind.nl/en/residence-permits/study/student-residence-permit-for-university-or-higher-professional-education" },
      { label: "IND: who is exempt from the MVV", url: "https://ind.nl/en/mvv-exemptions" },
      { label: "IND: income requirements for study", url: "https://ind.nl/en/income-requirements-study" },
      { label: "IND: orientation year", url: "https://ind.nl/en/residence-permits/work/residence-permit-for-orientation-year" }
    ],
    portal: [
      { label: "NetherlandsWorldwide: apply for an MVV sticker (choose your country)", url: "https://www.netherlandsworldwide.nl/visa-the-netherlands/mvv-long-stay" }
    ]
  };

  DEST.ESP = {
    code: "ESP", name: "Spain", slug: "spain", us: "Spain", schengen: true, full: true,
    permit: "Student visa (stay authorisation for studies), then a TIE card for stays over 180 days",
    visaBefore: function () { return true; },
    headline: function (o) { return o.schengenVisa
      ? "Get a student visa from the Spanish consulate before you travel, then a TIE card within a month of arrival."
      : "Get a student visa from the Spanish consulate, or enter visa-free and apply in Spain within 60 days. Then get a TIE card."; },
    headSrc: function (o) { return o.schengenVisa ? ["es-sheet1", "es-consulate-req"] : ["es-sheet1", "es-santiago"]; },
    fundsEURmonth: 600, fundsYearEUR: 7200,
    funds: { short: "€600/month", text: "€600 a month (100% of the 2026 IPREM index)", note: "Unless your accommodation for the whole stay is already paid.", conf: "official", src: ["es-sheet1", "es-iprem-2026"] },
    fees: [
      { label: "Student visa", eur: null, note: "Set per nationality: see your consulate's fee list", conf: "official", src: ["es-chile-fees"] },
      { label: "TIE card", eur: null, note: "Paid with form 790-012", conf: "check", src: ["es-guide"] }
    ],
    work: { short: "30 h/week", text: "Up to 30 hours a week, compatible with studies, included in the student authorisation.", conf: "official", src: ["es-sheet4bis", "es-rd"] },
    post: { short: "See sheet 20", text: "Graduates (bachelor level or higher) can apply for a residence permit to look for work or start a business. We could not confirm its current length from official pages; check the Ministry's information sheet 20.", conf: "check", src: ["es-sheet20"] },
    processing: { text: "Apply at least 2 months before your course starts. Once the stay authorisation is approved, the consulate has up to one month to issue the visa.", src: ["es-ankara"] },
    insurance: { text: "Public or private health insurance from an insurer authorised in Spain, covering the whole study period.", src: ["es-consulate-req"] },
    steps: [
      { when: "4–6 months before", title: "Get your admission letter",
        body: "The programme must be full-time and lead to a qualification; you also show that enrolment fees are paid.", src: ["es-sheet1"] },
      { when: "3–4 months before", title: "Get your criminal record certificates",
        body: "For stays over 180 days (applicants over 16): a recent criminal record certificate from every country you lived in during the last 5 years, legalised or apostilled, with translations.", src: ["es-consulate-req"] },
      { when: "At least 2 months before", title: "Apply for the student visa",
        body: "Apply at the Spanish consulate (or its visa centre) for your place of residence with the admission letter, funds (€600 a month) and health insurance.", src: ["es-sheet1", "es-ankara"] },
      { when: "Alternative", title: "Enter visa-free and apply in Spain", if: function (o) { return !o.schengenVisa; },
        body: "Spain's consulate in Santiago de Chile says nationals who don't need a Schengen visa can instead apply for the study authorisation at the immigration office in Spain within 60 days of arrival.", src: ["es-santiago"] },
      { when: "Within 1 month of arrival", title: "Apply for your TIE card",
        body: "For stays over 180 days, apply at the police station in the province where your authorisation was processed.", src: ["es-consulate-req"] }
    ],
    docs: [
      { label: "Passport valid for your stay (consulates often ask for at least 1 year)" },
      { label: "National visa application form and photo" },
      { label: "Admission letter and proof that fees are paid" },
      { label: "Proof of funds: €600 a month" },
      { label: "Health insurance (authorised in Spain)" },
      { label: "Criminal record certificate, apostilled and translated (stays > 180 days)" }
    ],
    docsSrc: ["es-sheet1", "es-consulate-req"],
    watch: [
      { text: "Work is capped at 30 hours a week; exceeding it ends your stay authorisation.", src: ["es-sheet4bis"] }
    ],
    links: [
      { label: "Ministry of Inclusion: sheet 1 (stay for studies)", url: "https://www.inclusion.gob.es/en/web/migraciones/w/estancia-por-estudios" },
      { label: "Ministry of Inclusion: sheet 4 bis (work while studying)", url: "https://www.inclusion.gob.es/en/web/migraciones/w/hoja-4-bis-acceso-al-empleo-de-las-personas-titulares-de-una-autorizacion-de-estancia-de-larga-duracion-por-estudios-movilidad-de-alumnos-servicios-de-voluntariado-o-actividades-formativas" },
      { label: "Ministry of Inclusion: sheet 20 (job search after studies)", url: "https://www.inclusion.gob.es/en/web/migraciones/w/20.-autorizacion-de-residencia-para-busqueda-de-empleo-o-inicio-de-proyecto-empresarial" }
    ],
    portal: [
      { label: "Spanish embassies and consulates worldwide", url: "https://www.exteriores.gob.es/en/EmbajadasConsulados/Paginas/index.aspx" }
    ]
  };

  DEST.ITA = {
    code: "ITA", name: "Italy", slug: "italy", us: "Italy", schengen: true, full: true,
    permit: "Study visa (type D), then a permesso di soggiorno per studio",
    visaBefore: function () { return true; },
    headline: function () { return "Pre-enrol on Universitaly, get a type D study visa, then request your residence permit within 8 working days of arrival."; },
    headSrc: ["it-universitaly", "it-interno-visa"],
    fundsEURmonth: 848.32, fundsYearEUR: 10179.85,
    funds: { short: "€10,180/year", text: "€10,179.85 per academic year (≈ €848 a month)", note: "For 2026/27 and 2027/28. Return travel and any unpaid tuition must be added on top.", conf: "official", src: ["it-cons-ba-2026", "it-tunis-2026"] },
    fees: [
      { label: "Study visa", eur: 50, conf: "official", src: ["it-hanoi-visa", "it-brasilia-visa"] },
      { label: "Residence permit (card €30.46 + €40 contribution + €30 postal fee)", eur: 100.46, note: "Plus a revenue stamp", conf: "official", src: ["it-polizia-costs", "it-portale-costs"] }
    ],
    work: { short: "20 h/week", text: "Up to 20 hours a week, capped at 1,040 hours a year.", conf: "official", src: ["it-work"] },
    post: { short: "9–12 months", text: "After graduating in Italy you can convert to a job-search permit lasting between 9 and 12 months; the 20-hour limit then no longer applies.", conf: "official", src: ["it-study-norm", "it-prefettura-conv"] },
    processing: { text: "For 2026/27 bachelor's and master's programmes, submit your visa application by 30 November 2026.", src: ["it-cons-ba-2026"] },
    insurance: { text: "Private insurance, or voluntary registration with the national health service for a flat €700 a year.", src: ["it-ssn-700", "it-salute"] },
    steps: [
      { when: "Spring (usually from March)", title: "Pre-enrol on Universitaly",
        body: "Pre-enrolment for visa purposes goes exclusively through the Universitaly portal; the university checks it and forwards it to the consulate.", src: ["it-universitaly", "it-cons-ba-2026"] },
      { when: "Summer", title: "Gather funds and documents",
        body: "Show €10,179.85 for the academic year from lawful, traceable sources, plus accommodation and health insurance.", src: ["it-cons-ba-2026"] },
      { when: "By 30 Nov 2026 (2026/27 intake)", title: "Apply for the type D study visa",
        body: "Apply at the Italian embassy, consulate or its visa centre. The Foreign Ministry's Visa for Italy tool lists requirements for your nationality.", src: ["it-cons-ba-2026", "it-visto"] },
      { when: "Within 8 working days of arrival", title: "Request your residence permit",
        body: "Send the residence-permit kit from a post office, then attend the police (Questura) appointment for fingerprints.", src: ["it-interno-visa", "it-portale-costs"] },
      { when: "First weeks", title: "Arrange health cover",
        body: "Keep private insurance, or register voluntarily with the national health service (€700 a year).", src: ["it-ssn-700"] }
    ],
    docs: [
      { label: "Passport, plus copies" },
      { label: "Universitaly pre-enrolment summary" },
      { label: "Proof of funds: €10,179.85 for the year (lawful, traceable)" },
      { label: "Proof of accommodation" },
      { label: "Health insurance" },
      { label: "National (D) visa application form and photo" }
    ],
    docsSrc: ["it-cons-ba-2026", "it-universitaly"],
    watch: [
      { text: "The funds requirement rose 46.5% for 2026/27 (from €6,947.33). Older guides still quote the old figure.", src: ["it-cons-ba-2026", "it-connectsaqib"] },
      { text: "Visa deadline for 2026/27 bachelor's and master's programmes: 30 November 2026.", src: ["it-cons-ba-2026"] }
    ],
    links: [
      { label: "Universitaly: international students", url: "https://www.universitaly.it/it/studenti-stranieri" },
      { label: "Visa for Italy (Foreign Ministry tool)", url: "https://vistoperitalia.esteri.it/" },
      { label: "Ministry of the Interior: visa and residence permit", url: "https://www.interno.gov.it/it/temi/immigrazione-e-asilo/modalita-dingresso/visto-e-permesso-soggiorno" }
    ],
    portal: [
      { label: "Visa for Italy: requirements by nationality and residence", url: "https://vistoperitalia.esteri.it/" }
    ]
  };

  DEST.IRL = {
    code: "IRL", name: "Ireland", slug: "ireland", us: "Ireland", schengen: false, full: true,
    permit: "Study visa (for visa-required nationals), then Stamp 2 permission and an IRP card",
    visaBefore: function (o) { return !!o.irelandVisa; },
    headline: function (o) {
      if (o.cta) return "No visa, permit or registration needed: British citizens can live, study and work in Ireland under the Common Travel Area.";
      return o.irelandVisa
        ? "Apply online for an Irish long-term (D) study visa before you travel, then register for an IRP card."
        : "No visa needed to travel. Show your study documents at the border, then register for an IRP card.";
    },
    headSrc: function (o) { return o.cta ? ["ie-cta", "uk-cta"] : ["ie-visa-list", "ie-longterm-visa"]; },
    fundsEURmonth: 833.33, fundsYearEUR: 10000,
    funds: { short: "€10,000", text: "Immediate access to at least €10,000 for one academic year (≈ €833 a month)", note: "Degree students may use an education bond of at least €10,000 instead (pilot).", conf: "official", src: ["ie-finances", "ie-finance-2025"] },
    fees: [
      { label: "Visa (single entry)", eur: 60, conf: "official", src: ["ie-fees"], when: function (o) { return o.irelandVisa; } },
      { label: "IRP registration", eur: 300, conf: "official", src: ["ie-register"], when: function (o) { return !o.cta; } }
    ],
    work: { short: "20 h/week", text: "Up to 20 hours a week in term; up to 40 hours in June–September and 15 December–15 January.", conf: "official", src: ["ie-student-perm"] },
    post: { short: "12–24 months", text: "Stamp 1G: 12 months after a level 8 degree, up to 24 months after level 9 or above; you may work 40 hours a week.", conf: "official", src: ["ie-1g"] },
    processing: { text: "Each Irish visa office publishes its current processing times.", src: ["ie-visa-offices"] },
    insurance: { text: "Private medical insurance is required for all non-EEA students.", src: ["ie-insurance"] },
    steps: [
      { when: "6–9 months before", title: "Get accepted on an eligible course",
        body: "The course must be full-time and on the Interim List of Eligible Programmes (ILEP), or offered by a provider with TrustEd Ireland authorisation. Part-time or online courses don't qualify.", src: ["ie-ilep", "ie-trusted"] },
      { when: "3–4 months before", title: "Pay fees and buy insurance",
        body: "Pay the tuition the rules require and buy private medical insurance; keep the receipts.", src: ["ie-insurance"] },
      { when: "3 months before", title: "Apply online for a long-term (D) study visa", if: function (o) { return o.irelandVisa; },
        body: function (o) { return "Fill in the AVATS form online and send your documents to the visa office that handles your country" + (o.irlOffice ? " (" + o.irlOffice + ")" : "") + ". Show immediate access to €10,000."; }, src: ["ie-longterm-visa", "ie-visa-offices"] },
      { when: "At the border", title: "Show your documents at immigration", if: function (o) { return !o.irelandVisa && !o.cta; },
        body: function (o) { return o.name + " citizens don't need a visa. At immigration control, show the acceptance letter, fee receipt, proof of €10,000 and insurance."; }, src: ["ie-visa-list", "ie-finances"] },
      { when: "Within 90 days", title: "Register for your IRP card", if: function (o) { return !o.cta; },
        body: "Book a first-time registration appointment online; all first-time registrations take place at the Burgh Quay office in Dublin. You get Stamp 2 permission and an IRP card.", src: ["ie-register", "ie-bq"] }
    ],
    ctaSteps: [
      { when: "Before you travel", title: "Get admitted",
        body: "Apply to the course. Under the Common Travel Area you need no visa, residence permit or employment permit to live, study and work in Ireland.", src: ["ie-cta", "uk-cta"] },
      { when: "Before the course", title: "Check fees and student support",
        body: "British citizens have access to education in Ireland on terms no less favourable than Irish citizens. Ask the institution which fee rate applies to you.", src: ["uk-cta", "uk-living-ie"] }
    ],
    docs: [
      { label: "Passport, plus copies" },
      { label: "Acceptance letter for an eligible (ILEP / TrustEd) course", when: function (o) { return !o.cta; } },
      { label: "Tuition fee receipt", when: function (o) { return !o.cta; } },
      { label: "Proof of immediate access to €10,000", when: function (o) { return !o.cta; } },
      { label: "Private medical insurance", when: function (o) { return !o.cta; } },
      { label: "AVATS application summary and photos", when: function (o) { return o.irelandVisa; } },
      { label: "Admission letter", when: function (o) { return !!o.cta; } }
    ],
    docsSrc: ["ie-longterm-visa", "ie-register"],
    watch: [
      { text: "Ireland is not in Schengen. A Schengen visa does not let you enter Ireland, and Irish permission does not cover Schengen countries.", src: ["ie-visa-list"] }
    ],
    links: [
      { label: "Irish Immigration: long-term study visa", url: "https://www.irishimmigration.ie/coming-to-study-in-ireland/what-are-my-study-visa-options/how-to-apply-for-long-term-study-visa/" },
      { label: "Irish Immigration: visa offices", url: "https://www.irishimmigration.ie/visa-offices/" },
      { label: "Irish Immigration: register your permission", url: "https://www.irishimmigration.ie/registering-your-immigration-permission/how-to-register-your-immigration-permission-for-the-first-time/information-on-registering-your-immigration-permission-for-the-first-time/" },
      { label: "Third Level Graduate Programme (Stamp 1G)", url: "https://www.irishimmigration.ie/my-situation-has-changed-since-i-arrived-in-ireland/third-level-graduate-programme/" }
    ],
    portal: [
      { label: "Irish Immigration: which visa office handles your country", url: "https://www.irishimmigration.ie/visa-offices/" }
    ]
  };

  DEST.POL = {
    code: "POL", name: "Poland", slug: "poland", us: "Poland", schengen: true, full: true,
    permit: "National (D) visa for study, then a temporary residence permit (karta pobytu)",
    visaBefore: function () { return true; },
    headline: function () { return "Get a national (D) study visa before you travel, then apply online (MOS) for a temporary residence permit."; },
    headSrc: ["pl-study-gov", "pl-mos-studies"],
    fundsEURmonth: 1010 / FX.PLN, fundsYearEUR: 1010 * 12 / FX.PLN, fundsCurrency: "PLN",
    funds: { short: "PLN 1,010/month", text: "At least PLN 1,010 a month (≈ €238), plus return travel, tuition and housing", note: "Legal minimum for a single person since 1 January 2025. A return ticket replaces the travel amount.", conf: "official", src: ["pl-funds", "pl-uw-funds"] },
    fees: [
      { label: "National (D) visa", eur: 200, note: "From 1 January 2026 (was €135)", conf: "official", src: ["pl-visa-fee-2026", "pl-visa-fee-2024"] },
      { label: "Temporary residence permit (PLN 340) + card (PLN 100)", eur: Math.round(440 / FX.PLN), conf: "official", src: ["pl-udsc-fees"] }
    ],
    work: { short: "No limit", text: "Full-time students with a student visa or temporary residence permit can work without a work permit.", conf: "official", src: ["pl-work"] },
    post: { short: "9 months", text: "A one-time 9-month temporary residence permit after graduating, to look for work or start a business. Graduates of full-time studies in Poland don't need a work permit.", conf: "official", src: ["pl-graduate"] },
    processing: { text: "Consulates decide national visas within 15 calendar days of the fee payment, extendable to 30 days.", src: ["pl-iran-visa"] },
    insurance: { text: "Health insurance for the visa, then public or private cover in Poland.", src: ["pl-study-gov"] },
    steps: [
      { when: "6–9 months before", title: "Get admitted to an accredited full-time programme",
        body: "Since 1 August 2025 universities must check you have at least B2 in the language of instruction, using a recognised certificate.", src: ["pl-b2", "pl-notes"] },
      { when: "3–4 months before", title: "Apply for the national (D) study visa",
        body: "Register in the e-Konsulat system and attend the consulate appointment with the admission letter, funds proof, insurance and accommodation. The fee is €200.", src: ["pl-study-gov", "pl-visa-fee-2026"] },
      { when: "Before your visa expires", title: "Apply for a temporary residence permit",
        body: "Submit the application online through the MOS system (paper applications are no longer accepted), then give fingerprints at the voivodeship office.", src: ["pl-mos-studies", "pl-mos-only"] }
    ],
    docs: [
      { label: "Passport, plus copies" },
      { label: "Admission letter for an accredited full-time programme" },
      { label: "Language certificate, B2 or higher" },
      { label: "Proof of funds: PLN 1,010 a month plus return travel" },
      { label: "Health insurance" },
      { label: "Proof of accommodation" }
    ],
    docsSrc: ["pl-study-gov", "pl-b2"],
    watch: [
      { text: "The national visa fee rose to €200 on 1 January 2026.", src: ["pl-visa-fee-2026"] },
      { text: "Poland tightened student admissions in 2025: B2 language proof and stricter checks on universities.", src: ["pl-b2", "pl-notes"] }
    ],
    links: [
      { label: "Study in Poland: visa and application", url: "https://study.gov.pl/visa-application" },
      { label: "MOS: residence permit for studies", url: "https://mos.cudzoziemcy.gov.pl/en/informacje/na-studia_EN" },
      { label: "Office for Foreigners: work as a student", url: "https://www.gov.pl/web/udsc-en/work-student" },
      { label: "e-Konsulat (visa registration)", url: "https://secure.e-konsulat.gov.pl" }
    ],
    portal: [
      { label: "e-Konsulat: register for a Polish visa appointment", url: "https://secure.e-konsulat.gov.pl" }
    ]
  };

  DEST.SWE = {
    code: "SWE", name: "Sweden", slug: "sweden", us: "Sweden", schengen: true, full: true,
    permit: "Residence permit for studies, granted before you travel",
    visaBefore: function () { return true; },
    headline: function () { return "Apply online for a residence permit for studies and get it before you travel."; },
    headSrc: ["se-mv-apply"],
    fundsEURmonth: 10656 / FX.SEK, fundsYearEUR: 10656 * 10 / FX.SEK, fundsCurrency: "SEK", fundsMonths: 10,
    funds: { short: "SEK 10,656/month", text: "SEK 10,656 a month (≈ €969), for 10 months of each study year", note: "2026 amount. Reduced if housing or food is provided free.", conf: "multi", src: ["se-mdu", "se-kau", "se-mv-apply"] },
    fees: [
      { label: "University Admissions application", eur: Math.round(900 / FX.SEK), note: "SEK 900", conf: "official", src: ["se-ua-fee"] },
      { label: "Residence permit", eur: Math.round(1500 / FX.SEK), note: "SEK 1,500", conf: "official", src: ["se-mv-apply"] }
    ],
    work: { short: "15 h/week", text: "For permits decided from 11 June 2026: at most 15 hours a week in term, no limit in June–August. Working more can cost you your permit.", conf: "official", src: ["se-mv-rules", "se-sis-rules"] },
    post: { short: "12 months", text: "Up to 12 months residence permit to look for work after completing your studies.", conf: "official", src: ["se-mv-jobseek"] },
    processing: { text: "Apply as soon as you have paid the first tuition instalment; the first-round admission deadline for the autumn semester is mid-January.", src: ["se-ua-dates"] },
    insurance: { text: "Comprehensive health insurance is required if your permit is shorter than one year.", src: ["se-mv-apply"] },
    steps: [
      { when: "October – mid-January (autumn start)", title: "Apply on University Admissions",
        body: "Apply through universityadmissions.se and pay the SEK 900 application fee.", src: ["se-ua-fee", "se-ua-dates"] },
      { when: "After admission", title: "Pay the first tuition instalment", body: "Your residence-permit application needs proof of this payment.", src: ["se-mv-apply"] },
      { when: "Right after paying", title: "Apply online for a residence permit",
        body: "Apply on the Migration Agency website, pay SEK 1,500 and show SEK 10,656 a month.", src: ["se-mv-apply", "se-mdu"] },
      { when: "Within 30 days of arrival", title: "Report your address",
        body: "New since 11 June 2026: notify the Migration Agency of your address within 30 days, and whenever you move.", src: ["se-mv-rules"] },
      { when: "Every year", title: "Meet the study-results rule",
        body: "New since 11 June 2026: complete at least 37.5 credits in year 1 and 45 credits a year after that.", src: ["se-mv-rules", "se-sis-rules"] }
    ],
    docs: [
      { label: "Passport, plus copies" },
      { label: "Notification of selection (admission)" },
      { label: "Receipt for the first tuition instalment" },
      { label: "Proof of funds: SEK 10,656 a month" },
      { label: "Comprehensive health insurance (if permit < 12 months)" }
    ],
    docsSrc: ["se-mv-apply"],
    watch: [
      { text: "New rules since 11 June 2026: 15-hour weekly work cap in term, minimum study results and address reporting. They don't apply to permits granted before that date.", src: ["se-mv-rules"] }
    ],
    links: [
      { label: "Migration Agency: studies at higher education", url: "https://www.migrationsverket.se/en/you-want-to-apply/study/higher-education.html" },
      { label: "Migration Agency: new rules (May 2026)", url: "https://www.migrationsverket.se/nyheter/news-archive/2026-05-25-new-rules-for-residence-permits-for-studies-in-higher-education.html" },
      { label: "University Admissions: key dates", url: "https://www.universityadmissions.se/en/key-dates-and-deadlines/" }
    ],
    portal: [
      { label: "Migration Agency: apply online", url: "https://www.migrationsverket.se/en/you-want-to-apply/study/higher-education.html" },
      { label: "Sweden Abroad: find a Swedish embassy", url: "https://www.swedenabroad.se/en/embassies/" }
    ]
  };

  /* ----------------------------------------------------------------
   * BASIC GUIDES: the other 19 EU countries (official study-permit page verified for each).
   * ---------------------------------------------------------------- */
  var BASIC = [
    { code: "AUT", name: "Austria", slug: "austria", us: "Austria", schengen: true, url: "https://www.migration.gv.at/en/living-and-working-in-austria/study-in-austria/", auth: "Austrian migration portal: study in Austria", src: "b-aut" },
    { code: "BEL", name: "Belgium", slug: "belgium", us: "Belgium", schengen: true, url: "https://dofi.ibz.be/en", auth: "Immigration Office (IBZ)", src: "b-bel" },
    { code: "BGR", name: "Bulgaria", slug: "bulgaria", us: "Bulgaria", schengen: true, url: "https://www.mfa.bg/en/155", auth: "Ministry of Foreign Affairs: studying in Bulgaria", src: "b-bgr", note: "Full Schengen member since 1 January 2025." },
    { code: "HRV", name: "Croatia", slug: "croatia", us: "Croatia", schengen: true, url: "https://mup.gov.hr/aliens-281621/stay-and-work/biometric-residence-permit/281683", auth: "Ministry of the Interior: residence permits", src: "b-hrv" },
    { code: "CYP", name: "Cyprus", slug: "cyprus", us: "Cyprus", schengen: false, url: "https://www.gov.cy/mip-md/en/documents/students/", auth: "Migration Department: students", src: "b-cyp", note: "Not in Schengen. Your university applies for your entry permit; days in Cyprus don't count toward the Schengen 90/180 limit." },
    { code: "CZE", name: "Czechia", slug: "czech-republic", ca: "czechia", schengen: true, url: "https://www.mvcr.cz/mvcren/article/information-for-schools-and-students.aspx", auth: "Ministry of the Interior: schools and students", src: "b-cze" },
    { code: "DNK", name: "Denmark", slug: "denmark", us: "Denmark", schengen: true, url: "https://www.nyidanmark.dk/en-GB/You-want-to-apply/Study/Higher-Education", auth: "New to Denmark (SIRI): higher education", src: "b-dnk", note: "Denmark is not bound by the EU students directive (2016/801), so its national rules apply." },
    { code: "EST", name: "Estonia", slug: "estonia", us: "Estonia", schengen: true, url: "https://www.politsei.ee/en/instructions/residence-permit-for-study", auth: "Police and Border Guard Board: residence permit for study", src: "b-est" },
    { code: "FIN", name: "Finland", slug: "finland", us: "Finland", schengen: true, url: "https://migri.fi/en/studying-in-finland", auth: "Finnish Immigration Service (Migri)", src: "b-fin", funds: "At least €800 a month for your studies." },
    { code: "GRC", name: "Greece", slug: "greece", us: "Greece", schengen: true, url: "https://migration.gov.gr/en/migration-policy/metanasteusi-stin-ellada/katigories-adeion-diamonis-politon-triton-choron-dikaiologitika%E2%80%8B/", auth: "Ministry of Migration and Asylum: residence permit categories", src: "b-grc" },
    { code: "HUN", name: "Hungary", slug: "hungary", us: "Hungary", schengen: true, url: "https://oif.gov.hu/factsheets/residence-of-the-student-pupil", auth: "Directorate-General for Aliens Policing: students", src: "b-hun" },
    { code: "LVA", name: "Latvia", slug: "latvia", us: "Latvia", schengen: true, url: "https://www.pmlp.gov.lv/en/studies", auth: "Office of Citizenship and Migration Affairs: studies", src: "b-lva", funds: "€620 a month for studies at an accredited higher education institution." },
    { code: "LTU", name: "Lithuania", slug: "lithuania", us: "Lithuania", schengen: true, url: "https://www.migracija.lt/en/esu-studentas1", auth: "Migration Department (MIGRIS): students", src: "b-ltu", funds: "Half the Lithuanian minimum monthly wage for each month of the permit." },
    { code: "LUX", name: "Luxembourg", slug: "luxembourg", us: "Luxembourg", schengen: true, url: "https://guichet.public.lu/en/citoyens/immigration/plus-3-mois/ressortissant-tiers/etudiant/etudiant-pays-tiers.html", auth: "Guichet.lu: students from third countries", src: "b-lux", note: "The authorisation to stay must be approved before you enter Luxembourg." },
    { code: "MLT", name: "Malta", slug: "malta", us: "Malta", schengen: true, url: "https://identita.gov.mt/expatriates-unit-main-page/noneu-nationals/non-employment-permits/study-research-trainees-volunteers-interns/", auth: "Identità: study permits", src: "b-mlt" },
    { code: "PRT", name: "Portugal", slug: "portugal", us: "Portugal", schengen: true, url: "https://vistos.mne.gov.pt/en/national-visas/general-information/type-of-visa", auth: "Portuguese visa portal (then AIMA for residence)", src: "b-prt", note: "Holders of a residence visa must apply for a residence permit with AIMA during the visa's 4-month validity." },
    { code: "ROU", name: "Romania", slug: "romania", us: "Romania", schengen: true, url: "https://igi.mai.gov.ro/en/studies/", auth: "General Inspectorate for Immigration: studies", src: "b-rou", note: "Full Schengen member since 1 January 2025. Residence can be extended 9 months after graduation to look for work." },
    { code: "SVK", name: "Slovakia", slug: "slovakia", us: "Slovakia", schengen: true, url: "https://www.minv.sk/?residence-of-an-foreigner=", auth: "Ministry of the Interior: residence of foreigners", src: "b-svk" },
    { code: "SVN", name: "Slovenia", slug: "slovenia", us: "Slovenia", schengen: true, url: "https://infotujci.si/en/third-country-nationals/temporary-residence-permit/", auth: "InfoTujci: temporary residence permit", src: "b-svn" }
  ];

  /* ----------------------------------------------------------------
   * SCHENGEN SHORT STAYS (≤ 90 days in any 180)
   * ---------------------------------------------------------------- */
  var SHORT = {
    feeAdult: 90, feeChild: 45,
    visaSteps: [
      { when: "Decide where to apply", title: "Apply to the right country",
        body: "Apply to the consulate of the country where you will spend the most days; if the days are equal, the country of first entry.", src: ["eu-apply-schengen", "reg-visa-code"] },
      { when: "6 months to 15 days before", title: "Book the appointment",
        body: "Apply no earlier than 6 months and no later than 15 days before the trip. Many consulates use a visa centre.", src: ["eu-apply-schengen"] },
      { when: "At the appointment", title: "Give fingerprints and pay the fee",
        body: "The fee is €90 (children aged 6–12: €45). Pupils and students travelling for study or training are exempt from the fee.", src: ["eu-fee-2024", "de-ffo-visa"] },
      { when: "About 15 days", title: "Wait for the decision",
        body: "The standard decision time is 15 calendar days; it can be extended in individual cases.", src: ["reg-visa-code"] },
      { when: "At the border", title: "Register in the Entry/Exit System (EES)",
        body: "Your fingerprints and a face photo are recorded on first entry; passport stamping has ended. Stay no longer than 90 days in any 180-day period.", src: ["ees-full", "ees-faq"] }
    ],
    freeSteps: [
      { when: "Before booking", title: "Check your passport",
        body: "It must have been issued within the last 10 years and be valid at least 3 months after the day you leave.", src: ["youreurope-docs"] },
      { when: "Planning", title: "Count your days",
        body: "Up to 90 days in any 180-day period across all Schengen countries combined. You may not work.", src: ["reg-visa-list", "youreurope-docs"] },
      { when: "At the border", title: "Register in the Entry/Exit System (EES)",
        body: "Your fingerprints and a face photo are recorded on first entry. EES has been fully operational since 10 April 2026.", src: ["ees-full"] },
      { when: "Not yet", title: "No ETIAS needed yet",
        body: "ETIAS (€20 once it starts) is not in operation; the EU will announce a start date several months in advance. Ignore websites that charge for it today.", src: ["etias-home", "etias-fee", "fragomen-etias"] }
    ],
    visaDocs: [
      "Schengen visa application form, signed",
      "Passport issued within 10 years, valid 3+ months after departure, with 2 blank pages",
      "Passport photo",
      "Travel medical insurance (emergency care, hospitalisation, repatriation), at least €30,000",
      "Return or onward ticket reservation",
      "Proof of accommodation",
      "Proof of means: bank statements, payslips or sponsor letter",
      "Proof of purpose: invitation, conference or course enrolment, employer letter"
    ],
    visaDocsSrc: ["eu-apply-schengen", "reg-visa-code", "youreurope-docs"],
    freeDocs: ["Passport issued within 10 years, valid 3+ months after departure", "Return or onward ticket", "Proof of accommodation", "Proof you can pay for the trip"],
    freeDocsSrc: ["youreurope-docs"]
  };

  /* ----------------------------------------------------------------
   * CHANGE LOG
   * ---------------------------------------------------------------- */
  var CHANGES = [
    { date: "2025-05-20", where: "ESP", what: "Royal Decree 1155/2024 in force: students may work up to 30 hours a week.", src: "es-sheet4bis" },
    { date: "2025-07-17", where: "EU", what: "Commission sets the future ETIAS fee at €20 (was €7).", src: "etias-fee" },
    { date: "2025-07-23", where: "IDN", what: "New Schengen visa cascade for Indonesia: 5-year multiple-entry visas after one visa.", src: "eeas-indonesia" },
    { date: "2025-07-29", where: "TUR", what: "New Schengen visa cascade for Türkiye.", src: "ec-turkiye" },
    { date: "2025-08-01", where: "POL", what: "New regulation: students must prove B2 in the language of instruction.", src: "pl-b2" },
    { date: "2025-10-12", where: "EU", what: "Entry/Exit System (EES) starts its phased roll-out at Schengen borders.", src: "ees-full" },
    { date: "2025-11", where: "RUS", what: "Russian citizens generally limited to single-entry Schengen visas.", src: "ec-russia" },
    { date: "2025-12-30", where: "EU", what: "Revised visa suspension mechanism in force (Regulation 2025/2441).", src: "reg-2025-2441" },
    { date: "2026-01-01", where: "POL", what: "National (D) visa fee rises from €135 to €200.", src: "pl-visa-fee-2026" },
    { date: "2026-01-01", where: "NLD", what: "IND study permit fee rises from €243 to €254.", src: "nl-ind-2026" },
    { date: "2026-01-29", where: "EU", what: "Commission adopts the first EU Visa Strategy, including measures for students.", src: "ec-strategy" },
    { date: "2026-02", where: "IRL", what: "ILEP closed to new courses; providers now need TrustEd Ireland authorisation to recruit non-EEA students.", src: "ie-trusted" },
    { date: "2026-04-10", where: "EU", what: "EES fully operational at all external border crossings.", src: "ees-full" },
    { date: "2026-05-01", where: "FRA", what: "Residence-permit taxes raised; student VLS-TS validation now €150 (was €75).", src: "fr-sp-a18881" },
    { date: "2026-05-28", where: "EU", what: "2025 Schengen statistics: over 12 million short-stay applications, 14.6% refused.", src: "ec-stats-2025" },
    { date: "2026-06", where: "ITA", what: "Funds requirement for 2026/27 raised to €10,179.85 a year (from €6,947.33).", src: "it-cons-ba-2026" },
    { date: "2026-06-11", where: "SWE", what: "Work cap of 15 hours a week in term, minimum study results, address reporting.", src: "se-mv-rules" },
    { date: "2026-07", where: "EU", what: "ETIAS late-2026 target removed; no launch date yet.", src: "fragomen-etias" },
    { date: "2026-08-01", where: "FRA", what: "Student funds threshold rises from €615 to €877.50 a month (Decree 2026-526).", src: "fr-decree-2026-526" }
  ];

  /* ----------------------------------------------------------------
   * SOURCES. [type, publisher, date, title, url]   type: o = official, s = secondary
   * ---------------------------------------------------------------- */
  var S = {
    // EU law and EU institutions
    "reg-visa-code": ["o", "European Parliament & Council", "2009", "Regulation (EC) No 810/2009 establishing a Community Code on Visas (Visa Code)", "https://eur-lex.europa.eu/eli/reg/2009/810/oj"],
    "reg-visa-list": ["o", "European Parliament & Council", "2025", "Regulation (EU) 2018/1806 listing the third countries whose nationals must be in possession of visas (consolidated text of 30 December 2025)", "https://eur-lex.europa.eu/eli/reg/2018/1806/2025-12-30/eng"],
    "reg-2025-2441": ["o", "European Parliament & Council", "2025", "Regulation (EU) 2025/2441 revising the visa suspension mechanism", "https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:32025R2441"],
    "dir-2016-801": ["o", "European Parliament & Council", "2016", "Directive (EU) 2016/801 on the entry and residence of third-country nationals for research, studies and training", "https://eur-lex.europa.eu/eli/dir/2016/801/oj"],
    "eu-apply-schengen": ["o", "European Commission", "n.d.", "Applying for a Schengen visa", "https://home-affairs.ec.europa.eu/policies/schengen/visa-policy/applying-schengen-visa_en"],
    "eu-fee-2024": ["o", "European Commission", "2024, June 13", "Schengen visa fee increased as of 11 June 2024", "https://home-affairs.ec.europa.eu/news/schengen-visa-fee-increased-11-june-2024-2024-06-13_en"],
    "ec-legal-docs": ["o", "European Commission", "n.d.", "Legal documents related to Schengen visas (country-specific multiple-entry visa decisions)", "https://home-affairs.ec.europa.eu/policies/schengen/visa-policy/legal-documents-related-schengen-visas_en"],
    "ec-gcc-2024": ["o", "European Commission", "2024, April 22", "Commission Implementing Decision C(2024) 2689 on multiple-entry visas for nationals of Bahrain, Oman and Saudi Arabia", "https://home-affairs.ec.europa.eu/document/download/d22b298f-18db-48b1-bb53-cc4114bc40b3_en"],
    "ec-qatar-kuwait": ["o", "European Commission", "2022, April 27", "Questions and answers: Proposal for visa exemption for nationals of Qatar and Kuwait", "https://ec.europa.eu/commission/presscorner/detail/cs/qanda_22_2507"],
    "ec-russia": ["o", "European Commission", "2025, November", "Implementing decision establishing rules on the issuing of multiple-entry visas to Russian nationals", "https://home-affairs.ec.europa.eu/commission-implementing-decision-establishing-rules-issuing-multiple-entry-visas-russian-nationals_en"],
    "ec-turkiye": ["o", "European Commission", "2025, July 29", "New rules for Turkish citizens applying for Schengen visas", "https://home-affairs.ec.europa.eu/news/new-rules-turkish-citizens-applying-schengen-visas-2025-07-29_en"],
    "eeas-india": ["o", "European External Action Service", "2024, April 18", "European Union adopts more favourable Schengen visa rules for Indians", "https://www.eeas.europa.eu/delegations/india/european-union-adopts-more-favourable-schengen-visa-rules-indians_en"],
    "eeas-indonesia": ["o", "European External Action Service", "2025, July", "European Union adopts more favourable Schengen visa rules for Indonesia", "https://www.eeas.europa.eu/delegations/indonesia/european-union-adopts-more-favourable-schengen-visa-rules-indonesia_en"],
    "ec-stats-2025": ["o", "European Commission", "2026, May 28", "Schengen short-stay visa applications rise in 2025 but remain below pre-pandemic levels", "https://home-affairs.ec.europa.eu/news/schengen-short-stay-visa-applications-rise-2025-remain-below-pre-pandemic-levels-2026-05-28_en"],
    "ec-strategy": ["o", "European Commission", "2026, January 29", "EU visa strategy", "https://home-affairs.ec.europa.eu/eu-visa-strategy_en"],
    "ees-full": ["o", "European Commission", "2026, April 10", "Entry/Exit System (EES) is fully operational", "https://home-affairs.ec.europa.eu/news/entryexit-system-ees-fully-operational-2026-04-10_en"],
    "ees-faq": ["o", "European Union", "n.d.", "FAQs about EES (Travel to Europe)", "https://travel-europe.europa.eu/en/ees/faq"],
    "etias-who": ["o", "European Union", "n.d.", "ETIAS: Who should apply (list of visa-exempt countries)", "https://travel-europe.europa.eu/en/etias/about-etias/who-should-apply"],
    "etias-home": ["o", "European Union", "n.d.", "European Travel Information and Authorisation System (ETIAS)", "https://travel-europe.europa.eu/en/etias"],
    "etias-fee": ["o", "European Commission", "2025, July 17", "The European travel authorisation ETIAS will cost EUR 20", "https://home-affairs.ec.europa.eu/news/european-travel-authorisation-etias-will-cost-eur-20-2025-07-17_en"],
    "youreurope-docs": ["o", "European Union (Your Europe)", "n.d.", "Travel documents for non-EU nationals", "https://europa.eu/youreurope/citizens/travel/entry-exit/non-eu-nationals/index_en.htm"],
    "ec-portal": ["o", "European Commission", "n.d.", "EU Immigration Portal", "https://home-affairs.ec.europa.eu/policies/migration-and-asylum/eu-immigration-portal_en"],
    "fragomen-etias": ["s", "Fragomen", "2026", "European Union: ETIAS and EES launch status", "https://www.fragomen.com/insights/european-union-european-travel-information-and-authorisation-system-etias-launch-delayed.html"],
    "ey-gcc": ["s", "EY", "2024", "EU announces five-year multiple-entry Schengen visas for first-time applicants from Bahrain, Oman and Saudi Arabia", "https://www.ey.com/en_gl/technical/tax-alerts/european-union-announces-five-year-multiple-entry-schengen-visas-for-first-time-applicants-from-bahrain-oman-and-saudi-arabia"],
    "uk-cta": ["o", "UK Government (GOV.UK)", "n.d.", "Common Travel Area guidance", "https://www.gov.uk/government/publications/common-travel-area-guidance/common-travel-area-guidance"],
    "uk-living-ie": ["o", "UK Government (GOV.UK)", "n.d.", "Living in Ireland", "https://www.gov.uk/guidance/living-in-ireland"],
    "uk-travel-eu": ["o", "UK Government (GOV.UK)", "n.d.", "Travelling to the EU and Schengen area", "https://www.gov.uk/travel-to-eu-schengen-area"],

    // France
    "fr-decree-2026-526": ["o", "Légifrance", "2026, June 22", "Décret n° 2026-526 portant actualisation et indexation du niveau de ressources ... pour un motif d'études", "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054300340"],
    "fr-cf-funds-2026": ["o", "Campus France Japon", "2026", "Modification du montant des ressources exigées pour les demandes de visa étudiant à compter du 1er août 2026", "https://www.japon.campusfrance.org/fr/modification-du-montant-des-ressources-exigees-pour-les-demandes-de-visa-etudiant-a-compter-du-1er"],
    "fr-sp-f2231": ["o", "Service-Public.fr", "2026", "Foreign student in France: long-stay visa or residence permit", "https://www.service-public.gouv.fr/particuliers/vosdroits/F2231?lang=en"],
    "fr-sp-r52684": ["o", "Service-Public.fr", "2026", "Validate a long-stay visa as a residence permit (VLS-TS) and pay the fee", "https://www.service-public.gouv.fr/particuliers/vosdroits/R52684?lang=en"],
    "fr-sp-a18881": ["o", "Service-Public.fr", "2026", "Titres de séjour : augmentation du montant des taxes au 1er mai 2026", "https://www.service-public.gouv.fr/particuliers/actualites/A18881?lang=en"],
    "fr-sp-f2713": ["o", "Service-Public.fr", "2026", "Can a non-European student work in France?", "https://www.service-public.gouv.fr/particuliers/vosdroits/F2713?lang=en"],
    "fr-sp-f17319": ["o", "Service-Public.fr", "2026", "Residence card or VLS-TS: job search / company creation", "https://www.service-public.gouv.fr/particuliers/vosdroits/F17319?lang=en"],
    "fr-cvec": ["o", "Étudiant.gouv", "2026", "Do you have to pay the CVEC contribution?", "https://www.etudiant.gouv.fr/en/do-you-have-pay-cvec-contribution-955"],
    "fr-cf-validate": ["o", "Campus France", "n.d.", "How to validate your long-stay visa upon your arrival in France", "https://www.campusfrance.org/en/how-to-validate-your-long-stay-visa-visa-long-sejour-upon-your-arrival-in-france"],
    "fr-fv-student": ["o", "France-Visas", "n.d.", "Student", "https://france-visas.gouv.fr/en/etudiant"],
    "fr-fv-fees": ["o", "France-Visas", "n.d.", "Frais de visa (visa fee table)", "https://france-visas.gouv.fr/documents/d/france-visas/frais-de-visa-francais"],
    "fr-cf-eef": ["o", "Campus France", "n.d.", "Which countries are affected by the \"Etudes en France\" procedure?", "https://www.campusfrance.org/en/faq/which-countries-are-affected-by-the-etudes-en-france-studying-in-france-procedure"],
    "fr-cf-eef-proc": ["o", "Campus France", "n.d.", "\"Studying in France\" procedure", "https://www.campusfrance.org/en/application-etudes-en-france-procedure"],
    "fr-cf-noneef": ["o", "Campus France", "n.d.", "Enrolment without the \"Studying in France\" procedure", "https://www.campusfrance.org/en/application-non-EU-student-living-outside-EU-without-etudes-en-France-procedure"],

    // Germany
    "de-ffo-sperrkonto": ["o", "Federal Foreign Office", "n.d.", "Opening and closing a blocked bank account (Sperrkonto)", "https://www.auswaertiges-amt.de/en/sperrkonto-388600"],
    "de-daad-costs": ["o", "DAAD", "n.d.", "Costs of education and living", "https://www.daad.de/en/studying-in-germany/living-in-germany/finances/"],
    "de-ffo-visa": ["o", "Federal Foreign Office", "n.d.", "Applying for a visa: general information (fees)", "https://www.auswaertiges-amt.de/en/visa-service/-/215870"],
    "de-csp-study": ["o", "Federal Foreign Office (Consular Services Portal)", "n.d.", "Visa for study purposes and seeking a university place", "https://digital.diplo.de/studium"],
    "de-mig-students": ["o", "Make it in Germany (Federal Government)", "n.d.", "Students from abroad: access to the labour market", "https://www.make-it-in-germany.com/en/looking-for-foreign-professionals/entering/admission-labour-market/students"],
    "de-mig-after": ["o", "Make it in Germany (Federal Government)", "n.d.", "Prospects after graduation: seeking employment", "https://www.make-it-in-germany.com/en/study-training/study/prospects/seeking-employment"],
    "de-berlin-permit": ["o", "Service Berlin", "n.d.", "Residence permit for the purpose of full-time studies", "https://service.berlin.de/dienstleistung/305244/en/"],
    "de-uk-41": ["o", "German Embassy London", "n.d.", "D-Visa: University studies (visa-free privilege for certain nationals)", "https://uk.diplo.de/uk-en/02/university-studies-2449178"],
    "de-bamf-entry": ["o", "Federal Office for Migration and Refugees", "n.d.", "Entry regulations for Germany", "https://www.bamf.de/EN/Themen/MigrationAufenthalt/ZuwandererDrittstaaten/Migrathek/Einreisebestimmungen/einreisebestimmungen-node.html"],
    "de-aps-india": ["o", "APS India (German Embassy New Delhi)", "n.d.", "FAQs: Academic Evaluation Centre", "https://aps-india.de/faqs/"],
    "de-aps-china": ["o", "APS China (German Embassy Beijing)", "n.d.", "Akademische Prüfstelle", "https://www.aps.org.cn/"],
    "de-aps-vietnam": ["o", "German Embassy Hanoi", "n.d.", "Akademische Prüfstelle (APS) in Vietnam", "https://vietnam.diplo.de/vn-de/willkommen/aktuelles/aps/1236800"],
    "de-dhaka-faq": ["o", "German Embassy Dhaka", "2026", "FAQ: Student visa", "https://dhaka.diplo.de/bd-en/service/2689586-2689586"],
    "de-kyiv": ["o", "German Embassy Kyiv", "n.d.", "Visa information in English", "https://ukraine.diplo.de/ua-de/service/05-visaeinreise/2305172-2305172"],

    // Netherlands
    "nl-ind-student": ["o", "Immigration and Naturalisation Service (IND)", "n.d.", "Student residence permit for university or higher professional education", "https://ind.nl/en/residence-permits/study/student-residence-permit-for-university-or-higher-professional-education"],
    "nl-ind-mvv": ["o", "Immigration and Naturalisation Service (IND)", "n.d.", "MVV exemptions", "https://ind.nl/en/mvv-exemptions"],
    "nl-ind-income": ["o", "Immigration and Naturalisation Service (IND)", "n.d.", "Income requirements study", "https://ind.nl/en/income-requirements-study"],
    "nl-ind-2026": ["o", "Immigration and Naturalisation Service (IND)", "2025", "Fees and required amounts for 2026 known", "https://ind.nl/en/news/fees-and-required-amounts-for-2026-known"],
    "nl-ind-fees": ["o", "Immigration and Naturalisation Service (IND)", "n.d.", "Fees: costs of an application", "https://ind.nl/en/fees-costs-of-an-application"],
    "nl-ind-orientation": ["o", "Immigration and Naturalisation Service (IND)", "n.d.", "Residence permit for orientation year", "https://ind.nl/en/residence-permits/work/residence-permit-for-orientation-year"],
    "nl-ind-intl-students": ["o", "Immigration and Naturalisation Service (IND)", "n.d.", "International students and the IND", "https://ind.nl/en/about-us/background-articles/international-students-and-the-ind"],
    "nl-business-twv": ["o", "Business.gov.nl", "n.d.", "Work permit (TWV)", "https://business.gov.nl/regulations/work-permit-employees/"],
    "nl-nw-mvv": ["o", "NetherlandsWorldwide", "n.d.", "Applying for an MVV visa sticker for the Netherlands: choose your country", "https://www.netherlandsworldwide.nl/visa-the-netherlands/mvv-long-stay"],
    "nl-rug-fee": ["o", "University of Groningen", "2026", "Application procedure: MVV and residence permit", "https://www.rug.nl/education/application-enrolment-tuition-fees/admission/procedures/application-informatie/visa-immigration/application-procedure-mvv-and-residence-permit?lang=en"],
    "nl-studypath": ["s", "StudyPath", "2026", "Dutch MVV visa guide 2026", "https://studypath.nl/guides/mvv-visa"],

    // Spain
    "es-sheet1": ["o", "Ministerio de Inclusión, Seguridad Social y Migraciones", "n.d.", "Hoja 1: Autorización de estancia de larga duración para estudios superiores", "https://www.inclusion.gob.es/en/web/migraciones/w/estancia-por-estudios"],
    "es-sheet4bis": ["o", "Ministerio de Inclusión, Seguridad Social y Migraciones", "n.d.", "Hoja 4 bis: Acceso al empleo de titulares de una autorización de estancia por estudios", "https://www.inclusion.gob.es/en/web/migraciones/w/hoja-4-bis-acceso-al-empleo-de-las-personas-titulares-de-una-autorizacion-de-estancia-de-larga-duracion-por-estudios-movilidad-de-alumnos-servicios-de-voluntariado-o-actividades-formativas"],
    "es-sheet20": ["o", "Ministerio de Inclusión, Seguridad Social y Migraciones", "n.d.", "Hoja 20: Autorización de residencia para búsqueda de empleo o inicio de proyecto empresarial", "https://www.inclusion.gob.es/en/web/migraciones/w/20.-autorizacion-de-residencia-para-busqueda-de-empleo-o-inicio-de-proyecto-empresarial"],
    "es-guide": ["o", "Ministerio de Inclusión, Seguridad Social y Migraciones", "2025", "Guía de visado y autorización de estancia de larga duración (estudiantes)", "https://www.inclusion.gob.es/documents/410169/6828741/Gu%C3%ADa+Estudiantes.pdf/b6a0c88d-c689-6ce4-9888-6f198b32f513?t=1752143214552"],
    "es-rd": ["o", "Boletín Oficial del Estado", "2024", "Real Decreto 1155/2024 (Reglamento de Extranjería)", "https://www.boe.es/buscar/act.php?id=BOE-A-2024-24099"],
    "es-iprem-2026": ["o", "Consulado General de España en Los Ángeles", "2026", "IPREM 2026: 600,00 € al mes", "https://www.exteriores.gob.es/Consulados/losangeles/en/ServiciosConsulares/Documents/IPREM.pdf"],
    "es-consulate-req": ["o", "Consulado General de España en Casablanca", "n.d.", "Requisitos visado de estudios", "https://www.exteriores.gob.es/Consulados/casablanca/es/Consulado/PublishingImages/Paginas/Visados/REQUISITOS%20VISADO%20ESTUDIOS.pdf"],
    "es-santiago": ["o", "Consulado General de España en Santiago de Chile", "n.d.", "Visados nacionales: visado de estudios", "https://www.exteriores.gob.es/Consulados/santiagodechile/es/ServiciosConsulares/Paginas/index.aspx?scca=Visados&scco=Chile&scd=260&scs=Visados+Nacionales+-+Visado+de+estudios"],
    "es-chile-fees": ["o", "Consulado General de España en Santiago de Chile", "2026", "Listado de tasas consulares (a partir del 1 de enero de 2026)", "https://www.exteriores.gob.es/DocumentosAuxiliaresSC/Chile/SANTIAGO%20DE%20CHILE%20(C)/TASAS%20CONSULARES.pdf"],
    "es-ankara": ["o", "Embajada de España en Ankara", "n.d.", "Visados nacionales: visado de estudios", "https://www.exteriores.gob.es/Embajadas/ankara/es/ServiciosConsulares/Paginas/index.aspx?scca=Visados&scco=Turqu%C3%ADa&scd=12&scs=Visados+Nacionales+-+Visado+de+estudios"],

    // Italy
    "it-cons-ba-2026": ["o", "Consolato Generale d'Italia a Buenos Aires", "2026", "Studenti internazionali: nuove indicazioni su visto e immatricolazione per gli anni accademici 2026/2027 e 2027/2028", "https://consbuenosaires.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/studenti-internazionali-nuove-indicazioni-su-visto-e-immatricolazione-per-gli-anni-accademici-2026-2027-e-2027-2028/"],
    "it-tunis-2026": ["o", "Ambasciata d'Italia a Tunisi", "2026, June", "Iscriversi alle università italiane a.a. 2026/2027: condizioni per la concessione del visto per studio", "https://ambtunisi.esteri.it/it/news/dall_ambasciata/2026/06/iscriversi-alle-universita-italiane-a-a-2026-2027-condizioni-per-la-concessione-del-visto-per-studio-immatricolazione-universitaria/"],
    "it-universitaly": ["o", "Universitaly (Ministry of University and Research)", "n.d.", "Studenti stranieri", "https://www.universitaly.it/it/studenti-stranieri"],
    "it-work": ["o", "Integrazione Migranti (Ministry of Labour)", "n.d.", "È possibile lavorare con un permesso per motivi di studio?", "https://integrazionemigranti.gov.it/it-it/Ricerca-news/Dettaglio-news/id/3085/-possibile-lavorare-con-un-permesso-per-motivi-di-studio-E-svolgere-un-tirocinio"],
    "it-study-norm": ["o", "Integrazione Migranti (Ministry of Labour)", "n.d.", "Studio (norme)", "https://www.integrazionemigranti.gov.it/it-it/Ricerca-norme/Dettaglio-norma/id/14/Studio"],
    "it-prefettura-conv": ["o", "Prefettura (Ministry of the Interior)", "2024", "Vademecum: conversioni dei permessi di soggiorno", "https://prefettura.interno.gov.it/sites/default/files/31/2024-01/vademecum_conversioni_dei_permessi_di_soggiorno.pdf"],
    "it-polizia-costs": ["o", "Polizia di Stato", "n.d.", "Come, dove e quanto costa (permesso di soggiorno)", "https://www.poliziadistato.it/articolo/come-dove-e-quanto-costa"],
    "it-portale-costs": ["o", "Portale Immigrazione", "n.d.", "Tabelle costi", "https://www.portaleimmigrazione.it/ITA/tabelleCosti.html"],
    "it-interno-visa": ["o", "Ministero dell'Interno", "n.d.", "Visto e permesso di soggiorno", "https://www.interno.gov.it/it/temi/immigrazione-e-asilo/modalita-dingresso/visto-e-permesso-soggiorno"],
    "it-ssn-700": ["o", "Integrazione Migranti (Ministry of Labour)", "n.d.", "DDL Bilancio: aumenta il contributo per l'iscrizione volontaria al SSN", "https://integrazionemigranti.gov.it/it-it/Ricerca-news/Dettaglio-news/id/3457/DDl-Bilancio-aumenta-il-contributo-per-liscrizione-volontaria-al-SSN"],
    "it-salute": ["o", "Ministero della Salute", "n.d.", "Assistenza ai cittadini dei Paesi extra UE in Italia", "https://www.salute.gov.it/new/it/tema/assistenza-sanitaria-paesi-extra-ue/assistenza-ai-cittadini-dei-paesi-extra-ue-italia/"],
    "it-visto": ["o", "Ministero degli Affari Esteri", "n.d.", "Visa for Italy", "https://vistoperitalia.esteri.it/"],
    "it-hanoi-visa": ["o", "Ambasciata d'Italia ad Hanoi", "n.d.", "Pre-enrollments and student visas", "https://ambhanoi.esteri.it/en/italia-e-vietnam/diplomazia-culturale/studiare-in-italia/pre-enrollments-and-student-visas/"],
    "it-brasilia-visa": ["o", "Ambasciata d'Italia a Brasilia", "n.d.", "Tipos de vistos de longa duração (tipo D)", "https://ambbrasilia.esteri.it/pt/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/visto-di-lunga-durata-tipo-d/tipi-di-visto-di-lunga-durata-tipo-d/"],
    "it-iran-2026": ["o", "Ambasciata d'Italia a Mascate", "2026, May", "Visa application for Iranian citizens", "https://ambmascate.esteri.it/en/news/dall_ambasciata/2026/05/visa-application-for-iranian-citizens/"],
    "it-connectsaqib": ["s", "ConnectSaqib", "2026, June 2", "Italy increases student visa financial requirement to €10,179.85", "https://connectsaqib.com/2026/06/02/italy-increases-student-visa-financial-requirement-to-e10179-85-what-international-students-need-to-know-in-2026/"],

    // Ireland
    "ie-visa-list": ["o", "Immigration Service Delivery", "n.d.", "Visa & non-visa required nationalities", "https://www.irishimmigration.ie/visa-non-visa-required-nationalities/"],
    "ie-visa-offices": ["o", "Immigration Service Delivery", "n.d.", "Visa offices", "https://www.irishimmigration.ie/visa-offices/"],
    "ie-longterm-visa": ["o", "Immigration Service Delivery", "n.d.", "How to apply for a long-term study visa", "https://www.irishimmigration.ie/coming-to-study-in-ireland/what-are-my-study-visa-options/how-to-apply-for-long-term-study-visa/"],
    "ie-finances": ["o", "Immigration Service Delivery", "n.d.", "Information on student finances", "https://www.irishimmigration.ie/coming-to-study-in-ireland/what-are-my-study-options/a-fee-paying-private-primary-or-secondary-school/information-on-student-finances/"],
    "ie-finance-2025": ["o", "Immigration Service Delivery", "2025", "Reminder on student finance requirements from 30 June 2025", "https://www.irishimmigration.ie/reminder-on-student-finance-requirements-from-30-june-2025/"],
    "ie-insurance": ["o", "Immigration Service Delivery", "n.d.", "Private medical insurance", "https://www.irishimmigration.ie/coming-to-study-in-ireland/what-are-my-study-options/a-fee-paying-private-primary-or-secondary-school/private-medical-insurance/"],
    "ie-student-perm": ["o", "Immigration Service Delivery", "n.d.", "Student permission", "https://www.irishimmigration.ie/my-situation-has-changed-since-i-arrived-in-ireland/student-permission/"],
    "ie-ilep": ["o", "Immigration Service Delivery", "n.d.", "Interim List of Eligible Programmes (ILEP)", "https://www.irishimmigration.ie/coming-to-study-in-ireland/what-are-my-study-options/interim-list-of-eligible-programmes-ilep/"],
    "ie-trusted": ["o", "Immigration Service Delivery", "2026, February", "Policy statement: TrustEd Ireland and immigration requirements", "https://www.irishimmigration.ie/wp-content/uploads/2026/02/Policy-Statement-TrustEd-Ireland-and-Immigration-Requirements.pdf"],
    "ie-1g": ["o", "Immigration Service Delivery", "n.d.", "Third level graduate programme", "https://www.irishimmigration.ie/my-situation-has-changed-since-i-arrived-in-ireland/third-level-graduate-programme/"],
    "ie-fees": ["o", "Immigration Service Delivery", "n.d.", "Preclearance and entry visa fees", "https://www.irishimmigration.ie/preclearance-and-entry-visas-fees/"],
    "ie-register": ["o", "Immigration Service Delivery", "n.d.", "Registering your immigration permission for the first time", "https://www.irishimmigration.ie/registering-your-immigration-permission/how-to-register-your-immigration-permission-for-the-first-time/information-on-registering-your-immigration-permission-for-the-first-time/"],
    "ie-bq": ["o", "Immigration Service Delivery", "n.d.", "Burgh Quay appointments", "https://www.irishimmigration.ie/burgh-quay-appointments/"],
    "ie-za": ["o", "Immigration Service Delivery", "2024", "Visa requirement for nationals of Botswana and South Africa", "https://www.irishimmigration.ie/visa-requirement-for-nationals-of-botswana-and-south-africa/"],
    "ie-ukr": ["o", "Immigration Service Delivery", "n.d.", "FAQs for Ukraine nationals and residents of Ukraine", "https://www.irishimmigration.ie/faqs-for-ukraine-nationals-and-residents-of-ukraine/"],
    "ie-cta": ["o", "Department of Foreign Affairs (gov.ie)", "n.d.", "The Common Travel Area", "https://www.gov.ie/en/department-of-foreign-affairs/publications/the-common-travel-area/"],
    "cy-visa": ["o", "Ministry of Foreign Affairs of Cyprus (Gov.cy)", "n.d.", "Categories of persons and countries whose nationals do not require a visa", "https://www.gov.cy/mfa/en/documents/categories-of-persons-and-countries-whose-nationals-do-not-require-a-visa/"],
    "ie-ssvwp": ["o", "Immigration Service Delivery", "n.d.", "Short stay visa waiver programme", "https://www.irishimmigration.ie/coming-to-visit-ireland/short-stay-visa-waiver-programme/"],

    // Poland
    "pl-funds": ["o", "Wielkopolski Urząd Wojewódzki (Department for Foreigners)", "n.d.", "Sufficient financial resources for a student", "https://migrant.poznan.uw.gov.pl/en/slownik-pojec/sufficient-financial-resources-student"],
    "pl-uw-funds": ["o", "University of Warsaw", "n.d.", "Step 2: Proof of sufficient financial resources", "https://welcome.uw.edu.pl/4-steps-to-legalise-your-stay-step-2-proof-of-sufficient-financial-resources/"],
    "pl-visa-fee-2026": ["o", "Embassy of Poland in Israel (Gov.pl)", "2025", "New consular fees from January 1, 2026: what is changing?", "https://www.gov.pl/web/israel/new-consular-fees-from-january-1-2026--what-is-changing"],
    "pl-visa-fee-2024": ["o", "Ministry of Foreign Affairs of Poland", "2024", "Increase in national visa fees", "https://www.gov.pl/web/diplomacy/increase-in-national-visa-fees"],
    "pl-udsc-fees": ["o", "Office for Foreigners (UdSC)", "n.d.", "Information on stamp duty and residence card issuance fees", "https://www.gov.pl/web/udsc-en/information-on-stamp-duty-and-residence-card-issuance-fees"],
    "pl-mos-studies": ["o", "MOS (Office for Foreigners)", "n.d.", "Temporary residence permit for the purpose of studies", "https://mos.cudzoziemcy.gov.pl/en/informacje/na-studia_EN"],
    "pl-mos-only": ["o", "Mazowiecki Urząd Wojewódzki (Migrant WSC)", "n.d.", "Applications for temporary residence only via MOS", "https://en.migrant.wsc.mazowieckie.pl/pl/messages/change-in-the-method-of-submitting-applications-for-temporary-permanent-residence-and-long-term-residence"],
    "pl-work": ["o", "Office for Foreigners (UdSC)", "n.d.", "Work: student", "https://www.gov.pl/web/udsc-en/work-student"],
    "pl-graduate": ["o", "Office for Foreigners (UdSC)", "n.d.", "Permit for temporary residence: graduate", "https://www.gov.pl/web/udsc-en/permit-for-temporary-residence--graduate"],
    "pl-b2": ["o", "Ministry of Science and Higher Education", "2025, July 31", "Regulation of 30 July 2025 on documents certifying knowledge of the language of instruction", "https://www.gov.pl/web/nauka/rozporzadzenie-ministra-nauki-i-szkolnictwa-wyzszego-z-dnia-30-lipca-2025-r-w-sprawie-rodzajow-dokumentow-poswiadczajacych-znajomosc-jezyka-w-ktorym-odbywa-sie-ksztalcenie-na-studiach-zostalo-ogloszone-w-dniu-31-lipca-2025-r-w-dzienniku-ustaw-rzeczypospolitej-polskiej-pod-poz-1045"],
    "pl-study-gov": ["o", "Study in Poland (NAWA)", "n.d.", "Visa and application", "https://study.gov.pl/visa-application"],
    "pl-iran-visa": ["o", "Embassy of Poland in Iran (Gov.pl)", "n.d.", "D-type national visa", "https://www.gov.pl/web/iran-en/d-type-national-visa"],
    "pl-notes": ["s", "Notes from Poland", "2025, June 2", "Poland introduces tougher new rules for foreign students and economic migrants", "https://notesfrompoland.com/2025/06/02/poland-introduces-tougher-new-rules-for-foreign-students-and-economic-migrants/"],

    // Sweden
    "se-mv-apply": ["o", "Swedish Migration Agency", "2026", "Apply for a residence permit for studies at higher education", "https://www.migrationsverket.se/en/you-want-to-apply/study/higher-education.html"],
    "se-mv-rules": ["o", "Swedish Migration Agency", "2026, May 25", "New rules for residence permits for studies in higher education", "https://www.migrationsverket.se/nyheter/news-archive/2026-05-25-new-rules-for-residence-permits-for-studies-in-higher-education.html"],
    "se-sis-rules": ["o", "Study in Sweden (Swedish Institute)", "2026", "New rules for residence permits for studies", "https://studyinsweden.se/news/new-rules-for-residence-permits-for-studies/"],
    "se-mv-jobseek": ["o", "Swedish Migration Agency", "n.d.", "Apply for a residence permit to seek employment after completing your studies in Sweden", "https://www.migrationsverket.se/en/you-want-to-extend/study/look-for-work-after-completing-your-studies-in-sweden.html"],
    "se-ua-fee": ["o", "University Admissions in Sweden", "n.d.", "Pay your application fee", "https://www.universityadmissions.se/en/fees-scholarships-residence-permit/pay-your-application-fee/"],
    "se-ua-dates": ["o", "University Admissions in Sweden", "n.d.", "Key dates and deadlines", "https://www.universityadmissions.se/en/key-dates-and-deadlines/"],
    "se-mdu": ["o", "Mälardalen University", "2026", "Useful information for new students (maintenance requirement)", "https://www.mdu.se/en/malardalen-university/student/new-student/new-in-sweden/useful-information"],
    "se-kau": ["o", "Karlstad University", "2026", "Living costs", "https://www.kau.se/en/education/study-us/living-sweden/living-costs"],

    // Basic guides (national authorities)
    "b-aut": ["o", "Austrian Federal Government (migration.gv.at)", "n.d.", "Study in Austria", "https://www.migration.gv.at/en/living-and-working-in-austria/study-in-austria/"],
    "b-bel": ["o", "Immigration Office (IBZ)", "n.d.", "Immigration Office", "https://dofi.ibz.be/en"],
    "b-bgr": ["o", "Ministry of Foreign Affairs of Bulgaria", "n.d.", "Studying in Bulgaria", "https://www.mfa.bg/en/155"],
    "b-hrv": ["o", "Ministry of the Interior of Croatia", "n.d.", "Biometric residence permit", "https://mup.gov.hr/aliens-281621/stay-and-work/biometric-residence-permit/281683"],
    "b-cyp": ["o", "Migration Department (Gov.cy)", "n.d.", "Students", "https://www.gov.cy/mip-md/en/documents/students/"],
    "b-cze": ["o", "Ministry of the Interior of the Czech Republic", "n.d.", "Information for schools and students", "https://www.mvcr.cz/mvcren/article/information-for-schools-and-students.aspx"],
    "b-dnk": ["o", "New to Denmark (SIRI)", "n.d.", "Higher education", "https://www.nyidanmark.dk/en-GB/You-want-to-apply/Study/Higher-Education"],
    "b-est": ["o", "Police and Border Guard Board", "n.d.", "Residence permit for study", "https://www.politsei.ee/en/instructions/residence-permit-for-study"],
    "b-fin": ["o", "Finnish Immigration Service (Migri)", "n.d.", "Studying in Finland", "https://migri.fi/en/studying-in-finland"],
    "b-grc": ["o", "Ministry of Migration and Asylum", "n.d.", "Categories of residence permits for third-country nationals", "https://migration.gov.gr/en/migration-policy/metanasteusi-stin-ellada/katigories-adeion-diamonis-politon-triton-choron-dikaiologitika%E2%80%8B/"],
    "b-hun": ["o", "National Directorate-General for Aliens Policing", "n.d.", "Residence of the student, pupil", "https://oif.gov.hu/factsheets/residence-of-the-student-pupil"],
    "b-lva": ["o", "Office of Citizenship and Migration Affairs", "n.d.", "Studies", "https://www.pmlp.gov.lv/en/studies"],
    "b-ltu": ["o", "Migration Department of Lithuania", "n.d.", "I'm a student", "https://www.migracija.lt/en/esu-studentas1"],
    "b-lux": ["o", "Guichet.lu", "n.d.", "Conditions for residence in Luxembourg for students from third countries", "https://guichet.public.lu/en/citoyens/immigration/plus-3-mois/ressortissant-tiers/etudiant/etudiant-pays-tiers.html"],
    "b-mlt": ["o", "Identità", "n.d.", "Non-employment permits: study, research, trainees, volunteers & interns", "https://identita.gov.mt/expatriates-unit-main-page/noneu-nationals/non-employment-permits/study-research-trainees-volunteers-interns/"],
    "b-prt": ["o", "Ministério dos Negócios Estrangeiros (Portugal)", "n.d.", "National visas: type of visa", "https://vistos.mne.gov.pt/en/national-visas/general-information/type-of-visa"],
    "b-rou": ["o", "General Inspectorate for Immigration", "n.d.", "Studies", "https://igi.mai.gov.ro/en/studies/"],
    "b-svk": ["o", "Ministry of the Interior of the Slovak Republic", "n.d.", "Residence of a foreigner", "https://www.minv.sk/?residence-of-an-foreigner="],
    "b-svn": ["o", "InfoTujci (Government of Slovenia)", "n.d.", "Temporary residence permit", "https://infotujci.si/en/third-country-nationals/temporary-residence-permit/"]
  };

  var SOURCES = {};
  Object.keys(S).forEach(function (k) {
    var a = S[k];
    SOURCES[k] = { type: a[0] === "o" ? "official" : "secondary", pub: a[1], date: a[2], title: a[3], url: a[4] };
  });

  return {
    VERIFIED: VERIFIED, FX: FX, ORIGINS: ORIGINS, APS: APS, ORIGIN_EMB: ORIGIN_EMB, ADVICE: ADVICE, ADVICE_LABEL: ADVICE_LABEL,
    DEST: DEST, BASIC: BASIC, SHORT: SHORT, CHANGES: CHANGES, SOURCES: SOURCES
  };
})();
