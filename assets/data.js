/*
 * ClearEntry rulebook
 * ------------------------------------------------------------------
 * Every rule the checker shows lives in this file. Each fact carries:
 *   conf  - how well we could confirm it:
 *           "official" = confirmed on an official government/EU source
 *           "multi"    = confirmed by two or more independent secondary sources
 *           "check"    = single/older source or sources disagree: verify before acting
 *   src   - ids of entries in SOURCES (bottom of file), shown as links in the app
 * Update VERIFIED when you re-check a country, and add a CHANGES entry for every rule change.
 */
window.CE_DATA = (function () {
  "use strict";

  var VERIFIED = "2026-09-24";

  // Approximate rates used only to compare SEK / PLN amounts in euros.
  var FX = { SEK: 11.0, PLN: 4.25, asOf: "September 2026 (approx.)" };

  /* ----------------------------------------------------------------
   * ORIGINS (passports). Codes are ICAO 3-letter codes, as printed in
   * the machine-readable zone of a passport.
   * -------------------------------------------------------------- */
  var ORIGINS = [
    { code: "IND", name: "India", adj: "Indian", group: "Launch markets",
      schengenVisa: true, irelandVisa: true, eef: true, aps: "IND", de41: false, mvvExempt: false,
      refusal: "15.8% of Schengen short-stay applications refused in 2025",
      cascade: "Visa \"cascade\": after two Schengen visas used lawfully in the last 3 years, Indian residents can get a 2-year multiple-entry visa, then up to 5 years." },
    { code: "CHN", name: "China", adj: "Chinese", group: "Launch markets",
      schengenVisa: true, irelandVisa: true, eef: true, aps: "CHN", de41: false, mvvExempt: false,
      refusal: "4.1% of Schengen short-stay applications refused in 2025",
      cascade: null },
    { code: "USA", name: "United States", adj: "US", group: "Launch markets",
      schengenVisa: false, irelandVisa: false, eef: true, aps: null, de41: "full", mvvExempt: true,
      refusal: null, cascade: null },
    { code: "CAN", name: "Canada", adj: "Canadian", group: "Launch markets",
      schengenVisa: false, irelandVisa: false, eef: true, aps: null, de41: "full", mvvExempt: true,
      refusal: null, cascade: null },
    { code: "ARE", name: "United Arab Emirates", adj: "Emirati", group: "Gulf states (GCC)",
      schengenVisa: false, irelandVisa: false, eef: true, aps: null, de41: false, mvvExempt: false,
      refusal: null, cascade: null,
      note: "UAE citizens have been visa-free for Schengen short stays since 2015. Long stays still need a national visa or permit." },
    { code: "SAU", name: "Saudi Arabia", adj: "Saudi", group: "Gulf states (GCC)",
      schengenVisa: true, irelandVisa: true, eef: true, aps: null, de41: false, mvvExempt: false,
      refusal: null,
      cascade: "Since April 2024, first-time applicants who live in and apply from Saudi Arabia can be issued a 5-year multiple-entry Schengen visa (at the consulate's discretion)." },
    { code: "QAT", name: "Qatar", adj: "Qatari", group: "Gulf states (GCC)",
      schengenVisa: true, irelandVisa: true, eef: true, aps: null, de41: false, mvvExempt: false,
      refusal: null,
      cascade: "The EU proposed visa-free travel for Qatari citizens in 2022, but it is still not in force. Do not assume visa-free access.",
      note: "Watch this space: if the visa exemption is adopted, Qatari citizens would move to the visa-free (and later ETIAS) route for short stays." },
    { code: "KWT", name: "Kuwait", adj: "Kuwaiti", group: "Gulf states (GCC)",
      schengenVisa: true, irelandVisa: true, eef: true, aps: null, de41: false, mvvExempt: false,
      refusal: null,
      cascade: "Kuwait has its own Schengen visa cascade (longer multiple-entry visas after good travel history). The 2022 visa-exemption proposal is still pending.",
      note: "Watch this space: a visa exemption for Kuwait has been proposed but not adopted." },
    { code: "BHR", name: "Bahrain", adj: "Bahraini", group: "Gulf states (GCC)",
      schengenVisa: true, irelandVisa: true, eef: true, aps: null, de41: false, mvvExempt: false,
      refusal: null,
      cascade: "Since April 2024, first-time applicants who live in and apply from Bahrain can be issued a 5-year multiple-entry Schengen visa (at the consulate's discretion)." },
    { code: "OMN", name: "Oman", adj: "Omani", group: "Gulf states (GCC)",
      schengenVisa: true, irelandVisa: true, eef: false, aps: null, de41: false, mvvExempt: false,
      refusal: null,
      cascade: "Since April 2024, first-time applicants who live in and apply from Oman can be issued a 5-year multiple-entry Schengen visa (at the consulate's discretion)." },
    { code: "GBR", name: "United Kingdom", adj: "British", group: "Other key markets",
      schengenVisa: false, irelandVisa: false, cta: true, eef: true, aps: null, de41: "full", mvvExempt: true,
      refusal: null, cascade: null,
      note: "Since Brexit, British citizens need a national visa or permit to study in every EU country except Ireland." },
    { code: "AUS", name: "Australia", adj: "Australian", group: "Other key markets",
      schengenVisa: false, irelandVisa: false, eef: false, aps: null, de41: "full", mvvExempt: true,
      refusal: null, cascade: null },
    { code: "BRA", name: "Brazil", adj: "Brazilian", group: "Other key markets",
      schengenVisa: false, irelandVisa: false, eef: true, aps: null, de41: "noWork", mvvExempt: false,
      refusal: null, cascade: null },
    { code: "NGA", name: "Nigeria", adj: "Nigerian", group: "Other key markets",
      schengenVisa: true, irelandVisa: true, eef: true, aps: null, de41: false, mvvExempt: false,
      refusal: "Close to 48% of Schengen short-stay applications refused in 2025",
      cascade: null },
    { code: "PAK", name: "Pakistan", adj: "Pakistani", group: "Other key markets",
      schengenVisa: true, irelandVisa: true, eef: true, aps: null, de41: false, mvvExempt: false,
      refusal: null, cascade: null },
    { code: "TUR", name: "Türkiye", adj: "Turkish", group: "Other key markets",
      schengenVisa: true, irelandVisa: true, eef: true, aps: null, de41: false, mvvExempt: false,
      refusal: "14.6% of Schengen short-stay applications refused in 2025",
      cascade: "Türkiye has its own Schengen visa cascade (longer multiple-entry visas after good travel history)." },
    { code: "MAR", name: "Morocco", adj: "Moroccan", group: "Other key markets",
      schengenVisa: true, irelandVisa: true, eef: true, aps: null, de41: false, mvvExempt: false,
      refusal: null, cascade: null },
    { code: "VNM", name: "Vietnam", adj: "Vietnamese", group: "Other key markets",
      schengenVisa: true, irelandVisa: true, eef: true, aps: "VNM", de41: false, mvvExempt: false,
      refusal: null, cascade: null }
  ];

  var APS = {
    IND: { label: "APS India", url: "https://www.aps-india.de" },
    CHN: { label: "APS China", url: "https://www.aps.org.cn" },
    VNM: { label: "German Embassy Hanoi (APS Vietnam)", url: "https://vietnam.diplo.de" }
  };

  /* ----------------------------------------------------------------
   * FULL GUIDES: eight launch destinations (study > 90 days).
   * Text fields may be functions of the origin object `o`.
   * -------------------------------------------------------------- */
  var DEST = {};

  DEST.FRA = {
    code: "FRA", name: "France", schengen: true, full: true,
    permit: "VLS-TS \"étudiant\" (long-stay visa that works as a residence permit)",
    visaBefore: function () { return true; },
    headline: function () { return "Get a long-stay student visa (VLS-TS) before you travel, then validate it online within 3 months."; },
    fundsEURmonth: 877.5, fundsYearEUR: 10530,
    funds: { short: "€877.50/month", text: "€877.50 a month (€10,530 a year)", note: "For applications made from 1 August 2026 (was €615). Set at 47% of the gross minimum wage, so it rises when the minimum wage rises.", conf: "multi", src: ["infomigrants2026", "fr-decree-analysis"] },
    fees: [
      { label: "Long-stay student visa", eur: 50, conf: "check" },
      { label: "VLS-TS validation tax (online, after arrival)", eur: 50, conf: "check" },
      { label: "Campus France / Études en France fee", eur: null, note: "Set per country", conf: "check", when: function (o) { return o.eef; } },
      { label: "CVEC student life contribution", eur: 105, note: "2025/26 rate", conf: "multi" }
    ],
    tuition: { text: "Public universities, 2026/27, non-EU students: €2,895 a year (bachelor) and €3,941 a year (master). Exemptions are capped at 30% of affected students. Business schools and grandes écoles set their own fees.", conf: "official", src: ["mesr-fees"], low: 2895, high: 3941 },
    work: { short: "964 h/year", text: "Up to 964 hours a year (about 60% of full-time), no separate permit.", conf: "multi" },
    post: { short: "12 months", text: "Master's graduates (and some other diplomas) can get a 12-month permit to look for work or start a business.", conf: "multi" },
    processing: "Consulates usually decide within 2–3 weeks of the appointment. The Études en France stage adds several weeks, so start 6–9 months ahead.",
    insurance: "Register with French social security on etudiant-etranger.ameli.fr. Basic cover is free for students; a top-up (mutuelle) is optional.",
    steps: [
      { when: "6–9 months before", title: function (o) { return o.eef ? "Apply through Études en France (Campus France)" : "Apply to your programme"; },
        body: function (o) { return o.eef
          ? o.name + " is one of the 73 countries that use the Études en France platform. You apply to most public programmes through it, pay the Campus France fee for your country and usually have an interview. If a private school admits you directly, you still complete the Études en France step before the visa."
          : o.name + " is not on the Études en France list, so you apply directly to the institution and go straight to the visa step once you are admitted."; } },
      { when: "3 months before, at the latest", title: "Apply for the long-stay student visa",
        body: "Create the application on France-Visas and book an appointment at the visa centre for your area to give fingerprints and a photo. Bring the admission letter, proof of funds (€877.50 a month), proof of accommodation for at least the first three months, and your passport." },
      { when: "Within 3 months of arrival", title: "Validate your visa online (ANEF)",
        body: "The VLS-TS only works as a residence permit once you validate it on the ANEF website and pay the tax online. Keep the confirmation. Without it you are not legally resident after three months." },
      { when: "First weeks", title: "Pay the CVEC and register for health cover",
        body: "Pay the student life contribution (CVEC) before you enrol at a public institution, then register with French social security on etudiant-etranger.ameli.fr." },
      { when: "2–4 months before the visa expires", title: "Renew online",
        body: "Apply on ANEF for a multi-year student residence card. Missing this window means losing the right to stay." }
    ],
    docs: [
      { label: "Passport valid for your whole stay, plus copies" },
      { label: "Admission letter from the French institution" },
      { label: "Études en France / Campus France confirmation", when: function (o) { return o.eef; } },
      { label: "Proof of funds: €877.50 a month (bank statements, scholarship or sponsor letter)" },
      { label: "Proof of accommodation for at least the first 3 months" },
      { label: "Recent passport photos" },
      { label: "France-Visas application receipt" },
      { label: "Birth certificate with certified translation (asked for later by ANEF and social security)" }
    ],
    watch: [
      "Funds rose from €615 to €877.50 a month on 1 August 2026. Older guides and some agents still quote €615.",
      "Non-EU fees at public universities rise to €2,895 (bachelor) and €3,941 (master) for 2026/27.",
      "Visa centres are busiest June–August. Book your appointment as soon as you are admitted."
    ],
    links: [
      { label: "Campus France: Études en France procedure", url: "https://www.campusfrance.org/en/application-etudes-en-france-procedure" },
      { label: "France-Visas (official visa website)", url: "https://france-visas.gouv.fr" },
      { label: "ANEF: validate or renew your permit", url: "https://administration-etrangers-en-france.interieur.gouv.fr" },
      { label: "CVEC payment", url: "https://cvec.etudiant.gouv.fr" },
      { label: "Health cover for international students (Ameli)", url: "https://etudiant-etranger.ameli.fr" },
      { label: "EU Immigration Portal: student in France", url: "https://home-affairs.ec.europa.eu/policies/migration-and-asylum/eu-immigration-portal/student-france_en" }
    ],
    src: ["infomigrants2026", "mesr-fees", "campusfrance-eef"]
  };

  DEST.DEU = {
    code: "DEU", name: "Germany", schengen: true, full: true,
    permit: "National (D) visa for study, then a residence permit under §16b Residence Act",
    visaBefore: function (o) { return o.de41 !== "full"; },
    headline: function (o) {
      if (o.de41 === "full") return "You can enter visa-free and apply for your student residence permit in Germany, or get a visa first.";
      if (o.de41 === "noWork") return "Get a national (D) study visa before you travel. Visa-free entry only works if you will not work.";
      return "Get a national (D) study visa before you travel, then a residence permit from the local foreigners office.";
    },
    fundsEURmonth: 992, fundsYearEUR: 11904,
    funds: { short: "€992/month", text: "€992 a month (€11,904 a year), usually in a blocked account", note: "Set each year in line with the BAföG student grant. A scholarship or a formal obligation letter (Verpflichtungserklärung) can replace the blocked account.", conf: "multi", src: ["de-blocked", "de-blocked-2"] },
    fees: [
      { label: "National (D) visa", eur: 75, conf: "multi", when: function (o) { return o.de41 !== "full"; } },
      { label: "Residence permit (foreigners office)", eur: 100, note: "Up to", conf: "check" },
      { label: "Semester contribution", eur: null, note: "About €100–€400 per semester", conf: "check" }
    ],
    tuition: { text: "Most public universities charge no tuition, only the semester contribution. Exceptions: Baden-Württemberg (€1,500 a semester for non-EU students) and a few universities such as TUM.", conf: "check", low: 0, high: 3000 },
    work: { short: "140 days/yr", text: "140 full days or 280 half days a year, no separate permit. Student-assistant jobs at the university are extra.", conf: "multi" },
    post: { short: "18 months", text: "Up to 18 months job-search residence permit after graduating (§20 Residence Act). You may work in any job meanwhile.", conf: "multi" },
    processing: "Allow 6–12 weeks from appointment to decision. Appointment waits can add more in high-demand countries.",
    insurance: "Travel health insurance until you enrol, then statutory student health insurance (about €140 a month if you are under 30) or approved private cover.",
    steps: [
      { when: "9–12 months before", title: "Get your APS certificate", if: function (o) { return !!o.aps; },
        body: function (o) { return "Germany requires " + o.adj + " applicants to have their academic documents checked by the Academic Evaluation Centre (APS) before university admission and the visa. It takes weeks, so do it first."; } },
      { when: "6–9 months before", title: "Get admitted",
        body: "Apply directly or through uni-assist, depending on the university. Keep the admission letter (Zulassungsbescheid)." },
      { when: "3–4 months before", title: "Open a blocked account (or other funds proof)",
        body: "Deposit €11,904 with an approved blocked-account provider. You can then withdraw €992 a month in Germany." },
      { when: "3–4 months before", title: "Apply for the national (D) study visa", if: function (o) { return o.de41 !== "full"; },
        body: function (o) { return (o.de41 === "noWork" ? "Brazilian citizens can enter visa-free and apply in Germany only if they will not work. Most students take part-time jobs, so the study visa is the safer route. " : "") +
          "Apply through the Federal Foreign Office's Consular Services Portal and book an appointment at the German mission or its visa centre. Book as soon as you have the admission letter."; } },
      { when: "Before you travel", title: "Decide: visa first, or apply in Germany", if: function (o) { return o.de41 === "full"; },
        body: function (o) { return "As a " + o.adj + " citizen you can enter visa-free and apply for the student residence permit at the local foreigners office (Ausländerbehörde) within 90 days. Book that appointment early, as some cities have long waits. Do not start working until the permit is issued. You can still apply for a visa before you travel if you want certainty."; } },
      { when: "Before you travel", title: "Buy health insurance",
        body: "Travel health insurance until you enrol, then statutory or approved private student insurance." },
      { when: "Within 14 days of moving in", title: "Register your address (Anmeldung)",
        body: "Register at the local citizens' office (Bürgeramt) with your landlord's confirmation (Wohnungsgeberbestätigung)." },
      { when: "Before the visa expires (or within 90 days)", title: "Get your residence permit",
        body: "Apply at the foreigners office with your enrolment certificate, insurance, funds proof and address registration." }
    ],
    docs: [
      { label: "Passport, plus copies" },
      { label: "Admission letter (Zulassungsbescheid)" },
      { label: "APS certificate", when: function (o) { return !!o.aps; } },
      { label: "Blocked account confirmation (€11,904) or scholarship / obligation letter" },
      { label: "Health insurance confirmation" },
      { label: "Certificates and transcripts" },
      { label: "Language certificate (German or English, as the programme requires)" },
      { label: "Visa application from the Consular Services Portal", when: function (o) { return o.de41 !== "full"; } },
      { label: "CV and motivation letter (often requested)" }
    ],
    watch: [
      "The blocked-account amount is set every year. Check it on the Federal Foreign Office site before you deposit.",
      "Baden-Württemberg charges non-EU students €1,500 a semester; TUM charges its own fees.",
      "Only work within the 140/280-day limit. Exceeding it can cost you your permit."
    ],
    links: [
      { label: "Consular Services Portal (visa applications)", url: "https://digital.diplo.de/visa" },
      { label: "Federal Foreign Office: visa service", url: "https://www.auswaertiges-amt.de/en/visa-service" },
      { label: "BAMF: entry regulations", url: "https://www.bamf.de/EN/Themen/MigrationAufenthalt/ZuwandererDrittstaaten/Migrathek/Einreisebestimmungen/einreisebestimmungen-node.html" },
      { label: "Make it in Germany (federal portal)", url: "https://www.make-it-in-germany.com/en/" },
      { label: "DAAD: study in Germany", url: "https://www.daad.de/en/" }
    ],
    src: ["de-blocked", "bamf-entry", "de-work"]
  };

  DEST.NLD = {
    code: "NLD", name: "Netherlands", schengen: true, full: true,
    permit: "Residence permit for study; your university applies to the IND for you",
    visaBefore: function (o) { return !o.mvvExempt; },
    headline: function (o) { return o.mvvExempt
      ? "Your university applies to the IND for you. You need no entry visa (MVV); you collect your residence card after arrival."
      : "Your university applies to the IND for you. After approval you collect an MVV entry visa before you travel."; },
    fundsEURmonth: 1130.77, fundsYearEUR: 13569.24,
    funds: { short: "€1,130.77/month", text: "€1,130.77 a month (€13,569 a year)", note: "2026 amount for university and HBO students. The IND adjusts it every 1 January and 1 July. Many universities ask you to transfer a year of living costs to them.", conf: "multi", src: ["ind-2026", "ind-student"] },
    fees: [
      { label: "IND application fee (study)", eur: 254, note: "From 1 Jan 2026 (was €243)", conf: "multi" }
    ],
    tuition: { text: "Non-EU students pay the institutional fee, typically about €10,000–€20,000+ a year.", conf: "check", low: 10000, high: 20000 },
    work: { short: "16 h/week", text: "Up to 16 hours a week in term, or full-time in June–August. Your employer must get a work permit (TWV) for you.", conf: "multi" },
    post: { short: "12 months", text: "12-month orientation year (zoekjaar) to find work, with no work permit needed.", conf: "multi" },
    processing: "The IND aims to decide within 60 days; many universities file early so you have the MVV in time.",
    insurance: "Private international student insurance, or Dutch basic insurance if you take a job.",
    steps: [
      { when: "6–9 months before", title: "Get admitted by a recognised sponsor",
        body: "Only institutions on the IND public register of recognised sponsors can bring non-EU students. Check yours is listed." },
      { when: "3–4 months before", title: "Let the university apply to the IND",
        body: "Your university submits the entry-and-residence application. You pay the €254 fee and prove funds of €1,130.77 a month, often by transferring a year of costs plus tuition to the university." },
      { when: "Within 3 months of approval", title: "Collect your MVV entry visa", if: function (o) { return !o.mvvExempt; },
        body: "Book an appointment at the Dutch embassy or consulate to give biometrics. The MVV sticker goes in your passport; travel while it is valid." },
      { when: "Before you travel", title: "Travel without an MVV", if: function (o) { return o.mvvExempt; },
        body: function (o) { return o.name + " citizens don't need the MVV entry visa. Travel on your passport and collect the residence card after arrival."; } },
      { when: "First 2 weeks", title: "Register and collect your card",
        body: "Register your address with the municipality to get a citizen service number (BSN), then pick up your residence card at an IND desk. If your nationality needs a TB test, the IND says so in the approval letter." },
      { when: "Every year", title: "Keep up your study progress",
        body: "Universities must report students with insufficient study progress to the IND, which can end the permit." }
    ],
    docs: [
      { label: "Passport, plus copies" },
      { label: "Admission from a recognised-sponsor institution" },
      { label: "Proof of funds: €1,130.77 a month (or deposit with the university)" },
      { label: "Proof of tuition payment" },
      { label: "Signed antecedents certificate (IND form)" },
      { label: "TB test declaration, if the IND requires it for your nationality" },
      { label: "Health insurance" }
    ],
    watch: [
      "The funds amount changes every 1 January and 1 July. Check the IND page right before you pay.",
      "Housing is scarce in the big university cities. Find a room before you arrive."
    ],
    links: [
      { label: "IND: student residence permit", url: "https://ind.nl/en/residence-permits/study/student-residence-permit-for-university-or-higher-professional-education" },
      { label: "IND: who is exempt from the MVV", url: "https://ind.nl/en/mvv-exemptions" },
      { label: "IND: income requirements for study", url: "https://ind.nl/en/income-requirements-study" },
      { label: "Study in NL (official)", url: "https://www.studyinnl.org" }
    ],
    src: ["ind-2026", "ind-mvv", "ind-student"]
  };

  DEST.ESP = {
    code: "ESP", name: "Spain", schengen: true, full: true,
    permit: "Student visa (stay authorisation for studies), then a TIE card for stays over 6 months",
    visaBefore: function () { return true; },
    headline: function () { return "Get a student visa from the Spanish consulate before you travel, then a TIE card within a month of arrival."; },
    fundsEURmonth: 600, fundsYearEUR: 7200,
    funds: { short: "€600/month", text: "€600 a month (€7,200 a year)", note: "100% of the IPREM index for 2026. Consultants report that some consulates expect a buffer above the minimum.", conf: "multi", src: ["es-iprem", "es-iprem-2"] },
    fees: [
      { label: "Student visa", eur: 80, note: "About €80; higher for some nationalities (e.g. USA, Canada) under reciprocity", conf: "check" },
      { label: "TIE card", eur: 16, note: "Roughly €16–€20 (form 790-012)", conf: "check" }
    ],
    tuition: { text: "Public university fees are set by each region, and non-EU students may pay more. Private universities cost much more.", conf: "check", low: 1000, high: 6000 },
    work: { short: "30 h/week", text: "Up to 30 hours a week, included in the student permit since 20 May 2025 (Royal Decree 1155/2024).", conf: "multi" },
    post: { short: "12–24 months?", text: "Graduates (bachelor level or higher) can apply in Spain for a residence permit to look for work or start a business. Sources give different durations (12 or 24 months). Confirm on the Ministry's information sheet 20.", conf: "check" },
    processing: "Consulates typically decide within about a month. Certificates, apostilles and translations often take longer than the visa itself.",
    insurance: "Health insurance from a company authorised in Spain, with no co-payments or waiting periods, or public cover.",
    steps: [
      { when: "4–6 months before", title: "Get your admission letter",
        body: "The programme must be full-time and lead to a qualification. Keep the official acceptance letter." },
      { when: "3–4 months before", title: "Get police and medical certificates",
        body: "For stays over 6 months: a criminal record certificate from each country you lived in during the last 5 years, and a medical certificate. Most must be apostilled (or legalised) and translated into Spanish by a sworn translator." },
      { when: "3 months before", title: "Apply for the student visa",
        body: "Apply at the Spanish consulate (or its visa centre) for your place of residence with the admission letter, funds of €600 a month, and health insurance." },
      { when: "Within 1 month of arrival", title: "Apply for your TIE card",
        body: "If you stay over 6 months, book a police appointment (cita previa) for fingerprints and the foreigner identity card (TIE). Pay fee form 790-012 first." },
      { when: "First weeks", title: "Register on the padrón",
        body: "Register your address at the city hall. Banks and health centres often ask for it." }
    ],
    docs: [
      { label: "Passport, plus copies" },
      { label: "National visa application form and photo" },
      { label: "Admission letter (full-time programme)" },
      { label: "Proof of funds: €600 a month" },
      { label: "Health insurance: no co-payments, full cover" },
      { label: "Criminal record certificate, apostilled and translated" },
      { label: "Medical certificate" },
      { label: "Proof of accommodation (often requested)" }
    ],
    watch: [
      "Start apostilles and sworn translations first. They are the usual cause of delays.",
      "Post-study permit duration differs between sources. Check the Ministry's sheet 20 before planning."
    ],
    links: [
      { label: "Ministry of Foreign Affairs (consulates)", url: "https://www.exteriores.gob.es" },
      { label: "Ministry of Inclusion: info sheet 20 (job search after studies)", url: "https://www.inclusion.gob.es/en/web/migraciones/w/20.-autorizacion-de-residencia-para-busqueda-de-empleo-o-inicio-de-proyecto-empresarial" },
      { label: "Royal Decree 1155/2024 (BOE)", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2024-24099" }
    ],
    src: ["es-iprem", "es-rd", "es-sheet20"]
  };

  DEST.ITA = {
    code: "ITA", name: "Italy", schengen: true, full: true,
    permit: "Study visa (type D), then a permesso di soggiorno per studio",
    visaBefore: function () { return true; },
    headline: function () { return "Pre-enrol on Universitaly, get a type D study visa, then request your residence permit within 8 working days of arrival."; },
    fundsEURmonth: 848.32, fundsYearEUR: 10179.85,
    funds: { short: "€10,180/year", text: "€10,179.85 for the academic year (≈ €848 a month)", note: "Set by the Ministry of University and Research for 2026/27 and 2027/28, up 46.5% from €6,947.33.", conf: "multi", src: ["it-funds", "it-wai"] },
    fees: [
      { label: "Study visa", eur: 50, note: "Confirm with the consulate", conf: "check" },
      { label: "Residence permit (post-office kit and fees)", eur: 110, note: "Roughly €100–€120", conf: "check" }
    ],
    tuition: { text: "Public universities charge income-based fees, often about €1,000–€4,000 a year for international students; some set flat fees.", conf: "check", low: 1000, high: 4000 },
    work: { short: "20 h/week", text: "Up to 20 hours a week, capped at 1,040 hours a year.", conf: "multi" },
    post: { short: "12 months", text: "Up to 12 months job-search permit (attesa occupazione) after graduating.", conf: "multi" },
    processing: "Consulates decide within 90 days at most; apply as early as your pre-enrolment allows. Deadline for 2026/27: 30 November 2026.",
    insurance: "Private insurance, or voluntary registration with the national health service (about €700 a year since 2024).",
    steps: [
      { when: "Spring (usually from March)", title: "Pre-enrol on Universitaly",
        body: "Degree programmes require pre-enrolment on the Universitaly portal. The university checks it and forwards it to the consulate, and tells you which recognition documents (Declaration of Value or CIMEA statement) it needs." },
      { when: "Summer", title: "Gather funds and documents",
        body: "Show €10,179.85 for the academic year, accommodation and health insurance." },
      { when: "By 30 Nov 2026 (2026/27 intake)", title: "Apply for the type D study visa",
        body: "Apply at the Italian consulate or its visa centre. The Foreign Ministry's visa tool lists requirements for your nationality." },
      { when: "Within 8 working days of arrival", title: "Request your residence permit",
        body: "Pick up the residence-permit kit at a post office (Sportello Amico), send it, then attend the police (Questura) appointment for fingerprints." },
      { when: "First weeks", title: "Get a tax code and health cover",
        body: "Get your codice fiscale, then keep private insurance or register with the national health service." }
    ],
    docs: [
      { label: "Passport, plus copies" },
      { label: "Universitaly pre-enrolment summary" },
      { label: "Proof of funds: €10,179.85 for the year" },
      { label: "Proof of accommodation" },
      { label: "Health insurance" },
      { label: "Declaration of Value or CIMEA statement, if your university asks" },
      { label: "Visa application form and photo" }
    ],
    watch: [
      "The funds requirement rose 46.5% for 2026/27. Older guides still quote €6,947.33.",
      "Visa deadline for 2026/27 bachelor's and master's programmes: 30 November 2026."
    ],
    links: [
      { label: "Universitaly (pre-enrolment)", url: "https://www.universitaly.it" },
      { label: "Studiare in Italia: rules for international students", url: "https://www.studiare-in-italia.it/studentistranieri/" },
      { label: "Visa for Italy (Foreign Ministry tool)", url: "https://vistoperitalia.esteri.it" }
    ],
    src: ["it-funds", "it-wai", "it-work"]
  };

  DEST.IRL = {
    code: "IRL", name: "Ireland", schengen: false, full: true,
    permit: "Study visa (for visa-required nationals), then Stamp 2 permission and an IRP card",
    visaBefore: function (o) { return !!o.irelandVisa; },
    headline: function (o) {
      if (o.cta) return "No visa or immigration registration needed: British citizens can live, study and work in Ireland under the Common Travel Area.";
      return o.irelandVisa
        ? "Apply online for an Irish D study visa before you travel, then register for an IRP card."
        : "No visa needed to travel. Show your study documents at the border, then register for an IRP card.";
    },
    fundsEURmonth: 833.33, fundsYearEUR: 10000,
    funds: { short: "€10,000", text: "€10,000 for a course longer than 8 months (≈ €833 a month)", note: "You must show immediate access to the money, both for the visa and at registration.", conf: "multi", src: ["ie-funds", "ie-funds-2"] },
    fees: [
      { label: "Study visa (single entry)", eur: 60, conf: "check", when: function (o) { return o.irelandVisa; } },
      { label: "IRP registration", eur: 300, conf: "multi", when: function (o) { return !o.cta; } }
    ],
    tuition: { text: "Non-EU fees are typically about €10,000–€25,000+ a year.", conf: "check", low: 10000, high: 25000 },
    work: { short: "20 h/week", text: "Up to 20 hours a week in term and 40 hours in the holiday periods (Stamp 2).", conf: "multi" },
    post: { short: "12–24 months", text: "Stamp 1G: 12 months after an honours bachelor's (level 8), up to 24 months after a master's or PhD.", conf: "multi" },
    processing: "Allow about 8 weeks for a study visa decision in busy periods.",
    insurance: "Private medical insurance is required for Stamp 2.",
    steps: [
      { when: "6–9 months before", title: "Get accepted on an eligible course",
        body: "The course must be full-time and on the Interim List of Eligible Programmes (ILEP). Only these give study permission." },
      { when: "3–4 months before", title: "Pay fees and buy insurance",
        body: "Pay the tuition the rules require and buy private medical insurance. Keep the receipts." },
      { when: "3 months before", title: "Apply online for a D study visa (AVATS)", if: function (o) { return o.irelandVisa; },
        body: "Fill in the AVATS form online, then send your documents to the Irish embassy or visa office that handles your country. Show access to €10,000." },
      { when: "At the border", title: "Show your documents at immigration", if: function (o) { return !o.irelandVisa && !o.cta; },
        body: function (o) { return o.name + " citizens don't need a visa. At immigration control, show the acceptance letter, fee receipt, proof of €10,000 and insurance."; } },
      { when: "Before the date stamped on arrival", title: "Register for your IRP card", if: function (o) { return !o.cta; },
        body: "Book a registration appointment online with Immigration Service Delivery. You get Stamp 2 permission and an IRP card." }
    ],
    ctaSteps: [
      { when: "Before you travel", title: "Get admitted and check your fee status",
        body: "Apply to the course. Under the Common Travel Area you need no visa, permit or registration to live, study and work in Ireland." },
      { when: "After arrival", title: "Get a PPS number if you work",
        body: "You need a Personal Public Service (PPS) number to work and use public services." }
    ],
    docs: [
      { label: "Passport, plus copies" },
      { label: "Acceptance letter for an ILEP course", when: function (o) { return !o.cta; } },
      { label: "Tuition fee receipt", when: function (o) { return !o.cta; } },
      { label: "Proof of access to €10,000", when: function (o) { return !o.cta; } },
      { label: "Private medical insurance", when: function (o) { return !o.cta; } },
      { label: "AVATS application summary and photos", when: function (o) { return o.irelandVisa; } },
      { label: "Letter explaining any gaps in your education history", when: function (o) { return o.irelandVisa; } },
      { label: "Admission letter", when: function (o) { return !!o.cta; } }
    ],
    watch: [
      "Ireland is not in Schengen. A Schengen visa does not let you enter Ireland, and Irish permission does not let you stay in Schengen countries.",
      "Only ILEP-listed courses give study permission."
    ],
    links: [
      { label: "Irish Immigration Service Delivery", url: "https://www.irishimmigration.ie" },
      { label: "ICOS: Third Level Graduate Programme", url: "https://www.internationalstudents.ie/info-and-advice/immigration/third-level-graduate-scheme" }
    ],
    src: ["ie-funds", "ie-1g"]
  };

  DEST.POL = {
    code: "POL", name: "Poland", schengen: true, full: true,
    permit: "National (D) visa for study, then a temporary residence permit (karta pobytu)",
    visaBefore: function () { return true; },
    headline: function () { return "Get a national (D) study visa before you travel, then apply online for a temporary residence permit."; },
    fundsEURmonth: 1010 / FX.PLN, fundsYearEUR: 1010 * 12 / FX.PLN, fundsCurrency: "PLN",
    funds: { short: "PLN 1,010/month", text: "At least PLN 1,010 a month (≈ €238) plus a return ticket", note: "Legal minimum for living costs; you must also prove tuition is paid and have housing. Consulates often expect more.", conf: "multi", src: ["pl-funds", "pl-funds-2"] },
    fees: [
      { label: "National (D) visa", eur: 80, conf: "check" },
      { label: "Temporary residence permit + card", eur: Math.round(440 / FX.PLN), note: "PLN 340 + PLN 100", conf: "check" }
    ],
    tuition: { text: "English-taught degrees at public universities typically cost about €2,000–€6,000 a year.", conf: "check", low: 2000, high: 6000 },
    work: { short: "No limit", text: "Full-time students can work without a work permit and without an hour limit.", conf: "multi" },
    post: { short: "9 months", text: "Up to 9 months temporary residence to look for work or start a business after graduating.", conf: "check" },
    processing: "Consulates usually decide within 15 days of a complete application; residence-permit decisions in Poland can take months.",
    insurance: "Travel health insurance of at least €30,000 for the visa, then public (NFZ) or private cover.",
    steps: [
      { when: "6–9 months before", title: "Get admitted to an accredited full-time programme",
        body: "Since 2025 universities must check you have at least B2 in the language of instruction and report students who do not start. Pay the tuition deposit the university asks for." },
      { when: "3–4 months before", title: "Apply for the national (D) study visa",
        body: "Register your application in the e-Konsulat system and attend the consulate appointment with the admission letter, tuition receipt, funds, insurance and accommodation." },
      { when: "After arrival (stays over 30 days)", title: "Register your address",
        body: "Register your address (zameldowanie) at the city office." },
      { when: "Before your visa expires", title: "Apply for a temporary residence permit",
        body: "Submit the application online through the MOS system, then visit the voivodeship office for fingerprints." }
    ],
    docs: [
      { label: "Passport, plus copies" },
      { label: "Admission letter for an accredited full-time programme" },
      { label: "Language certificate, B2 or higher" },
      { label: "Tuition payment receipt" },
      { label: "Proof of funds: PLN 1,010 a month plus a return ticket" },
      { label: "Health insurance (at least €30,000 cover)" },
      { label: "Proof of accommodation" }
    ],
    watch: [
      "Poland tightened student rules in 2025: B2 language proof, stricter checks on universities and a cap on the share of foreign students.",
      "Visa appointments are in high demand in some countries. Book as soon as you are admitted."
    ],
    links: [
      { label: "Office for Foreigners (UdSC)", url: "https://www.gov.pl/web/udsc-en" },
      { label: "MOS: online residence applications", url: "https://mos.cudzoziemcy.gov.pl" },
      { label: "e-Konsulat (visa registration)", url: "https://secure.e-konsulat.gov.pl" }
    ],
    src: ["pl-rules", "pl-funds"]
  };

  DEST.SWE = {
    code: "SWE", name: "Sweden", schengen: true, full: true,
    permit: "Residence permit for studies, granted before you travel",
    visaBefore: function () { return true; },
    headline: function () { return "Apply online for a residence permit for studies and get it before you travel."; },
    fundsEURmonth: 10656 / FX.SEK, fundsYearEUR: 10656 * 12 / FX.SEK, fundsCurrency: "SEK",
    funds: { short: "SEK 10,656/month", text: "SEK 10,656 a month (≈ €969) for the whole permit period", note: "2026 amount. Reduced if housing or meals are provided for free.", conf: "official", src: ["se-mv", "se-rules"] },
    fees: [
      { label: "University Admissions application", eur: Math.round(900 / FX.SEK), note: "SEK 900", conf: "multi" },
      { label: "Residence permit", eur: Math.round(1500 / FX.SEK), note: "SEK 1,500", conf: "multi" }
    ],
    tuition: { text: "Non-EU students pay tuition, typically about SEK 80,000–295,000 a year (≈ €7,000–€27,000).", conf: "check", low: 7000, high: 27000 },
    work: { short: "15 h/week", text: "At most 15 hours a week in term for permits granted from 11 June 2026; no limit in June–August. Working more can lead to your permit being withdrawn.", conf: "multi" },
    post: { short: "12 months", text: "Up to 12 months permit to look for work after graduating.", conf: "check" },
    processing: "Decisions can take several months at peak (April–July). Apply the day you pay the first tuition instalment.",
    insurance: "Comprehensive health insurance is required if your permit is shorter than 12 months.",
    steps: [
      { when: "October – mid-January (autumn start)", title: "Apply on University Admissions",
        body: "Apply through universityadmissions.se and pay the SEK 900 application fee." },
      { when: "After admission (usually April)", title: "Pay the first tuition instalment",
        body: "The residence-permit application needs proof of this payment." },
      { when: "Right after paying", title: "Apply online for a residence permit",
        body: "Apply on the Swedish Migration Agency website, pay SEK 1,500 and show SEK 10,656 a month for the whole permit period." },
      { when: "Before or after travel", title: "Give fingerprints and a photo",
        body: "At a Swedish embassy or consulate, or at the Migration Agency after arrival, to get your residence-permit card." },
      { when: "Within 30 days of arrival", title: "Report your address",
        body: "New in 2026: report your Swedish address to the Migration Agency. If your permit lasts a year or more, register with the Tax Agency for a personal identity number." }
    ],
    docs: [
      { label: "Passport, plus copies" },
      { label: "Notification of selection (admission)" },
      { label: "Receipt for the first tuition instalment" },
      { label: "Proof of funds: SEK 10,656 a month for the permit period" },
      { label: "Comprehensive health insurance (if permit < 12 months)" }
    ],
    watch: [
      "New 2026 rules: 15-hour weekly work cap in term, minimum study results (37.5 credits in year 1, 45 per year after) and address reporting.",
      "Peak processing is April–July. Late applications risk missing the semester start."
    ],
    links: [
      { label: "Migration Agency: studies at higher education", url: "https://www.migrationsverket.se/en/you-want-to-apply/study/higher-education.html" },
      { label: "University Admissions in Sweden", url: "https://www.universityadmissions.se" },
      { label: "Study in Sweden: new rules for residence permits", url: "https://studyinsweden.se/news/new-rules-for-residence-permits-for-studies/" }
    ],
    src: ["se-mv", "se-rules"]
  };

  /* ----------------------------------------------------------------
   * BASIC GUIDES: the other 19 EU countries. Shared Schengen rules
   * apply fully; long-stay rules are summarised with official links.
   * -------------------------------------------------------------- */
  var BASIC = [
    { code: "AUT", name: "Austria", schengen: true, url: "https://www.migration.gv.at/en/", auth: "Migration portal of the Austrian government" },
    { code: "BEL", name: "Belgium", schengen: true, url: "https://dofi.ibz.be/en", auth: "Immigration Office (DOFI)" },
    { code: "BGR", name: "Bulgaria", schengen: true, url: "https://www.mfa.bg/en", auth: "Ministry of Foreign Affairs", note: "Full Schengen member since 1 January 2025." },
    { code: "HRV", name: "Croatia", schengen: true, url: "https://mup.gov.hr/en", auth: "Ministry of the Interior" },
    { code: "CYP", name: "Cyprus", schengen: false, url: "https://www.moi.gov.cy/moi/crmd/crmd.nsf", auth: "Civil Registry and Migration Department", note: "Not in Schengen. Days in Cyprus do not count toward the Schengen 90/180 limit." },
    { code: "CZE", name: "Czechia", schengen: true, url: "https://www.mvcr.cz/mvcren/", auth: "Ministry of the Interior" },
    { code: "DNK", name: "Denmark", schengen: true, url: "https://www.nyidanmark.dk/en-GB", auth: "New to Denmark (SIRI)", note: "Denmark is not bound by the EU students directive, so its national rules can differ more." },
    { code: "EST", name: "Estonia", schengen: true, url: "https://www.politsei.ee/en", auth: "Police and Border Guard Board" },
    { code: "FIN", name: "Finland", schengen: true, url: "https://migri.fi/en", auth: "Finnish Immigration Service (Migri)" },
    { code: "GRC", name: "Greece", schengen: true, url: "https://migration.gov.gr/en/", auth: "Ministry of Migration and Asylum" },
    { code: "HUN", name: "Hungary", schengen: true, url: "https://oif.gov.hu", auth: "National Directorate-General for Aliens Policing" },
    { code: "LVA", name: "Latvia", schengen: true, url: "https://www.pmlp.gov.lv/en", auth: "Office of Citizenship and Migration Affairs" },
    { code: "LTU", name: "Lithuania", schengen: true, url: "https://www.migracija.lt", auth: "Migration Department (MIGRIS)" },
    { code: "LUX", name: "Luxembourg", schengen: true, url: "https://guichet.public.lu/en.html", auth: "Guichet.lu (government portal)" },
    { code: "MLT", name: "Malta", schengen: true, url: "https://identita.gov.mt", auth: "Identità (residence permits)" },
    { code: "PRT", name: "Portugal", schengen: true, url: "https://vistos.mne.gov.pt", auth: "Portuguese visa portal (then AIMA for residence)" },
    { code: "ROU", name: "Romania", schengen: true, url: "https://igi.mai.gov.ro/en/", auth: "General Inspectorate for Immigration", note: "Full Schengen member since 1 January 2025." },
    { code: "SVK", name: "Slovakia", schengen: true, url: "https://www.minv.sk", auth: "Ministry of the Interior" },
    { code: "SVN", name: "Slovenia", schengen: true, url: "https://infotujci.si/en/", auth: "Info for foreigners (government portal)" }
  ];

  /* ----------------------------------------------------------------
   * SHARED SCHENGEN SHORT-STAY RULES (≤ 90 days in any 180)
   * -------------------------------------------------------------- */
  var SHORT = {
    feeAdult: 90, feeChild: 45,
    insuranceMin: 30000,
    visaSteps: [
      { when: "Decide where to apply", title: "Apply to the right country",
        body: "Apply to the consulate of the country where you will spend the most days. If the days are equal, apply to your country of first entry." },
      { when: "6 months to 15 days before", title: "Book the appointment",
        body: "You can apply up to 6 months before the trip and no later than 15 days before. In peak season, apply at least 6–8 weeks ahead. Many consulates use a visa centre (VFS Global, TLScontact or BLS)." },
      { when: "At the appointment", title: "Give biometrics and pay the fee",
        body: "Fingerprints are taken (valid for 59 months). Fee €90 (children 6–12: €45). Students on study or educational trips and children under 6 pay nothing." },
      { when: "About 15 days", title: "Wait for the decision",
        body: "The standard decision time is 15 calendar days; it can be extended to 45 days." },
      { when: "At the border", title: "Register in the Entry/Exit System (EES)",
        body: "On your first entry, border guards record your fingerprints and a face photo. Stamps are no longer used. Stay no longer than 90 days in any 180-day period." }
    ],
    freeSteps: [
      { when: "Before booking", title: "Check your passport",
        body: "Your passport must have been issued in the last 10 years and be valid for at least 3 months after the day you plan to leave." },
      { when: "Planning", title: "Count your days",
        body: "You may stay up to 90 days in any 180-day period, across all Schengen countries combined. You may not work." },
      { when: "At the border", title: "Register in the Entry/Exit System (EES)",
        body: "On your first entry, border guards record your fingerprints and a face photo. EES has been fully operational since 10 April 2026." },
      { when: "Not yet", title: "No ETIAS needed yet",
        body: "ETIAS (the €20 travel authorisation) has no start date. The EU removed its late-2026 target in July 2026. Ignore websites that charge you for ETIAS today." }
    ],
    visaDocs: [
      "Schengen visa application form, signed",
      "Passport: issued within 10 years, valid 3+ months after departure, 2 blank pages",
      "Passport photo",
      "Travel medical insurance, at least €30,000 cover, valid in all Schengen states",
      "Return or onward ticket reservation",
      "Proof of accommodation",
      "Proof of means: bank statements, payslips or sponsor letter",
      "Proof of purpose: invitation, conference or course enrolment, employer letter"
    ],
    freeDocs: [
      "Passport valid 3+ months after departure (issued within 10 years)",
      "Return or onward ticket",
      "Proof of accommodation",
      "Proof you can pay for the trip"
    ]
  };

  /* ----------------------------------------------------------------
   * CHANGE LOG: dated rule changes we logged (May 2025 – Aug 2026).
   * -------------------------------------------------------------- */
  var CHANGES = [
    { date: "2025-05-20", where: "ESP", what: "Royal Decree 1155/2024 in force: students may work up to 30 hours a week.", src: "es-rd" },
    { date: "2025-06", where: "POL", what: "Tougher rules for foreign students: B2 language proof, stricter checks on universities, cap on foreign student share.", src: "pl-rules" },
    { date: "2025-10-12", where: "EU", what: "Entry/Exit System (EES) starts a six-month phased roll-out at Schengen borders.", src: "ec-ees" },
    { date: "2026-01-01", where: "NLD", what: "IND study permit fee rises from €243 to €254; living-costs amount €1,130.77 a month.", src: "ind-2026" },
    { date: "2026-01-29", where: "EU", what: "Commission adopts the first EU Visa Strategy and a Recommendation on attracting talent, including students.", src: "ec-strategy" },
    { date: "2026-04-10", where: "EU", what: "EES fully operational at all external border crossings.", src: "ec-ees" },
    { date: "2026-04", where: "ITA", what: "Funds requirement for 2026/27 raised to €10,179.85 a year (from €6,947.33, +46.5%).", src: "it-funds" },
    { date: "2026-05-21", where: "FRA", what: "Decree 2026-385: national non-EU fees of €2,895 (bachelor) and €3,941 (master); exemptions capped at 30%.", src: "mesr-fees" },
    { date: "2026-05-28", where: "EU", what: "2025 Schengen statistics: over 12 million short-stay applications, 14.6% refused.", src: "ec-stats" },
    { date: "2026-06-11", where: "SWE", what: "Work cap of 15 hours a week in term, minimum study results, address reporting.", src: "se-rules" },
    { date: "2026-07", where: "EU", what: "ETIAS late-2026 target removed; no launch date, 2027 widely expected.", src: "fragomen-etias" },
    { date: "2026-08-01", where: "FRA", what: "Student funds threshold rises from €615 to €877.50 a month (Decree 2026-526).", src: "infomigrants2026" },
    { date: "2026-08-02", where: "EU", what: "AI Act Article 50 transparency duties apply to chatbots and AI-generated content.", src: "ec-ai-art50" }
  ];

  /* ----------------------------------------------------------------
   * SOURCES (APA 7). Keys are used by `src` fields above and by the
   * business case. `type`: "official" | "secondary" | "academic".
   * -------------------------------------------------------------- */
  var SOURCES = {
    "ec-strategy": { type: "official", apa: "European Commission. (2026a, January 29). EU visa strategy. Migration and Home Affairs.", url: "https://home-affairs.ec.europa.eu/eu-visa-strategy_en" },
    "ec-ees": { type: "official", apa: "European Commission. (2026b, April 10). Entry/Exit System (EES) is fully operational. Migration and Home Affairs.", url: "https://home-affairs.ec.europa.eu/news/entryexit-system-ees-fully-operational-2026-04-10_en" },
    "ec-stats": { type: "official", apa: "European Commission. (2026d, May 28). Schengen short-stay visa applications rise in 2025 but remain below pre-pandemic levels. Migration and Home Affairs.", url: "https://home-affairs.ec.europa.eu/news/schengen-short-stay-visa-applications-rise-2025-remain-below-pre-pandemic-levels-2026-05-28_en" },
    "ec-ai-art50": { type: "official", apa: "European Commission. (2026c). Transparency obligations under Article 50 of the AI Act [FAQ]. Shaping Europe's Digital Future.", url: "https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act" },
    "ec-portal": { type: "official", apa: "European Commission. (n.d.). EU Immigration Portal. Migration and Home Affairs. Retrieved September 24, 2026.", url: "https://home-affairs.ec.europa.eu/policies/migration-and-asylum/eu-immigration-portal_en" },
    "eurostat-students": { type: "official", apa: "Eurostat. (2025a, August 22). 8.4% of tertiary students in the EU came from abroad.", url: "https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20250822-1" },
    "eurostat-permits": { type: "official", apa: "Eurostat. (2025b, September 12). 3.5 million first residence permits in 2024.", url: "https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20250912-2" },
    "dir-2016-801": { type: "official", apa: "Directive (EU) 2016/801 of the European Parliament and of the Council of 11 May 2016 on the conditions of entry and residence of third-country nationals for the purposes of research, studies, training, voluntary service, pupil exchange schemes or educational projects and au pairing. (2016). Official Journal of the European Union, L 132, 21–57.", url: "https://eur-lex.europa.eu/eli/dir/2016/801/oj" },
    "reg-visa-code": { type: "official", apa: "Regulation (EC) No 810/2009 of the European Parliament and of the Council of 13 July 2009 establishing a Community Code on Visas (Visa Code). (2009). Official Journal of the European Union, L 243, 1–58.", url: "https://eur-lex.europa.eu/eli/reg/2009/810/oj" },
    "reg-visa-list": { type: "official", apa: "Regulation (EU) 2018/1806 of the European Parliament and of the Council of 14 November 2018 listing the third countries whose nationals must be in possession of visas when crossing the external borders. (2018). Official Journal of the European Union, L 303, 39–58.", url: "https://eur-lex.europa.eu/eli/reg/2018/1806/oj" },
    "gdpr": { type: "official", apa: "Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 (General Data Protection Regulation). (2016). Official Journal of the European Union, L 119, 1–88.", url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj" },
    "eeas-india": { type: "official", apa: "European External Action Service. (2024, April 18). European Union adopts more favourable Schengen visa rules for Indians.", url: "https://www.eeas.europa.eu/delegations/india/european-union-adopts-more-favourable-schengen-visa-rules-indians_en" },
    "ey-gcc": { type: "secondary", apa: "EY. (2024). European Union announces five-year multiple-entry Schengen visas for first-time applicants from Bahrain, Oman and Saudi Arabia [Tax alert].", url: "https://www.ey.com/en_gl/technical/tax-alerts/european-union-announces-five-year-multiple-entry-schengen-visas-for-first-time-applicants-from-bahrain-oman-and-saudi-arabia" },
    "ec-qatar-kuwait": { type: "official", apa: "European Commission. (2022, April 27). Questions and answers: Proposal for visa exemption for nationals of Qatar and Kuwait.", url: "https://ec.europa.eu/commission/presscorner/detail/cs/qanda_22_2507" },
    "fragomen-etias": { type: "secondary", apa: "Fragomen. (2026). European Union: European Travel Information and Authorisation System (ETIAS) and Entry/Exit System (EES) launch status.", url: "https://www.fragomen.com/insights/european-union-european-travel-information-and-authorisation-system-etias-launch-delayed.html" },
    "infomigrants2026": { type: "secondary", apa: "InfoMigrants. (2026). France : le niveau minimum de ressources pour les étudiants étrangers passe à 877 euros à compter du 1er août 2026.", url: "https://www.infomigrants.net/fr/post/72455/france--le-niveau-minimum-de-ressources-pour-les-etudiants-etrangers-passe-a-877-euros-a-compter-du-1er-aout-2026" },
    "fr-decree-analysis": { type: "secondary", apa: "Kohen, H. (2026). Le relèvement du seuil de ressources des étudiants étrangers à 877,50 euros au 1er août 2026. Kohen Avocats.", url: "https://kohenavocats.com/ressources-etudiants-etrangers-877-euros-aout-2026-office-juge-administratif/" },
    "mesr-fees": { type: "official", apa: "Ministère de l'Enseignement supérieur et de la Recherche. (2026). FAQ : Droits d'inscription différenciés pour les étudiants extra-communautaires.", url: "https://www.enseignementsup-recherche.gouv.fr/fr/faq-droits-d-inscription-differencies-pour-les-etudiants-extra-communautaires-101557" },
    "campusfrance-eef": { type: "official", apa: "Campus France. (n.d.). Which countries are affected by the \"Etudes en France\" (Studying in France) procedure? Retrieved September 24, 2026.", url: "https://www.campusfrance.org/en/faq/which-countries-are-affected-by-the-etudes-en-france-studying-in-france-procedure" },
    "de-blocked": { type: "secondary", apa: "Study.eu. (2026). Germany: Blocked bank accounts for students (guide).", url: "https://www.study.eu/article/germany-blocked-bank-accounts-for-students-guide" },
    "de-blocked-2": { type: "secondary", apa: "ApplyBoard. (2026a). Germany blocked account 2026: Amount and how to open one.", url: "https://assist.applyboard.com/hc/en-us/articles/32833954417933-Germany-Blocked-Account-2026-Amount-How-to-Open-One" },
    "de-work": { type: "secondary", apa: "GradGermany. (2026). Student work hours in Germany 2026: 140 full or 280 half days.", url: "https://www.gradgermany.com/blog/work-limit-revised-for-international-students-in-germany-2026" },
    "bamf-entry": { type: "official", apa: "Federal Office for Migration and Refugees. (n.d.). Entry regulations for Germany. Retrieved September 24, 2026.", url: "https://www.bamf.de/EN/Themen/MigrationAufenthalt/ZuwandererDrittstaaten/Migrathek/Einreisebestimmungen/einreisebestimmungen-node.html" },
    "ind-2026": { type: "official", apa: "Immigration and Naturalisation Service. (2025). Fees and required amounts for 2026 known.", url: "https://ind.nl/en/news/fees-and-required-amounts-for-2026-known" },
    "ind-mvv": { type: "official", apa: "Immigration and Naturalisation Service. (n.d.-a). MVV exemptions. Retrieved September 24, 2026.", url: "https://ind.nl/en/mvv-exemptions" },
    "ind-student": { type: "official", apa: "Immigration and Naturalisation Service. (n.d.-b). Student residence permit for university or higher professional education. Retrieved September 24, 2026.", url: "https://ind.nl/en/residence-permits/study/student-residence-permit-for-university-or-higher-professional-education" },
    "es-iprem": { type: "secondary", apa: "ApplyBoard. (2026c). Spain student visa financial requirements (2026–27): IPREM and proof of funds.", url: "https://assist.applyboard.com/hc/en-us/articles/46221924951437-Spain-Student-Visa-Financial-Requirements-2026-27-IPREM-Proof-of-Funds" },
    "es-iprem-2": { type: "secondary", apa: "My Spain Visa. (2026). Spain student visa 2026: Work 30h/week and requirements.", url: "https://myspainvisa.com/student-visa-spain/" },
    "es-rd": { type: "official", apa: "Real Decreto 1155/2024, de 19 de noviembre, por el que se aprueba el Reglamento de la Ley Orgánica 4/2000. (2024). Boletín Oficial del Estado, 280.", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2024-24099" },
    "es-sheet20": { type: "official", apa: "Ministerio de Inclusión, Seguridad Social y Migraciones. (2025). Hoja informativa 20: Autorización de residencia para búsqueda de empleo o inicio de proyecto empresarial.", url: "https://www.inclusion.gob.es/en/web/migraciones/w/20.-autorizacion-de-residencia-para-busqueda-de-empleo-o-inicio-de-proyecto-empresarial" },
    "it-funds": { type: "secondary", apa: "ConnectSaqib. (2026, June 2). Italy increases student visa financial requirement to €10,179.85.", url: "https://connectsaqib.com/2026/06/02/italy-increases-student-visa-financial-requirement-to-e10179-85-what-international-students-need-to-know-in-2026/" },
    "it-wai": { type: "secondary", apa: "WAI Association Italy. (2026). Studying in Italy 2026/2027: News for international students.", url: "https://www.waitaly.net/en/studying-in-italy-news-international-students/" },
    "it-work": { type: "secondary", apa: "Il Centro. (2026). Student visa Italy: The 20 hours per week rule explained (2026 guide).", url: "https://ilcentro.net/italy-student-visa-the-20-hours-per-week-rule-explained-2026/" },
    "ie-funds": { type: "secondary", apa: "ApplyBoard. (2026b). Ireland Stamp 2 student visa 2026: Work rights and requirements.", url: "https://assist.applyboard.com/hc/en-us/articles/43170065693837-Ireland-Stamp-2-Student-Visa-2026-Work-Rights-Requirements" },
    "ie-funds-2": { type: "secondary", apa: "GMAC. (2026). What are Ireland's student visa requirements in 2026?", url: "https://www.gmac.com/resources/learners/how-to-apply/study-abroad/ireland-student-visa-rules" },
    "ie-1g": { type: "secondary", apa: "Irish Council for International Students. (n.d.). Third Level Graduate Programme. Retrieved September 24, 2026.", url: "https://www.internationalstudents.ie/info-and-advice/immigration/third-level-graduate-scheme" },
    "pl-rules": { type: "secondary", apa: "Notes from Poland. (2025, June 2). Poland introduces tougher new rules for foreign students and economic migrants.", url: "https://notesfrompoland.com/2025/06/02/poland-introduces-tougher-new-rules-for-foreign-students-and-economic-migrants/" },
    "pl-funds": { type: "official", apa: "Wielkopolski Urząd Wojewódzki. (n.d.). Sufficient financial resources for a student. Department for Foreigners. Retrieved September 24, 2026.", url: "https://migrant.poznan.uw.gov.pl/en/slownik-pojec/sufficient-financial-resources-student" },
    "pl-funds-2": { type: "secondary", apa: "University of Warsaw. (n.d.). Step 2: Proof of sufficient financial resources. Retrieved September 24, 2026.", url: "https://welcome.uw.edu.pl/4-steps-to-legalise-your-stay-step-2-proof-of-sufficient-financial-resources/" },
    "se-mv": { type: "official", apa: "Swedish Migration Agency. (2026). Apply for a residence permit for studies at higher education.", url: "https://www.migrationsverket.se/en/you-want-to-apply/study/higher-education.html" },
    "se-rules": { type: "official", apa: "Study in Sweden. (2026). New rules for residence permits for studies. Swedish Institute.", url: "https://studyinsweden.se/news/new-rules-for-residence-permits-for-studies/" },
    "qs-flows": { type: "secondary", apa: "QS Quacquarelli Symonds. (2025). Global student flows: Europe.", url: "https://www.qs.com/insights/global-student-flows-europe" },
    "icef-agents": { type: "secondary", apa: "ICEF Monitor. (2026a, August). Global agent survey reveals international students' top concerns are visa uncertainty and affordability.", url: "https://monitor.icef.com/2026/08/global-agent-survey-reveals-international-students-top-concerns-are-visa-uncertainty-and-affordability/" },
    "icef-idp": { type: "secondary", apa: "ICEF Monitor. (2026b, May). New IDP research shows link between visa uncertainty and the perceived ROI of study abroad.", url: "https://monitor.icef.com/2026/05/new-idp-research-shows-link-between-visa-uncertainty-and-the-perceived-roi-of-study-abroad/" },
    "icef-us": { type: "secondary", apa: "ICEF Monitor. (2026c, August). Visa delays and policy uncertainty projected to reduce foreign enrolment in the US by more than 100,000 students this fall.", url: "https://monitor.icef.com/2026/08/visa-delays-and-policy-uncertainty-projected-to-reduce-foreign-enrolment-in-the-us-by-more-than-100000-students-this-fall/" },
    "icef-sust": { type: "secondary", apa: "ICEF Monitor. (2023, September). Sustainability factors in the study abroad research for nearly half of prospective students.", url: "https://monitor.icef.com/2023/09/sustainability-factors-in-the-study-abroad-research-for-nearly-half-of-prospective-students/" },
    "icef-carbon": { type: "secondary", apa: "ICEF Monitor. (2025, April). Study shows that international educators and students want to lessen carbon footprint but that barriers remain.", url: "https://monitor.icef.com/2025/04/study-shows-that-international-educators-and-students-want-to-lessen-carbon-footprint-but-that-barriers-remain/" },
    "iea-ai": { type: "official", apa: "International Energy Agency. (2025). Energy and AI. IEA.", url: "https://www.iea.org/reports/energy-and-ai" },
    "cnn-lago": { type: "secondary", apa: "CNN. (2025, May 21). Africans lost nearly $70M to denied visa applications to Europe in 2024.", url: "https://edition.cnn.com/2025/05/21/travel/africans-europe-schengen-denied-visas-applications" },
    "bt-india": { type: "secondary", apa: "Business Today. (2026, May 29). Schengen visa data 2025: India files 1.15 mn applications, but approval rates remain low.", url: "https://www.businesstoday.in/nri/visa/story/schengen-visa-data-2025-india-files-1-15-mn-applications-but-approval-rates-remain-low-533887-2026-05-29" },
    "un-sdg": { type: "official", apa: "United Nations. (2015). Transforming our world: The 2030 Agenda for Sustainable Development (A/RES/70/1).", url: "https://sdgs.un.org/2030agenda" },
    "porter-2008": { type: "academic", apa: "Porter, M. E. (2008). The five competitive forces that shape strategy. Harvard Business Review, 86(1), 78–93.", url: "https://hbr.org/2008/01/the-five-competitive-forces-that-shape-strategy" },
    "barney-1991": { type: "academic", apa: "Barney, J. (1991). Firm resources and sustained competitive advantage. Journal of Management, 17(1), 99–120.", url: "https://doi.org/10.1177/014920639101700108" },
    "ansoff-1957": { type: "academic", apa: "Ansoff, H. I. (1957). Strategies for diversification. Harvard Business Review, 35(5), 113–124.", url: "" },
    "ghemawat-2001": { type: "academic", apa: "Ghemawat, P. (2001). Distance still matters: The hard reality of global expansion. Harvard Business Review, 79(8), 137–147.", url: "" },
    "osterwalder-2010": { type: "academic", apa: "Osterwalder, A., & Pigneur, Y. (2010). Business model generation: A handbook for visionaries, game changers, and challengers. Wiley.", url: "" },
    "osterwalder-2014": { type: "academic", apa: "Osterwalder, A., Pigneur, Y., Bernarda, G., & Smith, A. (2014). Value proposition design: How to create products and services customers want. Wiley.", url: "" },
    "johnson-2023": { type: "academic", apa: "Whittington, R., Regnér, P., Angwin, D., Johnson, G., & Scholes, K. (2023). Exploring strategy: Text and cases (13th ed.). Pearson.", url: "" },
    "bovee-2024": { type: "academic", apa: "Bovée, C. L., & Thill, J. V. (2024). Business in action (10th ed., global ed.). Pearson.", url: "" }
  };

  return {
    VERIFIED: VERIFIED, FX: FX, ORIGINS: ORIGINS, APS: APS, DEST: DEST,
    BASIC: BASIC, SHORT: SHORT, CHANGES: CHANGES, SOURCES: SOURCES
  };
})();
