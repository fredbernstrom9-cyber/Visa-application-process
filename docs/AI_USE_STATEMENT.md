# AI use statement

The course allows AI "provided that students clearly cite the sources they used and explain how they used the tool, including the prompt or prompts entered". This statement covers that requirement.

## Tool

- **Claude** (Anthropic), used through **Claude Code**, on 24 September 2026.

## What we used it for

1. **Research:** web searches for current (2026) visa and study-permit rules in the EU, restricted to official government, embassy and EU domains, with a source recorded for each fact (see the website's *Sources & AI use* page, `assets/data.js` and `assets/embassies.js`).
2. **Embassy pages:** for each of the 43 passports, searches on each destination's foreign-service website to find the embassy or consulate page that applies, plus each passport country's foreign ministry.
3. **Code:** writing the website (HTML, CSS, JavaScript) in this repository.
4. **Drafting analysis:** the new Environmental and Legal rows and all "Revised" columns of our PESTEL (`docs/PESTEL.md`). An earlier version of the site also had a business-case page drafted by the AI; we removed it in the second round.

## What the group did (complete before submission)

> _Describe your own contribution and checks, for example: "We opened every item marked 'Verify' on the official website, corrected X, checked the embassy links for our own passports, and checked all APA references."_

## Prompts entered (verbatim)

**Prompt 1 (first version)**

```
Im doing a group project in Business organisation, the goal is just to get the highest grade possible, i want you to build me a website, the idea is that Students and travellers in general have a hard time finding information or finding informatiom that´s not outdated, new laws and policies change a lot the time, I want this idea to be EU focused, The core concept is the following: An application on the website where you can select what country your from aka what passport you have and then from that select the country your going to study in/travel to, and then get all necessary information on that, basically collect all information, you can start with the following countries, India, china, USA, canada, middle eastern gulf states, and any other relevant country for the application, Now i also want you to follow these perimeters to optimize my grades, [course outline, assessment criteria and reference expectations pasted here]
```

Pasted before the request as context: our draft PESTEL table ("PESTEL on your first workable problem") and our problem-statement table (problem, goal, root cause, users, size, segment, alternatives, competitors, sources).

**Prompt 2 (current version)**

```
remove the whole business case side as it´s not going to be useful here, but instead add more sources, scrape embassy websites both the local country and the country your travelling to and make sure all info is correct, also have cited sources for each specific country when you select it on the bottom of the page, way more sources and add 25 more countries and make the and verify all information everywhere and also remove the estimation for tution fee
```

## Limits of the AI output

- The AI's research environment could not open government websites directly (its network blocked them). Facts were therefore checked through web searches restricted to official government and EU domains, using the text of the official pages as the search engine returned it. Facts that could not be confirmed exactly are marked **Verify** in the checker and must be checked by hand.
- Re-checking corrected several figures from the first version (listed on the website under *What verification changed*). Rules can change after 24 September 2026.
- The embassy list covers the pages the searches found (150). Where a passport–destination pair has none, the checker points to the destination's worldwide portal.
