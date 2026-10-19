# Architecture and calculations

## Runtime and data flow

Neraca uses React and TypeScript, built with Vinext and Vite. A local Node.js
server serves the app on localhost by default. Finance state is loaded from IndexedDB in the browser,
validated, and passed into the interface and calculation functions. User actions
produce updated state, which is saved back to IndexedDB.

`lib/storage.ts` stores settings, categories, accounts, transactions, recurring
transactions, assets, valuation history, liabilities, budgets, recurring budgets,
snapshots, reconciliations, and goals. Writes are queued and use a read/write
transaction spanning the stores. Data remains scoped to a browser profile and
origin; running the app for different people does not share their records.

`lib/finance.ts` contains the data model and deterministic calculations. The
React interface in `app/page.tsx` coordinates forms, validation, and views.
There is no LLM or Python service in this calculation path.

## Financial semantics

| Metric or operation | Current behavior |
| --- | --- |
| Account balance | Opening balance plus dated inflows, minus dated outflows, plus applicable dated reconciliation corrections |
| Total assets | Account balances plus non-account asset values |
| Total debt | Remaining principal across liabilities |
| Net worth | Total assets minus total debt |
| Liquid assets | Account balances plus assets marked liquid with time-to-cash at most three days |
| Cash inflow | Income transactions plus net proceeds from asset-sale transactions |
| Cash outflow | Expenses, debt payments, and asset purchases |
| Free cash flow | Cash inflow minus cash outflow; internal transfers are excluded |
| Debt payment | Principal reduces the recorded liability; interest is part of cash outflow |
| Asset purchase | Source funds decrease; asset value and, for crypto, quantity and cost basis increase |
| Asset sale | Asset holdings decrease; net proceeds increase the destination account |
| Operational cash | Account balances used for day-to-day safety calculations; investment valuations are excluded |

Asset-sale proceeds are included in the app's cash-inflow metric. They should
not be interpreted as salary or as profit: realized gain is a separate value.
Similarly, free cash flow here is a personal cash-availability measure, not a
corporate accounting definition.

For the current report month, account balances are calculated through today.
Other report months use their month-end cutoff. The Assets page separately
shows the current position. Validation uses the transaction date, so a later
top-up cannot fund an earlier recorded expense.

## Market prices

`lib/market.ts` requests public CoinGecko prices for the tracked coin IDs:
`bitcoin`, `ethereum`, and `tether`. It requests USD and IDR prices and a source
update timestamp. Holdings, account names, notes, and portfolio values are not
included in the request. The provider still receives ordinary network metadata
associated with a public HTTP request.

Market values are derived from locally stored quantities and public prices.
Displaying a new market value does not replace the stored purchase cost basis.
Initial quantity estimation uses:

```text
quantity = purchase amount in IDR / USD-IDR rate / purchase price in USD
```

This does not reconstruct an exchange's fills, fees, or historical FX rates.
Users can reconcile actual quantities and correct transaction prices/rates.

## Backup and offline behavior

JSON export contains the financial state. Import validates the supported backup
version and record values before applying data. CSV export contains transactions
only. Neither export is encrypted by the app.

The service worker caches same-origin app resources for offline reuse after
loading. It does not cache cross-origin price requests. PWA support does not
provide a scheduler that makes payments or syncs balances while the app is closed.

## Server and build boundaries

`vite.config.ts` uses the Vinext plugin directly for Node.js development and
builds. There is no Cloudflare worker, server database, or login integration.
`scripts/start.mjs` serves production assets and proxies page requests to the
internal Vinext server. Both servers listen on localhost by default. `HOST`
and `PORT` explicitly configure the production server's listening address.
Changing the address or port changes the browser origin and its local data.

Build output belongs in ignored `dist/`. Source files and tests are versioned;
dependency caches, browser data, financial exports, and local assistant notes
are not. Git ignore rules are a guard against accidental commits, not encryption
and not a substitute for reviewing every publication.

Historical asset values and older reconciliation behavior have limitations
described in the README. Publishing the repository does not migrate, expose,
or synchronize any existing browser's financial records.
