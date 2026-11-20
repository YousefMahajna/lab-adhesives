# Lab Adhesives

Live: https://yousefmahajna.github.io/lab-adhesives/

## Shared autosave activation

Open [Shared setup](https://yousefmahajna.github.io/lab-adhesives/shared-setup.html). Publish `firebase-database-rules.json` in the Firebase Console, create and verify the owner's `ymahajna@nvidia.com` account, preview the Gist source, then initialize. Setup copies the latest complete inventory to an empty `adhesivesSharedV1` Firebase path using an ETag conditional write. It cannot replace existing inventory. The Gist archive and separate datasheet files are never modified by this version.

Deployment alone does not migrate data or enable writes. Until initialization, the page reads the saved Gist inventory and blocks editing with a Shared setup link. Reload open inventory tabs after initialization.

The supplied Firebase web configuration is a public client identifier, not an admin credential. No service-account keys or GitHub tokens are embedded. Authentication uses the official Firebase SDK, Email/Password and verified NVIDIA email addresses. Users choose a separate lab-app password. Firebase Auth persists the session for this origin across the lab routes.

## Entry and permissions

The regular URL retains the existing name selector. Hub links retain the selected-email handoff, skip the selector and load the shared hub policy. A selected email or legacy editor password does not authorize a database write. Verified Firebase identity and server-enforced grants authorize writes. The verified account's name and role supersede an unverified selection once signed in.

The owner alone initializes and updates `adhesiveAccessV1`. The hub synchronizes that mirror after successful Users saves and reports any sync failure explicitly. Use Shared setup → Sync permissions to retry. Server rules consult the currently saved mirror on every write; revoking Editor prevents further stock writes even from an open tab. General NVIDIA default levels and individual No access entries are supported.

Editors, managers and the owner can edit inventory, shipments and comments. Verified Viewers can add new comments, with their Firebase UID recorded in a wrapper; they cannot edit stock, modify/delete existing comments or upload files. Public read access is retained from the existing deployment. The supplied rules protect the new Adhesives paths and preserve existing public-write behavior at Activities `appState` and `processRecipeLibrary`; those applications have not yet migrated to verified authorization. Never grant `.write:true` at the database root, because ancestor grants bypass child restrictions.

The old exposed GitHub credential must remain revoked. Historical commits and backups can still contain it; deleting it from current source does not invalidate a token.

## Saves and recovery

Every edit attempts an automatic Firebase save. Saves read the latest shared data, merge only changed fields and conditionally write the read ETag. Conflicts re-read and retry at most three times. A confirmed server response clears the recovery record and shows Saved. A failed/unconfirmed write shows Not saved and retains the edit for retry; it does not report success. Datasheet uploads remain in page memory until confirmed, with a before-leaving warning.

Other visible tabs refresh about every ten seconds and on foregrounding. Both direct and hub URLs use the same shared source. Unknown row fields, zero quantities, hidden legacy Owner values, comments, shipments, extra main-file metadata and datasheet references survive migration and normal saves. New datasheets live in the Firebase inventory; existing attachment URLs continue to read the untouched Gist files.

Previous per-email unsaved records are retained. In the original browser, sign in as the matching verified account to recover changed fields over the latest shared data and autosave them. Recovery records are used for connection failures, rather than as the ordinary inventory source. They are removed after confirmed saving. A downgrade to Viewer never replays an Editor's inventory draft.

## Stock and Excel

Min QTY is independently editable after QTY. Below Min QTY is red; Min QTY through below 130% is dark yellow; 130% or higher is normal. Missing values are unknown rather than zero. Red-first/yellow-first sorting and stock-color filters affect only displayed rows. Owner is hidden from the inventory form/table but retained in data and a hidden Excel Owner (legacy) column. Existing workbooks without Min QTY do not reset minima; attachments and unknown row fields survive imports.

`node scripts/weekly-low-stock.cjs` produces a read-only urgent report for Michael and Yousef. It reads Firebase once initialized and uses the Gist only when the new path is absent. A failed Firebase read never falls back to a potentially stale Gist. The separately configured Codex Sunday 09:00 Israel-time automation prepares an Outlook draft for below-minimum items only. The user manually sends it. Yellow warnings do not trigger urgent emails.

## Validation

Run `node --test tests/*.test.cjs` with Node 24. Tests cover source preservation, conflict detection, denied saves, Viewer comment restrictions and server authorization predicates, alongside existing entry, low-stock and merge tests. Rule-predicate tests are not a Firebase emulator; Firebase Console validates rule syntax when publishing. Workspace browser tests mock all writes and check both entry routes, cross-browser saves, failures/retry and recovery. A separate browser check loads the real official Auth SDK without creating accounts, sending emails or writing data.
