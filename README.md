# Local-First Personal Finance Tracker

**Neraca** is a personal finance web app that stores financial records in your
browser using IndexedDB. Track accounts, spending, assets, debts, budgets, and
financial goals without creating an account or setting up a server database.
The current interface is in Indonesian, with Indonesian rupiah (IDR) as its
base currency.

Each person runs their own copy or opens the app in their own browser profile.
Financial records are not shared between users or synced between devices.

Start with the [Windows setup and update guide](docs/GETTING_STARTED.id.md).
Read the [Indonesian user guide](docs/USER_GUIDE.id.md) for step-by-step usage,
or [architecture and calculations](docs/ARCHITECTURE.md) for how the app works.

## Features

- Dashboard for assets, debt, net worth, liquidity, and monthly cash flow.
- Bank, cash, and e-wallet accounts with transfers and reconciliation.
- Income, expenses, debt payments, asset purchases, and asset sales.
- Manual asset valuations and BTC, ETH, and USDT market-price tracking.
- Category budgets, recurring budgets, and recurring transactions.
- Financial goals, emergency-buffer settings, and rule-based financial analysis.
- JSON backup/restore and transaction export to CSV.
- Responsive desktop-first interface and a PWA shell for offline reuse after loading.

Crypto purchase input uses an IDR amount and a USD purchase price to estimate
the quantity held. Public CoinGecko USD/IDR quotes refresh approximately every
60 seconds while the app is open. These are market estimates, not a connection
to an exchange account. Requests contain coin IDs and currencies, not your
balances or quantities. Live prices require internet access and may be
unavailable if the provider is rate-limited.

## Requirements

- Node.js 22.13 or later and npm.
- Git, for cloning the repository and downloading updates.
- A modern browser with IndexedDB support.

No `.env` file, login, bank API, or server database is needed for the finance app.

## Quick start

```bash
git clone https://github.com/Tonyraflysudarsono/local-first-personal-finance-tracker.git
cd local-first-personal-finance-tracker
npm ci
npm run dev
```

Open the local URL printed in the terminal, normally `http://localhost:3000`.
Keep the terminal running while using the app. Press `Ctrl+C` to stop it.
On Windows PowerShell, use `npm.cmd` if your execution policy blocks `npm.ps1`.
Create an account with its opening balance, then record transactions. The app
starts without permanent sample financial records.

For a production build:

```bash
npm run build
npm start
```

Both development and production servers use localhost by default. The production
server uses port 3000; set `PORT` to change it or `HOST` to explicitly change the
listening address. The development server stops if its chosen port is already
in use instead of silently switching to another origin with separate data.
PWA installation and service workers require HTTPS or localhost. Sharing this
repository makes the source available; it does not create a publicly hosted app.

## Data and backups

Financial records are stored in IndexedDB under your browser profile and origin
(protocol, hostname, and port). Clearing site data or moving to another browser,
device, or origin requires restoring a backup.

Use **Backup & Pengaturan** to export a JSON backup, restore it, or export
transactions to CSV. Keep backups private. Backup files are not encrypted by
the app, and anyone with access to the browser profile can potentially read
its records. Make a backup before upgrades or moving the app.

Restoring a JSON backup **replaces all current app records** in that browser
origin after confirmation. Export the current state first. CSV is a transaction
export, not a full backup. Do not commit personal JSON/CSV exports to this repo.

GoPay, OVO, and similar IDR balances belong under **Rekening & Kas** as e-wallet
accounts. Expense validation uses the account balance on the transaction date;
today's balance may differ from a past date's balance.

## Development and checks

```bash
npm test
npm run lint
```

`npm test` runs TypeScript checks, a production build, and finance regression
tests. Fixtures use synthetic data. Financial calculations run locally in
TypeScript and do not use an LLM.

## Updating an existing installation

1. Export a JSON backup from the running app.
2. Stop the local server with `Ctrl+C`.
3. In the project directory, run `git pull --ff-only`, then `npm ci`.
4. Start the server again and open the same browser profile and URL.

For production use, run `npm run build` before `npm start`. Updating the source
does not intentionally erase IndexedDB records, but a backup is still needed
before upgrades. If Git reports local changes or a merge conflict, keep those
changes and resolve them before updating; do not reset the checkout blindly.

## Project structure

| Path | Purpose |
| --- | --- |
| `app/` | React interface and application layout |
| `lib/finance.ts` | Financial models, calculations, and validation |
| `lib/storage.ts` | IndexedDB persistence and backup handling |
| `lib/market.ts` | Public crypto-price requests |
| `public/` | PWA manifest, service worker, and static assets |
| `tests/` | Finance regression tests |
| `scripts/start.mjs` | Production server entry point |
| `docs/` | Setup, usage, and architecture documentation |
| `vite.config.ts` | Local development and build configuration |

The app uses TypeScript, React, Vinext, Vite, and IndexedDB. It runs on Node.js
without Cloudflare, D1, R2, an authentication provider, or a server database.
The finance app does not enable analytics or remote financial-data persistence.

## Current limitations

- No automatic device synchronization, bank import, or exchange-account sync.
- Historical asset reports are not a complete accounting ledger and may reflect
  current asset valuations.
- Older account corrections retain their original opening-balance behavior;
  new corrections take effect from the reconciliation date.
- Rule-based analysis depends on the completeness of manually entered records.
- The app has not been hardened for public server deployment. Review dependency
  advisories with `npm audit`; passing unit tests is not a security certification.

## License

No license has been selected for this repository yet. Publishing the source
does not grant a general license to redistribute or reuse it. Dependencies
retain their respective licenses.
