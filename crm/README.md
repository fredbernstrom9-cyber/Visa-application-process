# ClearEntry Teams: EU / Schengen visa case CRM and live analytics

A multi-tenant B2B web app for universities, business schools and student-recruitment agencies to manage and track their applicants' EU / Schengen visa cases: pipeline, document checklists, risk scoring, applicant portal, real-time collaboration and an analytics dashboard.

> The app **starts empty**. There is no seed or demo data. A new organisation is guided through three first steps: set processing times, build a checklist, import applicants.

| | |
|---|---|
| Stack | Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 + shadcn/ui-style components · Supabase (Postgres, Auth, Storage, Realtime) · TanStack Table / Query · dnd-kit · Recharts · Zod · Stripe |
| Tenancy | Shared database, `org_id` on every row, **Row Level Security on every table**, same-tenant composite foreign keys |
| Tests | Vitest (unit + database/RLS), Playwright (end-to-end against a real database) |

> **Where is this?** The repository root also holds an older static site (`index.html`, `assets/`). This app lives in `crm/` and is independent of it. On Vercel set **Root Directory = `crm`**.

---

## Contents

1. [Features](#features)
2. [Try it locally in 2 minutes (no Supabase account, no Docker)](#try-it-locally)
3. [Set up your own Supabase project](#supabase-project)
4. [Environment variables](#environment-variables)
5. [Stripe billing](#stripe)
6. [E-mail](#email)
7. [Scheduled job (cron)](#cron)
8. [Deploy to Vercel](#vercel)
9. [Testing](#testing)
10. [Project layout](#layout)
11. [Security and privacy notes](#security)
12. [Known limitations](#limitations)

---

## <a id="features"></a>Features

- **Organisations and roles**: e-mail + password or magic-link sign-in, invitations by e-mail, roles *owner / admin / advisor / viewer*. Advisors see only applicants assigned to them unless an admin grants "view all".
- **Applicants and cases**: full applicant profile, EU/Schengen destination, visa type (C / D / other), intake, start and appointment dates, advisor, tags, notes. Every stage change is stored with user and timestamp.
- **Views**: data grid (search, multi-filter, sort, column chooser, saved and shared views, bulk actions), drag-and-drop pipeline (pointer, touch and keyboard, plus a "Move to…" menu for phones), case detail with presence.
- **CSV / XLSX import**: automatic column matching, manual mapping step, per-row validation, preview before anything is saved, de-duplication on e-mail, downloadable error report.
- **Document checklists**: templates per destination + visa type with optional nationality override, official source and "last checked" date; applied automatically to new cases; per-item status, due date, comment and private file upload with expiring signed URLs.
- **Risk scoring**: transparent and configurable (days to start vs. processing time, appointment, % documents verified). The reason is shown next to every score, e.g. *"Starts in 21d · no appointment · 40% docs verified · needs ~44d"*.
- **Live tracking**: lists, board, KPIs and charts update without refresh via Supabase Realtime; online presence and "also viewing this case"; highlight on rows changed by others; connection indicator with automatic resync; live activity feed with filters; per-case timeline.
- **Notifications**: bell + toast for *became high risk*, *overdue document / task*, *decision recorded*, *assigned to me*; optional daily e-mail digest behind a provider interface.
- **Analytics dashboard** (Premium): 9 KPIs with change vs. the previous period, pipeline funnel with conversion, weekly throughput, acceptance by destination and nationality (with sample size), time per stage (bottleneck), start-date horizon scatter, cohort progress per intake, advisor workload; global filters; click-through drill-down; CSV / XLSX export per chart or as one workbook; one-page PDF intake report.
- **Tasks and deadlines**: tasks per case, *My tasks*, and a deadline timeline (Overdue / This week / Next 30 days / Later) combining start dates, appointments, document and task due dates.
- **Applicant portal** (Premium): per-case secure link (256-bit token, only its hash stored, expiring, revocable, rate limited) where applicants see their checklist and upload documents without an account. Uploads appear live for the advisor.
- **Plans and billing**: `canUse(org, feature)` in one place (`src/lib/plans.ts`), mirrored and enforced inside the database; Stripe Checkout, customer portal and webhooks.
- **Privacy**: private storage, signed URLs, per-applicant data export (JSON) and right-to-erasure (database rows *and* files), append-only audit log.

Free plan: 1 user, 10 applicants, no analytics. Premium: unlimited applicants and seats, analytics, live tracking, import / export, portal links, reports.

---

## <a id="try-it-locally"></a>Try it locally in 2 minutes (no Supabase account, no Docker)

You need Node 20+ and a local PostgreSQL 15+ server **binary** (`initdb`/`pg_ctl`, e.g. `apt install postgresql`). The repo ships a small Supabase-compatible stack (PostgreSQL + PostgREST + an auth/storage gateway) that runs the **real migrations and RLS policies**. It is for development and tests only. Realtime websockets are not emulated, so the header will show "Reconnecting…"; use a real Supabase project to see live updates.

```bash
cd crm
npm install
npm run stack:start          # starts Postgres, PostgREST and the gateway; downloads PostgREST once
npm run stack:env > .env.local
echo 'CRON_SECRET=dev-secret' >> .env.local
npm run dev                  # http://localhost:3000
```

Sign up, create an organisation and you land on an empty workspace with the setup guide. To unlock Premium locally:

```bash
psql postgresql://postgres@127.0.0.1:54329/clearentry_dev -c "update organizations set plan = 'premium'"
```

`npm run stack:reset` wipes the dev database; `npm run stack:stop` stops the services. The stack rebuilds the database automatically when a migration changes. E-mails sent by the auth gateway (magic links, recovery) are listed at `http://127.0.0.1:54321/__mail`.

---

## <a id="supabase-project"></a>Set up your own Supabase project

1. **Create a project** at [supabase.com](https://supabase.com) (pick a region close to your Vercel region).
2. **Apply the migrations** in `supabase/migrations/` (they are ordered and idempotent per environment):
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   Or paste each file, in order, into the SQL editor. The migrations create the schema, RLS policies, triggers, RPCs, the private `case-documents` storage bucket, storage policies, the Realtime publication and the plan tables. They contain **no demo data**.
3. **Authentication → Providers**: keep *Email* enabled and **leave "Confirm email" on**: invitations are bound to a verified address.
4. **Authentication → URL Configuration**: set *Site URL* to your deployed URL and add to *Redirect URLs*: `https://your-domain/auth/callback` and `https://your-domain/auth/confirm` (and `http://localhost:3000/**` for development).
5. *(Optional)* **Authentication → Email Templates**: to use the token-hash flow, point the confirmation / magic-link / recovery links at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/overview` (`type=magiclink`, `type=recovery` respectively). The default PKCE links work out of the box through `/auth/callback`.
6. **Authentication → SMTP**: configure a real SMTP provider for production; the built-in mailer is rate limited.
7. **Realtime**: nothing to enable: the migration adds the tables to the `supabase_realtime` publication. Make sure *Realtime* is on for the project.
8. **API keys**: copy the project URL, the `anon` / publishable key and the **service-role key** into your environment (see below). The service-role key bypasses RLS: it is used only in server code (portal, Stripe webhook, cron, GDPR erasure) and must never be exposed to the browser.
9. *(Optional)* **Types**: `npm run db:types` regenerates `src/lib/database.generated.ts` with the Supabase CLI (the app works with hand-written row types).

To re-create the database in a new project, simply run the migrations again; to change the schema, add a **new** migration file rather than editing an applied one.

---

## <a id="environment-variables"></a>Environment variables

Copy `.env.example` to `.env.local`.

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | anon / publishable key (browser + server, RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | service-role key, **server only** (portal, webhooks, cron, erasure, rate limiter) |
| `NEXT_PUBLIC_APP_URL` | yes | canonical public URL, used in e-mail links, Stripe return URLs and portal links |
| `NEXT_PUBLIC_APP_NAME` | no | product name shown in the UI (default *ClearEntry Teams*) |
| `STRIPE_SECRET_KEY` | for billing | Stripe secret key |
| `STRIPE_PRICE_ID_PREMIUM` | for billing | recurring Price ID of the Premium plan |
| `STRIPE_WEBHOOK_SECRET` | for billing | signing secret of the webhook endpoint |
| `CRON_SECRET` | for cron | bearer secret protecting `/api/cron/daily` |
| `OWNER_ACCESS_USER_ID`, `OWNER_ACCESS_KEY_HASH` | no | enable the private [owner link](#owner-access) (both required) |
| `EMAIL_PROVIDER` | no | `console` (default; logs e-mails) or `resend` |
| `EMAIL_FROM`, `RESEND_API_KEY` | with `resend` | sender and API key |

Without Supabase variables the app shows a setup page instead of crashing. Without Stripe variables billing is disabled and the upgrade button explains why.

---

## <a id="owner-access"></a>Owner quick access (optional)

A private link that signs **one** account (the site owner's) in without a password or an e-mail round trip: `https://your-domain/owner#key=<secret>`. Treat the link like a password: anyone who has it is signed in as the owner.

- It is **off** unless both `OWNER_ACCESS_USER_ID` (the owner's id from Supabase → Authentication → Users) and `OWNER_ACCESS_KEY_HASH` are set. Only that single account can ever be signed in this way.
- Generate the secret and its hash (only the hash is stored in the environment, so a leaked environment does not leak the link):
  ```bash
  SECRET=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
  echo "link:  https://your-domain/owner#key=$SECRET"
  echo "hash:  $(printf %s "$SECRET" | sha256sum | cut -d' ' -f1)"   # -> OWNER_ACCESS_KEY_HASH
  ```
- The secret lives in the URL *fragment*, which browsers never send to servers, logs or other sites; the page removes it from the address bar immediately. Attempts are rate limited (5 per 10 minutes per IP).
- To revoke the link, change or delete `OWNER_ACCESS_KEY_HASH` and redeploy.

---

## <a id="stripe"></a>Stripe billing

1. In Stripe create a **Product** "Premium" with a recurring **Price** (flat fee: the plan has unlimited seats). Put its ID in `STRIPE_PRICE_ID_PREMIUM`.
2. Add a **webhook endpoint** `https://your-domain/api/stripe/webhook` subscribed to: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Enable the **Customer portal** (Settings → Billing → Customer portal) so customers can update cards, see invoices and cancel.
4. Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook` and use the printed `whsec_…` as `STRIPE_WEBHOOK_SECRET`.

How it behaves: Checkout is created server-side with `client_reference_id` = organisation id; the **webhook is the source of truth** for the plan. Events are verified, de-duplicated (`stripe_events`) and applied in timestamp order (late events cannot undo newer ones). `active`, `trialing` and `past_due` (grace period) keep Premium; anything else returns the organisation to Free. Downgrading never deletes data; it only prevents adding beyond the Free limits.

---

## <a id="email"></a>E-mail

Application e-mails (invitations, notification digest) go through the `EmailProvider` interface in `src/lib/email/index.ts`. Two providers ship: `console` and `resend`. Add another by implementing `send()` and registering it in `getEmailProvider()`. Supabase Auth e-mails (confirmation, magic link, recovery) are sent by Supabase through the SMTP you configure there.

---

## <a id="cron"></a>Scheduled job (cron)

`vercel.json` schedules `GET /api/cron/daily` every day at 05:00 UTC. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set. The job refreshes risk, raises *became high risk* and *overdue* alerts, purges expired rate-limit rows and sends the opt-in e-mail digest.

Without any cron, the dashboard also triggers a throttled (30 min per organisation) maintenance run whenever someone opens the Overview, so alerts still work; the cron guarantees they fire on days nobody logs in. Alternative: schedule `select public.run_maintenance();` with `pg_cron` in Supabase.

---

## <a id="vercel"></a>Deploy to Vercel

1. Import the repository; set **Root Directory** to `crm`. Framework preset: Next.js (build `next build`, default).
2. Add the environment variables above (Production + Preview). Use a different Supabase project and Stripe test keys for Preview.
3. Set `NEXT_PUBLIC_APP_URL` to the production domain, add the domain to Supabase redirect URLs and create the Stripe webhook.
4. Deploy. Verify `GET /api/health` returns `{"ok":true,"supabaseConfigured":true}`.

---

## <a id="testing"></a>Testing

```bash
npm run typecheck      # tsc
npm run lint           # eslint
npm test               # unit tests (Vitest): risk, plans, filters, import mapping, KPI deltas, PDF, deadlines
npm run test:db        # database + RLS tests on a throw-away Postgres (starts one automatically)
npm run test:e2e       # Playwright end-to-end (builds the app, starts the local stack)
```

- **`tests/db`** runs the *real migrations* against PostgreSQL and proves, among other things, that a user in org A cannot read, update, delete or attach rows to org B in any table, view, RPC or storage path (`rls.test.ts`); that triggers, risk, import, erasure and the rate limiter behave (`workflow.test.ts`); that every analytics function returns the right numbers and respects filters and advisor scoping (`analytics.test.ts`); and that the SQL and TypeScript risk implementations agree on 600 random cases (`risk-parity.test.ts`). Set `TEST_DATABASE_URL` to use your own server.
- **`tests/e2e`** drives the production build in Chromium (desktop and phone) through sign-up, magic link, rate limiting, the full setup → checklist → applicant → documents → pipeline → deadlines journey, Free-plan limits, CSV import, the dashboard and drill-down, grid filters / saved views / bulk actions / export, invitations and roles, cross-organisation isolation, uploads with signed URLs, the applicant portal, GDPR export / erasure, Stripe webhooks, the PDF report and the daily job.
- CI (`.github/workflows/crm.yml`) runs all of the above.

---

## <a id="layout"></a>Project layout

```
crm/
  supabase/migrations/     schema, RLS, triggers, RPCs, analytics, storage, grants
  src/app/                 routes: (auth), (app) workspace, portal, api (billing, stripe, cron, reports)
  src/components/          ui primitives, app shell, grid, pipeline, case, charts, settings, portal, live
  src/lib/                 plans, risk, filters, import mapping, export, supabase clients, server actions, queries
  tests/{unit,db,e2e}/     Vitest and Playwright suites
  scripts/                 local Postgres + Supabase-compatible dev stack
  DECISIONS.md             log of key technical choices
```

---

## <a id="security"></a>Security and privacy notes

- Row Level Security is enabled on **every** table; clients can only read the tables they need and write specific columns (billing, system and audit columns are not writable). Plan limits are enforced by triggers, so they cannot be bypassed through the API.
- Documents live in a **private** bucket under `{org}/{case}/{item}/…`; storage policies check tenant and case access; downloads use 2-minute signed URLs. The applicant portal never exposes storage credentials: uploads use server-issued, single-use signed upload URLs.
- Portal and invitation tokens are 256-bit random values; only SHA-256 hashes are stored. Portal pages are `no-store`, `noindex`, `no-referrer`, and rate limited per IP and token.
- Auth endpoints are rate limited per IP and per e-mail (Postgres-backed limiter, works across serverless instances).
- CSV / XLSX exports neutralise spreadsheet formulas; file names and MIME types of uploads are validated; sensitive routes check origin and role.
- Audit log: stage changes, document verification, role changes, deletions, plan changes, exports, portal links. It never stores personal data and survives applicant erasure as an anonymous record.

---

## <a id="limitations"></a>Known limitations

- **Realtime** is exercised by hand against a Supabase project, not by the automated suite (the local stack has no websocket server). The provider degrades gracefully (polling on window focus) and shows its status.
- Spreadsheet import reads `.csv` and `.xlsx` (not legacy `.xls`).
- The PDF report is a single fixed one-page template; charts in it are simple vector bars.
- Checklist templates are never pre-filled: requirements differ by consulate and change often, so each organisation records its own with the official source and the date it last checked it.
- Risk is an estimate from the assumptions you configure, not a prediction of the consulate's decision. Always confirm requirements with the consulate or the official portal.
