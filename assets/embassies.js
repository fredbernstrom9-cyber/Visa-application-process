/*
 * Embassy and consulate pages, per passport country (the country you apply from) and destination.
 * Each entry: [link text, url]. Found by searching each destination foreign service's own domain
 * (diplo.de, esteri.it, exteriores.gob.es, gov.pl, ireland.ie, swedenabroad.se, netherlandsandyou.nl, ambafrance.org / france-visas).
 * Where a pair has no entry, the checker shows the destination's worldwide portal (DEST.<CODE>.portal).
 * Last checked 24 September 2026.
 */
window.CE_EMB = {
  IND: {
    DEU: ["German Embassy New Delhi: visa information","https://india.diplo.de/in-en/service/-/2341254"],
    ITA: ["Embassy of Italy New Delhi: visas","https://ambnewdelhi.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/"],
    IRL: ["Embassy of Ireland New Delhi: study visa leaflet","https://assets.ireland.ie/documents/20250425_Study_visa_information_leaflet.pdf"],
    POL: ["Embassy of Poland New Delhi: visa information","https://newdelhi.mfa.gov.pl/en/consular_information/visa_information/visa_information"]
  },
  CHN: {
    NLD: ["NetherlandsWorldwide: the Netherlands in China","https://www.netherlandsandyou.nl/your-country-and-the-netherlands/china/travel-and-residence/applying-for-a-short-stay-schengen-visa"],
    ITA: ["Embassy of Italy Beijing: visas","https://ambpechino.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/"],
    IRL: ["Embassy of Ireland Beijing: visa types and documents","https://www.ireland.ie/en/china/beijing/services/visas/visa-types-documentation/"],
    SWE: ["Embassy of Sweden Beijing","https://www.swedenabroad.se/en/embassies/china-beijing/"]
  },
  USA: {
    ESP: ["Consulate of Spain Washington DC: study visa","https://www.exteriores.gob.es/Consulados/washington/en/ServiciosConsulares/Paginas/Consular/study-visa.aspx"],
    ITA: ["Embassy of Italy Washington: visas","https://ambwashingtondc.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/"],
    IRL: ["Embassy of Ireland USA: visas for Ireland","https://www.ireland.ie/en/usa/washington/services/visas/visas-for-ireland/"],
    POL: ["Poland in the US: D-type national visa","https://www.gov.pl/web/usa-en/d-type-national-visa"]
  },
  CAN: {
    DEU: ["German Missions in Canada: national visa","https://canada.diplo.de/ca-en/consular-services/visa/long-term"],
    ESP: ["Embassy of Spain Ottawa: student visa","https://www.exteriores.gob.es/Embajadas/ottawa/en/ServiciosConsulares/Paginas/Consular/Visado-de-estudios.aspx"],
    ITA: ["Embassy of Italy Ottawa: national visa for study","https://ambottawa.esteri.it/ambasciata_ottawa/en/informazioni_e_servizi/visti/schengen-or-national-visa-for-study.html"],
    POL: ["Poland in Canada: D-type national visa","https://www.gov.pl/web/canada-en/d-type-national-visa"]
  },
  ARE: {
    DEU: ["German Missions in the UAE: national visa for study","https://uae.diplo.de/ae-en/service/05-visaeinreise/2490162-2490162"],
    ESP: ["Embassy of Spain Abu Dhabi: study visa","https://www.exteriores.gob.es/Embajadas/abudhabi/en/ServiciosConsulares/Paginas/Consular/Visado-de-estudios.aspx"],
    ITA: ["Embassy of Italy Abu Dhabi: national visa","https://ambabudhabi.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/national-visa/"]
  },
  SAU: {
    DEU: ["German Embassy Riyadh: national visas","https://saudiarabien.diplo.de/ksa-en/visa-service/national-visas-2195264"],
    ITA: ["Embassy of Italy Riyadh: visas","https://ambriad.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/"],
    POL: ["Poland in Saudi Arabia: D-type national visa","https://www.gov.pl/web/saudiarabia/d-type-national-visa"],
    SWE: ["Embassy of Sweden Riyadh","https://www.swedenabroad.se/en/embassies/saudi-arabia-riyadh/"]
  },
  QAT: {
    DEU: ["German Embassy Doha: university studies visa","https://doha.diplo.de/qa-en/service/visa/nationale-visa/2583162-2583162"],
    ESP: ["Embassy of Spain in Qatar","https://www.exteriores.gob.es/Embajadas/doha/en/Paginas/index.aspx"],
    ITA: ["Embassy of Italy Doha: visas","https://ambdoha.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/"],
    POL: ["Poland in Qatar: visas","https://www.gov.pl/web/qatar/visas---general-information"]
  },
  KWT: {
    DEU: ["German Embassy Kuwait: student visa (§16b)","https://kuwait.diplo.de/kw-en/service/visa-einreise/2661044-2661044"],
    ITA: ["Embassy of Italy Kuwait: study","https://ambalkuwait.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/studi/"],
    POL: ["Poland in Kuwait: student visa documents","https://www.gov.pl/web/kuwait/student-visa-procedure--educational-documents"]
  },
  BHR: {
    FRA: ["Embassy of France in Bahrain: applying for a French visa","https://bh.ambafrance.org/Applying-for-a-French-visa-in-Bahrain"],
    DEU: ["German Embassy Manama","https://manama.diplo.de/bh-en"],
    ITA: ["Embassy of Italy Manama: visas","https://ambmanama.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/"]
  },
  OMN: {
    DEU: ["German Embassy Muscat: student visa (§16b)","https://maskat.diplo.de/om-en/service/05-visaeinreise/2609582-2609582"],
    ITA: ["Embassy of Italy Muscat: visas","https://ambmascate.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/"]
  },
  DZA: {
    FRA: ["Embassy of France in Algeria: student visas","https://dz.ambafrance.org/Visas-etudiants-delivres-par-les-consulats-generaux-de-France-en-Algerie"],
    DEU: ["German Embassy Algiers: national visa","https://algier.diplo.de/dz-fr/service/05-visaeinreise/2430460-2430460"],
    ITA: ["Embassy of Italy Algiers: visas","https://ambalgeri.esteri.it/fr/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/"],
    POL: ["Poland in Algeria: study visas","https://www.gov.pl/web/algerie/visas-dtudes"],
    SWE: ["Embassy of Sweden Algiers","https://www.swedenabroad.se/fr/ambassade/algeriet-alger/"]
  },
  CMR: {
    FRA: ["Embassy of France in Cameroon: going to France","https://cm.ambafrance.org/-Visas-Aller-en-France-"],
    DEU: ["German Embassy Yaoundé: visas","https://jaunde.diplo.de/cm-fr/service/05-visaeinreise"],
    ESP: ["Embassy of Spain Yaoundé: visa appointments","https://www.exteriores.gob.es/Embajadas/yaunde/en/Embajada/Paginas/instructions-visa.aspx"],
    ITA: ["Embassy of Italy Yaoundé: study visa","https://ambyaounde.esteri.it/fr/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti__trashed/visto-per-studio/"]
  },
  EGY: {
    DEU: ["German Embassy Cairo: study visa (PDF)","https://kairo.diplo.de/resource/blob/2546508/b249cc765b49519705d54e85f137f1d8/merkblatt-eng-studium-data.pdf"],
    ESP: ["Embassy of Spain in Egypt","https://www.exteriores.gob.es/Embajadas/elcairo/en"],
    ITA: ["Embassy of Italy Cairo: study visa procedure","https://ambilcairo.esteri.it/ar/news/dall_ambasciata/2020/07/richiesta-di-visto-per-studio-immatricolazione-2/"],
    POL: ["Poland in Egypt: D-type national visa","https://www.gov.pl/web/egypt/d-type-national-visa"],
    SWE: ["Sweden Abroad (Egypt): apply for a visa","https://www.swedenabroad.se/en/about-sweden-non-swedish-citizens/egypt/going-to-sweden/visiting-sweden/apply-for-a-visa2/"]
  },
  GHA: {
    DEU: ["German Embassy Accra: visa for students","https://accra.diplo.de/gh-en/service/-visainformation/2615324-2615324"],
    ITA: ["Embassy of Italy Accra: Declaration of Value requirements (PDF)","https://ambaccra.esteri.it/wp-content/uploads/2024/05/Requisiti-Dichiarazione-di-Valore.pdf"]
  },
  KEN: {
    DEU: ["German Embassy Nairobi: visa for higher education studies","https://nairobi.diplo.de/ke-en/service/visa-entry/2629250-2629250"],
    ITA: ["Embassy of Italy Nairobi: studies","https://ambnairobi.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/studiare-in-italia/"],
    POL: ["Poland in Kenya: D-type national visa","https://www.gov.pl/web/kenya/d-type-national-visa"]
  },
  MAR: {
    DEU: ["German Embassy Rabat: study visa","https://rabat.diplo.de/ma-fr/service/visa-einreise/2732202-2732202"],
    ESP: ["Embassy of Spain Rabat: student visa","https://www.exteriores.gob.es/Embajadas/rabat/fr/ServiciosConsulares/Paginas/Consular/Visado-de-estudios.aspx"],
    POL: ["Poland in Morocco: national (D) visa","https://www.gov.pl/web/maroc/un-visa-national-type-d"]
  },
  NGA: {
    DEU: ["German Missions in Nigeria: university studies visa","https://nigeria.diplo.de/ng-en/2750690-2750690"],
    ITA: ["Embassy of Italy Abuja: visas","https://ambabuja.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/"],
    IRL: ["Embassy of Ireland Nigeria: visa processing times","https://www.ireland.ie/en/nigeria/abuja/services/visas/weekly-decision-reports/"],
    POL: ["Poland in Nigeria: D-type national visa","https://www.gov.pl/web/nigeria-en/d-type-national-visa"],
    SWE: ["Embassy of Sweden Abuja","https://www.swedenabroad.se/en/embassies/nigeria-abuja/"]
  },
  SEN: {
    FRA: ["Embassy of France in Senegal: study in France","https://sn.ambafrance.org/Etudier-en-France"],
    DEU: ["German Embassy Dakar: visas","https://dakar.diplo.de/sn-en/service/visa"],
    POL: ["Poland in Senegal: national (D) visa","https://www.gov.pl/web/senegal-fr/un-visa-national-type-d"]
  },
  ZAF: {
    DEU: ["German Missions in South Africa: study visa","https://southafrica.diplo.de/sa-en/sa-consular/sa-studyvisa-498290"],
    ESP: ["Embassy of Spain Pretoria: study visa","https://www.exteriores.gob.es/Embajadas/pretoria/en/ServiciosConsulares/Paginas/Consular/Visado-de-estudios.aspx"],
    IRL: ["Embassy of Ireland South Africa: visas for Ireland","https://www.ireland.ie/en/southafrica/pretoria/services/visas/visas-for-ireland/"],
    POL: ["Poland in South Africa: student visa information","https://www.gov.pl/web/southafrica/booking-appointment-date"]
  },
  TUN: {
    DEU: ["German Embassy Tunis: study visa","https://tunis.diplo.de/tn-fr/service/05-visaeinreise/2573172-2573172"],
    ESP: ["Embassy of Spain Tunis: student visa","https://www.exteriores.gob.es/Embajadas/tunez/fr/ServiciosConsulares/Paginas/Consular/Visado-de-estudios.aspx"],
    ITA: ["Embassy of Italy Tunis: study visa (PDF)","https://ambtunisi.esteri.it/wp-content/uploads/2023/10/visa_etudes.pdf"],
    POL: ["Poland in Tunisia: national (D) visa","https://www.gov.pl/web/tunisie/un-visa-national-type-d"],
    SWE: ["Embassy of Sweden Tunis","https://www.swedenabroad.se/fr/ambassade/tunisie-tunis/"]
  },
  BGD: {
    DEU: ["German Embassy Dhaka: study visa information","https://dhaka.diplo.de/bd-en/service/2685884-2685884"],
    ESP: ["Embassy of Spain Dhaka: study visa","https://www.exteriores.gob.es/Embajadas/dhaka/en/ServiciosConsulares/Paginas/Consular/Visado-de-estudios.aspx"]
  },
  IDN: {
    NLD: ["Netherlands in Indonesia: MVV visa for students","https://www.netherlandsandyou.nl/web/indonesia/w/mvv-visa-for-students"],
    ITA: ["Embassy of Italy Jakarta: study in Italy","https://ambjakarta.esteri.it/en/italia-e-indonesia/diplomazia-culturale/studiare-in-italia/"],
    POL: ["Poland in Indonesia: study visa message","https://www.gov.pl/web/indonesia-en/study-visa---important-message-for-students"],
    SWE: ["Embassy of Sweden Jakarta","https://www.swedenabroad.se/en/embassies/indonesia-jakarta/"]
  },
  IRN: {
    ESP: ["Embassy of Spain in Iran: consular services","https://www.exteriores.gob.es/Embajadas/teheran/en/ServiciosConsulares/Paginas/inicio.aspx"],
    ITA: ["Embassy of Italy: visa applications for Iranian citizens (May 2026)","https://ambmascate.esteri.it/en/news/dall_ambasciata/2026/05/visa-application-for-iranian-citizens/"],
    IRL: ["Embassy of Ireland, Iran","https://www.ireland.ie/en/tehran/"],
    POL: ["Poland in Iran: D-type national visa","https://www.gov.pl/web/iran-en/d-type-national-visa"],
    SWE: ["Embassy of Sweden Tehran","https://www.swedenabroad.se/en/embassies/iran-tehran/"]
  },
  JPN: {
    DEU: ["German Embassy Tokyo: study in Germany visa","https://japan.diplo.de/ja-ja/service/study/908722"],
    ESP: ["Embassy of Spain Tokyo: study visa","https://www.exteriores.gob.es/Embajadas/tokio/en/ServiciosConsulares/Paginas/Consular/Visado-de-estudios.aspx"],
    ITA: ["Embassy of Italy Tokyo: visas","https://ambtokyo.esteri.it/ja/servizi-consolari-e-visti/visti/"],
    POL: ["Poland in Japan: D-type national visa","https://www.gov.pl/web/nippon/d-type-national-visa"]
  },
  MYS: {
    DEU: ["German Embassy Kuala Lumpur: student visa","https://kuala-lumpur.diplo.de/my-en/service/05-visaeinreise/2284850-2284850"],
    ITA: ["Embassy of Italy Kuala Lumpur: university enrolment visa (PDF)","https://ambkualalumpur.esteri.it/wp-content/uploads/2026/07/STUDY-UNIVERSITY-ENROLLMENT.pdf"]
  },
  NPL: {
    DEU: ["German Embassy Kathmandu: study visa","https://kathmandu.diplo.de/np-en/service/01-visaeinreise/2225320-2225320"]
  },
  PAK: {
    DEU: ["German Mission in Pakistan: study visa","https://pakistan.diplo.de/pk-en/service/2-study-visa-seite/1676104"],
    ITA: ["Embassy of Italy Islamabad: visas","https://ambislamabad.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/"],
    POL: ["Poland in Pakistan: D-type national visa","https://www.gov.pl/web/pakistan-en/d-type-national-visa"]
  },
  PHL: {
    DEU: ["German Embassy Manila: long-stay national visa","https://manila.diplo.de/ph-en/service/visa/2439020-2439020"],
    ITA: ["Embassy of Italy Manila: study visa","https://ambmanila.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/study-visa/"],
    POL: ["Poland in the Philippines: D-type national visa","https://www.gov.pl/web/philippines/d-type-national-visa"]
  },
  KOR: {
    DEU: ["German Embassy Seoul: study visa","https://seoul.diplo.de/kr-ko/service/06-visaeng/1891982-1891982"],
    ESP: ["Embassy of Spain Seoul: student visa","https://www.exteriores.gob.es/Embajadas/seul/en/ServiciosConsulares/Paginas/Consular/Visado-de-estudios.aspx"],
    SWE: ["Embassy of Sweden Seoul","https://www.swedenabroad.se/en/embassies/south-korea-seoul/"]
  },
  LKA: {
    DEU: ["German Embassy Colombo: national visa","https://colombo.diplo.de/lk-en/service/01-visaeinreisenational"],
    ITA: ["Embassy of Italy Colombo: visas","https://ambcolombo.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/"]
  },
  VNM: {
    DEU: ["German Embassy Hanoi: visa for studies","https://vietnam.diplo.de/vn-de/service/2306542-2306542"],
    ESP: ["Embassy of Spain Hanoi: national visa for study (PDF)","https://www.exteriores.gob.es/DocumentosAuxiliaresSC/Vietnam/HANOI%20(E)/21c%20Nacionales.%20Estudios%20(EN).pdf"],
    ITA: ["Embassy of Italy Hanoi: pre-enrolment and student visas","https://ambhanoi.esteri.it/en/italia-e-vietnam/diplomazia-culturale/studiare-in-italia/pre-enrollments-and-student-visas/"],
    IRL: ["Embassy of Ireland Vietnam: contact","https://www.ireland.ie/en/vietnam/hanoi/contact/"],
    SWE: ["Embassy of Sweden Hanoi","https://www.swedenabroad.se/en/embassies/vietnam-hanoi/"]
  },
  KAZ: {
    DEU: ["German Embassy Astana: national visas","https://kasachstan.diplo.de/kz-de/2012022-2012022"],
    POL: ["Polish consulate Astana: e-Konsulat registration","https://secure.e-konsulat.gov.pl/placowki/140"]
  },
  RUS: {
    DEU: ["German Missions in Russia: general visa information","https://germania.diplo.de/ru-de/service/05-visaeinreise/1623820-1623820"],
    NLD: ["Netherlands Embassy in Moscow: contact","https://www.netherlandsandyou.nl/web/russian-federation/about-us/contact-embassy-moscow"],
    IRL: ["Embassy of Ireland Russia: visas for Ireland","https://www.ireland.ie/en/moscow/services/visas/visas-for-ireland/"],
    POL: ["Polish consulate Moscow: e-Konsulat registration","https://secure.e-konsulat.gov.pl/placowki/82"],
    SWE: ["Sweden Abroad (Russia): apply for a visa","https://www.swedenabroad.se/en/about-sweden-non-swedish-citizens/russia/going-to-sweden/travelling-to-sweden/apply-for-a-visa/"]
  },
  TUR: {
    DEU: ["German Missions in Türkiye: study visas","https://tuerkei.diplo.de/tr-de/service/05-visaeinreise/2616402-2616402"],
    NLD: ["NetherlandsWorldwide: MVV in Türkiye","https://www.netherlandsandyou.nl/your-country-and-the-netherlands/turkey/travel-and-residence/applying-for-a-long-stay-visa-mvv"],
    ESP: ["Embassy of Spain Ankara: study visa","https://www.exteriores.gob.es/Embajadas/ankara/es/ServiciosConsulares/Paginas/index.aspx?scca=Visados&scco=Turqu%C3%ADa&scd=12&scs=Visados+Nacionales+-+Visado+de+estudios"],
    IRL: ["Embassy of Ireland Türkiye: visas for Ireland","https://www.ireland.ie/en/turkiye/ankara/services/visas/visas-for-ireland/"],
    SWE: ["Embassy of Sweden Ankara: contact","https://www.swedenabroad.se/en/embassies/turkey-ankara/contact/"]
  },
  UKR: {
    DEU: ["German Embassy Kyiv: visa information in English","https://ukraine.diplo.de/ua-de/service/05-visaeinreise/2305172-2305172"],
    NLD: ["Netherlands Embassy in Kyiv","https://www.netherlandsandyou.nl/your-country-and-the-netherlands/ukraine/about-us/embassy-in-kyiv"],
    IRL: ["Embassy of Ireland Ukraine: visas","https://www.ireland.ie/en/kyiv/visas/"],
    SWE: ["Sweden Abroad (Ukraine): how to apply","https://www.swedenabroad.se/en/about-sweden-non-swedish-citizens/ukraine/going-to-sweden/visiting-sweden/apply-for-a-visa/"]
  },
  GBR: {
    DEU: ["German Embassy London: D-visa for university studies","https://uk.diplo.de/uk-en/02/university-studies-2449178"],
    ESP: ["Consulate General of Spain London: study visa","https://www.exteriores.gob.es/Consulados/londres/en/ServiciosConsulares/Paginas/Consular/Visado-de-estudios.aspx"],
    ITA: ["Consulate General of Italy London: study visa","https://conslondra.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/study/"],
    POL: ["Poland in the UK: D-type national visa","https://www.gov.pl/web/unitedkingdom/d-type-national-visa"]
  },
  UZB: {
    DEU: ["German Embassy Tashkent: study visa","https://taschkent.diplo.de/uz-de/service/05-visaeinreise/2445770-2445770"],
    ITA: ["Embassy of Italy Tashkent: visas","https://ambtashkent.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/"]
  },
  ARG: {
    DEU: ["German Embassy Buenos Aires: study visa","https://buenos-aires.diplo.de/ar-es/service/visa-einreise/visadeestudio-2194872"],
    ESP: ["Consulate General of Spain Buenos Aires: study visa","https://www.exteriores.gob.es/Consulados/buenosaires/es/ServiciosConsulares/Paginas/index.aspx?scca=Visados&scco=Argentina&scd=40&scs=Visados+Nacionales+-+Visado+de+estudios"],
    ITA: ["Consulate General of Italy Buenos Aires: 2026/27 study visa guidance","https://consbuenosaires.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/studenti-internazionali-nuove-indicazioni-su-visto-e-immatricolazione-per-gli-anni-accademici-2026-2027-e-2027-2028/"]
  },
  AUS: {
    DEU: ["German Missions in Australia: student visa","https://australien.diplo.de/au-en/service/visa/long-term/study-2640466"],
    ESP: ["Embassy of Spain Canberra: study visa","https://www.exteriores.gob.es/Embajadas/canberra/en/ServiciosConsulares/Paginas/Consular/Visado-de-estudios.aspx"],
    ITA: ["Consulate General of Italy Melbourne: long-stay student visa","https://consmelbourne.esteri.it/en/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/italian-and-shengen-area-visas/national-visas-from-91-to-365-days-in-italy/visti-studio-lungo-soggiorno/"]
  },
  BRA: {
    DEU: ["German Missions in Brazil: study visa","https://brasil.diplo.de/br-pt/servicos/vistos/estudo-2568248"],
    ESP: ["Embassy of Spain Brasília: study visa","https://www.exteriores.gob.es/Embajadas/brasilia/pt/ServiciosConsulares/Paginas/Consular/Visado-de-estudios.aspx"],
    ITA: ["Embassy of Italy Brasília: long-stay (D) visas","https://ambbrasilia.esteri.it/pt/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/visto-di-lunga-durata-tipo-d/tipi-di-visto-di-lunga-durata-tipo-d/"],
    POL: ["Poland in Brazil: national (D) visa","https://www.gov.pl/web/brasil/um-visto-nacional-tipo-d"]
  },
  CHL: {
    DEU: ["German Embassy Santiago: university study visa","https://santiago.diplo.de/cl-es/service/05-visaeinreise/2494130-2494130"],
    ESP: ["Consulate General of Spain Santiago: study visa","https://www.exteriores.gob.es/Consulados/santiagodechile/es/ServiciosConsulares/Paginas/index.aspx?scca=Visados&scco=Chile&scd=260&scs=Visados+Nacionales+-+Visado+de+estudios"],
    IRL: ["Embassy of Ireland Chile: visas","https://www.ireland.ie/en/chile/santiago/services/visas/"]
  },
  COL: {
    DEU: ["German Embassy Bogotá: national visas","https://bogota.diplo.de/co-es/service/visa-einreise/1808586-1808586"],
    ESP: ["Consulate General of Spain Bogotá: study visa","https://www.exteriores.gob.es/Consulados/bogota/es/ServiciosConsulares/Paginas/index.aspx?scca=Visados&scco=Colombia&scd=31&scs=Visados+Nacionales+-+Visado+de+estudios"],
    ITA: ["Embassy of Italy Bogotá: university enrolment study visa","https://ambbogota.esteri.it/es/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/visas-requisitos/visas-de-estudio/visa-de-estudio-para-la-inscripcion-en-una-universidad-operante-en-italia/"],
    IRL: ["Embassy of Ireland Colombia: visas for Ireland","https://www.ireland.ie/en/colombia/bogota/services/visas/visas-for-ireland/"]
  },
  MEX: {
    DEU: ["German Embassy Mexico City: long-stay visas","https://mexiko.diplo.de/mx-es/servicios/visa/visaestancialarga/1047218"],
    ESP: ["Consulate General of Spain Mexico City: study visa","https://www.exteriores.gob.es/Consulados/mexico/es/ServiciosConsulares/Paginas/index.aspx?scca=Visados&scco=M%C3%A9xico&scd=195&scs=Visados+Nacionales+-+Visado+de+estudios"],
    ITA: ["Embassy of Italy Mexico City: visas","https://ambcittadelmessico.esteri.it/es/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/"]
  }
};
