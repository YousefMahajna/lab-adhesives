# Lab Adhesives

Live page: https://yousefmahajna.github.io/lab-adhesives/

## Entry paths

Opening the regular page URL keeps the existing name selector and editor-password flow. Stored hub emails do not bypass this selection screen.

When opened from Interconnect Process Lab, the Adhesive Inventory tile passes a selected NVIDIA email in a URL fragment (`#ipl-entry=1&email=...`). The fragment does not contain a role, password, or token and is not sent in HTTP referrer headers. Adhesives loads the published hub policy and reads the current shared `platforms.json` from GitHub with caching disabled. It determines the Adhesives role from that shared configuration:

- Viewer opens in the existing Viewer mode, including its existing commenting behavior.
- Editor, Manager, and Administrator open as Adhesive Editor.
- No access, invalid email, or a failed permission lookup keeps the page blocked. It never falls back to the legacy selector for marked hub links.

Hub entry skips the name/password selector, shows the configured user name and role, and adds a back link to Process Lab. A refresh or changed handoff fragment rechecks permissions. Entry roles are not saved in localStorage or reused by the regular link. Inventory, shipment, and comment deletion/import editing functions also check the current Editor mode.

This is integration with the hub's existing unverified email selection. It does not verify NVIDIA mailbox ownership or create server-side authorization. The regular entry selector and existing cloud data service remain in place. Verified identity and data-service permission enforcement require separate work.

## Shared saving

The page no longer embeds a GitHub API credential. Inventory reads use the existing gist anonymously until a saving connection is established. Choose **Connect saving** to enter a fine-grained token belonging to the owner of that shared gist (currently YousefMahajna), with account permission **Gists: Read and write**. Other GitHub accounts cannot write this owner-owned gist simply because they are lab Editors. An Editor role permits the application editing interface; GitHub independently authorizes shared writes. This is a page-local connection separate from the hub's repository-saving connection.

Tokens are sent only to GitHub API endpoints and kept only in a private page-memory variable. Inputs clear after a connection attempt. Credentials are never included in source, localStorage, sessionStorage, inventory data, or handoff URLs. Disconnecting, reloading, closing the page or an authorization failure clears the connection. **Save** publishes the pending inventory/comment/shipment changes using the existing merge-into-latest behavior.

Disconnected edits are kept in a browser draft for the selected hub email or legacy user name and access role. Reloading restores that draft over the latest shared data. An Editor draft stays separate if that email is subsequently downgraded to Viewer. A confirmed save clears the draft when no newer edits remain. Missing cloud data blocks editing until a valid baseline has loaded. Newly attached files stay in page memory until saved; the page warns before leaving while attachments are pending. Browser draft storage failures are reported. Failed network writes keep the draft and do not report success.

The previous credential was already public, including in repository history and backups. The repository owner must revoke that old credential in GitHub and create a replacement. Removing it from the current page cannot invalidate historical copies. See [GitHub token management](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

## Minimum stock

Inventory shows **Min QTY** immediately after QTY. Each adhesive has an independent editable `minQty`; old rows remain unchanged until an editor explicitly sets a value. Blank/unknown quantities and minimums are not assumed to be zero. QTY below Min QTY is red; QTY from Min QTY up to but below 130% is dark yellow; 130% or above has no stock highlight. Only below-minimum items belong in urgent reports.

Owner is hidden from the inventory table and edit form, but existing `owner` data remains on every saved row. Excel retains Owner in a hidden **Owner (legacy)** column for lossless round-tripping. Min QTY is exported/imported; older workbooks without it leave existing thresholds unchanged. Uploaded datasheet references and unknown row fields survive normal edits and imports. This release does not migrate or rewrite shared inventory data.

Use **Red first** or **Yellow first** to sort by stock urgency, or click the QTY heading to alternate between them. The **Stock color** filter can show only red or only yellow items. These controls affect the displayed rows, not stored inventory order or quantities.

`node scripts/weekly-low-stock.cjs` reads the saved shared inventory and emits an urgent report for Michael (`michaelsk@nvidia.com`) and Yousef (`ymahajna@nvidia.com`). It never sends email, changes inventory, or places orders. A separate Codex desktop automation is configured for Sundays at 09:00 Asia/Jerusalem to create an Outlook email draft only when items are below minimum. Automatic sending is unavailable with the current connector; drafts need manual Send. The schedule is outside this static website and is not installed by cloning this repository.

## Development checks

Run `node --test tests/*.test.cjs` with Node 24. The policy under `tests/fixtures/` is an offline snapshot for contract tests; production loads the published hub policy. The check workflow runs on pull requests and pushes to main. Browser integration checks are maintained in the implementing workspace and intercept all GitHub API requests to avoid changing live inventory.
