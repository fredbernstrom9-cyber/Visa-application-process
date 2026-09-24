# ClearEntry: EU study & travel entry checker

Business Organisation group project. Pick a **passport**, an **EU destination** and a **purpose** (study > 90 days or short stay ≤ 90 days) to get the exact steps, documents, official fees, work rights and deadlines. Every fact carries a numbered citation, and each result ends with its own source list plus the embassy pages for that passport and destination.

The site has two views:

| View | What it contains |
|---|---|
| **Checker** (`#tool`) | The personal checklist with numbered citations, a **Sources** section at the bottom of every result (destination embassy or consulate, your own government, all cited sources), the destination comparison for your passport, and a dated log of 19 rule changes (May 2025 – Aug 2026) |
| **Sources & AI use** (`#sources`) | Method, what verification corrected, the full APA 7 reference list, the embassy directory by passport country, AI use statement with both prompts, disclaimer |

## Coverage

- **43 passports**
  - Most requested: India, China, United States, Canada.
  - Gulf states: UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman.
  - Africa: Algeria, Cameroon, Egypt, Ghana, Kenya, Morocco, Nigeria, Senegal, South Africa, Tunisia.
  - Asia: Bangladesh, Indonesia, Iran, Japan, Malaysia, Nepal, Pakistan, Philippines, South Korea, Sri Lanka, Vietnam.
  - Europe & Central Asia: Kazakhstan, Russia, Türkiye, Ukraine, United Kingdom, Uzbekistan.
  - Americas & Oceania: Argentina, Australia, Brazil, Chile, Colombia, Mexico.
- **27 EU destinations.** Full guides for France, Germany, Netherlands, Spain, Italy, Ireland, Poland and Sweden; basic guides for the other 19, each linked to that country's official study-permit page. Schengen short-stay rules (visa or visa-free, EES, ETIAS status, 90/180) apply to all.
- **Sources:** about 150 cited sources, almost all official, plus 150 embassy and consulate pages and the foreign ministry of each of the 43 passport countries.
- **No tuition estimates.** Tuition is set by each institution, so the checker shows only official government fees.
- **Rules checked:** 24 September 2026. Key figures carry a confidence label: *Official source*, *2+ sources* or *Verify*.

## Run it

It is a static site with no build step and no dependencies.

```bash
# any static server works, for example:
npx serve .
# then open http://localhost:3000
```

Opening `index.html` directly in a browser also works.

### Publish on GitHub Pages

1. Merge this branch into `main`.
2. In the repository go to **Settings → Pages**, choose **Deploy from a branch**, then **main** and **/ (root)**.
3. The site appears at `https://<your-user>.github.io/<repo>/`.

## Update a rule

All rules live in [`assets/data.js`](assets/data.js):

1. Edit the figure in `DEST.<CODE>` (e.g. `DEST.FRA.funds`), and set `conf` to `official`, `multi` or `check`.
2. Point its `src` at one or more ids in `SOURCES` (add a new entry there if needed: type, publisher, date, title, URL). The checker numbers citations automatically.
3. Add a line to `CHANGES` with the date and the source id.
4. Update `VERIFIED` at the top of the file.

Embassy pages are in [`assets/embassies.js`](assets/embassies.js), keyed by passport code and then destination code.

## Files

```
index.html                 checker and sources views
assets/style.css           design tokens (light + dark), layout, components
assets/data.js             the rulebook: passports, destinations, change log, sources
assets/embassies.js        embassy and consulate pages per passport and destination
assets/app.js              checker logic, citations, comparison chart, routing
docs/PESTEL.md             completed and revised PESTEL for the report (not shown on the site)
docs/AI_USE_STATEMENT.md   AI disclosure required by the course (complete the group section)
```

## Before you submit

- Complete the group section of `docs/AI_USE_STATEMENT.md` (and the matching box on the Sources page).
- Open every item labelled **Verify** on its official site.
- The government websites could not be opened directly from the AI's research environment, so facts were checked through searches restricted to official domains. Spot-check the embassy links for your own group's passports.
- The Economic row of `docs/PESTEL.md` still has two unsourced figures from the first draft (0.9% growth, 3% inflation). Add a source or remove them.

## Disclaimer

General information, not legal advice. Always confirm with the official source before you apply.
