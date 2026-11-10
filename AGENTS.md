<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## YAR Admin architecture
- The dashboard lives in `src/yar/` (JS/JSX, browser-only) and is mounted client-side by `src/components/YarApp.tsx` from `/dashboard`, legacy `/?page=` and `/$page`; it reads localStorage, so it must never be evaluated during SSR.
- Page navigation stays on legacy query params (`?page=`, `?edit=`, `?bookingId=`) via `src/yar/lib/router.js`; never add react-router-dom.
- Roles/permissions are centralized in `src/yar/auth/access.js`; every storage mutation calls `assertCan(action)` so UI hiding is never the only guard (mock auth, not production security).
- Every literal color in legacy CSS/JSX is a `--c-<hex>` variable defined in `src/yar/styles/theme.css` (light = original, dark = generated); new colors must use tokens, not hex.
- English UI is produced by the DOM translator (`src/yar/i18n/translator.js`) from the Arabic→English table in `src/yar/i18n/en.js`; add new Arabic UI strings to that table.
- Layout CSS uses logical properties (inline-start/end) so RTL/LTR flip automatically; do not reintroduce left/right.
- PartoCRS flight types in `src/yar/integrations/partocrs/types.ts` are generated from swagger.json; UI talks only to `flightAdapter` (mock now, protected-backend adapter later); never call PartoCRS from the browser.
- Original model tests run with `node --test legacy/tests/*.test.cjs` against `legacy/dist/`; new tests live in `src/test/yar/`.
- Mark legacy model initialization files and CSS as package side effects so production bundling retains ordered global registrations and styles.

- Public pages use top-level TanStack routes and a separate SSR-safe public layout; legacy dashboard query navigation stays under /dashboard to avoid conflicting with the public home.
- Account credentials, local sessions, reset requests, notifications and audit events use a separate browser-local adapter; only salted PBKDF2 verification material is persisted and the adapter is excluded from business-data import/export. This is not production authentication or cross-device delivery.
- Initial administrator and employee credentials are provisioned through developer-only environment inputs or a local hidden-password terminal prompt; private outputs are never bundled/served, and setup refuses destructive replacement of extra accounts to preserve history.
- Phone normalization is a shared SSR-safe module; account reads flag missing/duplicate numbers without changing IDs, credentials or active status, preserving an existing administrator review session.
- Public inquiry submission remains disconnected; dashboard-only mock inquiries use a separate browser-local adapter with explicit MOCK references and permission guards, never public-request delivery.
- Legacy native date fields are enhanced by one client-only calendar bridge using DayPicker; original inputs retain their validation and change handlers so business date values stay unchanged.
- Owner-requested demo aliases are provisioned into the local repository only after their password hash verifies; existing accounts/data are never overwritten, and later password/status changes remain authoritative.
- Catalog photo dropzones compress browser-selected files for local persistence; the save adapter accepts multipart FormData with nested field names and actual File parts for future server uploads, without network delivery now.
- Use the shared logo component to preserve the original logo shapes while replacing its small embedded subtitle with readable localized text.
- Hotels follow Hotel → room variant (each `rooms[]` entry = category + view + beds) → rate plans; inventory/availability lives on the room variant so all meal plans share one physical pool. Option labels are stable codes in `src/yar/services/hotelCatalog.js` with icons in `features/hotels/hotelIcons.js`; pricing, migration and quotes live in `services/hotelPricing.js`.
- Hotel records upgrade non-destructively via `migrateHotel` (legacy breakfast true/false → one BB/RO compatibility plan at the historical price); bookings store a frozen `serviceInfo.hotelOffer` snapshot so later catalog edits never change history.
- The daily USD→IQD rate lives in a separate browser-local store (`services/fxRate.js` pure helpers + `storage/fxStorage.js`); `operationsStorage.createBooking` is the authoritative converter and freezes `supplierNet {USD amount, rate, date}` on the booking, so UI previews never decide stored money and legacy models stay untouched.
- Hotel schema fields in `models/hotel-schema.js` must list every stored key because catalog sanitize drops unknown keys; extra sample hotels are appended in storage migration, not the seed array, because final-demo derives test records from seed order.
