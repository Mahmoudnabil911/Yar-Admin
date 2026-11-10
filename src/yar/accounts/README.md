# YAR local accounts

This adapter is browser-local, not production authentication. Local storage can be edited by the visitor; permission checks protect normal UI workflows, not hostile clients. No provider, remote delivery or backend was added.

## Private initial administrator and employee setup

This setup creates exactly two active initial accounts: one administrator and one Reception & Booking Employee. **No owner accounts have been created automatically.** Owner-confirmed unique Iraqi phone numbers and passwords are required; the public support phone is not an account identity.

### Recommended private setup

1. Use a trusted local computer with Python 3 and Node.js. Open a private terminal in the project source folder.
2. Run `python3 scripts/setup-yar-accounts.py`.
3. Enter each account's full name, Iraqi mobile number, and password when prompted. Password entry is hidden and does not enter shell history. Use at least 10 characters including a letter and number. Do not paste passwords into chat.
4. If the intended browser already has accounts, first export the account repository privately for review; provide its path and historical account IDs when asked. Extra unrelated accounts cause setup to stop rather than delete them. Existing credential updates require explicit confirmation.
5. Choose a **new private output path outside the project**. The utility creates password verification material only, with owner-only file permissions. Keep both the JSON and installation script private; never upload to the app, commit, email or attach them in chat.

### Install on a fresh owner browser

1. Open the intended YAR preview/site origin in the browser where both accounts should be available.
2. Have a trusted developer open that browser's developer console. Run the contents of the private `<output>.install.js` file **only after reviewing it**. Never paste code from an untrusted source.
3. The installer refuses to replace an existing account repository. Running it again with the same data is harmless. It changes only `YAR_ADMIN_ACCOUNTS_V2`, not bookings, supplier balances or other business data.
4. Sign in using the **administrator mobile number entered in setup**, change its initial password, and verify user management. Sign out, then sign in with the **employee mobile number entered in setup**, change that initial password, and verify the four operational pages. Refresh and sign in again as each.
5. Record the two normalized login identifiers privately for the project owner. Never record passwords in public instructions. No specific owner login identifiers can be reported until the owner supplies them.

### Existing repositories

The utility preserves IDs, original creation metadata, recovery requests, notifications and audit history during an explicitly confirmed merge. It refuses extra accounts, role mismatches, duplicate phone conflicts and unknown historical IDs. No automatic installation script is generated for an existing repository: a trusted developer must review the merge against the current exported account data before applying it, then clear the old local session and test both logins. Do not overwrite newer data or any unrelated storage key.

### Environment-input alternative

Use `node scripts/provision-yar.mjs <new-private-output-path>` with `YAR_INITIAL_NAME`, `YAR_INITIAL_PHONE`, `YAR_INITIAL_PASSWORD`, `YAR_EMPLOYEE_NAME`, `YAR_EMPLOYEE_PHONE`, and `YAR_EMPLOYEE_PASSWORD` supplied through a trusted process environment, not committed configuration or command-line literals. Optional private-review inputs: `YAR_EXISTING_ACCOUNTS_FILE`, `YAR_ADMIN_EXISTING_ID`, `YAR_EMPLOYEE_EXISTING_ID`, `YAR_CONFIRM_EXISTING_UPDATE=owner-approved`. Support-phone use is blocked unless the owner explicitly approves it through `YAR_ALLOW_SUPPORT_PHONE=owner-approved`.

This remains browser-local authentication, not production-grade security. Installing into an automated test browser or another browser profile does not install accounts into the owner's preview. Tests using disposable fixtures do not establish that owner accounts are ready.

Legacy staff records and all operational data remain untouched. Unprovisioned legacy staff appear inactive for review; administrators can supply valid Iraqi mobile numbers and initial passwords using Create User with their historical ID through an explicit migration. New accounts are mapped to the existing booking-assignment interface.

Sessions last 12 hours, revalidate account state on reads, storage events, window focus and every 30 seconds. Password reset/account status changes increment a local session version. Browser tabs share one local session; other devices and browser profiles do not share records. Session read states and reset resolution are separate.

Contact form validation and the inbox UI are available, but shared contact delivery remains disconnected; deletion submission remains disabled, with confirmed telephone support. Web request delivery, operator/controller identity, retention, actual data recipients and refund arrangements require owner review before publication/store submission. Public legal copy is a supplied draft, not a legal-compliance certification.

Phone migration preserves IDs, credentials, active status and existing sessions. Missing/invalid/duplicate numbers are flagged for administrator review and cannot be used to log in. Keep a current administrator session open to review numbers. With no active administrator session, use developer-controlled local repair with owner-confirmed numbers (never invent numbers or restore username login).
