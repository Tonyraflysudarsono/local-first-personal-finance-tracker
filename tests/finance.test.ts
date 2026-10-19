// All financial records in this file are synthetic test fixtures.
import test from "node:test";
import assert from "node:assert/strict";
import { AppState, analyzeFinancialHealth, applyRecurringBudgets, applyRecurringTransactions, calculateCryptoQuantity, calculateCryptoSale, calculateMetrics, calculateSafetyMetrics, convertLiquidAssetToAccount, copyBudgetsToMonth, ensureCustomCategory, getAccountBalances, getCryptoPerformance, getGoalCurrentAmount, normalizeImportedState, reconcileCryptoHolding, recordAccountReconciliation, recordAssetSale, removeAssetSale, removeRecurringBudget, removeRecurringTransactions, syncRecurringBudget, syncRecurringRule, withMarketAssetValues } from "../lib/finance";
import { serializeState } from "../lib/storage";
import { fetchCryptoMarketQuotes } from "../lib/market";

const baseState = (): AppState => ({
  version: 1,
  categories: [{ id: "food", name: "Makanan", kind: "expense", color: "#000" }],
  accounts: [
    { id: "bank", name: "Bank", type: "bank", openingBalance: 1_000_000, createdAt: "2026-08-01T00:00:00.000Z" },
    { id: "cash", name: "Tunai", type: "cash", openingBalance: 500_000, createdAt: "2026-08-01T00:00:00.000Z" },
  ],
  transactions: [],
  recurringTransactions: [],
  assets: [],
  assetValuations: [],
  liabilities: [],
  budgets: [],
  recurringBudgets: [],
  snapshots: [],
  reconciliations: [],
  goals: [],
  settings: { currency: "IDR", monthStartDay: 1 },
});

test("modal IDR dan harga beli BTC USD menghasilkan kuantitas yang benar", () => {
  const quantity = calculateCryptoQuantity(1_500_000, 78_000, 16_000);
  assert.ok(Math.abs(quantity - 0.001201923076923077) < 0.0000000001);
  assert.equal(calculateCryptoQuantity(1_500_000, 0, 16_000), 0);
});

test("harga BTC live mengubah nilai tampilan tanpa mengubah modal tersimpan", () => {
  const state = baseState();
  state.assets = [{
    id: "btc",
    name: "BTC",
    type: "investment",
    value: 1_248_000,
    liquid: true,
    daysToCash: 3,
    updatedAt: "2026-08-01",
    market: {
      coinId: "bitcoin",
      symbol: "BTC",
      quantity: 0.001,
      costBasisIdr: 1_248_000,
      averagePurchasePriceUsd: 78_000,
      usdIdrRateAtPurchase: 16_000,
    },
  }];
  const quotes = { bitcoin: { coinId: "bitcoin" as const, symbol: "BTC" as const, priceUsd: 76_000, priceIdr: 1_216_000_000, updatedAt: "2026-08-02T00:00:00.000Z", source: "CoinGecko" as const } };
  const display = withMarketAssetValues(state, quotes);
  const performance = getCryptoPerformance(state.assets[0], quotes);

  assert.equal(state.assets[0].value, 1_248_000);
  assert.equal(display.assets[0].value, 1_216_000);
  assert.equal(performance?.difference, -32_000);
  assert.ok(Math.abs((performance?.percentage ?? 0) - -2.564102564102564) < 0.00001);
});

test("backup mempertahankan data pelacakan BTC", () => {
  const state = baseState();
  state.assets = [{
    id: "btc",
    name: "BTC",
    type: "investment",
    value: 1_500_000,
    liquid: true,
    daysToCash: 3,
    updatedAt: "2026-08-01",
    market: {
      coinId: "bitcoin",
      symbol: "BTC",
      quantity: 0.0012,
      costBasisIdr: 1_500_000,
      averagePurchasePriceUsd: 78_000,
      usdIdrRateAtPurchase: 16_000,
    },
  }];
  const restored = normalizeImportedState(JSON.parse(serializeState(state)));
  assert.deepEqual(restored.assets[0].market, state.assets[0].market);
});

test("harga USDT live mengubah nilai tampilan dan lolos backup", () => {
  const state = baseState();
  state.assets = [{
    id: "usdt",
    name: "USDT Wallet",
    type: "investment",
    value: 720_000,
    liquid: true,
    daysToCash: 3,
    updatedAt: "2026-09-19",
    market: { coinId: "tether", symbol: "USDT", quantity: 45, costBasisIdr: 720_000, averagePurchasePriceUsd: 1, usdIdrRateAtPurchase: 16_000 },
  }];
  const quotes = { tether: { coinId: "tether" as const, symbol: "USDT" as const, priceUsd: 1, priceIdr: 16_250, updatedAt: "2026-09-19T16:04:00.000Z", source: "CoinGecko" as const } };
  const display = withMarketAssetValues(state, quotes);
  const restored = normalizeImportedState(JSON.parse(serializeState(state)));

  assert.equal(display.assets[0].value, 731_250);
  assert.deepEqual(restored.assets[0].market, state.assets[0].market);
});

test("ETH live memakai jumlah lokal, ikut backup, dan dapat dijual sebagian", () => {
  const state = baseState();
  state.assets = [{
    id: "eth", name: "ETH", type: "investment", value: 8_000_000,
    liquid: true, daysToCash: 3, updatedAt: "2026-09-20",
    market: { coinId: "ethereum", symbol: "ETH", quantity: 0.25, costBasisIdr: 8_000_000, averagePurchasePriceUsd: 2_000, usdIdrRateAtPurchase: 16_000 },
  }];
  const quotes = { ethereum: { coinId: "ethereum" as const, symbol: "ETH" as const, priceUsd: 2_600, priceIdr: 42_000_000, updatedAt: "2026-09-20T12:00:00.000Z", source: "CoinGecko" as const } };
  const display = withMarketAssetValues(state, quotes);
  const restored = normalizeImportedState(JSON.parse(serializeState(state)));
  const sale = calculateCryptoSale(state.assets[0], 4_160_000, 2_600, 16_000, 100_000);

  assert.equal(state.assets[0].value, 8_000_000);
  assert.equal(display.assets[0].value, 10_500_000);
  assert.equal(getCryptoPerformance(state.assets[0], quotes)?.difference, 2_500_000);
  assert.deepEqual(restored.assets[0].market, state.assets[0].market);
  const invalidBackup = JSON.parse(serializeState(state));
  invalidBackup.assets[0].market.symbol = "BTC";
  assert.throws(() => normalizeImportedState(invalidBackup), /Data harga pasar/);
  assert.ok(Math.abs((sale?.quantitySold ?? 0) - 0.1) < 1e-12);
  assert.ok(Math.abs((sale?.remainingQuantity ?? 0) - 0.15) < 1e-12);
  assert.equal(sale?.realizedGainIdr, 860_000);
  const recordedSale = recordAssetSale(state, {
    assetId: "eth", accountId: "bank", date: "2026-09-20", grossProceedsIdr: 4_160_000,
    feeIdr: 100_000, cryptoSalePriceUsd: 2_600, usdIdrRateAtSale: 16_000,
  });
  assert.ok(Math.abs((recordedSale.state.assets[0].market?.quantity ?? 0) - 0.15) < 1e-12);
  assert.equal(getAccountBalances(recordedSale.state, "2026-09-20").bank, 5_060_000);
});

test("loader pasar membaca quote BTC, ETH, dan USDT tanpa mengirim jumlah kepemilikan", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      bitcoin: { usd: 115_000, idr: 1_870_000_000, last_updated_at: 1_758_313_440 },
      ethereum: { usd: 2_600, idr: 42_000_000, last_updated_at: 1_758_313_440 },
      tether: { usd: 1, idr: 16_260, last_updated_at: 1_758_313_440 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const quotes = await fetchCryptoMarketQuotes(["bitcoin", "ethereum", "tether"]);
    assert.match(requestedUrl, /ids=bitcoin,ethereum,tether/);
    assert.doesNotMatch(requestedUrl, /quantity|amount|balance/);
    assert.equal(quotes.bitcoin?.priceIdr, 1_870_000_000);
    assert.equal(quotes.ethereum?.priceIdr, 42_000_000);
    assert.equal(quotes.ethereum?.symbol, "ETH");
    assert.equal(quotes.tether?.priceIdr, 16_260);
    assert.equal(quotes.tether?.symbol, "USDT");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rekonsiliasi BTC memakai jumlah aktual dan menyesuaikan cost basis proporsional", () => {
  const state = baseState();
  state.assets = [{
    id: "btc",
    name: "BTC",
    type: "investment",
    value: 2_400_000,
    liquid: true,
    daysToCash: 3,
    updatedAt: "2026-09-18",
    market: { coinId: "bitcoin", symbol: "BTC", quantity: 0.0015, costBasisIdr: 2_400_000, averagePurchasePriceUsd: 100_000, usdIdrRateAtPurchase: 16_000 },
  }];

  const reconciled = reconcileCryptoHolding(state, { assetId: "btc", actualQuantity: 0.00075, date: "2026-09-19", note: "Synthetic exchange balance" });
  assert.equal(reconciled.assets[0].market?.quantity, 0.00075);
  assert.equal(reconciled.assets[0].market?.costBasisIdr, 1_200_000);
  assert.equal(reconciled.assets[0].value, 1_200_000);
  assert.match(reconciled.assetValuations[0].note ?? "", /Synthetic exchange balance/);
});

test("koreksi rekonsiliasi rekening menyamakan saldo tanpa membuat pemasukan", () => {
  const state = baseState();
  const corrected = recordAccountReconciliation(state, { id: "check", accountId: "bank", actualBalance: 3_000_000, date: "2026-09-19", applyCorrection: true, note: "Synthetic exchange balance" });

  assert.equal(corrected.accounts[0].openingBalance, 1_000_000);
  assert.equal(getAccountBalances(corrected, "2026-09-18").bank, 1_000_000);
  assert.equal(getAccountBalances(corrected, "2026-09-19").bank, 3_000_000);
  assert.equal(corrected.transactions.length, 0);
  assert.equal(corrected.reconciliations[0].correctionApplied, true);
  assert.equal(corrected.reconciliations[0].correctionMode, "dated");
  assert.equal(calculateMetrics(corrected, "2026-09").income, 0);
  const restored = normalizeImportedState(JSON.parse(JSON.stringify(corrected)));
  assert.equal(getAccountBalances(restored, "2026-09-18").bank, 1_000_000);
  assert.equal(getAccountBalances(restored, "2026-09-19").bank, 3_000_000);
  assert.throws(() => recordAccountReconciliation(corrected, {
    accountId: "bank", actualBalance: 2_000_000, date: "2026-09-18", applyCorrection: true,
  }), /mendahului koreksi saldo/);
});

test("rekonsiliasi lama tetap berlaku tanpa menghitung selisih dua kali", () => {
  const state = baseState();
  state.accounts[0].openingBalance = 3_000_000;
  state.reconciliations.push({
    id: "old-check", accountId: "bank", date: "2026-09-19", recordedBalance: 1_000_000,
    actualBalance: 3_000_000, difference: 2_000_000, correctionApplied: true,
  });
  assert.equal(getAccountBalances(state, "2026-09-19").bank, 3_000_000);
});

test("penjualan BTC menghitung kuantitas, cost basis, dan untung rugi terealisasi", () => {
  const asset = {
    id: "btc",
    name: "BTC",
    type: "investment" as const,
    value: 1_200_000,
    liquid: true,
    daysToCash: 3,
    updatedAt: "2026-08-01",
    market: {
      coinId: "bitcoin" as const,
      symbol: "BTC" as const,
      quantity: 0.001,
      costBasisIdr: 1_200_000,
      averagePurchasePriceUsd: 75_000,
      usdIdrRateAtPurchase: 16_000,
    },
  };

  const sale = calculateCryptoSale(asset, 608_000, 76_000, 16_000, 8_000);

  assert.ok(sale);
  assert.equal(sale?.quantitySold, 0.0005);
  assert.equal(sale?.costBasisRemovedIdr, 600_000);
  assert.equal(sale?.netProceedsIdr, 600_000);
  assert.equal(sale?.realizedGainIdr, 0);
  assert.equal(sale?.remainingQuantity, 0.0005);
  assert.equal(sale?.remainingCostBasisIdr, 600_000);
});

test("mencatat lalu menghapus penjualan BTC menjaga saldo dan kepemilikan tetap bisa dipulihkan", () => {
  const state = baseState();
  state.assets = [{
    id: "btc",
    name: "BTC",
    type: "investment",
    value: 1_200_000,
    liquid: true,
    daysToCash: 3,
    updatedAt: "2026-08-01",
    market: {
      coinId: "bitcoin",
      symbol: "BTC",
      quantity: 0.001,
      costBasisIdr: 1_200_000,
      averagePurchasePriceUsd: 75_000,
      usdIdrRateAtPurchase: 16_000,
    },
  }];

  const recorded = recordAssetSale(state, {
    transactionId: "sale",
    valuationId: "sale-valuation",
    assetId: "btc",
    accountId: "bank",
    date: "2026-08-05",
    grossProceedsIdr: 608_000,
    feeIdr: 8_000,
    cryptoSalePriceUsd: 76_000,
    usdIdrRateAtSale: 16_000,
    note: "Jual sebagian BTC",
  });

  assert.equal(recorded.transaction.amount, 600_000);
  assert.equal(recorded.transaction.cryptoQuantity, 0.0005);
  assert.equal(recorded.transaction.cryptoCostBasisIdr, 600_000);
  assert.equal(recorded.transaction.realizedGainIdr, 0);
  assert.equal(recorded.state.assets[0].market?.quantity, 0.0005);
  assert.equal(recorded.state.assets[0].market?.costBasisIdr, 600_000);
  assert.equal(recorded.state.assets[0].value, 600_000);
  assert.equal(getAccountBalances(recorded.state, "2026-08-31").bank, 1_600_000);

  const restored = removeAssetSale(recorded.state, "sale");
  assert.equal(restored.transactions.length, 0);
  assert.equal(restored.assets[0].market?.quantity, 0.001);
  assert.equal(restored.assets[0].market?.costBasisIdr, 1_200_000);
  assert.equal(restored.assets[0].value, 1_200_000);
  assert.equal(getAccountBalances(restored, "2026-08-31").bank, 1_000_000);
});

test("penjualan penuh BTC menyimpan kepemilikan nol dan tetap lolos normalisasi backup", () => {
  const state = baseState();
  state.assets = [{
    id: "btc",
    name: "BTC",
    type: "investment",
    value: 1_200_000,
    liquid: true,
    daysToCash: 3,
    updatedAt: "2026-08-01",
    market: {
      coinId: "bitcoin",
      symbol: "BTC",
      quantity: 0.001,
      costBasisIdr: 1_200_000,
      averagePurchasePriceUsd: 75_000,
      usdIdrRateAtPurchase: 16_000,
    },
  }];

  const recorded = recordAssetSale(state, {
    transactionId: "full-sale",
    valuationId: "full-sale-valuation",
    assetId: "btc",
    accountId: "bank",
    date: "2026-08-05",
    grossProceedsIdr: 1_216_000,
    feeIdr: 16_000,
    cryptoSalePriceUsd: 76_000,
    usdIdrRateAtSale: 16_000,
  });
  const restored = normalizeImportedState(JSON.parse(serializeState(recorded.state)));

  assert.equal(restored.assets[0].market?.quantity, 0);
  assert.equal(restored.assets[0].market?.costBasisIdr, 0);
  assert.equal(restored.assets[0].value, 0);
});

test("penjualan aset manual memisahkan hasil kotor, biaya, nilai dilepas, dan untung rugi", () => {
  const state = baseState();
  state.assets = [{ id: "motor", name: "Motor", type: "vehicle", value: 20_000_000, liquid: false, daysToCash: 30, updatedAt: "2026-08-01" }];

  const recorded = recordAssetSale(state, {
    transactionId: "motor-sale",
    valuationId: "motor-sale-valuation",
    assetId: "motor",
    accountId: "bank",
    date: "2026-08-05",
    grossProceedsIdr: 18_500_000,
    feeIdr: 500_000,
    bookValueRemovedIdr: 15_000_000,
  });

  assert.equal(recorded.transaction.amount, 18_000_000);
  assert.equal(recorded.transaction.grossProceedsIdr, 18_500_000);
  assert.equal(recorded.transaction.assetValue, 15_000_000);
  assert.equal(recorded.realizedGainIdr, 3_000_000);
  assert.equal(recorded.state.assets[0].value, 5_000_000);
  assert.equal(getAccountBalances(recorded.state, "2026-08-31").bank, 19_000_000);

  const restored = removeAssetSale(recorded.state, "motor-sale");
  assert.equal(restored.assets[0].value, 20_000_000);
  assert.equal(getAccountBalances(restored, "2026-08-31").bank, 1_000_000);
});

test("transfer tidak dihitung sebagai pemasukan atau pengeluaran", () => {
  const state = baseState();
  state.transactions = [{ id: "transfer", date: "2026-08-03", kind: "transfer", amount: 250_000, accountId: "bank", toAccountId: "cash" }];
  const metrics = calculateMetrics(state, "2026-08");
  assert.equal(metrics.income, 0);
  assert.equal(metrics.cashOutflow, 0);
  assert.equal(metrics.accountBalances.bank, 750_000);
  assert.equal(metrics.accountBalances.cash, 750_000);
});

test("properti masuk aset tetapi tidak masuk aset likuid", () => {
  const state = baseState();
  state.assets = [
    { id: "property", name: "Rumah", type: "property", value: 900_000_000, liquid: false, daysToCash: 90, updatedAt: "2026-08-01" },
    { id: "fund", name: "Reksa dana pasar uang", type: "investment", value: 2_000_000, liquid: true, daysToCash: 2, updatedAt: "2026-08-01" },
  ];
  const metrics = calculateMetrics(state, "2026-08");
  assert.equal(metrics.totalAssets, 903_500_000);
  assert.equal(metrics.liquidAssets, 3_500_000);
});

test("target dapat mengikuti saldo rekening atau nilai aset", () => {
  const state = baseState();
  state.transactions = [{ id: "expense", date: "2026-08-02", kind: "expense", amount: 250_000, accountId: "bank", categoryId: "food" }];
  state.assets = [{ id: "fund", name: "Dana investasi", type: "investment", value: 2_000_000, liquid: true, daysToCash: 2, updatedAt: "2026-08-01" }];
  const accountGoal = { id: "account-goal", name: "Dana aman", targetAmount: 2_000_000, currentAmount: 0, sourceType: "account" as const, sourceId: "bank", createdAt: "2026-08-01" };
  const assetGoal = { ...accountGoal, id: "asset-goal", sourceType: "asset" as const, sourceId: "fund" };
  const manualGoal = { ...accountGoal, id: "manual-goal", sourceType: "manual" as const, currentAmount: 400_000, sourceId: undefined };
  assert.equal(getGoalCurrentAmount(state, accountGoal), 750_000);
  assert.equal(getGoalCurrentAmount(state, assetGoal), 2_000_000);
  assert.equal(getGoalCurrentAmount(state, manualGoal), 400_000);
});

test("arus kas bebas memakai seluruh arus kas keluar non-transfer", () => {
  const state = baseState();
  state.transactions = [
    { id: "income", date: "2026-08-01", kind: "income", amount: 10_000_000, accountId: "bank" },
    { id: "expense", date: "2026-08-02", kind: "expense", amount: 2_000_000, accountId: "bank", categoryId: "food" },
    { id: "debt", date: "2026-08-03", kind: "debtPayment", amount: 1_000_000, accountId: "bank", principal: 800_000, interest: 200_000 },
    { id: "asset", date: "2026-08-04", kind: "assetPurchase", amount: 3_000_000, accountId: "bank" },
  ];
  const metrics = calculateMetrics(state, "2026-08");
  assert.equal(metrics.cashOutflow, 6_000_000);
  assert.equal(metrics.freeCashFlow, 4_000_000);
});

test("dana aman mengurangi kas dengan komitmen dan buffer tanpa menghitung investasi sebagai uang belanja", () => {
  const state = baseState();
  state.categories[0].essential = true;
  state.settings = { ...state.settings, emergencyBufferTarget: 500_000, nextIncomeDay: 25 };
  state.assets = [{ id: "fund", name: "Investasi", type: "investment", value: 5_000_000, liquid: true, daysToCash: 2, updatedAt: "2026-09-01" }];
  state.transactions = [{ id: "food", date: "2026-08-20", kind: "expense", amount: 310_000, accountId: "bank", categoryId: "food" }];
  state.recurringTransactions = [{ id: "rent", name: "Kos", kind: "expense", amount: 300_000, accountId: "bank", categoryId: "food", dayOfMonth: 20, startMonth: "2026-09", active: true, createdAt: "2026-08-01T00:00:00.000Z" }];
  state.liabilities = [{ id: "loan", name: "Cicilan", type: "personal", remainingPrincipal: 2_000_000, monthlyPayment: 200_000, dueDay: 22 }];

  const safety = calculateSafetyMetrics(state, "2026-09-16");

  assert.equal(safety.operationalCash, 1_190_000);
  assert.equal(safety.committedOutflow, 500_000);
  assert.equal(safety.emergencyBufferProtected, 500_000);
  assert.equal(safety.spendableBalance, 190_000);
  assert.equal(safety.daysToNextIncome, 9);
  assert.ok(Math.abs(safety.safeToSpendDaily - (190_000 / 9)) < 0.001);
  assert.ok(safety.survivalRunwayDays !== null && safety.survivalRunwayDays > 70);
  assert.equal(safety.status, "safe");
});

test("komitmen tidak menggandakan transaksi rutin yang sudah dibuat", () => {
  const state = baseState();
  state.categories[0].essential = true;
  state.settings = { ...state.settings, emergencyBufferTarget: 100_000, nextIncomeDay: 25 };
  state.recurringTransactions = [{ id: "rent", name: "Kos", kind: "expense", amount: 300_000, accountId: "bank", categoryId: "food", dayOfMonth: 20, startMonth: "2026-09", active: true, createdAt: "2026-08-01T00:00:00.000Z" }];
  state.transactions = [
    { id: "history", date: "2026-08-20", kind: "expense", amount: 300_000, accountId: "bank", categoryId: "food", recurringId: "rent" },
    { id: "generated", date: "2026-09-20", kind: "expense", amount: 300_000, accountId: "bank", categoryId: "food", recurringId: "rent" },
  ];

  const safety = calculateSafetyMetrics(state, "2026-09-16");

  assert.equal(safety.committedOutflow, 300_000);
});

test("status dana aman menjadi kritis saat komitmen terdekat tidak tertutup", () => {
  const state = baseState();
  state.categories[0].essential = true;
  state.settings = { ...state.settings, emergencyBufferTarget: 500_000, nextIncomeDay: 25 };
  state.transactions = [
    { id: "history", date: "2026-08-20", kind: "expense", amount: 300_000, accountId: "bank", categoryId: "food" },
    { id: "future", date: "2026-09-20", kind: "expense", amount: 2_000_000, accountId: "bank", categoryId: "food" },
  ];

  const safety = calculateSafetyMetrics(state, "2026-09-16");

  assert.equal(safety.status, "critical");
  assert.equal(safety.spendableBalance, 0);
  assert.equal(safety.emergencyBufferProtected, 0);
  assert.equal(safety.uncoveredCommitments, 800_000);
});

test("utang yang sudah lunas tidak lagi dihitung sebagai komitmen", () => {
  const state = baseState();
  state.categories[0].essential = true;
  state.settings = { ...state.settings, emergencyBufferTarget: 100_000, nextIncomeDay: 25 };
  state.liabilities = [{ id: "paid", name: "Cicilan lunas", type: "personal", remainingPrincipal: 0, monthlyPayment: 500_000, dueDay: 20 }];
  state.transactions = [{ id: "history", date: "2026-08-20", kind: "expense", amount: 300_000, accountId: "bank", categoryId: "food" }];

  const safety = calculateSafetyMetrics(state, "2026-09-16");

  assert.equal(safety.committedOutflow, 0);
});

test("backup mempertahankan pengaturan dana aman dan kategori kebutuhan pokok", () => {
  const state = baseState();
  state.categories[0].essential = true;
  state.settings = { ...state.settings, emergencyBufferTarget: 2_500_000, nextIncomeDay: 27 };

  const restored = normalizeImportedState(JSON.parse(serializeState(state)));

  assert.equal(restored.settings.emergencyBufferTarget, 2_500_000);
  assert.equal(restored.settings.nextIncomeDay, 27);
  assert.equal(restored.categories[0].essential, true);
});

test("analisis memproyeksikan bulan depan dari transaksi rutin, cicilan, dan anggaran", () => {
  const state = baseState();
  state.transactions = [
    { id: "income", date: "2026-08-01", kind: "income", amount: 10_000_000, accountId: "bank" },
    { id: "expense", date: "2026-08-02", kind: "expense", amount: 2_000_000, accountId: "bank", categoryId: "food" },
  ];
  state.recurringTransactions = [{ id: "rent", name: "Kos", kind: "expense", amount: 3_000_000, accountId: "bank", categoryId: "food", dayOfMonth: 5, startMonth: "2026-09", active: true, createdAt: "2026-08-01T00:00:00.000Z" }];
  state.liabilities = [{ id: "loan", name: "Cicilan", type: "personal", remainingPrincipal: 8_000_000, monthlyPayment: 1_000_000 }];
  state.budgets = [{ id: "budget", categoryId: "food", month: "2026-09", amount: 2_000_000 }];

  const analysis = analyzeFinancialHealth(state, "2026-08");
  assert.equal(analysis.nextMonth.income, 0);
  assert.equal(analysis.nextMonth.outflow, 4_000_000);
  assert.equal(analysis.nextMonth.freeCashFlow, -4_000_000);
  assert.equal(analysis.nextMonth.budgetGap, -1_000_000);
  assert.equal(analysis.savingsRate, 80);
  assert.equal(analysis.debtRatio, 10);
  assert.equal(analysis.status, "attention");
  assert.equal(analysis.recommendations[0].id, "next-deficit");
});

test("analisis tidak menggandakan transaksi rutin yang sudah dibuat", () => {
  const state = baseState();
  state.recurringTransactions = [{ id: "rent", name: "Kos", kind: "expense", amount: 3_000_000, accountId: "bank", categoryId: "food", dayOfMonth: 5, startMonth: "2026-09", active: true, createdAt: "2026-08-01T00:00:00.000Z" }];
  state.transactions = [{ id: "generated", date: "2026-09-05", kind: "expense", amount: 3_000_000, accountId: "bank", categoryId: "food", recurringId: "rent" }];

  const analysis = analyzeFinancialHealth(state, "2026-08");
  assert.equal(analysis.nextMonth.recurringExpenses, 0);
  assert.equal(analysis.nextMonth.outflow, 3_000_000);
});

test("anggaran bisa disalin ke bulan berikutnya tanpa menimpa kategori yang sudah ada", () => {
  const state = baseState();
  state.budgets = [
    { id: "food-aug", categoryId: "food", month: "2026-08", amount: 2_000_000 },
    { id: "home-sep", categoryId: "home", month: "2026-09", amount: 1_500_000 },
  ];
  const result = copyBudgetsToMonth(state, "2026-08", "2026-09");
  assert.equal(result.created, 1);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.state.budgets.map((budget) => [budget.categoryId, budget.month]), [["food", "2026-08"], ["home", "2026-09"], ["food", "2026-09"]]);
});

test("anggaran rutin mengikuti bulan mulai dan tidak menggandakan kategori", () => {
  const state = baseState();
  state.recurringBudgets = [{ id: "food-rule", categoryId: "food", amount: 2_000_000, startMonth: "2026-09", active: true, createdAt: "2026-08-01T00:00:00.000Z" }];
  assert.equal(applyRecurringBudgets(state, "2026-08").created, 0);
  const created = applyRecurringBudgets(state, "2026-09");
  assert.equal(created.created, 1);
  assert.equal(created.state.budgets[0].recurringId, "food-rule");
  assert.equal(applyRecurringBudgets(created.state, "2026-09").created, 0);
});

test("menghapus dan mengubah pola anggaran hanya menyentuh salinan otomatis", () => {
  const state = baseState();
  const previousRule = { id: "food-rule", categoryId: "food", amount: 2_000_000, startMonth: "2026-09", active: true, createdAt: "2026-08-01T00:00:00.000Z" };
  state.recurringBudgets = [previousRule];
  state.budgets = [
    { id: "auto", categoryId: "food", month: "2026-09", amount: 2_000_000, recurringId: "food-rule" },
    { id: "manual", categoryId: "food", month: "2026-10", amount: 2_500_000 },
  ];
  const nextRule = { ...previousRule, amount: 2_200_000 };
  const synced = syncRecurringBudget(state, previousRule, nextRule);
  assert.equal(synced.budgets.find((budget) => budget.id === "auto")?.amount, 2_200_000);
  assert.equal(synced.budgets.find((budget) => budget.id === "manual")?.amount, 2_500_000);
  const removed = removeRecurringBudget(synced, "food-rule");
  assert.deepEqual(removed.budgets.map((budget) => budget.id), ["manual"]);
});

test("transaksi bulan depan tidak mengurangi saldo sebelum tanggalnya", () => {
  const state = baseState();
  state.transactions = [{ id: "future-rent", date: "2026-09-05", kind: "expense", amount: 150_000, accountId: "bank", categoryId: "food" }];
  assert.equal(getAccountBalances(state, "2026-08-31").bank, 1_000_000);
  assert.equal(getAccountBalances(state, "2026-09-30").bank, 850_000);
});

test("pembelian aset dari aset likuid tidak membuat saldo rekening bayangan", () => {
  const state = baseState();
  state.accounts = [];
  state.assets = [
    { id: "idr", name: "IDR", type: "other", value: 1_500_000, liquid: true, daysToCash: 3, updatedAt: "2026-08-04" },
    { id: "btc", name: "BTC", type: "investment", value: 1_500_000, liquid: true, daysToCash: 3, updatedAt: "2026-08-04" },
  ];
  state.transactions = [{ id: "purchase", date: "2026-08-04", kind: "assetPurchase", amount: 1_500_000, sourceAssetId: "idr", assetId: "btc", assetValue: 1_500_000 }];
  const metrics = calculateMetrics(state, "2026-08");
  assert.deepEqual(metrics.accountBalances, {});
  assert.equal(metrics.totalAssets, 3_000_000);
  assert.equal(metrics.freeCashFlow, -1_500_000);
});

test("aset IDR likuid dengan riwayat masuk dan keluar dapat dipindahkan tanpa mengubah saldo dan total aset", () => {
  const state = baseState();
  state.assets = [
    { id: "idr-exchange", name: "IDR Exchange", type: "other", value: 1_100_000, liquid: true, daysToCash: 3, updatedAt: "2026-09-13" },
    { id: "btc", name: "BTC", type: "investment", value: 800_000, liquid: true, daysToCash: 3, updatedAt: "2026-09-13" },
  ];
  state.assetValuations = [{ id: "idr-opening", assetId: "idr-exchange", value: 1_900_000, recordedAt: "2026-09-01T12:00:00.000Z" }];
  state.transactions = [
    { id: "topup-one", date: "2026-09-01", kind: "assetPurchase", amount: 1_000_000, accountId: "bank", assetId: "idr-exchange", assetValue: 1_000_000, targetAssetCreated: true },
    { id: "topup-two", date: "2026-09-05", kind: "assetPurchase", amount: 900_000, accountId: "bank", assetId: "idr-exchange", assetValue: 900_000 },
    { id: "buy-btc", date: "2026-09-13", kind: "assetPurchase", amount: 800_000, sourceAssetId: "idr-exchange", assetId: "btc", assetValue: 800_000 },
  ];
  state.goals = [{ id: "goal", name: "Saldo exchange", targetAmount: 2_000_000, currentAmount: 0, sourceType: "asset", sourceId: "idr-exchange", createdAt: "2026-09-01" }];
  const before = calculateMetrics(state, "2026-09");

  const result = convertLiquidAssetToAccount(state, {
    assetId: "idr-exchange",
    accountId: "exchange-account",
    name: "Exchange IDR",
    type: "ewallet",
    asOfDate: "2026-09-18",
    createdAt: "2026-09-18T00:00:00.000Z",
  });
  const after = calculateMetrics(result.state, "2026-09");

  assert.equal(result.account.openingBalance, 1_900_000);
  assert.equal(getAccountBalances(result.state, "2026-09-18")["exchange-account"], 1_100_000);
  assert.equal(result.state.assets.some((asset) => asset.id === "idr-exchange"), false);
  assert.equal(result.state.assetValuations.some((item) => item.assetId === "idr-exchange"), false);
  assert.equal(result.migratedIncomingTransactionCount, 2);
  assert.equal(result.migratedSourceTransactionCount, 1);
  assert.equal(result.migratedTransactionCount, 3);
  assert.equal(result.state.transactions[0].assetId, undefined);
  assert.equal(result.state.transactions[0].migratedTargetAccountId, "exchange-account");
  assert.equal(result.state.transactions[2].sourceAssetId, undefined);
  assert.equal(result.state.transactions[2].accountId, "exchange-account");
  assert.equal(result.state.goals[0].sourceType, "account");
  assert.equal(result.state.goals[0].sourceId, "exchange-account");
  assert.equal(after.totalAssets, before.totalAssets);
  assert.equal(after.netWorth, before.netWorth);
});

test("konversi menolak BTC tetapi menerima riwayat pembelian masuk", () => {
  const state = baseState();
  state.assets = [{
    id: "btc",
    name: "BTC",
    type: "investment",
    value: 1_200_000,
    liquid: true,
    daysToCash: 3,
    updatedAt: "2026-09-01",
    market: { coinId: "bitcoin", symbol: "BTC", quantity: 0.001, costBasisIdr: 1_200_000, averagePurchasePriceUsd: 75_000, usdIdrRateAtPurchase: 16_000 },
  }];
  const input = { assetId: "btc", accountId: "btc-account", name: "BTC", type: "ewallet" as const, asOfDate: "2026-09-18", createdAt: "2026-09-18T00:00:00.000Z" };
  assert.throws(() => convertLiquidAssetToAccount(state, input), /kripto/);

  state.assets = [{ id: "idr", name: "IDR Exchange", type: "other", value: 500_000, liquid: true, daysToCash: 3, updatedAt: "2026-09-01" }];
  state.transactions = [{ id: "topup", date: "2026-09-01", kind: "assetPurchase", amount: 500_000, accountId: "bank", assetId: "idr" }];
  const converted = convertLiquidAssetToAccount(state, { ...input, assetId: "idr", accountId: "idr-account", name: "IDR Exchange" });
  assert.equal(converted.state.transactions[0].assetId, undefined);
  assert.equal(converted.state.transactions[0].migratedTargetAccountId, "idr-account");
});

test("kategori bawaan baru ditambahkan tanpa menghapus kategori pengguna", () => {
  const state = baseState();
  state.categories.push({ id: "custom", name: "Hewan peliharaan", kind: "expense", color: "#123" });
  const normalized = normalizeImportedState(state);
  assert.equal(normalized.categories.find((category) => category.id === "custom")?.name, "Hewan peliharaan");
  assert.equal(normalized.categories.find((category) => category.id === "cat-internet")?.name, "Paket data & internet");
  assert.equal(normalized.categories.find((category) => category.id === "cat-vehicle-service")?.name, "Servis kendaraan");
});

test("kategori custom dinormalisasi dan dipakai ulang tanpa duplikasi", () => {
  const first = ensureCustomCategory([], "  Hewan   peliharaan  ", "expense");
  const second = ensureCustomCategory(first.categories, "hewan peliharaan", "expense");
  assert.equal(first.categories.length, 1);
  assert.equal(first.categories[0].name, "Hewan peliharaan");
  assert.equal(second.categories.length, 1);
  assert.equal(second.categoryId, first.categoryId);
});

test("transaksi rutin dibuat sekali per bulan dan tanggal menyesuaikan akhir bulan", () => {
  const state = baseState();
  state.recurringTransactions = [{ id: "routine", name: "Internet", kind: "expense", amount: 150_000, accountId: "bank", categoryId: "food", dayOfMonth: 31, startMonth: "2026-01", active: true, createdAt: "2026-08-01T00:00:00.000Z" }];
  const first = applyRecurringTransactions(state, "2026-02");
  assert.equal(first.created, 1);
  assert.equal(first.state.transactions[0].date, "2026-02-28");
  const second = applyRecurringTransactions(first.state, "2026-02");
  assert.equal(second.created, 0);
  assert.equal(second.state.transactions.length, 1);
});

test("transaksi rutin baru dibuat mulai bulan yang dipilih", () => {
  const state = baseState();
  state.recurringTransactions = [{ id: "routine", name: "Kos", kind: "expense", amount: 1_500_000, accountId: "bank", dayOfMonth: 5, startMonth: "2026-08", active: true, createdAt: "2026-08-01T00:00:00.000Z" }];
  const beforeStart = applyRecurringTransactions(state, "2026-07");
  assert.equal(beforeStart.created, 0);
  const atStart = applyRecurringTransactions(beforeStart.state, "2026-08");
  assert.equal(atStart.created, 1);
  assert.equal(atStart.state.transactions[0].date, "2026-08-05");
});

test("menghapus pola rutin menghapus transaksi otomatis tanpa menyentuh transaksi manual", () => {
  const state = baseState();
  state.recurringTransactions = [{ id: "routine", name: "Kos", kind: "expense", amount: 1_500_000, accountId: "bank", dayOfMonth: 5, startMonth: "2026-08", active: true, createdAt: "2026-08-01T00:00:00.000Z" }];
  state.transactions = [
    { id: "auto", date: "2026-08-05", kind: "expense", amount: 1_500_000, accountId: "bank", recurringId: "routine" },
    { id: "manual", date: "2026-08-06", kind: "expense", amount: 25_000, accountId: "bank" },
  ];
  const next = removeRecurringTransactions(state, "routine");
  assert.equal(next.recurringTransactions.length, 0);
  assert.deepEqual(next.transactions.map((transaction) => transaction.id), ["manual"]);
});

test("perubahan kategori pola menyinkronkan transaksi otomatis yang belum diedit manual", () => {
  const state = baseState();
  const previousRule = { id: "routine", name: "Kos", kind: "expense" as const, amount: 1_500_000, accountId: "bank", categoryId: "family", dayOfMonth: 5, startMonth: "2026-08", active: true, createdAt: "2026-08-01T00:00:00.000Z" };
  const nextRule = { ...previousRule, categoryId: "home" };
  state.recurringTransactions = [previousRule];
  state.transactions = [
    { id: "auto", date: "2026-09-05", kind: "expense" as const, amount: 1_500_000, accountId: "bank", categoryId: "family", recurringId: "routine", note: "Kos" },
    { id: "manual-edit", date: "2026-09-05", kind: "expense" as const, amount: 1_600_000, accountId: "bank", categoryId: "family", recurringId: "routine", note: "Kos disesuaikan" },
  ];
  const next = syncRecurringRule(state, previousRule, nextRule);
  assert.equal(next.transactions.find((transaction) => transaction.id === "auto")?.categoryId, "home");
  assert.equal(next.transactions.find((transaction) => transaction.id === "manual-edit")?.categoryId, "family");
});

test("backup mempertahankan transaksi rutin, rekonsiliasi, dan target", () => {
  const state = baseState();
  state.recurringTransactions = [{ id: "routine", name: "Internet", kind: "expense", amount: 150_000, accountId: "bank", dayOfMonth: 5, active: true, createdAt: "2026-08-01T00:00:00.000Z" }];
  state.reconciliations = [{ id: "check", accountId: "bank", date: "2026-08-20", recordedBalance: 1_000_000, actualBalance: 990_000, difference: -10_000 }];
  state.goals = [{ id: "goal", name: "Dana darurat", targetAmount: 5_000_000, currentAmount: 1_000_000, createdAt: "2026-08-01T00:00:00.000Z" }];
  const normalized = normalizeImportedState(state);
  assert.deepEqual(normalized.recurringTransactions, state.recurringTransactions);
  assert.deepEqual(normalized.reconciliations, state.reconciliations);
  assert.deepEqual(normalized.goals, state.goals);
});

test("backup menolak nilai numerik yang rusak", () => {
  const state = baseState();
  state.accounts[0].openingBalance = Number.NaN;
  assert.throws(() => normalizeImportedState(state), /openingBalance/);
});

test("export lalu import menghasilkan backup yang stabil", () => {
  const normalized = normalizeImportedState(baseState());
  const restored = normalizeImportedState(JSON.parse(serializeState(normalized)));
  const restoredAgain = normalizeImportedState(JSON.parse(serializeState(restored)));
  assert.deepEqual(restoredAgain, restored);
});
