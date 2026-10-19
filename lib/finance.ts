export type TransactionKind =
  | "income"
  | "expense"
  | "transfer"
  | "debtPayment"
  | "assetPurchase"
  | "assetSale";

export type AccountType = "bank" | "cash" | "ewallet";

export interface Category {
  id: string;
  name: string;
  kind: "income" | "expense";
  color: string;
  /** Marks spending that must be covered before discretionary spending. */
  essential?: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  kind: TransactionKind;
  amount: number;
  accountId?: string;
  toAccountId?: string;
  categoryId?: string;
  assetId?: string;
  sourceAssetId?: string;
  /**
   * Keeps an incoming asset-purchase linked after its target asset is converted
   * into an account. The purchase remains unchanged for historical cash-flow
   * reporting, while deletion can still correct the converted account balance.
   */
  migratedTargetAccountId?: string;
  assetValue?: number;
  fee?: number;
  cryptoQuantity?: number;
  cryptoPurchasePriceUsd?: number;
  cryptoCostBasisIdr?: number;
  cryptoSalePriceUsd?: number;
  cryptoUsdIdrRateAtSale?: number;
  cryptoAverageCostPriceUsd?: number;
  grossProceedsIdr?: number;
  realizedGainIdr?: number;
  targetAssetCreated?: boolean;
  liabilityId?: string;
  principal?: number;
  interest?: number;
  recurringId?: string;
  note?: string;
}

export interface RecurringTransaction {
  id: string;
  name: string;
  kind: "income" | "expense";
  amount: number;
  accountId: string;
  categoryId?: string;
  dayOfMonth: number;
  /** Month in which this rule starts. Optional for backwards-compatible backups. */
  startMonth?: string;
  active: boolean;
  note?: string;
  createdAt: string;
}

export interface Reconciliation {
  id: string;
  accountId: string;
  date: string;
  recordedBalance: number;
  actualBalance: number;
  difference: number;
  correctionApplied?: boolean;
  correctionMode?: "dated";
  note?: string;
}

export type GoalSourceType = "manual" | "account" | "asset";

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  sourceType?: GoalSourceType;
  sourceId?: string;
  targetDate?: string;
  note?: string;
  createdAt: string;
}

export type CryptoCoinId = "bitcoin" | "ethereum" | "tether";
export type CryptoSymbol = "BTC" | "ETH" | "USDT";
export const CRYPTO_SYMBOLS: Record<CryptoCoinId, CryptoSymbol> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  tether: "USDT",
};

/**
 * Detail kepemilikan crypto disimpan lokal agar nilai pasar dapat dihitung
 * dari harga publik tanpa mengirim jumlah aset pengguna ke penyedia harga.
 */
export interface CryptoMarketTracking {
  coinId: CryptoCoinId;
  symbol: CryptoSymbol;
  quantity: number;
  costBasisIdr: number;
  averagePurchasePriceUsd: number;
  usdIdrRateAtPurchase: number;
}

export interface CryptoMarketQuote {
  coinId: CryptoCoinId;
  symbol: CryptoSymbol;
  priceUsd: number;
  priceIdr: number;
  updatedAt: string;
  source: "CoinGecko";
}

export type CryptoMarketQuotes = Partial<Record<CryptoCoinId, CryptoMarketQuote>>;

export interface Asset {
  id: string;
  name: string;
  type: "investment" | "vehicle" | "property" | "other";
  value: number;
  liquid: boolean;
  daysToCash: number;
  updatedAt: string;
  note?: string;
  market?: CryptoMarketTracking;
}

export interface AssetValuation {
  id: string;
  assetId: string;
  value: number;
  recordedAt: string;
  transactionId?: string;
  note?: string;
}

export interface Liability {
  id: string;
  name: string;
  type: "mortgage" | "vehicle" | "creditCard" | "paylater" | "personal" | "other";
  remainingPrincipal: number;
  monthlyPayment: number;
  interestRate?: number;
  dueDay?: number;
  note?: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  month: string;
  amount: number;
  recurringId?: string;
}

export interface RecurringBudget {
  id: string;
  categoryId: string;
  amount: number;
  startMonth: string;
  active: boolean;
  createdAt: string;
}

export interface Snapshot {
  id: string;
  month: string;
  totalAssets: number;
  totalDebt: number;
  netWorth: number;
  liquidAssets: number;
  freeCashFlow: number;
}

export interface AppState {
  version: 1;
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  assets: Asset[];
  assetValuations: AssetValuation[];
  liabilities: Liability[];
  budgets: Budget[];
  recurringBudgets: RecurringBudget[];
  snapshots: Snapshot[];
  reconciliations: Reconciliation[];
  goals: Goal[];
  settings: {
    currency: "IDR";
    monthStartDay: number;
    /** Cash protected from day-to-day spending. Optional for older backups. */
    emergencyBufferTarget?: number;
    /** Regular income day. When absent, planning falls back to month-end. */
    nextIncomeDay?: number;
  };
}

export interface MonthlyMetrics {
  month: string;
  income: number;
  expense: number;
  debtPayment: number;
  assetPurchase: number;
  cashOutflow: number;
  freeCashFlow: number;
  totalAssets: number;
  totalDebt: number;
  netWorth: number;
  liquidAssets: number;
  accountBalances: Record<string, number>;
  categoryTotals: Record<string, number>;
}

export type FinancialHealthStatus = "data" | "steady" | "watch" | "attention";
export type FinancialAnalysisAction = "transactions" | "assets" | "debts" | "budget" | "goals";

export interface FinancialInsight {
  id: string;
  tone: "good" | "watch" | "attention" | "neutral";
  title: string;
  detail: string;
  actionLabel?: string;
  actionView?: FinancialAnalysisAction;
}

export interface NextMonthProjection {
  month: string;
  income: number;
  outflow: number;
  recurringIncome: number;
  recurringExpenses: number;
  debtPayment: number;
  expense: number;
  budget: number;
  budgetGap: number | null;
  freeCashFlow: number;
}

export interface FinancialAnalysis {
  month: string;
  status: FinancialHealthStatus;
  statusLabel: string;
  summary: string;
  savingsRate: number | null;
  debtRatio: number | null;
  liquidRunway: number | null;
  averageMonthlyOutflow: number;
  observedMonths: number;
  nextMonth: NextMonthProjection;
  insights: FinancialInsight[];
  recommendations: FinancialInsight[];
  dataNotes: FinancialInsight[];
}

export type SafetyStatus = "data" | "safe" | "watch" | "critical";

export interface SafetyMetrics {
  asOfDate: string;
  nextIncomeDate: string;
  daysToNextIncome: number;
  operationalCash: number;
  committedOutflow: number;
  uncoveredCommitments: number;
  emergencyBufferTarget: number;
  emergencyBufferProtected: number;
  emergencyBufferGap: number;
  spendableBalance: number;
  safeToSpendDaily: number;
  essentialDailyBurn: number;
  survivalRunwayDays: number | null;
  observedDays: number;
  status: SafetyStatus;
  statusLabel: string;
  summary: string;
  dataNotes: string[];
}

export interface CryptoSaleCalculation {
  grossProceedsIdr: number;
  feeIdr: number;
  netProceedsIdr: number;
  quantitySold: number;
  costBasisRemovedIdr: number;
  realizedGainIdr: number;
  remainingQuantity: number;
  remainingCostBasisIdr: number;
}

export interface AssetSaleInput {
  transactionId?: string;
  valuationId?: string;
  assetId: string;
  accountId: string;
  date: string;
  grossProceedsIdr: number;
  feeIdr?: number;
  bookValueRemovedIdr?: number;
  cryptoSalePriceUsd?: number;
  usdIdrRateAtSale?: number;
  note?: string;
}

export interface AssetSaleResult {
  state: AppState;
  transaction: Transaction;
  quantitySold?: number;
  costBasisRemovedIdr: number;
  realizedGainIdr: number;
}

export interface ConvertLiquidAssetToAccountInput {
  assetId: string;
  accountId?: string;
  name: string;
  type: AccountType;
  asOfDate: string;
  createdAt?: string;
}

export interface ConvertLiquidAssetToAccountResult {
  state: AppState;
  account: Account;
  migratedTransactionCount: number;
  migratedIncomingTransactionCount: number;
  migratedSourceTransactionCount: number;
  migratedGoalCount: number;
}

export interface ReconcileCryptoHoldingInput {
  assetId: string;
  actualQuantity: number;
  date: string;
  remainingCostBasisIdr?: number;
  note?: string;
}

export interface RecordAccountReconciliationInput {
  id?: string;
  accountId: string;
  actualBalance: number;
  date: string;
  note?: string;
  applyCorrection?: boolean;
}

const CATEGORY_COLORS = ["#19b89a", "#f5ad57", "#6f86ff", "#e87e9b", "#9f8bff", "#6cc0cc"];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-salary", name: "Gaji", kind: "income", color: CATEGORY_COLORS[0] },
  { id: "cat-side", name: "Sampingan", kind: "income", color: CATEGORY_COLORS[1] },
  { id: "cat-food", name: "Makanan", kind: "expense", color: CATEGORY_COLORS[2], essential: true },
  { id: "cat-home", name: "Rumah & tagihan", kind: "expense", color: CATEGORY_COLORS[3], essential: true },
  { id: "cat-internet", name: "Paket data & internet", kind: "expense", color: "#4f8fd8", essential: true },
  { id: "cat-transport", name: "Transportasi", kind: "expense", color: CATEGORY_COLORS[4], essential: true },
  { id: "cat-vehicle-service", name: "Servis kendaraan", kind: "expense", color: "#c36b42", essential: false },
  { id: "cat-lifestyle", name: "Gaya hidup", kind: "expense", color: CATEGORY_COLORS[5], essential: false },
  { id: "cat-subscriptions", name: "Langganan digital", kind: "expense", color: "#7d6acb", essential: false },
  { id: "cat-health", name: "Kesehatan", kind: "expense", color: "#f28b6a", essential: true },
  { id: "cat-family", name: "Keluarga", kind: "expense", color: "#aa76d6", essential: false },
  { id: "cat-work-education", name: "Kerja & pendidikan", kind: "expense", color: "#2b9a87", essential: false },
  { id: "cat-social-gifts", name: "Sosial & hadiah", kind: "expense", color: "#c67991", essential: false },
  { id: "cat-other", name: "Lainnya", kind: "expense", color: "#95a2a4", essential: false },
];

export const emptyState = (): AppState => ({
  version: 1,
  categories: DEFAULT_CATEGORIES,
  accounts: [],
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
  settings: { currency: "IDR", monthStartDay: 1, emergencyBufferTarget: 0 },
});

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function convertLiquidAssetToAccount(
  state: AppState,
  input: ConvertLiquidAssetToAccountInput,
): ConvertLiquidAssetToAccountResult {
  const asset = state.assets.find((item) => item.id === input.assetId);
  const name = input.name.trim();
  if (!asset) throw new Error("Aset yang akan dipindahkan tidak ditemukan.");
  if (asset.market) throw new Error("Aset kripto tidak dapat diubah menjadi rekening kas.");
  if (!asset.liquid || asset.daysToCash > 3) throw new Error("Hanya aset likuid maksimal T+3 yang dapat dipindahkan ke rekening.");
  if (!name) throw new Error("Isi nama rekening baru.");
  if (!input.asOfDate) throw new Error("Tanggal konversi tidak valid.");
  if (!Number.isFinite(asset.value) || asset.value < 0) throw new Error("Nilai aset tidak valid untuk dipindahkan.");
  if (state.accounts.some((account) => account.name.trim().toLocaleLowerCase("id-ID") === name.toLocaleLowerCase("id-ID"))) {
    throw new Error("Nama rekening tersebut sudah digunakan.");
  }

  const incomingTransactions = state.transactions.filter((transaction) => transaction.assetId === asset.id);
  if (incomingTransactions.some((transaction) => transaction.kind !== "assetPurchase")) {
    throw new Error("Aset ini memiliki jenis riwayat masuk yang belum didukung untuk migrasi.");
  }
  const sourceTransactions = state.transactions.filter((transaction) => transaction.sourceAssetId === asset.id);
  if (sourceTransactions.some((transaction) => transaction.kind !== "assetPurchase")) {
    throw new Error("Aset ini memiliki jenis transaksi terkait yang belum didukung untuk migrasi.");
  }
  if ([...incomingTransactions, ...sourceTransactions].some((transaction) => transaction.date > input.asOfDate)) {
    throw new Error("Aset ini masih memiliki transaksi terjadwal di masa depan. Hapus atau pindahkan jadwal tersebut terlebih dahulu.");
  }

  const accountId = input.accountId ?? createId("account");
  if (state.accounts.some((account) => account.id === accountId)) throw new Error("ID rekening baru sudah digunakan.");
  const migratedOutflow = sourceTransactions.reduce((total, transaction) => total + transaction.amount, 0);
  const account: Account = {
    id: accountId,
    name,
    type: input.type,
    openingBalance: asset.value + migratedOutflow,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  const migratedGoalCount = state.goals.filter((goal) => goal.sourceType === "asset" && goal.sourceId === asset.id).length;

  return {
    state: {
      ...state,
      accounts: [...state.accounts, account],
      transactions: state.transactions.map((transaction) => {
        if (transaction.sourceAssetId === asset.id) {
          return { ...transaction, accountId: account.id, sourceAssetId: undefined };
        }
        if (transaction.assetId === asset.id) {
          return { ...transaction, assetId: undefined, migratedTargetAccountId: account.id };
        }
        return transaction;
      }),
      assets: state.assets.filter((item) => item.id !== asset.id),
      assetValuations: state.assetValuations.filter((valuation) => valuation.assetId !== asset.id),
      goals: state.goals.map((goal) => goal.sourceType === "asset" && goal.sourceId === asset.id
        ? { ...goal, sourceType: "account" as const, sourceId: account.id }
        : goal),
    },
    account,
    migratedTransactionCount: sourceTransactions.length + incomingTransactions.length,
    migratedIncomingTransactionCount: incomingTransactions.length,
    migratedSourceTransactionCount: sourceTransactions.length,
    migratedGoalCount,
  };
}

export function calculateCryptoQuantity(modalIdr: number, purchasePriceUsd: number, usdIdrRate: number): number {
  if (!Number.isFinite(modalIdr) || !Number.isFinite(purchasePriceUsd) || !Number.isFinite(usdIdrRate) || modalIdr < 0 || purchasePriceUsd <= 0 || usdIdrRate <= 0) return 0;
  return modalIdr / usdIdrRate / purchasePriceUsd;
}

export function reconcileCryptoHolding(state: AppState, input: ReconcileCryptoHoldingInput): AppState {
  const asset = state.assets.find((item) => item.id === input.assetId);
  if (!asset?.market) throw new Error("Pilih aset kripto yang akan dicocokkan.");
  if (!input.date) throw new Error("Pilih tanggal pengecekan saldo kripto.");
  if (input.date > isoDate()) throw new Error("Tanggal pengecekan saldo kripto tidak boleh di masa depan.");
  if (!Number.isFinite(input.actualQuantity) || input.actualQuantity < 0) throw new Error("Jumlah aktual kripto harus nol atau lebih.");

  const proportionalCostBasis = asset.market.quantity > 0
    ? asset.market.costBasisIdr * (input.actualQuantity / asset.market.quantity)
    : 0;
  const remainingCostBasisIdr = input.remainingCostBasisIdr ?? proportionalCostBasis;
  if (!Number.isFinite(remainingCostBasisIdr) || remainingCostBasisIdr < 0) throw new Error("Modal tersisa harus nol atau lebih.");
  if (input.actualQuantity === 0 && remainingCostBasisIdr !== 0) throw new Error("Modal tersisa harus Rp 0 jika jumlah kripto nol.");

  const nextAsset: Asset = {
    ...asset,
    value: remainingCostBasisIdr,
    updatedAt: input.date,
    market: {
      ...asset.market,
      quantity: input.actualQuantity,
      costBasisIdr: remainingCostBasisIdr,
    },
  };
  const valuation: AssetValuation = {
    id: createId("valuation"),
    assetId: asset.id,
    value: remainingCostBasisIdr,
    recordedAt: `${input.date}T12:00:00.000Z`,
    note: input.note?.trim() || `Rekonsiliasi ${asset.market.symbol}: ${input.actualQuantity} ${asset.market.symbol}`,
  };

  return {
    ...state,
    assets: state.assets.map((item) => item.id === asset.id ? nextAsset : item),
    assetValuations: [...state.assetValuations, valuation],
  };
}

export function recordAccountReconciliation(state: AppState, input: RecordAccountReconciliationInput): AppState {
  const account = state.accounts.find((item) => item.id === input.accountId);
  if (!account) throw new Error("Pilih rekening yang akan diperiksa.");
  if (!input.date) throw new Error("Pilih tanggal pengecekan saldo.");
  if (input.date > isoDate()) throw new Error("Tanggal pengecekan saldo tidak boleh di masa depan.");
  if (!Number.isFinite(input.actualBalance) || input.actualBalance < 0) throw new Error("Saldo aktual harus nol atau lebih.");
  if (input.applyCorrection && state.reconciliations.some((item) =>
    item.accountId === account.id && item.correctionApplied && item.correctionMode === "dated" && item.date > input.date)) {
    throw new Error("Koreksi ini mendahului koreksi saldo yang sudah ada. Pilih tanggal setelah koreksi terakhir.");
  }

  const recordedBalance = getAccountBalances(state, input.date)[account.id] ?? 0;
  const difference = input.actualBalance - recordedBalance;
  const reconciliation: Reconciliation = {
    id: input.id ?? createId("reconcile"),
    accountId: account.id,
    date: input.date,
    recordedBalance,
    actualBalance: input.actualBalance,
    difference,
    correctionApplied: Boolean(input.applyCorrection),
    correctionMode: input.applyCorrection ? "dated" : undefined,
    note: input.note?.trim() || undefined,
  };

  return {
    ...state,
    accounts: state.accounts,
    reconciliations: [...state.reconciliations, reconciliation],
  };
}

export function calculateCryptoSale(
  asset: Asset,
  grossProceedsIdr: number,
  salePriceUsd: number,
  usdIdrRate: number,
  feeIdr = 0,
): CryptoSaleCalculation | null {
  if (!asset.market ||
    !Number.isFinite(grossProceedsIdr) || grossProceedsIdr <= 0 ||
    !Number.isFinite(salePriceUsd) || salePriceUsd <= 0 ||
    !Number.isFinite(usdIdrRate) || usdIdrRate <= 0 ||
    !Number.isFinite(feeIdr) || feeIdr < 0 || feeIdr >= grossProceedsIdr ||
    asset.market.quantity <= 0) return null;

  const rawQuantity = calculateCryptoQuantity(grossProceedsIdr, salePriceUsd, usdIdrRate);
  const tolerance = Math.max(1e-12, asset.market.quantity * 1e-9);
  if (rawQuantity <= 0 || rawQuantity > asset.market.quantity + tolerance) return null;

  const sellsAll = Math.abs(rawQuantity - asset.market.quantity) <= tolerance;
  const quantitySold = sellsAll ? asset.market.quantity : rawQuantity;
  const proportion = quantitySold / asset.market.quantity;
  const costBasisRemovedIdr = sellsAll ? asset.market.costBasisIdr : asset.market.costBasisIdr * proportion;
  const netProceedsIdr = grossProceedsIdr - feeIdr;

  return {
    grossProceedsIdr,
    feeIdr,
    netProceedsIdr,
    quantitySold,
    costBasisRemovedIdr,
    realizedGainIdr: netProceedsIdr - costBasisRemovedIdr,
    remainingQuantity: sellsAll ? 0 : asset.market.quantity - quantitySold,
    remainingCostBasisIdr: sellsAll ? 0 : asset.market.costBasisIdr - costBasisRemovedIdr,
  };
}

export function recordAssetSale(state: AppState, input: AssetSaleInput): AssetSaleResult {
  const asset = state.assets.find((item) => item.id === input.assetId);
  const account = state.accounts.find((item) => item.id === input.accountId);
  const feeIdr = input.feeIdr ?? 0;
  if (!asset) throw new Error("Pilih aset yang akan dijual.");
  if (!account) throw new Error("Pilih rekening penerima hasil penjualan.");
  if (!input.date) throw new Error("Pilih tanggal penjualan.");
  if (!Number.isFinite(input.grossProceedsIdr) || input.grossProceedsIdr <= 0) throw new Error("Nilai penjualan harus lebih besar dari Rp 0.");
  if (!Number.isFinite(feeIdr) || feeIdr < 0 || feeIdr >= input.grossProceedsIdr) throw new Error("Biaya transaksi harus lebih kecil dari nilai penjualan.");

  const transactionId = input.transactionId ?? createId("tx");
  const valuationId = input.valuationId ?? createId("valuation");
  let nextAsset: Asset;
  let assetValueRemovedIdr: number;
  let quantitySold: number | undefined;
  let costBasisRemovedIdr: number;
  let realizedGainIdr: number;
  let cryptoFields: Pick<Transaction, "cryptoQuantity" | "cryptoSalePriceUsd" | "cryptoUsdIdrRateAtSale" | "cryptoAverageCostPriceUsd" | "cryptoCostBasisIdr"> = {};

  if (asset.market) {
    const sale = calculateCryptoSale(
      asset,
      input.grossProceedsIdr,
      Number(input.cryptoSalePriceUsd),
      Number(input.usdIdrRateAtSale),
      feeIdr,
    );
    if (!sale) throw new Error(`Nilai penjualan melebihi jumlah ${asset.market.symbol} atau harga dan kurs belum valid.`);
    const proportion = sale.quantitySold / asset.market.quantity;
    const sellsAll = sale.remainingQuantity === 0;
    assetValueRemovedIdr = sellsAll ? asset.value : asset.value * proportion;
    quantitySold = sale.quantitySold;
    costBasisRemovedIdr = sale.costBasisRemovedIdr;
    realizedGainIdr = sale.realizedGainIdr;
    nextAsset = {
      ...asset,
      value: sellsAll ? 0 : Math.max(0, asset.value - assetValueRemovedIdr),
      updatedAt: input.date,
      market: {
        ...asset.market,
        quantity: sale.remainingQuantity,
        costBasisIdr: sale.remainingCostBasisIdr,
      },
    };
    cryptoFields = {
      cryptoQuantity: sale.quantitySold,
      cryptoSalePriceUsd: input.cryptoSalePriceUsd,
      cryptoUsdIdrRateAtSale: input.usdIdrRateAtSale,
      cryptoAverageCostPriceUsd: asset.market.averagePurchasePriceUsd,
      cryptoCostBasisIdr: sale.costBasisRemovedIdr,
    };
  } else {
    assetValueRemovedIdr = Number(input.bookValueRemovedIdr);
    if (!Number.isFinite(assetValueRemovedIdr) || assetValueRemovedIdr <= 0) throw new Error("Isi nilai aset yang dilepas.");
    if (assetValueRemovedIdr > asset.value) throw new Error(`Nilai aset yang dilepas tidak boleh melebihi ${formatCurrency(asset.value)}.`);
    costBasisRemovedIdr = assetValueRemovedIdr;
    realizedGainIdr = input.grossProceedsIdr - feeIdr - assetValueRemovedIdr;
    nextAsset = { ...asset, value: asset.value - assetValueRemovedIdr, updatedAt: input.date };
  }

  const transaction: Transaction = {
    id: transactionId,
    date: input.date,
    kind: "assetSale",
    amount: input.grossProceedsIdr - feeIdr,
    accountId: account.id,
    assetId: asset.id,
    assetValue: assetValueRemovedIdr,
    fee: feeIdr || undefined,
    grossProceedsIdr: input.grossProceedsIdr,
    realizedGainIdr,
    note: input.note?.trim() || `Jual ${asset.name}`,
    ...cryptoFields,
  };
  const valuation: AssetValuation = {
    id: valuationId,
    assetId: asset.id,
    value: nextAsset.value,
    recordedAt: `${input.date}T12:00:00.000Z`,
    transactionId,
    note: `Penjualan ${asset.name}`,
  };

  return {
    state: {
      ...state,
      transactions: [...state.transactions, transaction],
      assets: state.assets.map((item) => item.id === asset.id ? nextAsset : item),
      assetValuations: [...state.assetValuations, valuation],
    },
    transaction,
    quantitySold,
    costBasisRemovedIdr,
    realizedGainIdr,
  };
}

export function removeAssetSale(state: AppState, transactionId: string): AppState {
  const transaction = state.transactions.find((item) => item.id === transactionId && item.kind === "assetSale");
  if (!transaction?.assetId) return state;
  const soldValue = Number(transaction.assetValue ?? transaction.amount);
  const soldQuantity = Number(transaction.cryptoQuantity ?? 0);
  const soldCostBasis = Number(transaction.cryptoCostBasisIdr ?? soldValue);
  const soldAverageCostUsd = Number(transaction.cryptoAverageCostPriceUsd ?? 0);

  return {
    ...state,
    transactions: state.transactions.filter((item) => item.id !== transactionId),
    assets: state.assets.map((asset) => {
      if (asset.id !== transaction.assetId) return asset;
      if (!asset.market || soldQuantity <= 0) return { ...asset, value: asset.value + soldValue };

      const currentQuantity = asset.market.quantity;
      const restoredQuantity = currentQuantity + soldQuantity;
      const restoredCostBasis = asset.market.costBasisIdr + soldCostBasis;
      const restoredAverageCostUsd = restoredQuantity > 0
        ? ((currentQuantity * asset.market.averagePurchasePriceUsd) + (soldQuantity * soldAverageCostUsd)) / restoredQuantity
        : asset.market.averagePurchasePriceUsd;
      const restoredRate = currentQuantity > 0 || soldAverageCostUsd <= 0
        ? asset.market.usdIdrRateAtPurchase
        : soldCostBasis / soldQuantity / soldAverageCostUsd;
      return {
        ...asset,
        value: asset.value + soldValue,
        market: {
          ...asset.market,
          quantity: restoredQuantity,
          costBasisIdr: restoredCostBasis,
          averagePurchasePriceUsd: restoredAverageCostUsd,
          usdIdrRateAtPurchase: restoredRate,
        },
      };
    }),
    assetValuations: state.assetValuations.filter((item) => item.transactionId !== transactionId),
  };
}

export function getCurrentAssetValue(asset: Asset, quotes: CryptoMarketQuotes = {}): number {
  const quote = asset.market ? quotes[asset.market.coinId] : undefined;
  if (asset.market && quote && Number.isFinite(quote.priceIdr) && quote.priceIdr > 0) {
    return asset.market.quantity * quote.priceIdr;
  }
  return asset.value;
}

export function getCryptoPerformance(asset: Asset, quotes: CryptoMarketQuotes = {}): { currentValue: number; difference: number; percentage: number } | null {
  if (!asset.market) return null;
  const currentValue = getCurrentAssetValue(asset, quotes);
  const difference = currentValue - asset.market.costBasisIdr;
  const percentage = asset.market.costBasisIdr > 0 ? (difference / asset.market.costBasisIdr) * 100 : 0;
  return { currentValue, difference, percentage };
}

/** Returns a display-only state. Market quotes are never persisted as transactions or valuation history. */
export function withMarketAssetValues(state: AppState, quotes: CryptoMarketQuotes = {}): AppState {
  return {
    ...state,
    assets: state.assets.map((asset) => ({ ...asset, value: getCurrentAssetValue(asset, quotes) })),
  };
}

export function mergeDefaultCategories(categories: Category[] | undefined): Category[] {
  const existing = categories ?? [];
  const defaultsById = new Map(DEFAULT_CATEGORIES.map((category) => [category.id, category]));
  const normalizedExisting = existing.map((category) => {
    const defaultCategory = defaultsById.get(category.id);
    return category.essential === undefined && defaultCategory?.essential !== undefined
      ? { ...category, essential: defaultCategory.essential }
      : category;
  });
  const missingDefaults = DEFAULT_CATEGORIES.filter(
    (defaultCategory) => !existing.some((category) => category.id === defaultCategory.id),
  );
  return [...normalizedExisting, ...missingDefaults];
}

export function ensureCustomCategory(
  categories: Category[],
  name: string,
  kind: Category["kind"],
): { categories: Category[]; categoryId?: string } {
  const normalizedName = name.trim().replace(/\s+/g, " ");
  if (!normalizedName) return { categories };

  const existing = categories.find(
    (category) => category.kind === kind && category.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
  );
  if (existing) return { categories, categoryId: existing.id };

  const category: Category = {
    id: createId("category"),
    name: normalizedName,
    kind,
    color: "#95a2a4",
  };
  return { categories: [...categories, category], categoryId: category.id };
}

export function daysInMonth(month: string): number {
  const [year, rawMonth] = month.split("-").map(Number);
  return new Date(year, rawMonth, 0).getDate();
}

export function applyRecurringTransactions(state: AppState, month: string): { state: AppState; created: number } {
  const monthRules = state.recurringTransactions.filter((rule) => rule.active && rule.amount > 0 && rule.accountId);
  const newTransactions = monthRules.flatMap((rule) => {
    const startMonth = rule.startMonth ?? rule.createdAt.slice(0, 7);
    if (startMonth && month < startMonth) return [];
    const alreadyCreated = state.transactions.some(
      (transaction) => transaction.recurringId === rule.id && transaction.date.startsWith(month),
    );
    if (alreadyCreated) return [];
    const day = Math.min(Math.max(1, rule.dayOfMonth), daysInMonth(month));
    return [{
      id: createId("tx"),
      date: `${month}-${String(day).padStart(2, "0")}`,
      kind: rule.kind,
      amount: rule.amount,
      accountId: rule.accountId,
      categoryId: rule.categoryId,
      recurringId: rule.id,
      note: rule.note?.trim() || rule.name,
    } satisfies Transaction];
  });

  return {
    state: newTransactions.length > 0
      ? { ...state, transactions: [...state.transactions, ...newTransactions] }
      : state,
    created: newTransactions.length,
  };
}

export function removeRecurringTransactions(state: AppState, recurringId: string): AppState {
  return {
    ...state,
    recurringTransactions: state.recurringTransactions.filter((rule) => rule.id !== recurringId),
    transactions: state.transactions.filter((transaction) => transaction.recurringId !== recurringId),
  };
}

export function syncRecurringRule(state: AppState, previousRule: RecurringTransaction, nextRule: RecurringTransaction): AppState {
  const previousNote = previousRule.note?.trim() || previousRule.name;
  const nextNote = nextRule.note?.trim() || nextRule.name;
  return {
    ...state,
    recurringTransactions: state.recurringTransactions.map((rule) => rule.id === nextRule.id ? nextRule : rule),
    transactions: state.transactions.map((transaction) => {
      const isGeneratedByRule = transaction.recurringId === previousRule.id;
      const isUntouchedGeneratedTransaction = isGeneratedByRule &&
        transaction.kind === previousRule.kind &&
        transaction.amount === previousRule.amount &&
        transaction.accountId === previousRule.accountId &&
        transaction.categoryId === previousRule.categoryId &&
        transaction.note === previousNote;
      if (!isUntouchedGeneratedTransaction) return transaction;
      return {
        ...transaction,
        kind: nextRule.kind,
        amount: nextRule.amount,
        accountId: nextRule.accountId,
        categoryId: nextRule.categoryId,
        note: nextNote,
      };
    }),
  };
}

export function copyBudgetsToMonth(state: AppState, sourceMonth: string, targetMonth: string): { state: AppState; created: number; skipped: number } {
  if (sourceMonth === targetMonth) return { state, created: 0, skipped: 0 };
  const sourceBudgets = state.budgets.filter((budget) => budget.month === sourceMonth);
  const existingCategories = new Set(state.budgets.filter((budget) => budget.month === targetMonth).map((budget) => budget.categoryId));
  const copied = sourceBudgets.filter((budget) => !existingCategories.has(budget.categoryId)).map((budget) => ({
    id: createId("budget"),
    categoryId: budget.categoryId,
    month: targetMonth,
    amount: budget.amount,
  } satisfies Budget));
  return {
    state: copied.length > 0 ? { ...state, budgets: [...state.budgets, ...copied] } : state,
    created: copied.length,
    skipped: sourceBudgets.length - copied.length,
  };
}

export function applyRecurringBudgets(state: AppState, month: string): { state: AppState; created: number } {
  const existingCategories = new Set(state.budgets.filter((budget) => budget.month === month).map((budget) => budget.categoryId));
  const newBudgets: Budget[] = [];
  for (const rule of state.recurringBudgets) {
    if (!rule.active || rule.amount <= 0 || !rule.categoryId || rule.startMonth > month || existingCategories.has(rule.categoryId)) continue;
    newBudgets.push({ id: createId("budget"), categoryId: rule.categoryId, month, amount: rule.amount, recurringId: rule.id });
    existingCategories.add(rule.categoryId);
  }
  return {
    state: newBudgets.length > 0 ? { ...state, budgets: [...state.budgets, ...newBudgets] } : state,
    created: newBudgets.length,
  };
}

export function removeRecurringBudget(state: AppState, recurringId: string): AppState {
  return {
    ...state,
    recurringBudgets: state.recurringBudgets.filter((rule) => rule.id !== recurringId),
    budgets: state.budgets.filter((budget) => budget.recurringId !== recurringId),
  };
}

export function syncRecurringBudget(state: AppState, previousRule: RecurringBudget, nextRule: RecurringBudget): AppState {
  return {
    ...state,
    recurringBudgets: state.recurringBudgets.map((rule) => rule.id === nextRule.id ? nextRule : rule),
    budgets: state.budgets.map((budget) => {
      const isGeneratedByRule = budget.recurringId === previousRule.id;
      const isUntouchedGeneratedBudget = isGeneratedByRule && budget.categoryId === previousRule.categoryId && budget.amount === previousRule.amount;
      return isUntouchedGeneratedBudget
        ? { ...budget, categoryId: nextRule.categoryId, amount: nextRule.amount, recurringId: nextRule.id }
        : budget;
    }),
  };
}

export function currentMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [year, rawMonth] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
    new Date(year, rawMonth - 1, 1),
  );
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatShortCurrency(value: number): string {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 1_000_000_000) return `${sign}Rp${(absolute / 1_000_000_000).toFixed(1)} M`;
  if (absolute >= 1_000_000) return `${sign}Rp${(absolute / 1_000_000).toFixed(1)} jt`;
  if (absolute >= 1_000) return `${sign}Rp${Math.round(absolute / 1_000)} rb`;
  return formatCurrency(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function isoDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function balanceCutoffForMonth(month: string): string {
  const today = new Date();
  return month === currentMonth(today)
    ? isoDate(today)
    : `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

export function getAccountBalances(
  state: Pick<AppState, "accounts" | "transactions" | "reconciliations">,
  asOfDate = isoDate(),
): Record<string, number> {
  const balances: Record<string, number> = Object.fromEntries(
    state.accounts.map((account) => [account.id, account.openingBalance]),
  );

  for (const transaction of state.transactions) {
    if (transaction.date > asOfDate) continue;
    if (!transaction.accountId || !(transaction.accountId in balances)) continue;

    if (transaction.kind === "transfer") {
      balances[transaction.accountId] = (balances[transaction.accountId] ?? 0) - transaction.amount;
      if (transaction.toAccountId) {
        balances[transaction.toAccountId] = (balances[transaction.toAccountId] ?? 0) + transaction.amount;
      }
      continue;
    }

    if (transaction.kind === "income" || transaction.kind === "assetSale") {
      balances[transaction.accountId] = (balances[transaction.accountId] ?? 0) + transaction.amount;
    } else {
      balances[transaction.accountId] = (balances[transaction.accountId] ?? 0) - transaction.amount;
    }
  }

  for (const reconciliation of state.reconciliations) {
    if (reconciliation.correctionMode !== "dated" || !reconciliation.correctionApplied || reconciliation.date > asOfDate) continue;
    if (reconciliation.accountId in balances) {
      balances[reconciliation.accountId] += reconciliation.difference;
    }
  }

  return balances;
}

const DAY_IN_MS = 86_400_000;

function dateFromIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoFromUtcDate(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function shiftIsoDate(value: string, days: number): string {
  const date = dateFromIso(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoFromUtcDate(date);
}

function daysBetween(startDate: string, endDate: string): number {
  return Math.max(0, Math.round((dateFromIso(endDate).getTime() - dateFromIso(startDate).getTime()) / DAY_IN_MS));
}

function dateForMonthDay(month: string, day: number): string {
  return `${month}-${String(Math.min(Math.max(1, day), daysInMonth(month))).padStart(2, "0")}`;
}

function nextPlanningDate(asOfDate: string, incomeDay?: number): string {
  const thisMonth = asOfDate.slice(0, 7);
  const day = incomeDay && incomeDay >= 1 && incomeDay <= 31 ? incomeDay : daysInMonth(thisMonth);
  const thisMonthCandidate = dateForMonthDay(thisMonth, day);
  if (thisMonthCandidate > asOfDate) return thisMonthCandidate;
  const nextMonth = getMonthOffset(thisMonth, 1);
  return dateForMonthDay(nextMonth, incomeDay && incomeDay >= 1 && incomeDay <= 31 ? incomeDay : daysInMonth(nextMonth));
}

function scheduledDatesBetween(dayOfMonth: number, startExclusive: string, endInclusive: string): string[] {
  const dates: string[] = [];
  let month = startExclusive.slice(0, 7);
  const endMonth = endInclusive.slice(0, 7);
  while (month <= endMonth) {
    const date = dateForMonthDay(month, dayOfMonth);
    if (date > startExclusive && date <= endInclusive) dates.push(date);
    month = getMonthOffset(month, 1);
  }
  return dates;
}

function normalizedCommitmentName(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function recurringMatchesLiability(rule: RecurringTransaction, liability: Liability): boolean {
  return rule.kind === "expense" &&
    rule.amount === liability.monthlyPayment &&
    normalizedCommitmentName(rule.name) === normalizedCommitmentName(liability.name);
}

/**
 * Calculates conservative day-to-day safety metrics from local records.
 * Accounts are spendable cash. Investments stay outside operational cash even
 * when they are liquid, so market movement cannot inflate a spending limit.
 */
export function calculateSafetyMetrics(state: AppState, asOfDate = isoDate()): SafetyMetrics {
  const nextIncomeDate = nextPlanningDate(asOfDate, state.settings.nextIncomeDay);
  const daysToNextIncome = Math.max(1, daysBetween(asOfDate, nextIncomeDate));
  const balances = getAccountBalances(state, asOfDate);
  const operationalCash = Object.values(balances).reduce((total, balance) => total + balance, 0);
  const futureTransactions = state.transactions.filter((transaction) =>
    transaction.date > asOfDate &&
    transaction.date <= nextIncomeDate &&
    (transaction.kind === "expense" || transaction.kind === "debtPayment" || transaction.kind === "assetPurchase"),
  );
  const transactionCommitments = futureTransactions.reduce((total, transaction) => total + transaction.amount, 0);

  let recurringCommitments = 0;
  for (const rule of state.recurringTransactions.filter((item) => item.active && item.kind === "expense" && item.amount > 0)) {
    for (const dueDate of scheduledDatesBetween(rule.dayOfMonth, asOfDate, nextIncomeDate)) {
      const month = dueDate.slice(0, 7);
      const startMonth = rule.startMonth ?? rule.createdAt.slice(0, 7);
      if (startMonth > month) continue;
      const alreadyCreated = state.transactions.some((transaction) =>
        transaction.recurringId === rule.id && transaction.date.startsWith(month),
      );
      if (!alreadyCreated) recurringCommitments += rule.amount;
    }
  }

  let liabilityCommitments = 0;
  for (const liability of state.liabilities.filter((item) => item.remainingPrincipal > 0 && item.monthlyPayment > 0 && item.dueDay)) {
    for (const dueDate of scheduledDatesBetween(liability.dueDay!, asOfDate, nextIncomeDate)) {
      const month = dueDate.slice(0, 7);
      const alreadyPaid = state.transactions.some((transaction) =>
        transaction.kind === "debtPayment" &&
        transaction.liabilityId === liability.id &&
        transaction.date.startsWith(month) &&
        transaction.date <= nextIncomeDate,
      );
      const coveredByRecurring = state.recurringTransactions.some((rule) => {
        const startMonth = rule.startMonth ?? rule.createdAt.slice(0, 7);
        return rule.active && startMonth <= month && recurringMatchesLiability(rule, liability);
      });
      if (!alreadyPaid && !coveredByRecurring) liabilityCommitments += liability.monthlyPayment;
    }
  }

  const committedOutflow = transactionCommitments + recurringCommitments + liabilityCommitments;
  const availableAfterCommitments = operationalCash - committedOutflow;
  const uncoveredCommitments = Math.max(0, -availableAfterCommitments);
  const emergencyBufferTarget = Math.max(0, state.settings.emergencyBufferTarget ?? 0);
  const emergencyBufferProtected = Math.min(emergencyBufferTarget, Math.max(0, availableAfterCommitments));
  const emergencyBufferGap = Math.max(0, emergencyBufferTarget - emergencyBufferProtected);
  const spendableBalance = Math.max(0, availableAfterCommitments - emergencyBufferTarget);
  const safeToSpendDaily = spendableBalance / daysToNextIncome;

  const historyStart = shiftIsoDate(asOfDate, -89);
  const historyTransactions = state.transactions.filter((transaction) =>
    transaction.date >= historyStart &&
    transaction.date <= asOfDate &&
    transaction.kind !== "transfer" &&
    transaction.kind !== "assetSale" &&
    transaction.kind !== "assetPurchase",
  );
  const earliestHistoryDate = historyTransactions.map((transaction) => transaction.date).sort()[0];
  const observedDays = earliestHistoryDate ? daysBetween(earliestHistoryDate, asOfDate) + 1 : 0;
  const essentialCategoryIds = new Set(state.categories.filter((category) => category.kind === "expense" && category.essential).map((category) => category.id));
  const historicalEssentialOutflow = historyTransactions
    .filter((transaction) =>
      transaction.kind === "debtPayment" ||
      (transaction.kind === "expense" && Boolean(transaction.categoryId && essentialCategoryIds.has(transaction.categoryId))),
    )
    .reduce((total, transaction) => total + transaction.amount, 0);
  const historicalDailyBurn = observedDays > 0 ? historicalEssentialOutflow / observedDays : 0;

  const currentMonthKey = asOfDate.slice(0, 7);
  const scheduledRecurringEssential = state.recurringTransactions
    .filter((rule) => {
      const startMonth = rule.startMonth ?? rule.createdAt.slice(0, 7);
      return rule.active && rule.kind === "expense" && startMonth <= currentMonthKey && Boolean(rule.categoryId && essentialCategoryIds.has(rule.categoryId));
    })
    .reduce((total, rule) => total + rule.amount, 0);
  const scheduledLiabilityPayments = state.liabilities
    .filter((liability) =>
      liability.remainingPrincipal > 0 &&
      liability.monthlyPayment > 0 &&
      !state.recurringTransactions.some((rule) => rule.active && recurringMatchesLiability(rule, liability)),
    )
    .reduce((total, liability) => total + liability.monthlyPayment, 0);
  const scheduledDailyBurn = (scheduledRecurringEssential + scheduledLiabilityPayments) / 30.4375;
  const essentialDailyBurn = Math.max(historicalDailyBurn, scheduledDailyBurn);
  const survivalRunwayDays = essentialDailyBurn > 0
    ? Math.max(0, operationalCash) / essentialDailyBurn
    : null;

  const dataNotes: string[] = [];
  if (state.accounts.length === 0) dataNotes.push("Tambahkan rekening, kas, atau e-wallet agar kas operasional dapat dihitung.");
  if (emergencyBufferTarget <= 0) dataNotes.push("Atur target dana darurat yang ingin dilindungi dari pengeluaran harian.");
  if (essentialCategoryIds.size === 0) dataNotes.push("Pilih kategori kebutuhan pokok untuk menghitung survival runway.");
  if (essentialDailyBurn <= 0) dataNotes.push("Belum ada riwayat atau pola kebutuhan pokok untuk menghitung survival runway.");
  if (state.liabilities.some((liability) => liability.monthlyPayment > 0 && !liability.dueDay)) {
    dataNotes.push("Lengkapi tanggal jatuh tempo utang agar komitmen terdekat lebih akurat.");
  }

  let status: SafetyStatus;
  if (state.accounts.length === 0) status = "data";
  else if (uncoveredCommitments > 0 || (survivalRunwayDays !== null && survivalRunwayDays < 14)) status = "critical";
  else if (emergencyBufferTarget <= 0 || essentialDailyBurn <= 0 || essentialCategoryIds.size === 0) status = "data";
  else if (emergencyBufferGap > 0 || (survivalRunwayDays !== null && survivalRunwayDays < 30)) status = "watch";
  else status = "safe";

  const statusLabel: Record<SafetyStatus, string> = {
    data: "Lengkapi data",
    safe: "Aman",
    watch: "Waspada",
    critical: "Kritis",
  };
  const summary = status === "critical"
    ? uncoveredCommitments > 0
      ? `Komitmen terdekat belum tertutup sebesar ${formatCurrency(uncoveredCommitments)}.`
      : "Kas operasional belum cukup untuk menutup 14 hari kebutuhan pokok."
    : status === "watch"
      ? emergencyBufferGap > 0
        ? `Dana darurat masih kurang ${formatCurrency(emergencyBufferGap)} dari target yang ditetapkan.`
        : "Daya tahan kas berada di bawah 30 hari kebutuhan pokok."
      : status === "safe"
        ? "Komitmen terdekat dan dana darurat masih tertutup dari kas operasional."
        : "Lengkapi pengaturan agar batas aman penggunaan uang dapat dibaca dengan tepat.";

  return {
    asOfDate,
    nextIncomeDate,
    daysToNextIncome,
    operationalCash,
    committedOutflow,
    uncoveredCommitments,
    emergencyBufferTarget,
    emergencyBufferProtected,
    emergencyBufferGap,
    spendableBalance,
    safeToSpendDaily,
    essentialDailyBurn,
    survivalRunwayDays,
    observedDays,
    status,
    statusLabel: statusLabel[status],
    summary,
    dataNotes,
  };
}

export function getGoalCurrentAmount(state: Pick<AppState, "accounts" | "transactions" | "reconciliations" | "assets">, goal: Goal): number {
  if (goal.sourceType === "account" && goal.sourceId) {
    const account = state.accounts.find((item) => item.id === goal.sourceId);
    if (account) return Math.max(0, getAccountBalances(state)[account.id] ?? 0);
  }
  if (goal.sourceType === "asset" && goal.sourceId) {
    const asset = state.assets.find((item) => item.id === goal.sourceId);
    if (asset) return Math.max(0, asset.value);
  }
  return Math.max(0, goal.currentAmount);
}

export function calculateMetrics(state: AppState, month = currentMonth()): MonthlyMetrics {
  const accountBalances = getAccountBalances(state, balanceCutoffForMonth(month));
  const monthTransactions = state.transactions.filter((transaction) => transaction.date.startsWith(month));
  const income = monthTransactions
    .filter((transaction) => transaction.kind === "income" || transaction.kind === "assetSale")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const expense = monthTransactions
    .filter((transaction) => transaction.kind === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const debtPayment = monthTransactions
    .filter((transaction) => transaction.kind === "debtPayment")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const assetPurchase = monthTransactions
    .filter((transaction) => transaction.kind === "assetPurchase")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const cashOutflow = expense + debtPayment + assetPurchase;
  const totalAssets = Object.values(accountBalances).reduce((total, value) => total + value, 0) +
    state.assets.reduce((total, asset) => total + asset.value, 0);
  const totalDebt = state.liabilities.reduce((total, liability) => total + liability.remainingPrincipal, 0);
  const liquidAssets = Object.values(accountBalances).reduce((total, value) => total + value, 0) +
    state.assets
      .filter((asset) => asset.liquid && asset.daysToCash <= 3)
      .reduce((total, asset) => total + asset.value, 0);
  const categoryTotals: Record<string, number> = {};
  for (const transaction of monthTransactions.filter((item) => item.kind === "expense")) {
    if (transaction.categoryId) categoryTotals[transaction.categoryId] = (categoryTotals[transaction.categoryId] ?? 0) + transaction.amount;
  }

  return {
    month,
    income,
    expense,
    debtPayment,
    assetPurchase,
    cashOutflow,
    freeCashFlow: income - cashOutflow,
    totalAssets,
    totalDebt,
    netWorth: totalAssets - totalDebt,
    liquidAssets,
    accountBalances,
    categoryTotals,
  };
}

export function getMonthOffset(month: string, offset: number): string {
  const [year, rawMonth] = month.split("-").map(Number);
  const value = new Date(year, rawMonth - 1 + offset, 1);
  return currentMonth(value);
}

function recurringRulesMissingFromMonth(state: AppState, month: string): RecurringTransaction[] {
  return state.recurringTransactions.filter((rule) => {
    const startMonth = rule.startMonth ?? rule.createdAt.slice(0, 7);
    return rule.active && rule.amount > 0 && rule.accountId && startMonth <= month &&
      !state.transactions.some((transaction) => transaction.recurringId === rule.id && transaction.date.startsWith(month));
  });
}

export function analyzeFinancialHealth(state: AppState, month = currentMonth()): FinancialAnalysis {
  const metrics = calculateMetrics(state, month);
  const nextMonth = getMonthOffset(month, 1);
  const nextMonthMetrics = calculateMetrics(state, nextMonth);
  const missingRecurringRules = recurringRulesMissingFromMonth(state, nextMonth);
  const recurringIncome = missingRecurringRules
    .filter((rule) => rule.kind === "income")
    .reduce((total, rule) => total + rule.amount, 0);
  const recurringExpenses = missingRecurringRules
    .filter((rule) => rule.kind === "expense")
    .reduce((total, rule) => total + rule.amount, 0);
  const paidLiabilitiesNextMonth = new Set(
    state.transactions
      .filter((transaction) => transaction.kind === "debtPayment" && transaction.date.startsWith(nextMonth) && transaction.liabilityId)
      .map((transaction) => transaction.liabilityId),
  );
  const scheduledDebtPayment = state.liabilities
    .filter((liability) => liability.monthlyPayment > 0 && !paidLiabilitiesNextMonth.has(liability.id))
    .reduce((total, liability) => total + liability.monthlyPayment, 0);
  const projectedExpense = nextMonthMetrics.expense + recurringExpenses;
  const projectedDebtPayment = nextMonthMetrics.debtPayment + scheduledDebtPayment;
  const projectedOutflow = projectedExpense + projectedDebtPayment + nextMonthMetrics.assetPurchase;
  const nextMonthProjection: NextMonthProjection = {
    month: nextMonth,
    income: nextMonthMetrics.income + recurringIncome,
    outflow: projectedOutflow,
    recurringIncome,
    recurringExpenses,
    debtPayment: projectedDebtPayment,
    expense: projectedExpense,
    budget: state.budgets.filter((budget) => budget.month === nextMonth).reduce((total, budget) => total + budget.amount, 0),
    budgetGap: null,
    freeCashFlow: nextMonthMetrics.income + recurringIncome - projectedOutflow,
  };
  nextMonthProjection.budgetGap = nextMonthProjection.budget > 0
    ? nextMonthProjection.budget - nextMonthProjection.expense
    : null;

  const recentMetrics = Array.from({ length: 3 }, (_, index) => calculateMetrics(state, getMonthOffset(month, index - 2)));
  const observedMonths = recentMetrics.filter((item) => item.income > 0 || item.cashOutflow > 0).length;
  const outflowHistory = recentMetrics.map((item) => item.cashOutflow).filter((value) => value > 0);
  const averageMonthlyOutflow = outflowHistory.length > 0
    ? outflowHistory.reduce((total, value) => total + value, 0) / outflowHistory.length
    : nextMonthProjection.outflow;
  const liquidRunway = averageMonthlyOutflow > 0
    ? Math.max(0, metrics.liquidAssets) / averageMonthlyOutflow
    : null;
  const savingsRate = metrics.income > 0 ? (metrics.freeCashFlow / metrics.income) * 100 : null;
  const monthlyDebtPayment = state.liabilities.reduce((total, liability) => total + liability.monthlyPayment, 0);
  const debtRatio = metrics.income > 0 ? (monthlyDebtPayment / metrics.income) * 100 : null;
  const topCategory = Object.entries(metrics.categoryTotals).sort(([, a], [, b]) => b - a)[0];
  const topCategoryName = topCategory ? state.categories.find((category) => category.id === topCategory[0])?.name ?? "Lainnya" : "Lainnya";
  const recommendations: FinancialInsight[] = [];
  const dataNotes: FinancialInsight[] = [];

  if (state.accounts.length === 0) {
    dataNotes.push({ id: "missing-account", tone: "attention", title: "Rekening belum tersedia", detail: "Saldo likuid dan kemampuan membayar belum bisa dibaca tanpa rekening sumber dana.", actionLabel: "Tambah rekening", actionView: "assets" });
  }
  if (observedMonths === 0) {
    dataNotes.push({ id: "missing-activity", tone: "neutral", title: "Riwayat arus kas masih kosong", detail: "Catat pemasukan dan pengeluaran agar perbandingan bulanan tidak hanya berdasarkan saldo awal.", actionLabel: "Catat transaksi", actionView: "transactions" });
  }
  if (state.budgets.filter((budget) => budget.month === nextMonth).length === 0) {
    dataNotes.push({ id: "missing-budget", tone: "neutral", title: "Batas bulan depan belum diatur", detail: `Anggaran membuat batas pengeluaran ${monthLabel(nextMonth)} lebih mudah dipantau.`, actionLabel: "Atur anggaran", actionView: "budget" });
  }

  if (metrics.freeCashFlow < 0) {
    recommendations.push({ id: "current-deficit", tone: "attention", title: "Tutup defisit bulan ini", detail: `Arus keluar lebih besar ${formatCurrency(Math.abs(metrics.freeCashFlow))} dari pemasukan yang tercatat. Tunda pembelian non-wajib atau cari pos yang bisa dikurangi.`, actionLabel: "Lihat transaksi", actionView: "transactions" });
  }
  if (nextMonthProjection.freeCashFlow < 0) {
    recommendations.push({ id: "next-deficit", tone: "attention", title: "Bulan depan perlu ruang tambahan", detail: `${monthLabel(nextMonth)} diproyeksikan defisit ${formatCurrency(Math.abs(nextMonthProjection.freeCashFlow))} setelah transaksi rutin dan cicilan diperhitungkan.`, actionLabel: "Atur transaksi rutin", actionView: "transactions" });
  }
  if (liquidRunway !== null && liquidRunway < 3) {
    recommendations.push({ id: "short-runway", tone: "attention", title: "Perkuat dana yang mudah dicairkan", detail: `Aset likuid diperkirakan menutup sekitar ${liquidRunway.toFixed(1)} bulan arus keluar rata-rata. Prioritaskan buffer sebelum menambah aset berisiko.`, actionLabel: "Lihat aset", actionView: "assets" });
  }
  if (debtRatio !== null && debtRatio > 30) {
    recommendations.push({ id: "debt-burden", tone: debtRatio > 40 ? "attention" : "watch", title: "Beban cicilan cukup besar", detail: `Cicilan berjalan sekitar ${Math.round(debtRatio)}% dari pemasukan bulan ini. Jaga agar kewajiban baru tidak mempersempit arus kas bebas.`, actionLabel: "Lihat utang", actionView: "debts" });
  }
  if (nextMonthProjection.budgetGap !== null && nextMonthProjection.budgetGap < 0) {
    recommendations.push({ id: "budget-overrun", tone: "watch", title: "Rencana pengeluaran melewati anggaran", detail: `Proyeksi pengeluaran kategori bulan depan melampaui anggaran sebesar ${formatCurrency(Math.abs(nextMonthProjection.budgetGap))}.`, actionLabel: "Tinjau anggaran", actionView: "budget" });
  }
  if (savingsRate !== null && savingsRate < 20 && metrics.freeCashFlow >= 0) {
    recommendations.push({ id: "low-savings-rate", tone: "watch", title: "Ruang menabung masih tipis", detail: `Sisa kas bulan ini sekitar ${Math.max(0, savingsRate).toFixed(0)}% dari pemasukan. Sisihkan nominal tetap segera setelah pemasukan masuk.` });
  }
  if (topCategory && metrics.expense > 0 && topCategory[1] / metrics.expense >= 0.35) {
    recommendations.push({ id: "top-category", tone: "watch", title: `${topCategoryName} menjadi pos terbesar`, detail: `${topCategoryName} mengambil sekitar ${Math.round((topCategory[1] / metrics.expense) * 100)}% pengeluaran bulan ini. Periksa apakah ada transaksi yang bisa dipangkas atau diberi batas.`, actionLabel: "Lihat transaksi", actionView: "transactions" });
  }
  if (recommendations.length === 0) {
    recommendations.push({ id: "keep-course", tone: "good", title: "Pertahankan pola yang berjalan", detail: "Arus kas, kewajiban, dan proyeksi bulan depan belum menunjukkan tekanan besar dari data yang tercatat." });
  }

  const hasEnoughContext = state.accounts.length > 0 && (observedMonths > 0 || metrics.totalAssets > 0 || state.liabilities.length > 0);
  const hasAttention = metrics.freeCashFlow < 0 || nextMonthProjection.freeCashFlow < 0 || (debtRatio !== null && debtRatio > 40) || (liquidRunway !== null && liquidRunway < 1);
  const needsWatching = (debtRatio !== null && debtRatio > 30) || (liquidRunway !== null && liquidRunway < 3) || (savingsRate !== null && savingsRate < 20) || (nextMonthProjection.budgetGap !== null && nextMonthProjection.budgetGap < 0);
  const status: FinancialHealthStatus = !hasEnoughContext ? "data" : hasAttention ? "attention" : needsWatching ? "watch" : "steady";
  const statusLabel: Record<FinancialHealthStatus, string> = { data: "Butuh data", steady: "Cukup stabil", watch: "Perlu dipantau", attention: "Perlu perhatian" };
  const summary: Record<FinancialHealthStatus, string> = {
    data: "Data belum cukup untuk membaca kondisi secara utuh. Lengkapi catatan utama agar rekomendasi lebih berguna.",
    steady: "Arus kas dan posisi likuiditas terlihat cukup terkendali dari data yang tercatat.",
    watch: "Posisi masih berjalan, tetapi ada beberapa angka yang perlu dipantau lebih dekat.",
    attention: "Ada tekanan pada arus kas atau kewajiban yang perlu ditangani sebelum menambah beban baru.",
  };
  const insights: FinancialInsight[] = [
    { id: "cashflow", tone: metrics.freeCashFlow >= 0 ? "good" : "attention", title: "Arus kas bulan ini", detail: metrics.freeCashFlow >= 0 ? `Masih tersisa ${formatCurrency(metrics.freeCashFlow)} setelah arus keluar.` : `Defisit ${formatCurrency(Math.abs(metrics.freeCashFlow))} dari catatan bulan ini.` },
    { id: "liquidity", tone: liquidRunway !== null && liquidRunway < 3 ? "watch" : "neutral", title: "Daya tahan likuid", detail: liquidRunway === null ? "Belum ada arus keluar untuk menghitung perkiraan daya tahan." : `Sekitar ${liquidRunway.toFixed(1)} bulan berdasarkan arus keluar rata-rata.` },
    { id: "next-month", tone: nextMonthProjection.freeCashFlow >= 0 ? "good" : "attention", title: `Persiapan ${monthLabel(nextMonth)}`, detail: nextMonthProjection.freeCashFlow >= 0 ? `Ada ruang sekitar ${formatCurrency(nextMonthProjection.freeCashFlow)} setelah rencana yang terbaca.` : `Ada kekurangan sekitar ${formatCurrency(Math.abs(nextMonthProjection.freeCashFlow))} dari rencana yang terbaca.` },
  ];

  return {
    month,
    status,
    statusLabel: statusLabel[status],
    summary: summary[status],
    savingsRate,
    debtRatio,
    liquidRunway,
    averageMonthlyOutflow,
    observedMonths,
    nextMonth: nextMonthProjection,
    insights,
    recommendations: recommendations.slice(0, 4),
    dataNotes: dataNotes.slice(0, 3),
  };
}

export function ensureCurrentSnapshot(state: AppState, month = currentMonth()): AppState {
  const metrics = calculateMetrics(state, month);
  const snapshot: Snapshot = {
    id: `snapshot-${month}`,
    month,
    totalAssets: metrics.totalAssets,
    totalDebt: metrics.totalDebt,
    netWorth: metrics.netWorth,
    liquidAssets: metrics.liquidAssets,
    freeCashFlow: metrics.freeCashFlow,
  };
  const existing = state.snapshots.some((item) => item.id === snapshot.id);
  return {
    ...state,
    snapshots: existing
      ? state.snapshots.map((item) => (item.id === snapshot.id ? snapshot : item))
      : [...state.snapshots, snapshot],
  };
}

function validateRecordCollection(value: unknown, label: string, requiredNumericFields: string[] = [], optionalNumericFields: string[] = [], integerFields: string[] = []): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) throw new Error(`Data ${label} pada backup tidak valid.`);
  value.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || typeof (entry as { id?: unknown }).id !== "string" || !(entry as { id: string }).id) {
      throw new Error(`Data ${label} pada backup tidak valid di baris ${index + 1}.`);
    }
    const record = entry as Record<string, unknown>;
    for (const field of requiredNumericFields) {
      const fieldValue = record[field];
      if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) throw new Error(`Nilai ${field} pada ${label} tidak valid.`);
    }
    for (const field of optionalNumericFields) {
      const fieldValue = record[field];
      if (fieldValue !== undefined && (typeof fieldValue !== "number" || !Number.isFinite(fieldValue))) throw new Error(`Nilai ${field} pada ${label} tidak valid.`);
    }
    for (const field of integerFields) {
      const fieldValue = record[field];
      if (fieldValue !== undefined && (!Number.isInteger(fieldValue) || (fieldValue as number) < 0)) throw new Error(`Nilai ${field} pada ${label} tidak valid.`);
    }
  });
}

export function normalizeImportedState(value: unknown): AppState {
  if (!value || typeof value !== "object") throw new Error("Format backup tidak valid.");
  const candidate = value as Partial<AppState>;
  if (candidate.version !== 1) throw new Error("Versi backup tidak didukung.");
  const base = emptyState();
  validateRecordCollection(candidate.categories, "kategori");
  validateRecordCollection(candidate.accounts, "rekening", ["openingBalance"]);
  validateRecordCollection(candidate.transactions, "transaksi", ["amount"], ["assetValue", "fee", "principal", "interest", "cryptoQuantity", "cryptoPurchasePriceUsd", "cryptoCostBasisIdr", "cryptoSalePriceUsd", "cryptoUsdIdrRateAtSale", "cryptoAverageCostPriceUsd", "grossProceedsIdr", "realizedGainIdr"]);
  validateRecordCollection(candidate.recurringTransactions, "transaksi rutin", ["amount", "dayOfMonth"], [], ["dayOfMonth"]);
  validateRecordCollection(candidate.assets, "aset", ["value", "daysToCash"]);
  validateRecordCollection(candidate.assetValuations, "riwayat nilai aset", ["value"]);
  validateRecordCollection(candidate.liabilities, "utang", ["remainingPrincipal", "monthlyPayment"], ["interestRate", "dueDay"]);
  validateRecordCollection(candidate.budgets, "anggaran", ["amount"]);
  validateRecordCollection(candidate.recurringBudgets, "anggaran rutin", ["amount"]);
  validateRecordCollection(candidate.snapshots, "snapshot", ["totalAssets", "totalDebt", "netWorth", "liquidAssets", "freeCashFlow"]);
  validateRecordCollection(candidate.reconciliations, "rekonsiliasi", ["recordedBalance", "actualBalance", "difference"]);
  validateRecordCollection(candidate.goals, "target", ["targetAmount", "currentAmount"]);
  if (candidate.settings !== undefined) {
    if (!candidate.settings || typeof candidate.settings !== "object") throw new Error("Pengaturan pada backup tidak valid.");
    const monthStartDay = candidate.settings.monthStartDay;
    if (!Number.isInteger(monthStartDay) || monthStartDay < 1 || monthStartDay > 31) throw new Error("Pengaturan tanggal awal bulan pada backup tidak valid.");
    const emergencyBufferTarget = candidate.settings.emergencyBufferTarget;
    if (emergencyBufferTarget !== undefined && (typeof emergencyBufferTarget !== "number" || !Number.isFinite(emergencyBufferTarget) || emergencyBufferTarget < 0)) {
      throw new Error("Target dana darurat pada backup tidak valid.");
    }
    const nextIncomeDay = candidate.settings.nextIncomeDay;
    if (nextIncomeDay !== undefined && (!Number.isInteger(nextIncomeDay) || nextIncomeDay < 1 || nextIncomeDay > 31)) {
      throw new Error("Tanggal pemasukan rutin pada backup tidak valid.");
    }
  }
  function normalizeCryptoMarketTracking(asset: Asset): Asset {
    if (asset.market === undefined) return asset;
    const market = asset.market as unknown as Record<string, unknown>;
    const numericFields = ["quantity", "costBasisIdr", "averagePurchasePriceUsd", "usdIdrRateAtPurchase"] as const;
    const supportedMarket = typeof market?.coinId === "string"
      && Object.prototype.hasOwnProperty.call(CRYPTO_SYMBOLS, market.coinId)
      && market.symbol === CRYPTO_SYMBOLS[market.coinId as CryptoCoinId];
    if (!market || typeof market !== "object" || !supportedMarket) {
      throw new Error("Data harga pasar pada aset tidak valid.");
    }
    for (const field of numericFields) {
      if (typeof market[field] !== "number" || !Number.isFinite(market[field]) || (market[field] as number) < 0) {
        throw new Error("Data harga pasar pada aset tidak valid.");
      }
    }
    if ((market.quantity as number) < 0 || (market.averagePurchasePriceUsd as number) <= 0 || (market.usdIdrRateAtPurchase as number) <= 0 ||
      ((market.quantity as number) === 0 && (market.costBasisIdr as number) !== 0)) {
      throw new Error("Data harga pasar pada aset tidak valid.");
    }
    return {
      ...asset,
      market: {
        coinId: market.coinId as CryptoCoinId,
        symbol: market.symbol as CryptoSymbol,
        quantity: market.quantity as number,
        costBasisIdr: market.costBasisIdr as number,
        averagePurchasePriceUsd: market.averagePurchasePriceUsd as number,
        usdIdrRateAtPurchase: market.usdIdrRateAtPurchase as number,
      },
    };
  }

  const importedAssets = (candidate.assets ?? base.assets).map((asset) => {
    const normalizedAsset = normalizeCryptoMarketTracking(asset);
    return normalizedAsset.type === "property"
      ? { ...normalizedAsset, liquid: false, daysToCash: 999 }
      : normalizedAsset;
  });
  const assetValuations = candidate.assetValuations?.length
    ? candidate.assetValuations
    : importedAssets.map((asset) => ({
      id: `valuation-${asset.id}-${asset.updatedAt}`,
      assetId: asset.id,
      value: asset.value,
      recordedAt: asset.updatedAt,
    }));
  const importedGoals = (candidate.goals ?? base.goals).map((goal) => {
    if (goal.sourceType === undefined) return goal;
    const sourceType = goal.sourceType === "account" || goal.sourceType === "asset" || goal.sourceType === "manual"
      ? goal.sourceType
      : "manual";
    return { ...goal, sourceType, sourceId: sourceType === "manual" ? undefined : goal.sourceId };
  });

  return {
    ...base,
    ...candidate,
    categories: mergeDefaultCategories(candidate.categories?.length ? candidate.categories : base.categories),
    assets: importedAssets,
    recurringTransactions: candidate.recurringTransactions ?? base.recurringTransactions,
    recurringBudgets: candidate.recurringBudgets ?? base.recurringBudgets,
    assetValuations,
    reconciliations: candidate.reconciliations ?? base.reconciliations,
    goals: importedGoals,
    settings: { ...base.settings, ...(candidate.settings ?? {}) },
  } as AppState;
}
