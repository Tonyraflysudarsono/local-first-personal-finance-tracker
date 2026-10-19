# Local-First Personal Finance Tracker

**Neraca** is a personal finance web app that stores financial records in your
browser using IndexedDB. Track accounts, spending, assets, debts, budgets, and
financial goals without creating an account or setting up a server database.
The current interface is in Indonesian, with Indonesian rupiah (IDR) as its
base currency.

Each person runs their own copy or opens the app in their own browser profile.
Financial records are not shared between users or synced between devices.

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
Create an account with its opening balance, then record transactions. The app
starts without permanent sample financial records.

For a production build:

```bash
npm run build
npm start
```

The production server uses port 3000 by default. Set `PORT` to change it.
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
| `build/`, `worker/`, `.openai/` | Vinext/Cloudflare build scaffolding |

The app uses TypeScript, React, Vinext, Vite, and IndexedDB. `db/`, `drizzle/`,
and `examples/d1/` are unused starter scaffolding, not storage for financial
records. The hosting config has D1 and R2 bindings disabled. The finance app
does not enable analytics or remote financial-data persistence.

## Current limitations

- No automatic device synchronization, bank import, or exchange-account sync.
- Historical asset reports are not a complete accounting ledger and may reflect
  current asset valuations.
- Older account corrections retain their original opening-balance behavior;
  new corrections take effect from the reconciliation date.
- Rule-based analysis depends on the completeness of manually entered records.

## License

No license has been selected for this repository yet. Publishing the source
does not grant a general license to redistribute or reuse it. Dependencies
retain their respective licenses.
