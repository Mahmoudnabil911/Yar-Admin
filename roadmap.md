# YAR Admin roadmap

## Done
- [x] Port existing React dashboard into the project (legacy `?page=` links kept)
- [x] Mock sign-in, two roles, page guards + action-layer permission checks
- [x] Fix booking drawer / payment details wiring; confirmations for cancel & issue
- [x] Remove electronic payment gateway UI (history kept); manual methods = office / bank
- [x] Supplier balances read-only for employees; admin-only refund & credit return
- [x] Light/dark theme (no flash), Arabic/English with RTL/LTR
- [x] Staff roles limited to admin / booking employee; legacy roles flagged; last-admin guard
- [x] Demo data JSON export/import with duplicate protection
- [x] PartoCRS flight types from swagger + mock adapter + demo flow
- [x] Tests: permissions, flight adapter, original 121 model tests

## Open
- [x] Supplier side in USD, customer side in IQD; admin-only daily USD rate with daily reminder, top-bar rate button, booking block without today's rate, frozen rate per booking; browser-verified admin/employee, English dark 390px; 79 vitest passed
- [ ] Printable customer invoice (IQD) and supplier invoice (USD) documents — not built yet; receipts/statements exist on screen
- [x] Public Sign In link beside About; bolder legible YAR logo letters
- [x] Hotel management: tabs, categorized facilities and room amenities with matching icons, room variants (view/beds/occupancy), meal plans and multiple rate plans, seasons, shared availability, galleries, review/publish, list filters, booking offer picker with frozen snapshot, legacy migration; browser-verified publish, 1,640,000 IQD HB quote booking, employee blocked, dark/English/390px; 73 vitest + 121 legacy tests passed
- [x] Expand room details and minimum-room price display; local photo dropzones with multipart File fields, dark dropdown contrast and bilingual logo subtitle; room price/details/photo save and refresh verified, 134 tests passed
- [x] Improve light-mode logo/photo, inbox mock emails, shared themed calendars and home header; browser-verified both themes, English, 790px and 390px; 148 focused/legacy tests passed
- [ ] Verify published dashboard after republishing — existing deployment drops model registration files; package side-effect preservation corrected locally, publishing requires owner action
- [x] Clarify the Sign In form title without redesigning the page
- [x] Private provisioning for exactly two initial active accounts, preserving existing data; both disposable fixture logins, first-password changes, refresh and role access browser-tested; 43 tests passed
- [x] Owner-requested admin/booking local aliases provision on valid first sign-in; both direct dashboard logins, refresh and four-page employee access verified without backend
- [x] Phone-only identity, safe existing-account review, phone recovery and administrator account forms
- [x] Login homepage, redesigned Contact and complete eight-section bilingual About
- [x] Customer Inbox UI/service contracts, four-page employee access, overview shortcut and notification navigation
- [x] Verify phone rules, inbox permissions, public pages and existing workflows
- [x] Replace selectable sign-in with phone and password; developer-controlled provisioning script
- [x] Administrator-only account management, status checks, profile and password-change utilities
- [x] Administrator-managed password recovery, mandatory password change, and persistent event-driven notifications
- [x] Public homepage/login and all supplied bilingual information, support and legal pages
- [x] Verify public routes, admin account creation, employee first-password change, recovery notifications and mobile layouts
- [ ] Activate shared Customer Inbox delivery, persisted follow-up and notifications — blocked by absent authorized backend and genuine server-verified authentication; UI/contracts only, no messages received
- [ ] Contact/deletion legal publication review — needs operator/controller and retention facts plus actual deletion delivery
- [ ] English text for admin-only pages (catalog editors, content, audience, pricing, reports, provider ops) — partly still Arabic
- [ ] Wide tables → stacked cards on phones (currently scroll inside their panel)
- [ ] Real backend + secure sign-in + PartoCRS server adapter (needs backend decision)
