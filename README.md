# ClearEntry: EU study & travel entry checker

Business Organisation group project. Pick a **passport**, an **EU destination** and a **purpose** (study > 90 days or short stay ≤ 90 days) to get the exact steps, documents, costs, work rights and deadlines. Every rule is dated and linked to its source.

The site has three views:

| View | What it contains |
|---|---|
| **Checker** (`#tool`) | The personal checklist, the destination comparison for your passport, and a dated log of 13 rule changes (May 2025 – Aug 2026) |
| **Business case** (`#strategy`) | Problem, completed PESTEL, Five Forces, competitors and perceptual map, VRIO, value proposition, SWOT/TOWS, Business Model Canvas, 4Ps, Ansoff, costs/revenue/financing, organisation and HR, innovation, CAGE expansion, SDGs and ethics, limits of the analysis, validation plan |
| **Sources & AI use** (`#sources`) | Method, confidence labels, full APA 7 reference list, AI use statement |

## Coverage

- **18 passports:** India, China, United States, Canada, the six Gulf states (UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman), United Kingdom, Australia, Brazil, Nigeria, Pakistan, Türkiye, Morocco, Vietnam.
- **27 EU destinations.** Full guides for France, Germany, Netherlands, Spain, Italy, Ireland, Poland and Sweden; basic guides with official links for the other 19. Schengen short-stay rules (visa or visa-free, EES, ETIAS status, 90/180) apply to all.
- **Rules checked:** 24 September 2026. Each figure carries a confidence label: *Official source*, *2+ sources* or *Verify*.

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
2. Add or update its source in `SOURCES` (APA 7 text + URL).
3. Add a line to `CHANGES` with the date.
4. Update `VERIFIED` at the top of the file.

## Files

```
index.html            all three views
assets/style.css      design tokens (light + dark), layout, components
assets/data.js        the rulebook: passports, destinations, change log, sources
assets/app.js         checker logic, comparison chart, routing
docs/PESTEL.md        completed and revised PESTEL, ready to paste into the report or slides
docs/AI_USE_STATEMENT.md  AI disclosure required by the course (complete the group section)
```

## How the project maps to the course

| Course element | Where |
|---|---|
| LO1a: frameworks to diagnose a problem | Business case sections 2–10 (PESTEL, Five Forces, VRIO, SWOT, BMC, 4Ps, Ansoff) |
| LO2a: limits and inconsistencies of methods | Business case §1 "Critical note", §16 "Limits of our analysis"; *Verify* labels in the checker |
| LO4a: ethical, social, environmental values | Business case §15 (SDGs 4, 10, 16, 17 and six ethical dilemmas); PESTEL Environmental row |
| Sessions 3–5: industry, resources, competitive advantage | §3 Five Forces, §4 positioning, §5 VRIO |
| Session 6: portfolio and business model | §8 BMC, §10 Ansoff (and why BCG does not fit yet) |
| Session 7: positioning and marketing mix | §4 perceptual map, §9 4Ps |
| Sessions 8–9: innovation, costs, finance, revenue | §11, §13 |
| Sessions 9–10: structure, human capital | §12 |
| Session 11: global expansion | §14 CAGE |
| Reference expectations (APA, 2+ sources, credibility) | *Sources & AI use*; confidence labels; commercial sources only where a second source agrees |

## Before you submit

- Complete the group section of `docs/AI_USE_STATEMENT.md` (and the matching box on the Sources page).
- Check every item labelled **Verify** on its official site.
- The Economic row still has two unsourced figures from the first draft (0.9% growth, 3% inflation). Add a source or remove them.

## Disclaimer

General information, not legal advice. Always confirm with the official source before you apply.
