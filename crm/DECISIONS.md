# Technical decisions

A running log of the choices that shape this codebase, with the reason for each. Newest decisions go at the bottom of their section.

## Repository and tooling

- **App lives in `crm/`.** The repository root already holds an unrelated static site (GitHub Pages). A sub-folder keeps both deployable; on Vercel set Root Directory to `crm`.
- **Next.js 16 App Router, `src/proxy.ts`.** Next 16 renamed `middleware` to `proxy`. The proxy only refreshes the Supabase session and gates private routes using `getClaims()` (cheap, no network). Authoritative checks use `getUser()` in the layout, server actions and route handlers; the database enforces authorisation regardless.
- **shadcn/ui-style components are hand-written** (`src/components/ui`). The shadcn registry was not reachable from the build environment, and the components are small wrappers over Radix + `class-variance-authority`, so they are owned code. Native `<select>` is used for form selects (best on phones, fully accessible).
- **TypeScript 5.9, ESLint 9, TanStack Table 8.** The newest majors (TypeScript 7, ESLint 10, Table 9) were available but change tooling or APIs substantially; the product does not need them.
- **No generated Supabase types.** Row shapes are written by hand in `src/lib/types.ts` and results are cast at the query boundary. `npm run db:types` generates official types if you prefer them.
- **Data fetching: TanStack Query in the browser, server actions for writes.** Reads go straight from the browser to Supabase under the user's JWT (RLS is the security boundary, so there is no API layer to forget to protect). Mutations are server actions that validate with Zod, check role/plan for friendlier errors and translate database errors. Query keys start with a table-group prefix so the Realtime layer can invalidate by prefix.
- **Server-action files export only async functions** (a Next requirement), so shared constants live in `src/lib/uploads.ts`, `src/lib/tokens.ts` etc.

## Multi-tenancy and security

- **Shared schema, `org_id` everywhere, RLS everywhere.** Policies use `SECURITY DEFINER` helper functions in a non-exposed `private` schema with an empty `search_path` (`my_org_ids()`, `my_wide_org_ids()`, `my_assigned_case_ids()` …) evaluated as hashed sub-plans, which keeps list queries fast and avoids recursive policy evaluation.
- **Same-tenant composite foreign keys.** Child tables reference `(id, org_id)` of their parent, so a row from organisation A can never point at a case, applicant or template of organisation B even if an application bug tried. `assigned_to` / `assignee_id` are checked to be members of the same organisation by trigger.
- **Roles.** `viewer` is read-only org-wide; `advisor` sees assigned cases only unless `memberships.can_view_all`. Membership changes go through audited `SECURITY DEFINER` RPCs (`set_member_role`, `remove_member`, `accept_invitation`), never direct table writes; the last owner cannot be removed.
- **Column-level privileges.** After revoking everything, only needed columns are granted (`grant update (name) on organizations`). Customers cannot write `plan`, billing columns, `docs_verified`, `max_stage_ord`, `verified_by`, audit rows or events. The activity/audit tables are written only by triggers and `SECURITY DEFINER` helpers, so actors cannot be forged.
- **Plan limits live in the database.** Free's 1 seat / 10 applicants are enforced by triggers (locking the org row) and Premium-only RPCs call `assert_feature`. `src/lib/plans.ts` is the single TypeScript source (`canUse`), and a unit test parses the migration to prove both agree.
- **Tokens are hashed.** Invitation and portal tokens are 256-bit random values; only the SHA-256 is stored, so a database leak does not leak working links. Raw links are shown once at creation.
- **Applicant portal uses the service role, narrowly.** The token is validated by `portal_get(hash)`, which returns only the one case behind it. File registration is a `SECURITY DEFINER` function callable only by the service role; the server generates the storage path and a single-use signed upload URL, so the browser never chooses where a file goes.
- **Rate limiting in Postgres.** `rate_limit_hit()` is a fixed-window counter (service role only). It works across serverless instances without Redis. It fails open (and logs) if the limiter itself is down, so an outage cannot lock everyone out. Tradeoff accepted: ~1 small write per protected request.
- **Same-origin checks on cookie-authenticated POST routes** (billing). Server actions rely on Next's built-in origin protection.
- **Open redirects** are prevented by `safeNext()`; e-mail links use the configured `NEXT_PUBLIC_APP_URL`, never the request `Host`, so a forged Host header cannot redirect a victim.
- **Owner quick access is a bearer link, kept deliberately narrow.** Founders asked to skip the login for themselves. Instead of weakening authentication for everyone, an optional route exchanges a 256-bit secret for a *normal* Supabase session (admin `generateLink` + `verifyOtp`, i.e. the same machinery as an e-mailed magic link) for exactly one configured user id. The environment holds only SHA-256 of the secret (compared in constant time); the secret travels in the URL fragment so it never reaches server logs or `Referer`; it is rate limited, same-origin only and answers every failure identically. The tradeoff is accepted and documented: whoever holds the link is the owner, so it must be treated like a password and can be revoked by changing the hash.
- **Exports defuse formula injection** (`'=…`) in CSV and rely on typed string cells for XLSX.

## Domain model

- **Applicants and cases are separate tables.** A person can have several cases (re-application after refusal, second destination). The Free limit counts people (applicants). The grid lists cases joined to their applicant through the `case_overview` view.
- **`case_overview` is the single read model.** It joins applicant, advisor and **live-computed risk** (`security_invoker`, so RLS applies). Risk is never stored per row for display, so "Starts in 21d" is always current; a small `case_risk_cache` table remembers the last level only to detect *became high risk* transitions for notifications.
- **Risk model** (`private.risk_calc`): `slack = days_to_start − estimated_days_needed`, where before submission `needed = max(doc-prep remaining, appointment remaining) + processing days` and after submission `needed = processing days − days since submission`. Thresholds (default high < 0, medium < 14 days) and per-destination (and optionally per-visa-type) times are organisation settings, with organisation-wide fallbacks. The same arithmetic exists in TypeScript for the settings simulator; a parity test compares them on 600 random inputs (integer ceiling avoids float drift).
- **Stage history table** (`case_stage_history`, trigger-maintained) feeds time-in-stage and cohort analytics, while `submitted_at`, `decided_at` and `max_stage_ord` columns make throughput, funnel and medians cheap. Moving a case backwards never lowers `max_stage_ord`, so the funnel counts "reached".
- **Activity payloads carry no personal data.** Names are joined at read time (`activity_feed` view), so deleting an applicant removes every trace by cascade. The audit log keeps only IDs and enums; erasure additionally blanks the metadata of entries about that person and records an anonymous `applicant.erased`.
- **Checklist templates are matched by destination + visa type, nationality override first.** Applying is idempotent through a unique `(case_id, template_item_id)` index. Template item IDs are stable across edits so already-applied checklists keep their link.
- **Comments on checklist items are visible to the applicant in the portal** (they are how an advisor says "photo too blurry"); internal notes belong on the case.
- **No seed data, including checklists.** Requirements vary by consulate and nationality and change often; shipping pre-filled lists would be both a liability and a lie. The only inserted rows are the plan tables.

## Analytics

- **SQL RPCs with one filter function.** `filtered_cases(org, filters jsonb)` is used by the grid, board, exports, reports and every analytics function, so a filter means the same thing everywhere and drill-down links are exact. All analytics functions are `SECURITY INVOKER`: advisors automatically get analytics for their own cases only; Premium is checked inside each function.
- **The date range filters cases by the date they were admitted** (`opened_on`). "Previous period" is the equally long window just before, computed with the same function, so every KPI is comparable like-for-like; it also lets agencies import historical cases with their real dates. Throughput charts count events (submission, decision) of the in-scope cases by week. When the range is "All time" no comparison is shown rather than inventing one.
- **Cohort view** reconstructs, for every case and every week before its start date, the furthest stage reached by then from the history table, and shows the share of the intake at each stage per week. Only weeks that have already happened are included.
- **Charts follow the data-viz palette rules**: fixed-order categorical slots validated for colour-vision deficiency, risk shown with colour **and** shape/icon **and** text, hairline recessive grids, text in ink tokens, legend for every multi-series chart, a table view and CSV/XLSX export for every chart.

## Realtime

- One channel per organisation carries Postgres changes (filtered by `org_id`; RLS decides what each subscriber receives), Presence (who is online and which case they view) and Broadcast (ephemeral "X is moving this card" and cache invalidations).
- Postgres-change DELETE events cannot be filtered by organisation, so deleting clients broadcast an `invalidate` message instead of relying on them.
- Changes by other people (their user id differs from `updated_by`, or the applicant portal) briefly highlight rows and cards. "Live · synced Ns ago" is backed by a 15 s health check of the joined channel; after any reconnect, tab refocus after 30 s hidden, or `online` event, everything refetches once. The provider rebuilds the channel after 45 s of failure.
- Live tracking is a Premium feature; on Free the provider stays off, the header says so, and data refreshes on window focus.

## Billing

- **The webhook is the source of truth.** Checkout success redirects only change the UI message; the plan changes when a verified `customer.subscription.*` event is applied. Events are de-duplicated by id and ignored if older than the last applied (`billing_event_at`). `past_due` keeps Premium during Stripe's retry window.
- Premium is a flat price with unlimited seats (per the product spec), so no seat sync is needed.

## Testing strategy

- **Database tests run the real migrations on plain PostgreSQL** using a ~60-line compatibility shim for the Supabase-only pieces (`auth.uid()`, `storage.objects`, roles, publication). This makes RLS proofs cheap and runnable anywhere.
- **End-to-end tests use a Docker-free local stack** (Postgres + PostgREST + a ~400-line GoTrue/Storage-compatible gateway in `scripts/dev-stack`). Because storage object access in the gateway runs through the real `storage.objects` policies, and PostgREST evaluates real RLS, the end-to-end suite exercises genuine authorisation. The gateway is explicitly not production code. It cannot emulate Realtime websockets; those flows are verified manually against Supabase.
- Tests create their own data (unique e-mails and organisations); nothing is seeded into the product.
