# YAR Admin

Internal dashboard + public website for YAR, a travel agency. Arabic (RTL) is the
default language, English (LTR) is fully supported. Light and dark themes, and the
layout adapts from desktop down to phone width.

## Stack

- TanStack Start (React 19 + Vite) for the app shell and public routes
- TypeScript for services, models and tests; JSX for the dashboard screens
- Tailwind CSS v4 for the public site, hand-written theme tokens for the dashboard
- Browser `localStorage` for all data in this phase

## Run it

```sh
bun install
bun run dev
```

Then open the printed local address (usually http://localhost:8080).

## What is in here

| Path | What it holds |
| --- | --- |
| `src/routes/` | Public pages: home / sign-in, About, Contact, Help, legal pages, `/login`, `/dashboard` |
| `src/public-site/` | Public site content, styles and logo artwork |
| `src/yar/` | The dashboard: screens, services, models, accounts, roles, translations |
| `src/yar/features/` | One folder per screen area (bookings, hotels, suppliers, payments, exchange rate, …) |
| `src/yar/services/` | Business logic: pricing, hotel catalog, exchange rate, storage adapters |
| `src/test/yar/` | Vitest tests for the services |
| `legacy/` | Original model build (`dist/`), its tests (`tests/`) and docs (`docs/`) |
| `scripts/` | Developer-only account provisioning helpers |

## Roles

Exactly two roles exist:

- **admin** — everything, including user accounts, the daily exchange rate and deletions.
- **booking_employee** — Overview, Bookings & Orders, Supplier Balances, Customer Inbox.

Every data mutation checks the permission first, so hiding a button is never the only
guard.

## Money rules

- Supplier side is **USD**: supplier net cost, supplier balances, top-ups, invoices.
- Customer side is **IQD**: booking price, customer payments and receipts.
- The admin sets the **USD → IQD rate once per day** (Asia/Baghdad date). Admins get a
  daily reminder if it has not been set, and bookings cannot be saved without today's rate.
- Each booking freezes the rate it was created with, so a later rate change never
  recomputes old records.

## Sign in (local preview)

This build stores accounts in the browser, so it is a working frontend, not production
authentication. Two preview logins are seeded on first run:

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `123456789` | admin |
| `booking` | `123456789` | booking_employee |

Real accounts are provisioned privately with `scripts/provision-yar.mjs` (developer-only).

## Tests

```sh
bun run test                          # service tests (vitest)
node --test legacy/tests/*.test.cjs   # original model tests, run from this folder
```

## Status

Frontend-only mock phase: no backend, no live flight or hotel supplier calls, no payment
gateways, no real email/SMS delivery. Public inquiry forms and the contact form are not
wired to anything yet.
