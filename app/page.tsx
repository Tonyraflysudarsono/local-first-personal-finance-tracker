"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CRYPTO_SYMBOLS,
  Account,
  AppState,
  Asset,
  AssetValuation,
  CryptoCoinId,
  CryptoMarketQuote,
  CryptoMarketQuotes,
  CryptoMarketTracking,
  Budget,
  Goal,
  GoalSourceType,
  Liability,
  RecurringBudget,
  RecurringTransaction,
  Transaction,
  TransactionKind,
  applyRecurringTransactions,
  applyRecurringBudgets,
  analyzeFinancialHealth,
  calculateMetrics,
  calculateSafetyMetrics,
  calculateCryptoQuantity,
  calculateCryptoSale,
  convertLiquidAssetToAccount,
  copyBudgetsToMonth,
  createId,
  currentMonth,
  ensureCustomCategory,
  formatCurrency,
  formatDate,
  getAccountBalances,
  getMonthOffset,
  getGoalCurrentAmount,
  getCryptoPerformance,
  monthLabel,
  removeRecurringBudget,
  removeRecurringTransactions,
  recordAssetSale,
  removeAssetSale,
  reconcileCryptoHolding,
  recordAccountReconciliation,
  syncRecurringBudget,
  syncRecurringRule,
  withMarketAssetValues,
} from "@/lib/finance";
import { fetchCryptoMarketQuotes, getUsdIdrRate } from "@/lib/market";
import { downloadFile, loadState, parseBackup, saveState, serializeState } from "@/lib/storage";

type View = "dashboard" | "transactions" | "assets" | "debts" | "budget" | "goals" | "reports" | "backup";
type ModalType = "transaction" | "transfer" | "account" | "asset" | "assetValue" | "assetPurchase" | "assetSale" | "assetToAccount" | "cryptoReconcile" | "liability" | "budget" | "recurring" | "recurringBudget" | "reconcile" | "goal" | null;
type PurchaseSourceType = "asset" | "account";

interface AssetPurchaseDraft {
  sourceType: PurchaseSourceType;
  sourceId: string;
  targetAssetId: string;
  targetName: string;
  targetType: Asset["type"];
  targetLiquid: boolean;
  targetDaysToCash: string;
  marketMode: "manual" | CryptoCoinId;
  bitcoinPurchasePriceUsd: string;
  amount: string;
  fee: string;
  date: string;
  note: string;
}

interface AssetSaleDraft {
  assetId: string;
  accountId: string;
  grossProceedsIdr: string;
  feeIdr: string;
  bookValueRemovedIdr: string;
  cryptoSalePriceUsd: string;
  usdIdrRateAtSale: string;
  date: string;
  note: string;
}

interface AssetToAccountDraft {
  name: string;
  type: Account["type"];
}

interface AssetDraft {
  name: string;
  type: Asset["type"];
  value: string;
  liquid: boolean;
  daysToCash: string;
  marketMode: "manual" | CryptoCoinId;
  bitcoinPurchasePriceUsd: string;
}

interface CryptoReconcileDraft {
  actualQuantity: string;
  remainingCostBasisIdr: string;
  date: string;
  note: string;
}

interface RecurringDraft {
  name: string;
  kind: "income" | "expense";
  amount: string;
  accountId: string;
  categoryId: string;
  dayOfMonth: string;
  startMonth: string;
  note: string;
  active: boolean;
}

interface ReconcileDraft {
  accountId: string;
  actualBalance: string;
  date: string;
  note: string;
  applyCorrection: boolean;
}

interface GoalDraft {
  name: string;
  targetAmount: string;
  currentAmount: string;
  sourceType: GoalSourceType;
  sourceId: string;
  targetDate: string;
  note: string;
}

const navGroups: { label: string; items: { id: View; label: string }[] }[] = [
  {
    label: "Pantau",
    items: [
      { id: "dashboard", label: "Ringkasan" },
      { id: "reports", label: "Laporan" },
    ],
  },
  {
    label: "Kelola",
    items: [
      { id: "transactions", label: "Transaksi" },
      { id: "assets", label: "Aset" },
      { id: "debts", label: "Utang" },
      { id: "budget", label: "Anggaran" },
      { id: "goals", label: "Target" },
    ],
  },
  { label: "Data", items: [{ id: "backup", label: "Backup" }] },
];

const navItems = navGroups.flatMap((group) => group.items);

const viewDetails: Record<View, { eyebrow: string; title: string; note: string }> = {
  dashboard: { eyebrow: "Neraca pribadi", title: "Kondisi keuangan", note: "Lihat posisi, aliran, dan prioritas bulan ini." },
  transactions: { eyebrow: "Arus uang", title: "Transaksi", note: "Setiap catatan membangun gambaran yang lebih akurat." },
  assets: { eyebrow: "Kepemilikan", title: "Aset dan saldo", note: "Bedakan uang siap pakai dari nilai jangka panjang." },
  debts: { eyebrow: "Kewajiban", title: "Utang", note: "Pantau sisa pokok dan komitmen pembayaran." },
  budget: { eyebrow: "Rencana", title: "Anggaran", note: "Tetapkan batas sebelum uang bergerak terlalu jauh." },
  goals: { eyebrow: "Tujuan", title: "Target keuangan", note: "Ubah keinginan besar menjadi langkah yang bisa dilihat." },
  reports: { eyebrow: "Pola", title: "Laporan", note: "Baca arah perubahan dari data yang sudah tercatat." },
  backup: { eyebrow: "Privasi data", title: "Backup", note: "Data tetap berada di browser dan di bawah kendalimu." },
};

function getToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function valuationTimestamp(date: string): string {
  return `${date}T${new Date().toISOString().slice(11)}`;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatCryptoQuantity(value: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(value);
}

function formatMarketTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(value));
}

function useCryptoMarketQuotes(coinIds: CryptoCoinId[]): { quotes: CryptoMarketQuotes; loading: boolean; error: string; refresh: () => void } {
  const coinKey = [...coinIds].sort().join(",");
  const [quotes, setQuotes] = useState<CryptoMarketQuotes>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    const requestedIds = coinKey ? coinKey.split(",") as CryptoCoinId[] : [];
    if (requestedIds.length === 0) return;
    setLoading(true);
    setError("");
    fetchCryptoMarketQuotes(requestedIds)
      .then((nextQuotes) => setQuotes(nextQuotes))
      .catch((nextError: unknown) => setError(nextError instanceof Error ? nextError.message : "Harga kripto belum dapat dimuat."))
      .finally(() => setLoading(false));
  }, [coinKey]);

  useEffect(() => {
    if (!coinKey) return;
    const initialLoad = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [coinKey, refresh]);

  return { quotes, loading, error, refresh };
}

function initialPurchaseDraft(state: AppState): AssetPurchaseDraft {
  const sourceAsset = state.assets.find((asset) => asset.liquid && asset.daysToCash <= 3 && !asset.market);
  const sourceAccount = state.accounts[0];
  return {
    sourceType: sourceAsset ? "asset" : "account",
    sourceId: sourceAsset?.id ?? sourceAccount?.id ?? "",
    targetAssetId: "new",
    targetName: "",
    targetType: "investment",
    targetLiquid: true,
    targetDaysToCash: "3",
    marketMode: "manual",
    bitcoinPurchasePriceUsd: "",
    amount: "",
    fee: "",
    date: getToday(),
    note: "",
  };
}

function initialAssetSaleDraft(state: AppState, asset: Asset | null): AssetSaleDraft {
  const selectedAsset = asset ?? state.assets[0] ?? null;
  return {
    assetId: selectedAsset?.id ?? "",
    accountId: state.accounts[0]?.id ?? "",
    grossProceedsIdr: "",
    feeIdr: "",
    bookValueRemovedIdr: selectedAsset && !selectedAsset.market ? String(selectedAsset.value) : "",
    cryptoSalePriceUsd: "",
    usdIdrRateAtSale: "",
    date: getToday(),
    note: selectedAsset ? `Jual ${selectedAsset.name}` : "",
  };
}

function initialAssetToAccountDraft(asset: Asset | null): AssetToAccountDraft {
  return { name: asset?.name ?? "", type: "ewallet" };
}

function initialRecurringDraft(state: AppState, editing: RecurringTransaction | null): RecurringDraft {
  const firstExpense = state.categories.find((category) => category.kind === "expense");
  const firstAccount = state.accounts[0];
  return {
    name: editing?.name ?? "",
    kind: editing?.kind ?? "expense",
    amount: editing ? String(editing.amount) : "",
    accountId: editing?.accountId ?? firstAccount?.id ?? "",
    categoryId: editing?.categoryId ?? firstExpense?.id ?? "",
    dayOfMonth: editing ? String(editing.dayOfMonth) : "1",
    startMonth: editing?.startMonth ?? editing?.createdAt.slice(0, 7) ?? currentMonth(),
    note: editing?.note ?? "",
    active: editing?.active ?? true,
  };
}

function initialReconcileDraft(state: AppState, accountId?: string): ReconcileDraft {
  return { accountId: accountId ?? state.accounts[0]?.id ?? "", actualBalance: "", date: getToday(), note: "", applyCorrection: false };
}

function initialCryptoReconcileDraft(asset: Asset | null): CryptoReconcileDraft {
  return {
    actualQuantity: asset?.market ? String(asset.market.quantity) : "",
    remainingCostBasisIdr: "",
    date: getToday(),
    note: "Saldo exchange aktual",
  };
}

function initialGoalDraft(editing: Goal | null): GoalDraft {
  return {
    name: editing?.name ?? "",
    targetAmount: editing ? String(editing.targetAmount) : "",
    currentAmount: editing ? String(editing.currentAmount) : "",
    sourceType: editing?.sourceType ?? "manual",
    sourceId: editing?.sourceId ?? "",
    targetDate: editing?.targetDate ?? "",
    note: editing?.note ?? "",
  };
}

function emptyTransaction(accountId = ""): Transaction {
  return { id: "", date: getToday(), kind: "expense", amount: 0, accountId, categoryId: "cat-food", note: "" };
}

function initialTransaction(state: AppState, type: ModalType, editingTransaction: Transaction | null): Transaction {
  if (editingTransaction) return editingTransaction;
  const transaction = emptyTransaction(state.accounts[0]?.id ?? "");
  if (type === "transfer") {
    return { ...transaction, kind: "transfer", categoryId: undefined, toAccountId: state.accounts[1]?.id ?? "" };
  }
  return transaction;
}

function typeLabel(type: Account["type"]): string {
  return type === "bank" ? "Bank" : type === "cash" ? "Tunai" : "E-wallet";
}

function assetTypeLabel(type: Asset["type"]): string {
  return type === "investment" ? "Investasi" : type === "vehicle" ? "Kendaraan" : type === "property" ? "Properti" : "Aset lain";
}

function liabilityTypeLabel(type: Liability["type"]): string {
  return type === "creditCard" ? "Kartu kredit" : type === "paylater" ? "Paylater" : type === "vehicle" ? "Kendaraan" : type === "mortgage" ? "KPR" : type === "personal" ? "Pribadi" : "Lainnya";
}

function kindLabel(kind: TransactionKind): string {
  return kind === "income" ? "Pemasukan" : kind === "expense" ? "Pengeluaran" : kind === "transfer" ? "Transfer" : kind === "debtPayment" ? "Bayar utang" : kind === "assetPurchase" ? "Beli aset" : "Jual aset";
}

function AppIcon({ name }: { name: View }) {
  const paths: Record<View, string> = {
    dashboard: "M4 19h4V9H4v10Zm6 0h4V5h-4v14Zm6 0h4v-7h-4v7Z",
    transactions: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 5h8V6H8v2Zm0 4h5v-2H8v2Zm0 4h8v-2H8v2Z",
    assets: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5Zm3 1.4V18h12v-6.1L12 6.9l-6 5Z",
    debts: "M4 5h16v14H4V5Zm2 2v10h12V7H6Zm2 2h4v2H8V9Zm0 4h7v2H8v-2Z",
    budget: "M4 4h16v3H4V4Zm0 5h16v11H4V9Zm3 3v2h5v-2H7Zm0 4v2h9v-2H7Z",
    goals: "M12 3 14.8 8.7 21 9.6l-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z",
    reports: "M5 3h11l3 3v15H5V3Zm2 2v14h10V7h-3V5H7Zm2 5h6v2H9v-2Zm0 4h6v2H9v-2Z",
    backup: "M12 3a7 7 0 1 1-6.2 3.76l1.78.9A5 5 0 1 0 12 5c-1.5 0-2.84.66-3.76 1.7H11v2H5V3h2v2.1A6.96 6.96 0 0 1 12 3Zm-1 5h2v5.2l3.4 2.03-1.02 1.72L11 14.3V8Z",
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function NeracaLogo({ size = 52, className = "", label }: { size?: number; className?: string; label?: string }) {
  return <svg className={`neraca-logo ${className}`.trim()} width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <rect x="1" y="1" width="46" height="46" rx="14" fill="var(--logo-primary)" />
    <path d="M8.5 11.5C8.5 9.57 10.07 8 12 8H27.5L39.5 20V36.5C39.5 38.43 37.93 40 36 40H12C10.07 40 8.5 38.43 8.5 36.5V11.5Z" fill="#0A4636" stroke="var(--logo-highlight)" strokeOpacity="0.48" />
    <path d="M14 8H28L36 16V37H14V8Z" fill="#1A735A" />
    <path d="M28 8V16H36" fill="var(--logo-accent)" />
    <path d="M17 34V16H20.5L31 28.3V16H35V34H31.5L21 21.7V34H17Z" fill="var(--logo-ink)" />
    <rect x="1" y="1" width="46" height="46" rx="14" stroke="rgba(255,255,255,0.36)" />
  </svg>;
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [state, setState] = useState<AppState | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [modal, setModal] = useState<ModalType>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);
  const [editingRecurringBudget, setEditingRecurringBudget] = useState<RecurringBudget | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [reconcileAccountId, setReconcileAccountId] = useState("");
  const [safetySettingsOpen, setSafetySettingsOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState("");
  const [storageStatus, setStorageStatus] = useState<"saving" | "saved" | "error">("saving");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadState().then((loadedState) => {
      if (active) {
        setState(loadedState);
        setStorageError("");
        setLoaded(true);
      }
    }).catch(() => {
      if (active) {
        setState(null);
        setLoaded(true);
        setStorageError("Data lokal belum dapat dibuka. Penyimpanan browser mungkin tidak tersedia.");
      }
    });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!state || !loaded) return;
    saveState(state)
      .then(() => {
        setStorageError("");
        setStorageStatus("saved");
      })
      .catch(() => {
        setStorageError("Perubahan belum tersimpan. Periksa izin penyimpanan browser lalu coba lagi.");
        setStorageStatus("error");
      });
  }, [state, loaded]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const trackedCoinIds = useMemo(() => [...new Set(state?.assets.flatMap((asset) => asset.market ? [asset.market.coinId] : []) ?? [])], [state]);
  const cryptoMarket = useCryptoMarketQuotes(trackedCoinIds);
  const marketQuotes = cryptoMarket.quotes;
  const displayState = useMemo(() => state ? withMarketAssetValues(state, marketQuotes) : null, [state, marketQuotes]);
  const metrics = useMemo(() => displayState ? calculateMetrics(displayState, month) : null, [displayState, month]);
  const assetMetrics = useMemo(() => displayState ? calculateMetrics(displayState) : null, [displayState]);
  const previousMetrics = useMemo(() => displayState ? calculateMetrics(displayState, getMonthOffset(month, -1)) : null, [displayState, month]);

  function updateState(next: AppState, message?: string) {
    setStorageStatus("saving");
    setState(next);
    if (message) setToast(message);
  }

  function closeModal() {
    setModal(null);
    setEditingAsset(null);
    setEditingTransaction(null);
    setEditingRecurring(null);
    setEditingRecurringBudget(null);
    setEditingGoal(null);
    setReconcileAccountId("");
  }

  function changeView(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function retrySave() {
    if (!state) return;
    setStorageStatus("saving");
    try {
      await saveState(state);
      setStorageError("");
      setStorageStatus("saved");
      setToast("Data berhasil disimpan kembali.");
    } catch {
      setStorageError("Data masih belum dapat disimpan. Pastikan penyimpanan browser tidak diblokir.");
      setStorageStatus("error");
    }
  }

  function applyCurrentRecurring() {
    if (!state) return;
    const result = applyRecurringTransactions(state, month);
    if (result.created === 0) {
      setToast("Tidak ada transaksi rutin baru untuk bulan ini.");
      return;
    }
    updateState(result.state, `${result.created} transaksi rutin dibuat untuk ${monthLabel(month)}.`);
  }

  function applyCurrentRecurringBudgets() {
    if (!state) return;
    const result = applyRecurringBudgets(state, month);
    if (result.created === 0) {
      setToast("Tidak ada anggaran rutin baru untuk bulan ini.");
      return;
    }
    updateState(result.state, `${result.created} anggaran rutin dibuat untuk ${monthLabel(month)}.`);
  }

  function copyCurrentBudgetsToNextMonth() {
    if (!state) return;
    const targetMonth = getMonthOffset(month, 1);
    const result = copyBudgetsToMonth(state, month, targetMonth);
    if (result.created === 0) {
      setToast(result.skipped > 0 ? `Anggaran ${monthLabel(targetMonth)} sudah memiliki kategori yang sama.` : `Belum ada anggaran ${monthLabel(month)} untuk disalin.`);
      return;
    }
    updateState(result.state, `${result.created} anggaran disalin ke ${monthLabel(targetMonth)}.`);
  }

  function deleteRecurring(id: string) {
    if (!state) return;
    const recurring = state.recurringTransactions.find((item) => item.id === id);
    if (!recurring) return;
    const generatedCount = state.transactions.filter((item) => item.recurringId === id).length;
    const confirmation = generatedCount > 0
      ? `Hapus pola "${recurring.name}" dan ${generatedCount} transaksi otomatis yang dibuat olehnya? Transaksi manual tidak akan terhapus.`
      : `Hapus pola "${recurring.name}"?`;
    if (!window.confirm(confirmation)) return;
    updateState(removeRecurringTransactions(state, id), generatedCount > 0 ? `Pola dan ${generatedCount} transaksi otomatis dihapus.` : "Pola transaksi rutin dihapus.");
  }

  function deleteRecurringBudget(id: string) {
    if (!state) return;
    const recurring = state.recurringBudgets.find((item) => item.id === id);
    if (!recurring) return;
    const generatedCount = state.budgets.filter((item) => item.recurringId === id).length;
    const categoryName = state.categories.find((item) => item.id === recurring.categoryId)?.name ?? "kategori";
    const confirmation = generatedCount > 0
      ? `Hapus pola anggaran ${categoryName} dan ${generatedCount} anggaran otomatis? Anggaran manual tidak akan terhapus.`
      : `Hapus pola anggaran ${categoryName}?`;
    if (!window.confirm(confirmation)) return;
    updateState(removeRecurringBudget(state, id), generatedCount > 0 ? `Pola dan ${generatedCount} anggaran otomatis dihapus.` : "Pola anggaran dihapus.");
  }

  function deleteAsset(id: string) {
    if (!state) return;
    const asset = state.assets.find((item) => item.id === id);
    if (!asset) return;
    const linkedTransactions = state.transactions.filter((item) => item.assetId === id || item.sourceAssetId === id);
    if (linkedTransactions.length > 0) {
      setToast(`${asset.name} masih dipakai ${linkedTransactions.length} transaksi. Hapus atau koreksi transaksi terkait terlebih dahulu.`);
      return;
    }
    const linkedGoals = state.goals.filter((goal) => goal.sourceType === "asset" && goal.sourceId === id);
    if (linkedGoals.length > 0) {
      setToast(`${asset.name} masih menjadi sumber ${linkedGoals.length} target. Ubah sumber target terlebih dahulu.`);
      return;
    }
    if (!window.confirm("Hapus aset ini? Tindakan ini tidak dapat dibatalkan.")) return;
    updateState({ ...state, assets: state.assets.filter((item) => item.id !== id), assetValuations: state.assetValuations.filter((item) => item.assetId !== id) }, "Aset dihapus.");
  }

  function deleteTransaction(id: string) {
    if (!state) return;
    const transaction = state.transactions.find((item) => item.id === id);
    if (!transaction || !window.confirm("Hapus transaksi ini? Tindakan ini tidak dapat dibatalkan.")) return;

    if (transaction.kind === "assetSale") {
      updateState(removeAssetSale(state, id), "Penjualan aset dihapus dan kepemilikan dipulihkan.");
      return;
    }

    let nextState: AppState = { ...state, transactions: state.transactions.filter((item) => item.id !== id) };
    if (transaction.kind === "debtPayment" && transaction.liabilityId) {
      const principal = Number(transaction.principal ?? transaction.amount);
      nextState = {
        ...nextState,
        liabilities: state.liabilities.map((item) => item.id === transaction.liabilityId
          ? { ...item, remainingPrincipal: item.remainingPrincipal + principal }
          : item),
      };
    }
    if (transaction.kind === "assetPurchase" && (transaction.assetId || transaction.migratedTargetAccountId)) {
      const purchasedValue = transaction.assetValue ?? Math.max(0, transaction.amount - (transaction.fee ?? 0));
      const cryptoQuantity = Number(transaction.cryptoQuantity ?? 0);
      const cryptoPurchasePriceUsd = Number(transaction.cryptoPurchasePriceUsd ?? 0);
      const cryptoCostBasisIdr = Number(transaction.cryptoCostBasisIdr ?? transaction.amount);
      const targetWasCreated = transaction.targetAssetCreated;
      const sourceAsset = transaction.sourceAssetId ? state.assets.find((item) => item.id === transaction.sourceAssetId) : null;
      const targetAsset = transaction.assetId ? state.assets.find((item) => item.id === transaction.assetId) : null;
      let nextAssets = state.assets;

      if (targetWasCreated && transaction.assetId) {
        nextAssets = nextAssets.filter((item) => item.id !== transaction.assetId);
      } else if (targetAsset) {
        nextAssets = nextAssets.map((item) => {
          if (item.id !== targetAsset.id) return item;
          if (!item.market || cryptoQuantity <= 0) return { ...item, value: Math.max(0, item.value - purchasedValue) };

          const remainingQuantity = Math.max(0, item.market.quantity - cryptoQuantity);
          const remainingCost = Math.max(0, item.market.costBasisIdr - cryptoCostBasisIdr);
          const remainingAverageUsd = remainingQuantity > 0
            ? Math.max(0, (item.market.quantity * item.market.averagePurchasePriceUsd - cryptoQuantity * cryptoPurchasePriceUsd) / remainingQuantity)
            : 0;
          const market = remainingQuantity > 0
            ? { ...item.market, quantity: remainingQuantity, costBasisIdr: remainingCost, averagePurchasePriceUsd: remainingAverageUsd }
            : undefined;
          return { ...item, value: Math.max(0, item.value - purchasedValue), market };
        });
      }

      if (sourceAsset) {
        nextAssets = nextAssets.map((item) => item.id === sourceAsset.id ? { ...item, value: item.value + transaction.amount } : item);
      }

      nextState = {
        ...nextState,
        accounts: transaction.migratedTargetAccountId
          ? state.accounts.map((account) => account.id === transaction.migratedTargetAccountId
            ? { ...account, openingBalance: account.openingBalance - purchasedValue }
            : account)
          : state.accounts,
        assets: nextAssets,
        assetValuations: state.assetValuations.filter((item) => item.transactionId !== transaction.id && (!targetWasCreated || item.assetId !== transaction.assetId)),
      };
    }
    updateState(nextState, transaction.kind === "assetPurchase" ? "Transaksi dihapus dan saldo pembelian dikembalikan." : "Transaksi dihapus.");
  }

  if (!loaded) {
    return <main className="loading-screen"><NeracaLogo size={58} label="Logo Neraca" className="loading-mark" /><p>Membuka neraca pribadi...</p></main>;
  }

  if (!state || !displayState || !metrics) {
    return <main className="error-screen" role="alert"><NeracaLogo size={58} label="Logo Neraca" className="loading-mark" /><h1>Data lokal belum dapat dibuka</h1><p>{storageError || "Penyimpanan browser tidak tersedia."}</p><button className="primary-button" onClick={() => window.location.reload()}>Muat ulang aplikasi</button></main>;
  }

  const currentView = viewDetails[view];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <NeracaLogo size={54} className="brand-mark" />
          <div className="brand-copy"><h1>Neraca</h1><p className="eyebrow">BUKU KEUANGAN PRIBADI</p></div>
        </div>
        <nav className="main-nav" aria-label="Navigasi utama">
          {navGroups.map((group) => <div className="nav-group" key={group.label}>
            <p className="sidebar-label">{group.label}</p>
            {group.items.map((item) => (
              <button key={item.id} className={`nav-item ${view === item.id ? "active" : ""}`} onClick={() => changeView(item.id)} aria-current={view === item.id ? "page" : undefined}>
                <AppIcon name={item.id} /><span>{item.label}</span>{view === item.id && <span className="active-dot" aria-hidden="true" />}
              </button>
            ))}
          </div>)}
        </nav>
        <div className="sidebar-spacer" />
        <div className="privacy-card"><span className="privacy-dot" aria-hidden="true" /><p><strong>Mode lokal aktif</strong><br />Data hanya tersimpan di browser ini.</p></div>
        <div className="sidebar-footer"><span>v1.0 · IDR</span><span className={`save-state ${storageStatus === "error" ? "attention" : storageStatus === "saving" ? "saving" : ""}`} aria-live="polite">{storageStatus === "error" ? "Perlu perhatian" : storageStatus === "saving" ? "Menyimpan..." : "Tersimpan lokal"}</span></div>
      </aside>

      <section className="content-area">
        <header className="topbar">
          <div className="topbar-context"><p className="eyebrow">{currentView.eyebrow}</p><h2>{currentView.title}</h2><p className="topbar-note">{currentView.note}</p></div>
          <div className="topbar-actions"><div className="period-switcher" aria-label="Pilih periode laporan"><button className="month-control" onClick={() => setMonth(getMonthOffset(month, -1))} aria-label="Bulan sebelumnya">&larr;</button><span><small>Periode aktif</small>{monthLabel(month)}</span><button className="month-control" onClick={() => setMonth(getMonthOffset(month, 1))} aria-label="Bulan berikutnya">&rarr;</button></div><button className="primary-button compact" onClick={() => setModal("transaction")}>+ Catat transaksi</button></div>
        </header>
        {storageError && <section className="storage-alert" role="alert"><span className="storage-alert-icon" aria-hidden="true">!</span><div><h2>Penyimpanan lokal perlu perhatian</h2><p>{storageError}</p></div><button className="secondary-button small" onClick={retrySave}>Coba simpan lagi</button></section>}
        <div className="content-scroll">
          {view === "dashboard" && <Dashboard state={displayState} metrics={metrics} previousMetrics={previousMetrics} month={month} onView={changeView} onAdd={() => setModal("transaction")} onConfigureSafety={() => setSafetySettingsOpen(true)} />}
          {view === "transactions" && <TransactionsView state={state} month={month} onAdd={() => { setEditingTransaction(null); setModal("transaction"); }} onEdit={(transaction) => { setEditingTransaction(transaction); setModal("transaction"); }} onAddRecurring={() => { setEditingRecurring(null); setModal("recurring"); }} onEditRecurring={(recurring) => { setEditingRecurring(recurring); setModal("recurring"); }} onDeleteRecurring={deleteRecurring} onApplyRecurring={applyCurrentRecurring} onDelete={deleteTransaction} />}
          {view === "assets" && <div className="page-stack"><AssetsView state={state} metrics={assetMetrics ?? metrics} marketQuotes={marketQuotes} marketLoading={cryptoMarket.loading} marketError={cryptoMarket.error} onRefreshMarket={cryptoMarket.refresh} onAddAccount={() => setModal("account")} onAddAsset={() => { setEditingAsset(null); setModal("asset"); }} onAddPurchase={() => setModal("assetPurchase")} onSellAsset={(asset) => { setEditingAsset(asset); setModal("assetSale"); }} onConvertAsset={(asset) => { setEditingAsset(asset); setModal("assetToAccount"); }} onReconcileCrypto={(asset) => { setEditingAsset(asset); setModal("cryptoReconcile"); }} onEditAsset={(asset) => { setEditingAsset(asset); setModal("asset"); }} onUpdateAssetValue={(asset) => { setEditingAsset(asset); setModal("assetValue"); }} onDeleteAsset={deleteAsset} />{state.accounts.length > 1 && <TransferQuickAction accountCount={state.accounts.length} onTransfer={() => setModal("transfer")} />}<ReconciliationPanel state={state} metrics={assetMetrics ?? metrics} onAdd={(account) => { setReconcileAccountId(account.id); setModal("reconcile"); }} /></div>}
          {view === "debts" && <DebtsView state={state} metrics={metrics} onAdd={() => setModal("liability")} onDelete={(id) => { if (window.confirm("Hapus utang ini? Riwayat pembayaran terkait tidak ikut dipulihkan.")) updateState({ ...state, liabilities: state.liabilities.filter((item) => item.id !== id) }, "Utang dihapus."); }} />}
          {view === "budget" && <BudgetView state={state} month={month} metrics={metrics} onAdd={() => setModal("budget")} onCopyNextMonth={copyCurrentBudgetsToNextMonth} onAddRecurring={() => { setEditingRecurringBudget(null); setModal("recurringBudget"); }} onEditRecurring={(recurring) => { setEditingRecurringBudget(recurring); setModal("recurringBudget"); }} onDeleteRecurring={deleteRecurringBudget} onApplyRecurring={applyCurrentRecurringBudgets} onDelete={(id) => { if (window.confirm("Hapus anggaran ini?")) updateState({ ...state, budgets: state.budgets.filter((item) => item.id !== id) }, "Anggaran dihapus."); }} />}
          {view === "goals" && <GoalsView state={state} onAdd={() => { setEditingGoal(null); setModal("goal"); }} onEdit={(goal) => { setEditingGoal(goal); setModal("goal"); }} onDelete={(id) => { if (window.confirm("Hapus target ini?")) updateState({ ...state, goals: state.goals.filter((item) => item.id !== id) }, "Target dihapus."); }} />}
          {view === "reports" && <ReportsView state={state} month={month} metrics={metrics} />}
          {view === "backup" && <BackupView state={state} onImport={(next) => updateState(next, "Backup berhasil dipulihkan.")} onToast={setToast} />}
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Navigasi cepat">
        {navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => changeView(item.id)} aria-current={view === item.id ? "page" : undefined}><AppIcon name={item.id} /><span>{item.label}</span></button>)}
      </nav>

      {modal && <EntryModal type={modal} state={state} month={month} editingAsset={modal === "asset" || modal === "assetValue" || modal === "assetSale" || modal === "assetToAccount" || modal === "cryptoReconcile" ? editingAsset : null} editingTransaction={modal === "transaction" ? editingTransaction : null} editingRecurring={modal === "recurring" ? editingRecurring : null} editingRecurringBudget={modal === "recurringBudget" ? editingRecurringBudget : null} editingGoal={modal === "goal" ? editingGoal : null} reconcileAccountId={modal === "reconcile" ? reconcileAccountId : undefined} onClose={closeModal} onSave={(next, message) => { updateState(next, message); closeModal(); }} />}
      {safetySettingsOpen && <SafetySettingsDialog state={state} onClose={() => setSafetySettingsOpen(false)} onSave={(next) => { updateState(next, "Pengaturan dana aman disimpan."); setSafetySettingsOpen(false); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function Dashboard({ state, metrics, previousMetrics, month, onView, onAdd, onConfigureSafety }: { state: AppState; metrics: ReturnType<typeof calculateMetrics>; previousMetrics: ReturnType<typeof calculateMetrics> | null; month: string; onView: (view: View) => void; onAdd: () => void; onConfigureSafety: () => void }) {
  const change = (current: number, previous: number) => previous === 0 ? 0 : ((current - previous) / Math.abs(previous)) * 100;
  const expenseShare = metrics.income === 0 ? 0 : Math.min(100, (metrics.expense / metrics.income) * 100);
  const topCategories = Object.entries(metrics.categoryTotals).sort(([, a], [, b]) => b - a).slice(0, 3);
  const netWorthChange = change(metrics.netWorth, previousMetrics?.netWorth ?? 0);
  const liquidRatio = metrics.totalAssets > 0 ? Math.round((metrics.liquidAssets / metrics.totalAssets) * 100) : 0;
  const isNewLedger = state.accounts.length === 0 && state.assets.length === 0 && state.liabilities.length === 0 && state.transactions.length === 0;
  const monthTransactions = state.transactions.filter((item) => item.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const analysis = analyzeFinancialHealth(state, month);
  const safety = calculateSafetyMetrics(state);

  return <div className="page-stack dashboard-stack">
    <section className="dashboard-intro">
      <div><p className="eyebrow teal">TINJAU BULAN INI</p><h2>Posisi uangmu, tanpa tebak-tebakan.</h2><p>Mulai dari posisi bersih, lalu lihat uang yang tersedia dan apa yang memerlukan perhatian.</p></div>
      <button className="secondary-button" onClick={onAdd}>+ Catat transaksi</button>
    </section>

    {isNewLedger && <section className="onboarding-panel"><div className="onboarding-index">01</div><div><p className="eyebrow">MULAI MENCATAT</p><h3>Siapkan satu rekening terlebih dahulu.</h3><p>Saldo rekening menjadi dasar untuk menghitung aset likuid dan arus kasmu secara akurat.</p></div><button className="primary-button" onClick={() => onView("assets")}>Tambah rekening</button></section>}

    <section className="balance-stage">
      <div className="balance-primary">
        <p className="eyebrow">KEKAYAAN BERSIH</p>
        <strong>{formatCurrency(metrics.netWorth)}</strong>
        <div className="balance-caption"><span>Total aset dikurangi seluruh utang</span>{previousMetrics?.netWorth ? <span className={netWorthChange >= 0 ? "change-pill positive" : "change-pill negative"}>{netWorthChange >= 0 ? "+" : ""}{netWorthChange.toFixed(0)}% dari bulan lalu</span> : <span className="change-pill neutral">Pembanding terbentuk setelah data bulan lalu ada</span>}</div>
      </div>
      <div className="balance-breakdown" aria-label="Rincian kekayaan bersih">
        <button className="balance-line" onClick={() => onView("assets")}><span><small>Total aset</small><strong>{formatCurrency(metrics.totalAssets)}</strong></span><span className="line-link">Lihat aset &rarr;</span></button>
        <button className="balance-line" onClick={() => onView("debts")}><span><small>Total utang</small><strong>{formatCurrency(metrics.totalDebt)}</strong></span><span className="line-link">Lihat utang &rarr;</span></button>
        <button className="balance-line liquid-line" onClick={() => onView("assets")}><span><small>Aset likuid</small><strong>{formatCurrency(metrics.liquidAssets)}</strong></span><span className="line-link">{liquidRatio}% dari aset</span></button>
      </div>
    </section>

    <section className="cashflow-ledger">
      <div className="cashflow-head"><div><p className="eyebrow">ARUS KAS · {monthLabel(month).toUpperCase()}</p><h3>Uang yang masuk, keluar, dan tersisa.</h3></div><button className="text-button" onClick={() => onView("reports")}>Buka laporan &rarr;</button></div>
      <div className="cashflow-figures">
        <div><span className="cashflow-label"><i className="legend-dot income" />Pemasukan</span><strong>{formatCurrency(metrics.income)}</strong></div>
        <div><span className="cashflow-label"><i className="legend-dot expense" />Arus keluar</span><strong>{formatCurrency(metrics.cashOutflow)}</strong></div>
        <div className={metrics.freeCashFlow < 0 ? "free-cash negative" : "free-cash"}><span className="cashflow-label">Arus kas bebas</span><strong>{formatCurrency(metrics.freeCashFlow)}</strong></div>
      </div>
      <div className="cashflow-scale" aria-label={metrics.income ? `${Math.round(expenseShare)} persen pemasukan telah digunakan` : "Belum ada pemasukan pada bulan ini"}><span style={{ width: `${expenseShare}%` }} /></div>
      <div className="cashflow-foot"><span>{metrics.income ? `${Math.round(expenseShare)}% pemasukan telah digunakan` : "Catat pemasukan untuk melihat rasio penggunaan"}</span><span>{metrics.freeCashFlow >= 0 ? "Sisa kas masih positif" : "Arus kas negatif perlu ditinjau"}</span></div>
    </section>

    <SafetyPanel safety={safety} onConfigure={onConfigureSafety} />

    <FinancialAnalysisPanel analysis={analysis} onView={onView} />

    <section className="dashboard-detail-grid">
      <div className="panel attention-panel"><div className="panel-heading"><div><p className="eyebrow">PERLU DIPANTAU</p><h3>Sinyal bulan ini</h3></div></div>{metrics.income === 0 && metrics.expense === 0 ? <EmptyInline title="Belum ada aktivitas bulan ini" copy="Tambahkan transaksi setelah rekening siap agar sinyal finansial dapat dibaca." action={state.accounts.length ? "+ Catat transaksi" : "Tambahkan rekening"} onClick={state.accounts.length ? onAdd : () => onView("assets")} /> : <div className="signal-list"><Signal icon={metrics.freeCashFlow >= 0 ? "✓" : "!"} title="Arus kas" copy={metrics.freeCashFlow >= 0 ? "Pemasukan masih menutup seluruh arus keluar." : "Arus keluar lebih besar dari pemasukan bulan ini."} tone={metrics.freeCashFlow >= 0 ? "good" : "warn"} /><Signal icon="L" title="Likuiditas" copy={metrics.totalAssets ? `${liquidRatio}% nilai aset dapat diakses cepat.` : "Tambahkan aset untuk melihat posisi likuiditas."} tone="neutral" />{topCategories[0] && <Signal icon="K" title="Kategori terbesar" copy={`${state.categories.find((item) => item.id === topCategories[0][0])?.name ?? "Lainnya"} · ${formatCurrency(topCategories[0][1])}`} tone="neutral" />}</div>}</div>
      <div className="panel account-panel"><div className="panel-heading"><div><p className="eyebrow">UANG TERSEDIA</p><h3>Saldo rekening</h3></div><button className="text-button" onClick={() => onView("assets")}>Kelola &rarr;</button></div>{state.accounts.length === 0 ? <EmptyInline title="Belum ada rekening" copy="Tambahkan rekening bank, tunai, atau e-wallet untuk mulai menghitung saldo." action="Tambah rekening" onClick={() => onView("assets")} /> : <div className="account-list">{state.accounts.slice(0, 4).map((account) => <div className="account-row" key={account.id}><span className={`account-badge ${account.type}`}>{account.type === "bank" ? "B" : account.type === "cash" ? "T" : "E"}</span><span className="account-name">{account.name}<small>{typeLabel(account.type)}</small></span><strong>{formatCurrency(metrics.accountBalances[account.id] ?? 0)}</strong></div>)}</div>}</div>
    </section>

    <section className="panel table-panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">AKTIVITAS TERBARU</p><h3>Transaksi di {monthLabel(month)}</h3></div><button className="text-button" onClick={() => onView("transactions")}>Semua transaksi &rarr;</button></div><TransactionTable state={state} transactions={monthTransactions.slice(0, 5)} compact /></section>
  </div>;
}

function SafetyPanel({ safety, onConfigure }: { safety: ReturnType<typeof calculateSafetyMetrics>; onConfigure: () => void }) {
  const runwayLabel = safety.survivalRunwayDays === null
    ? "Belum terbaca"
    : `${Math.floor(safety.survivalRunwayDays)} hari`;
  const bufferLabel = safety.emergencyBufferTarget > 0
    ? `${formatCurrency(safety.emergencyBufferProtected)} / ${formatCurrency(safety.emergencyBufferTarget)}`
    : "Belum diatur";
  const statusIcon = safety.status === "safe" ? "✓" : safety.status === "data" ? "i" : "!";

  return <section className={`panel safety-overview status-${safety.status}`} aria-labelledby="safety-overview-title">
    <div className="safety-overview-header">
      <div>
        <p className="eyebrow">DANA AMAN · PER HARI INI</p>
        <h3 id="safety-overview-title">Berapa uang yang benar-benar bisa dipakai?</h3>
        <p>{safety.summary}</p>
      </div>
      <div className="safety-overview-actions">
        <span className="safety-status"><span aria-hidden="true">{statusIcon}</span>{safety.statusLabel}</span>
        <button className="secondary-button small" type="button" onClick={onConfigure}>Atur dana aman</button>
      </div>
    </div>

    <div className="safety-metrics" aria-label="Indikator dana aman">
      <div className="safety-primary-metric">
        <span>Dana bisa dipakai</span>
        <strong>{formatCurrency(safety.spendableBalance)}</strong>
        <small>Setelah komitmen dan dana darurat</small>
      </div>
      <div>
        <span>Aman per hari</span>
        <strong>{formatCurrency(safety.safeToSpendDaily)}</strong>
        <small>Sampai {formatDate(safety.nextIncomeDate)}</small>
      </div>
      <div>
        <span>Survival runway</span>
        <strong>{runwayLabel}</strong>
        <small>Kas untuk kebutuhan pokok</small>
      </div>
      <div>
        <span>Dana darurat terlindungi</span>
        <strong>{bufferLabel}</strong>
        <small>{safety.emergencyBufferGap > 0 ? `Kurang ${formatCurrency(safety.emergencyBufferGap)}` : "Target sudah tertutup"}</small>
      </div>
    </div>

    <div className="safety-breakdown" aria-label="Rincian perhitungan dana aman">
      <span><small>Kas operasional</small><strong>{formatCurrency(safety.operationalCash)}</strong></span>
      <i aria-hidden="true">−</i>
      <span><small>Komitmen sampai {formatDate(safety.nextIncomeDate)}</small><strong>{formatCurrency(safety.committedOutflow)}</strong></span>
      <i aria-hidden="true">−</i>
      <span><small>Target dana darurat</small><strong>{formatCurrency(safety.emergencyBufferTarget)}</strong></span>
      <i aria-hidden="true">=</i>
      <span className="safety-result"><small>Dana bisa dipakai</small><strong>{formatCurrency(safety.spendableBalance)}</strong></span>
    </div>

    {safety.dataNotes.length > 0 && <div className="safety-data-notes">
      <strong>Supaya hitungannya lebih akurat</strong>
      <ul>{safety.dataNotes.slice(0, 3).map((note) => <li key={note}>{note}</li>)}</ul>
    </div>}
    <p className="analysis-footnote">Dihitung lokal dari saldo rekening, transaksi terjadwal, pola rutin, cicilan, dan kategori kebutuhan pokok. Investasi tidak otomatis dianggap uang belanja.</p>
  </section>;
}

function FinancialAnalysisPanel({ analysis, onView }: { analysis: ReturnType<typeof analyzeFinancialHealth>; onView: (view: View) => void }) {
  const rateLabel = analysis.savingsRate === null ? "Belum ada" : `${Math.round(analysis.savingsRate)}%`;
  const debtLabel = analysis.debtRatio === null ? "Belum ada" : `${Math.round(analysis.debtRatio)}%`;
  const runwayLabel = analysis.liquidRunway === null ? "Belum ada" : `${analysis.liquidRunway.toFixed(1)} bln`;

  return <section className={`panel analysis-panel status-${analysis.status}`} aria-labelledby="financial-analysis-title">
    <div className="analysis-header">
      <div><p className="eyebrow">ANALISIS LOKAL</p><h3 id="financial-analysis-title">Apa yang perlu kamu tahu sekarang?</h3><p>{analysis.summary}</p></div>
      <span className="analysis-status"><span aria-hidden="true">{analysis.status === "steady" ? "✓" : analysis.status === "data" ? "i" : "!"}</span>{analysis.statusLabel}</span>
    </div>
    <div className="analysis-kpis" aria-label="Indikator analisis keuangan">
      <div><span>Sisa dari pemasukan</span><strong>{rateLabel}</strong><small>Rasio arus kas bebas bulan ini</small></div>
      <div><span>Beban cicilan</span><strong>{debtLabel}</strong><small>Dibanding pemasukan bulan ini</small></div>
      <div><span>Daya tahan likuid</span><strong>{runwayLabel}</strong><small>Berdasarkan arus keluar rata-rata</small></div>
    </div>
    <div className="analysis-next-month">
      <div><p className="eyebrow">PERSIAPAN BULAN DEPAN</p><h4>{monthLabel(analysis.nextMonth.month)}</h4><p>Rencana dihitung dari transaksi yang sudah ada, pola rutin, dan cicilan utang.</p></div>
      <div className="analysis-next-values"><span><small>Masuk</small><strong>{formatCurrency(analysis.nextMonth.income)}</strong></span><span><small>Arus keluar</small><strong>{formatCurrency(analysis.nextMonth.outflow)}</strong></span><span className={analysis.nextMonth.freeCashFlow >= 0 ? "positive" : "negative"}><small>Sisa kas</small><strong>{formatCurrency(analysis.nextMonth.freeCashFlow)}</strong></span></div>
    </div>
    <div className="analysis-columns">
      <div className="analysis-column"><p className="eyebrow">SINYAL YANG TERBACA</p><div className="analysis-list">{analysis.insights.map((insight) => <div className="analysis-item" key={insight.id}><span className={`analysis-item-mark ${insight.tone}`} aria-hidden="true">{insight.tone === "good" ? "✓" : insight.tone === "attention" ? "!" : "i"}</span><div><strong>{insight.title}</strong><p>{insight.detail}</p></div></div>)}</div></div>
      <div className="analysis-column"><p className="eyebrow">REKOMENDASI BERIKUTNYA</p><div className="analysis-list">{analysis.recommendations.map((recommendation) => <div className="analysis-item" key={recommendation.id}><span className={`analysis-item-mark ${recommendation.tone}`} aria-hidden="true">{recommendation.tone === "good" ? "✓" : recommendation.tone === "attention" ? "!" : "i"}</span><div><strong>{recommendation.title}</strong><p>{recommendation.detail}</p>{recommendation.actionView && <button className="text-button analysis-action" onClick={() => onView(recommendation.actionView!)}>{recommendation.actionLabel} &rarr;</button>}</div></div>)}</div></div>
    </div>
    {analysis.dataNotes.length > 0 && <div className="analysis-data-notes"><strong>Yang masih perlu dilengkapi</strong>{analysis.dataNotes.map((note) => <span key={note.id}>{note.detail}{note.actionView && <button className="text-button analysis-action" onClick={() => onView(note.actionView!)}>{note.actionLabel} &rarr;</button>}</span>)}</div>}
    <p className="analysis-footnote">Dihitung di browser dari {analysis.observedMonths} bulan aktivitas. Ini alat bantu membaca data, bukan nasihat keuangan profesional.</p>
  </section>;
}

function MetricCard({ label, value, helper, tone, change, invertChange }: { label: string; value: string; helper: string; tone: string; change?: number; invertChange?: boolean }) {
  const isPositive = (change ?? 0) >= 0;
  const meaningful = Math.abs(change ?? 0) >= 0.1;
  return <div className={`metric-card ${tone}`}><div className="metric-top"><span>{label}</span></div><strong>{value}</strong><div className="metric-bottom"><span>{helper}</span>{meaningful && <small className={isPositive === !invertChange ? "positive" : "negative"}>{isPositive ? "Naik" : "Turun"} {Math.abs(change ?? 0).toFixed(0)}%</small>}</div></div>;
}

function Signal({ icon, title, copy, tone }: { icon: string; title: string; copy: string; tone: string }) {
  return <div className="signal"><span className={`signal-icon ${tone}`}>{icon}</span><div><strong>{title}</strong><p>{copy}</p></div></div>;
}

function EmptyInline({ title, copy, action, onClick }: { title: string; copy: string; action?: string; onClick?: () => void }) {
  return <div className="empty-inline">{action && onClick && <div className="empty-icon" aria-hidden="true">+</div>}<strong>{title}</strong><p>{copy}</p>{action && onClick && <button className="text-button" onClick={onClick}>{action}</button>}</div>;
}

function TransactionsView({ state, month, onAdd, onEdit, onAddRecurring, onEditRecurring, onDeleteRecurring, onApplyRecurring, onDelete }: { state: AppState; month: string; onAdd: () => void; onEdit: (transaction: Transaction) => void; onAddRecurring: () => void; onEditRecurring: (recurring: RecurringTransaction) => void; onDeleteRecurring: (id: string) => void; onApplyRecurring: () => void; onDelete: (id: string) => void }) {
  const [filter, setFilter] = useState("");
  const [kind, setKind] = useState<"all" | TransactionKind>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const normalizedFilter = filter.trim().toLowerCase();
  const filtered = state.transactions
    .filter((item) => {
      const category = state.categories.find((candidate) => candidate.id === item.categoryId);
      const account = state.accounts.find((candidate) => candidate.id === item.accountId);
      const targetAccount = state.accounts.find((candidate) => candidate.id === item.toAccountId);
      const searchable = [item.note, category?.name, account?.name, targetAccount?.name, kindLabel(item.kind)].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = normalizedFilter === "" || searchable.includes(normalizedFilter);
      const matchesAccount = accountId === "all" || item.accountId === accountId || item.toAccountId === accountId;
      return item.date.startsWith(month) && (kind === "all" || item.kind === kind) && (categoryId === "all" || item.categoryId === categoryId) && matchesAccount && matchesSearch;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  return <div className="page-stack">
    <PageHeader eyebrow="TRANSAKSI" title="Ke mana uang bergerak?" copy="Catat arus uang satu per satu agar gambaran besarnya tetap dapat dipercaya." action="+ Transaksi" onClick={onAdd} />
    <section className="panel recurring-panel"><div><p className="eyebrow">TRANSAKSI RUTIN</p><h3>{state.recurringTransactions.length === 0 ? "Belum ada pola bulanan" : `${state.recurringTransactions.filter((item) => item.active).length} pola aktif`}</h3><p>Gaji, internet, langganan, dan cicilan bisa dibuat sekali lalu diterapkan ke periode aktif.</p></div><div className="panel-heading-actions"><button className="secondary-button small" onClick={onAddRecurring}>+ Atur transaksi rutin</button>{state.recurringTransactions.some((item) => item.active) && <button className="primary-button small" onClick={onApplyRecurring}>Buat bulan ini</button>}</div></section>
    {state.recurringTransactions.length > 0 && <section className="panel recurring-list"><div className="panel-heading"><div><p className="eyebrow">POLA TERSIMPAN</p><h3>Yang akan berulang</h3></div><span className="data-note">Periode aktif: {monthLabel(month)}</span></div>{state.recurringTransactions.map((item) => <div className="recurring-row" key={item.id}><span className={`recurring-status ${item.active ? "active" : "paused"}`}>{item.active ? "Aktif" : "Jeda"}</span><div><strong>{item.name}</strong><small>{item.kind === "income" ? "Pemasukan" : state.categories.find((category) => category.id === item.categoryId)?.name ?? "Pengeluaran"} · tanggal {item.dayOfMonth} · mulai {monthLabel(item.startMonth ?? item.createdAt.slice(0, 7))} · {state.accounts.find((account) => account.id === item.accountId)?.name ?? "Rekening"}</small></div><strong>{formatCurrency(item.amount)}</strong><button className="row-action edit" onClick={() => onEditRecurring(item)}>Ubah</button><button className="icon-button" onClick={() => onDeleteRecurring(item.id)} aria-label={`Hapus pola ${item.name}`}>×</button></div>)}</section>}
    <section className="panel filter-panel" aria-label="Filter transaksi"><label className="visually-hidden" htmlFor="transaction-search">Cari transaksi</label><input id="transaction-search" className="search-input" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Cari catatan, kategori, atau rekening..." /><label className="visually-hidden" htmlFor="transaction-kind">Jenis transaksi</label><select id="transaction-kind" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="all">Semua jenis</option>{(["income", "expense", "transfer", "debtPayment", "assetPurchase", "assetSale"] as TransactionKind[]).map((item) => <option key={item} value={item}>{kindLabel(item)}</option>)}</select><label className="visually-hidden" htmlFor="transaction-category">Kategori transaksi</label><select id="transaction-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">Semua kategori</option>{state.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><label className="visually-hidden" htmlFor="transaction-account">Rekening transaksi</label><select id="transaction-account" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="all">Semua rekening</option>{state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><span className="filter-period">{monthLabel(month)}</span><span className="result-count" aria-live="polite">{filtered.length} transaksi</span></section>
    <section className="panel table-panel full-table"><TransactionTable state={state} transactions={filtered} onEdit={onEdit} onDelete={onDelete} /></section>
  </div>;
}

function TransactionTable({ state, transactions, compact = false, onEdit, onDelete }: { state: AppState; transactions: Transaction[]; compact?: boolean; onEdit?: (transaction: Transaction) => void; onDelete?: (id: string) => void }) {
  if (transactions.length === 0) return <EmptyInline title="Belum ada transaksi" copy="Transaksi baru akan muncul di sini." />;
  return <div className={`transaction-table ${compact ? "compact" : ""}`} role="table" aria-label="Daftar transaksi"><div className="table-head" role="row"><span role="columnheader">Aktivitas</span><span role="columnheader">Rekening / sumber</span><span role="columnheader">Nominal</span>{!compact && <span role="columnheader" aria-label="Aksi" />}</div>{transactions.map((transaction) => { const category = state.categories.find((item) => item.id === transaction.categoryId); const account = state.accounts.find((item) => item.id === transaction.accountId); const sourceAsset = state.assets.find((item) => item.id === transaction.sourceAssetId); const sourceLabel = account?.name ?? sourceAsset?.name ?? "Tidak ada sumber"; const positive = transaction.kind === "income" || transaction.kind === "assetSale" || transaction.kind === "transfer" && false; return <div className="table-row" role="row" key={transaction.id}><div className="transaction-main" role="cell"><span className={`transaction-mark ${positive ? "positive" : transaction.kind === "transfer" ? "transfer" : "negative"}`} aria-hidden="true">{positive ? "+" : transaction.kind === "transfer" ? "↔" : "-"}</span><span><strong>{category?.name ?? kindLabel(transaction.kind)}{transaction.recurringId && <em className="recurring-tag">Rutin</em>}</strong><small>{formatDate(transaction.date)}{transaction.note ? ` · ${transaction.note}` : ""}</small></span></div><span className="muted-cell" role="cell">{sourceLabel}</span><strong className={positive ? "amount-positive" : transaction.kind === "transfer" ? "amount-transfer" : "amount-negative"} role="cell">{positive ? "+" : transaction.kind === "transfer" ? "" : "-"}{formatCurrency(transaction.amount)}</strong>{!compact && <div className="transaction-actions" role="cell">{!(["assetPurchase", "assetSale"] as TransactionKind[]).includes(transaction.kind) && <button className="row-action edit" onClick={() => onEdit?.(transaction)} aria-label={`Ubah transaksi ${category?.name ?? kindLabel(transaction.kind)}`}>Ubah</button>}<button className="icon-button" onClick={() => onDelete?.(transaction.id)} aria-label={`Hapus transaksi ${category?.name ?? kindLabel(transaction.kind)}`}>×</button></div>}</div>; })}</div>;
}

function getAssetValueChange(asset: Asset, valuations: AssetValuation[]): number | null {
  const history = valuations
    .filter((item) => item.assetId === asset.id)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  if (history.length < 2) return null;
  return asset.value - history[history.length - 2].value;
}

function AssetsView({ state, metrics, marketQuotes, marketLoading, marketError, onRefreshMarket, onAddAccount, onAddAsset, onAddPurchase, onSellAsset, onConvertAsset, onReconcileCrypto, onEditAsset, onUpdateAssetValue, onDeleteAsset }: {
  state: AppState;
  metrics: ReturnType<typeof calculateMetrics>;
  marketQuotes: CryptoMarketQuotes;
  marketLoading: boolean;
  marketError: string;
  onRefreshMarket: () => void;
  onAddAccount: () => void;
  onAddAsset: () => void;
  onAddPurchase: () => void;
  onSellAsset: (asset: Asset) => void;
  onConvertAsset: (asset: Asset) => void;
  onReconcileCrypto: (asset: Asset) => void;
  onEditAsset: (asset: Asset) => void;
  onUpdateAssetValue: (asset: Asset) => void;
  onDeleteAsset: (id: string) => void;
}) {
  return <div className="page-stack">
    <PageHeader eyebrow="ASET & SALDO" title="Apa yang kamu punya?" copy="Posisi saat ini: pisahkan uang yang siap dipakai dari aset yang perlu waktu dicairkan." action="＋ Tambah aset" onClick={onAddAsset} />

    <section className="metric-grid three">
      <MetricCard label="Total aset" value={formatCurrency(metrics.totalAssets)} helper="Seluruh nilai kepemilikan" tone="mint" />
      <MetricCard label="Aset likuid" value={formatCurrency(metrics.liquidAssets)} helper="Kas, rekening, dan aset T+3" tone="sand" />
      <MetricCard label="Aset non-likuid" value={formatCurrency(metrics.totalAssets - metrics.liquidAssets)} helper="Properti, kendaraan, dan lainnya" tone="dark" />
    </section>

    <section className="content-grid">
      <div className="panel table-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">REKENING & KAS</p><h3>Saldo sumber dana</h3></div>
          <button className="secondary-button small" onClick={onAddAccount}>＋ Rekening</button>
        </div>
        {state.accounts.length === 0
          ? <EmptyInline title="Belum ada rekening" copy="Tambahkan saldo awal rekening bank, tunai, atau e-wallet." action="＋ Tambah rekening" onClick={onAddAccount} />
          : <div className="asset-list">{state.accounts.map((account) => <div className="asset-row" key={account.id}>
            <span className={`asset-icon ${account.type}`}>{account.type === "bank" ? "B" : account.type === "cash" ? "T" : "E"}</span>
            <div><strong>{account.name}</strong><small>{typeLabel(account.type)} · saldo berjalan</small></div>
            <strong>{formatCurrency(metrics.accountBalances[account.id] ?? 0)}</strong>
          </div>)}</div>}
      </div>

      <div className="panel table-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">KEPEMILIKAN LAIN</p><h3>Aset non-rekening</h3></div>
          <div className="panel-heading-actions"><button className="secondary-button small" onClick={onAddPurchase}>Beli aset</button><button className="text-button" onClick={onAddAsset}>＋ Tambah</button></div>
        </div>
        {state.assets.length === 0
          ? <EmptyInline title="Belum ada aset" copy="Tambahkan investasi, kendaraan, properti, atau aset lain." action="＋ Tambah aset" onClick={onAddAsset} />
          : <div className="asset-list">{state.assets.map((asset) => {
            const performance = getCryptoPerformance(asset, marketQuotes);
            const marketQuote = asset.market ? marketQuotes[asset.market.coinId] : undefined;
            const change = asset.market ? null : getAssetValueChange(asset, state.assetValuations);
            const value = performance?.currentValue ?? asset.value;
            const changeTone = performance ? performance.difference > 0 ? "positive" : performance.difference < 0 ? "negative" : "neutral" : change && change > 0 ? "positive" : change && change < 0 ? "negative" : "neutral";
            return <div className="asset-row asset-row-actions" key={asset.id}>
              <span className={`asset-icon ${asset.market ? "crypto" : asset.liquid ? "liquid" : "solid"}`}>{asset.market?.symbol === "BTC" ? "₿" : asset.market?.symbol === "ETH" ? "Ξ" : asset.market?.symbol === "USDT" ? "₮" : asset.liquid ? "L" : "A"}</span>
              <div className="asset-copy">
                <strong>{asset.name}</strong>
                <small>{assetTypeLabel(asset.type)} · {asset.liquid && asset.daysToCash <= 3 ? "likuid T+3" : "non-likuid"} · diperbarui {formatDate(asset.updatedAt)}</small>
                {asset.market && <div className="crypto-meta" aria-live="polite">
                  <span className="live-badge">{asset.market.symbol} · {marketQuote ? marketError ? "harga terakhir" : "harga pasar" : "harga belum tersedia"}</span>
                  <small>{formatCryptoQuantity(asset.market.quantity)} {asset.market.symbol} · beli rata-rata {formatUsd(asset.market.averagePurchasePriceUsd)}</small>
                  {marketQuote
                    ? <small>{marketError ? "Harga terakhir" : "Harga pasar"} {formatUsd(marketQuote.priceUsd)} · CoinGecko · {formatMarketTime(marketQuote.updatedAt)}</small>
                    : marketError
                      ? <span className="crypto-load-error">{marketError} <button type="button" className="market-refresh" onClick={onRefreshMarket} disabled={marketLoading}>{marketLoading ? "Memuat..." : "Coba lagi"}</button></span>
                      : <small>{marketLoading ? `Memuat harga ${asset.market.symbol}...` : "Harga live belum tersedia."}</small>}
                  {marketQuote && marketError && <span className="crypto-load-error">Pembaruan harga gagal; nilai memakai harga terakhir. <button type="button" className="market-refresh" onClick={onRefreshMarket} disabled={marketLoading}>{marketLoading ? "Memuat..." : "Coba lagi"}</button></span>}
                </div>}
                {performance && <span className={`asset-change ${changeTone}`}>{performance.difference > 0 ? "Untung" : performance.difference < 0 ? "Rugi" : "Impas"} {formatCurrency(Math.abs(performance.difference))} · {Math.abs(performance.percentage).toFixed(1)}%</span>}
                {!asset.market && change !== null && <span className={`asset-change ${changeTone}`}>{change > 0 ? "Naik" : change < 0 ? "Turun" : "Tidak berubah"}{change !== 0 && ` ${formatCurrency(Math.abs(change))}`} sejak update sebelumnya</span>}
              </div>
              <div className="asset-value"><strong>{formatCurrency(value)}</strong><small>{asset.market && marketQuote ? marketError ? "Dari harga terakhir" : "Nilai pasar" : asset.market ? "Nilai modal" : "Nilai terakhir"}</small></div>
              <div className="asset-actions">
                <button className="row-action sell" onClick={() => onSellAsset(asset)} disabled={asset.value <= 0 && (asset.market?.quantity ?? 0) <= 0} aria-label={`Jual aset ${asset.name}`}>Jual</button>
                {!asset.market && asset.liquid && asset.daysToCash <= 3 && <button className="row-action convert" onClick={() => onConvertAsset(asset)} aria-label={`Pindahkan ${asset.name} ke rekening dan kas`}>Ke rekening</button>}
                {asset.market && <button className="row-action update" onClick={() => onReconcileCrypto(asset)} aria-label={`Cocokkan saldo ${asset.name} dengan exchange`}>Cocokkan saldo</button>}
                <button className="row-action edit" onClick={() => onEditAsset(asset)} aria-label={`Ubah detail aset ${asset.name}`}>Ubah detail</button>
                {!asset.market && <button className="row-action update" onClick={() => onUpdateAssetValue(asset)} aria-label={`Perbarui nilai aset ${asset.name}`}>Perbarui nilai</button>}
                <button className="row-action delete" onClick={() => onDeleteAsset(asset.id)} aria-label={`Hapus aset ${asset.name}`}>Hapus</button>
              </div>
            </div>;
          })}</div>}
      </div>
    </section>
  </div>;
}

function TransferQuickAction({ accountCount, onTransfer }: { accountCount: number; onTransfer: () => void }) {
  return <section className="panel transfer-quick-action" aria-labelledby="transfer-quick-title"><span className="transfer-quick-icon" aria-hidden="true">↔</span><div className="transfer-quick-copy"><p className="eyebrow">TRANSFER INTERNAL</p><h3 id="transfer-quick-title">Pindahkan saldo antar sumber dana</h3><p>Pilih asal dan tujuan dari {accountCount} rekening, kas, atau e-wallet. Tidak dihitung sebagai pemasukan atau pengeluaran.</p></div><button className="secondary-button transfer-action-button" onClick={onTransfer}><span aria-hidden="true">↔</span>Pilih rekening</button></section>;
}

function ReconciliationPanel({ state, metrics, onAdd }: { state: AppState; metrics: ReturnType<typeof calculateMetrics>; onAdd: (account: Account) => void }) {
  if (state.accounts.length === 0) return null;
  return <section className="panel reconciliation-panel"><div className="panel-heading"><div><p className="eyebrow">KONTROL SALDO</p><h3>Rekonsiliasi rekening</h3><p className="panel-subcopy">Bandingkan saldo aktual. Status di bawah berasal dari pemeriksaan terakhir.</p></div></div><div className="reconciliation-list">{state.accounts.map((account) => { const checks = state.reconciliations.filter((item) => item.accountId === account.id).sort((a, b) => b.date.localeCompare(a.date)); const latest = checks[0]; return <div className="reconciliation-account" key={account.id}><div className="reconciliation-row"><div><strong>{account.name}</strong><small>Menurut Neraca: {formatCurrency(metrics.accountBalances[account.id] ?? 0)}</small></div><span className={`reconcile-status ${latest ? latest.difference === 0 || latest.correctionApplied ? "matched" : "mismatch" : ""}`}>{latest ? latest.correctionApplied ? "Terakhir: dikoreksi" : latest.difference === 0 ? "Terakhir: cocok" : `Terakhir: selisih ${formatCurrency(Math.abs(latest.difference))}` : "Belum dicek"}</span><button className="secondary-button small" onClick={() => onAdd(account)}>Cek saldo</button></div>{checks.length > 0 && <details className="reconciliation-history"><summary>Riwayat pengecekan ({checks.length})</summary><div className="reconciliation-history-list">{checks.map((check) => <div className="reconciliation-history-item" key={check.id}><div><strong>{formatDate(check.date)}</strong><small>Neraca {formatCurrency(check.recordedBalance)} · aktual {formatCurrency(check.actualBalance)}</small>{check.correctionApplied && <small>{check.correctionMode === "dated" ? "Selisih diterapkan mulai tanggal ini" : "Koreksi lama: selisih masuk saldo dasar"}</small>}{check.note && <small>{check.note}</small>}</div><span className={`reconcile-history-difference ${check.difference === 0 || check.correctionApplied ? "matched" : "mismatch"}`}>{check.correctionApplied ? "Dikoreksi" : check.difference === 0 ? "Cocok" : `${check.difference > 0 ? "+" : "-"}${formatCurrency(Math.abs(check.difference))}`}</span></div>)}</div></details>}</div>; })}</div></section>;
}

function DebtsView({ state, metrics, onAdd, onDelete }: { state: AppState; metrics: ReturnType<typeof calculateMetrics>; onAdd: () => void; onDelete: (id: string) => void }) {
  const monthlyPayment = state.liabilities.reduce((total, item) => total + item.monthlyPayment, 0);
  return <div className="page-stack"><PageHeader eyebrow="LIABILITAS" title="Apa yang masih menjadi kewajiban?" copy="Simpan sisa pokok, cicilan, dan jatuh tempo di satu tempat." action="+ Tambah utang" onClick={onAdd} /><section className="metric-grid three"><MetricCard label="Total utang" value={formatCurrency(metrics.totalDebt)} helper="Sisa pokok berjalan" tone="rose" /><MetricCard label="Cicilan bulanan" value={formatCurrency(monthlyPayment)} helper="Komitmen rutin" tone="sand" /><MetricCard label="Rasio cicilan" value={metrics.income ? `${Math.round((monthlyPayment / metrics.income) * 100)}%` : "Belum tersedia"} helper="Dari pemasukan bulan ini" tone="dark" /></section><section className="panel table-panel full-table">{state.liabilities.length === 0 ? <EmptyInline title="Belum ada utang" copy="Jika tidak ada utang, kondisi ini juga layak dicatat sebagai angka nol." action="+ Tambah utang" onClick={onAdd} /> : <div className="liability-list">{state.liabilities.map((liability) => { const payments = state.transactions.filter((item) => item.kind === "debtPayment" && item.liabilityId === liability.id).sort((a, b) => b.date.localeCompare(a.date)); return <div className="liability-row" key={liability.id}><div className="debt-icon" aria-hidden="true">U</div><div className="liability-copy"><strong>{liability.name}</strong><small>{liabilityTypeLabel(liability.type)}{liability.dueDay ? ` · jatuh tempo tanggal ${liability.dueDay}` : ""}</small></div><div><small>Sisa pokok</small><strong>{formatCurrency(liability.remainingPrincipal)}</strong></div><div><small>Cicilan/bulan</small><strong>{formatCurrency(liability.monthlyPayment)}</strong></div><button className="icon-button" onClick={() => onDelete(liability.id)} aria-label={`Hapus ${liability.name}`}>×</button><details className="liability-history"><summary>{payments.length > 0 ? `Riwayat pembayaran (${payments.length})` : "Belum ada riwayat pembayaran"}</summary>{payments.length > 0 && <div className="liability-history-list">{payments.map((payment) => <div className="liability-history-item" key={payment.id}><span>{formatDate(payment.date)} · pokok {formatCurrency(payment.principal ?? payment.amount)}{payment.interest ? ` · bunga ${formatCurrency(payment.interest)}` : ""}</span><strong>{formatCurrency(payment.amount)}</strong></div>)}</div>}</details></div>; })}</div>}</section></div>;
}

function BudgetView({ state, month, metrics, onAdd, onCopyNextMonth, onAddRecurring, onEditRecurring, onDeleteRecurring, onApplyRecurring, onDelete }: { state: AppState; month: string; metrics: ReturnType<typeof calculateMetrics>; onAdd: () => void; onCopyNextMonth: () => void; onAddRecurring: () => void; onEditRecurring: (recurring: RecurringBudget) => void; onDeleteRecurring: (id: string) => void; onApplyRecurring: () => void; onDelete: (id: string) => void }) {
  const budgets = state.budgets.filter((item) => item.month === month);
  const targetMonth = getMonthOffset(month, 1);
  const activeRecurringBudgets = state.recurringBudgets.filter((item) => item.active);
  return <div className="page-stack"><PageHeader eyebrow="ANGGARAN" title="Rencanakan ruang gerakmu." copy="Tetapkan batas sebelum pengeluaran berjalan terlalu jauh." action="＋ Tambah anggaran" onClick={onAdd} /><section className="panel recurring-panel budget-routine-panel"><div><p className="eyebrow">ANGGARAN BULANAN</p><h3>{state.recurringBudgets.length === 0 ? "Belum ada pola anggaran" : `${activeRecurringBudgets.length} pola anggaran aktif`}</h3><p>Salin anggaran sekali ke {monthLabel(targetMonth)} atau buat pola agar batas kategori bisa diterapkan setiap bulan.</p></div><div className="panel-heading-actions"><button className="secondary-button small" onClick={onCopyNextMonth} disabled={budgets.length === 0}>Salin ke {monthLabel(targetMonth)}</button><button className="secondary-button small" onClick={onAddRecurring}>+ Atur pola bulanan</button>{activeRecurringBudgets.length > 0 && <button className="primary-button small" onClick={onApplyRecurring}>Buat bulan ini</button>}</div></section>{state.recurringBudgets.length > 0 && <section className="panel recurring-list"><div className="panel-heading"><div><p className="eyebrow">POLA TERSIMPAN</p><h3>Anggaran yang akan berulang</h3></div><span className="data-note">Periode aktif: {monthLabel(month)}</span></div>{state.recurringBudgets.map((item) => { const category = state.categories.find((candidate) => candidate.id === item.categoryId); return <div className="recurring-row budget-recurring-row" key={item.id}><span className={`recurring-status ${item.active ? "active" : "paused"}`}>{item.active ? "Aktif" : "Jeda"}</span><div><strong>{category?.name ?? "Kategori"}</strong><small>{formatCurrency(item.amount)} per bulan · mulai {monthLabel(item.startMonth)}</small></div><strong>{formatCurrency(item.amount)}</strong><button className="row-action edit" onClick={() => onEditRecurring(item)}>Ubah</button><button className="icon-button" onClick={() => onDeleteRecurring(item.id)} aria-label={`Hapus pola anggaran ${category?.name ?? "kategori"}`}>×</button></div>; })}</section>}{budgets.length === 0 ? <section className="panel empty-panel"><div className="empty-icon large">◎</div><h3>Belum ada anggaran untuk {monthLabel(month)}</h3><p>Mulai dari kategori yang paling sering menghabiskan uangmu, atau terapkan pola anggaran yang sudah tersimpan.</p><button className="primary-button" onClick={state.recurringBudgets.length > 0 ? onApplyRecurring : onAdd}>{state.recurringBudgets.length > 0 ? "Buat anggaran bulan ini" : "＋ Buat anggaran pertama"}</button></section> : <section className="budget-grid">{budgets.map((budget) => { const category = state.categories.find((item) => item.id === budget.categoryId); const actual = metrics.categoryTotals[budget.categoryId] ?? 0; const ratio = budget.amount ? actual / budget.amount : 0; const progress = Math.min(ratio, 1); const nearLimit = ratio >= 0.8 && ratio < 1; const overLimit = ratio >= 1; return <div className="panel budget-card" key={budget.id}><div className="budget-card-top"><div><span className="color-dot" style={{ background: category?.color }} /><strong>{category?.name ?? "Kategori"}</strong>{budget.recurringId && <em className="recurring-tag">Rutin</em>}</div><button className="icon-button" onClick={() => onDelete(budget.id)} aria-label={`Hapus anggaran ${category?.name ?? "kategori"}`}>×</button></div><div className="budget-amount"><strong>{formatCurrency(actual)}</strong><span>dari {formatCurrency(budget.amount)}</span></div><div className="budget-progress" role="progressbar" aria-label={`Realisasi anggaran ${category?.name ?? "kategori"}`} aria-valuenow={Math.round(Math.min(ratio * 100, 100))} aria-valuemin={0} aria-valuemax={100}><span className={overLimit ? "over" : nearLimit ? "near" : ""} style={{ width: `${progress * 100}%` }} /></div><div className="budget-foot"><span className={overLimit ? "over" : nearLimit ? "near" : ""}>{overLimit ? "Melewati batas" : nearLimit ? "Mendekati batas" : `${Math.round(ratio * 100)}% terpakai`}</span><span>{formatCurrency(Math.max(0, budget.amount - actual))} tersisa</span></div></div>; })}</section>}</div>;
}

function goalSourceLabel(state: AppState, goal: Goal): string {
  if (goal.sourceType === "account") {
    const account = state.accounts.find((item) => item.id === goal.sourceId);
    return account ? `Mengikuti saldo ${account.name}` : "Sumber rekening tidak tersedia";
  }
  if (goal.sourceType === "asset") {
    const asset = state.assets.find((item) => item.id === goal.sourceId);
    return asset ? `Mengikuti nilai ${asset.name}` : "Sumber aset tidak tersedia";
  }
  return "Progres diisi manual";
}

function GoalsView({ state, onAdd, onEdit, onDelete }: { state: AppState; onAdd: () => void; onEdit: (goal: Goal) => void; onDelete: (id: string) => void }) {
  return <div className="page-stack"><PageHeader eyebrow="TARGET KEUANGAN" title="Simpan untuk sesuatu yang berarti." copy="Pantau progres dana darurat, investasi, atau pembelian besar tanpa mencampurnya dengan transaksi harian." action="+ Tambah target" onClick={onAdd} />{state.goals.length === 0 ? <section className="panel empty-panel"><div className="empty-icon large">◎</div><h3>Belum ada target keuangan</h3><p>Mulai dari satu target yang paling penting untuk beberapa bulan ke depan.</p><button className="primary-button" onClick={onAdd}>+ Buat target pertama</button></section> : <section className="goal-grid">{state.goals.map((goal) => { const currentAmount = getGoalCurrentAmount(state, goal); const progress = goal.targetAmount > 0 ? Math.min(100, Math.max(0, (currentAmount / goal.targetAmount) * 100)) : 0; return <article className="panel goal-card" key={goal.id}><div className="goal-card-top"><div><p className="eyebrow">{progress >= 100 ? "TERCAPAI" : "DALAM PROSES"}</p><h3>{goal.name}</h3></div><div className="goal-actions"><button className="row-action edit" onClick={() => onEdit(goal)}>Ubah</button><button className="icon-button" onClick={() => onDelete(goal.id)} aria-label={`Hapus target ${goal.name}`}>×</button></div></div><div className="goal-amounts"><strong>{formatCurrency(currentAmount)}</strong><span>dari {formatCurrency(goal.targetAmount)}</span></div><div className="goal-progress" role="progressbar" aria-label={`Progres target ${goal.name}`} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div><div className="goal-foot"><span>{Math.round(progress)}% tercapai</span>{goal.targetDate ? <span>Target {formatDate(goal.targetDate)}</span> : <span>Tanpa tanggal target</span>}</div><p className="goal-source">{goalSourceLabel(state, goal)}</p>{goal.note && <p className="goal-note">{goal.note}</p>}</article>; })}</section>}</div>;
}

function ReportsView({ state, month, metrics }: { state: AppState; month: string; metrics: ReturnType<typeof calculateMetrics> }) {
  const months = Array.from({ length: 6 }, (_, index) => getMonthOffset(month, index - 5));
  const snapshots = months.map((item) => ({ month: item, snapshot: state.snapshots.find((snapshot) => snapshot.month === item), metrics: calculateMetrics(state, item) }));
  const maxFlow = Math.max(1, ...snapshots.map((item) => Math.max(item.metrics.income, item.metrics.cashOutflow)));
  const categoryRows = Object.entries(metrics.categoryTotals).sort(([, a], [, b]) => b - a).slice(0, 6);
  return <div className="page-stack"><PageHeader eyebrow="LAPORAN" title="Baca pola, bukan hanya angka." copy="Lihat arah kekayaan bersih dan kategori pengeluaran dari waktu ke waktu." /><section className="report-grid"><div className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">ARUS KAS</p><h3>Pemasukan dan pengeluaran</h3></div><span className="chart-legend"><i className="legend-dot income" />Masuk <i className="legend-dot expense" />Keluar</span></div><div className="bar-chart" role="img" aria-label="Perbandingan pemasukan dan pengeluaran enam bulan terakhir">{snapshots.map((item) => <div className="bar-column" key={item.month}><div className="bars"><span className="bar income" style={{ height: `${Math.max(item.metrics.income ? 6 : 2, (item.metrics.income / maxFlow) * 100)}%` }} /><span className="bar expense" style={{ height: `${Math.max(item.metrics.cashOutflow ? 6 : 2, (item.metrics.cashOutflow / maxFlow) * 100)}%` }} /></div><small>{item.month.slice(5)}</small></div>)}</div></div><div className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">KOMPOSISI</p><h3>Pengeluaran kategori</h3></div><span className="month-caption">{monthLabel(month)}</span></div>{categoryRows.length === 0 ? <EmptyInline title="Belum ada data" copy="Catat pengeluaran untuk melihat komposisinya." /> : <div className="category-bars">{categoryRows.map(([categoryId, amount]) => { const category = state.categories.find((item) => item.id === categoryId); const max = categoryRows[0][1] || 1; return <div className="category-bar-row" key={categoryId}><div><span>{category?.name ?? "Lainnya"}</span><strong>{formatCurrency(amount)}</strong></div><div className="category-track"><span style={{ width: `${(amount / max) * 100}%`, background: category?.color }} /></div></div>; })}</div>}</div></section><section className="panel networth-panel"><div className="panel-heading"><div><p className="eyebrow">KEKAYAAN BERSIH</p><h3>Snapshot bulanan</h3></div><span className="data-note">Disimpan otomatis saat ada perubahan</span></div><div className="snapshot-strip">{snapshots.map((item) => { const amount = item.snapshot?.netWorth ?? item.metrics.netWorth; return <div className="snapshot-item" key={item.month}><small>{monthLabel(item.month).split(" ")[0]}</small><strong>{formatCurrency(amount)}</strong><span className={item.metrics.freeCashFlow >= 0 ? "positive" : "negative"}>{item.metrics.freeCashFlow >= 0 ? "Surplus" : "Defisit"}</span></div>; })}</div></section></div>;
}

function BackupView({ state, onImport, onToast }: { state: AppState; onImport: (state: AppState) => void; onToast: (message: string) => void }) {
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const confirmed = window.confirm("Restore akan menggantikan seluruh data Neraca di browser ini. Pastikan backup data saat ini sudah disimpan. Lanjutkan?");
    if (!confirmed) {
      event.target.value = "";
      return;
    }
    setImporting(true);
    setImportError("");
    try {
      onImport(await parseBackup(file));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Backup tidak dapat dipulihkan.");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }
  function exportJson() { downloadFile(`neraca-backup-${currentMonth()}.json`, serializeState(state), "application/json"); onToast("Backup JSON berhasil dibuat."); }
  function exportCsv() { const headers = ["Tanggal", "Jenis", "Nominal", "Rekening", "Kategori", "Catatan"]; const rows = state.transactions.map((item) => [item.date, kindLabel(item.kind), String(item.amount), state.accounts.find((account) => account.id === item.accountId)?.name ?? "", state.categories.find((category) => category.id === item.categoryId)?.name ?? "", item.note ?? ""]); const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n"); downloadFile(`neraca-transaksi-${currentMonth()}.csv`, csv, "text/csv;charset=utf-8"); onToast("CSV transaksi berhasil dibuat."); }
  return <div className="page-stack"><PageHeader eyebrow="BACKUP & PENGATURAN" title="Data tetap milikmu." copy="Neraca menyimpan semuanya di browser ini. Buat backup berkala sebelum membersihkan data browser atau pindah perangkat." />{importError && <section className="storage-alert inline" role="alert"><span className="storage-alert-icon" aria-hidden="true">!</span><div><h2>Backup belum dapat dipulihkan</h2><p>{importError} Pilih file JSON backup Neraca yang valid lalu coba lagi.</p></div><button className="text-button" onClick={() => setImportError("")}>Tutup</button></section>}<section className="backup-grid"><div className="panel backup-card accent"><div className="backup-icon" aria-hidden="true">↓</div><p className="eyebrow">CADANGKAN</p><h3>Export seluruh data</h3><p>JSON berisi rekening, transaksi, aset, utang, anggaran, kategori, dan snapshot.</p><button className="primary-button" onClick={exportJson}>Download backup JSON</button></div><div className="panel backup-card"><div className="backup-icon" aria-hidden="true">↑</div><p className="eyebrow">PINDAHKAN</p><h3>Restore dari backup</h3><p>Gunakan file JSON hasil export untuk memulihkan data pada browser atau alamat web baru.</p><label className="upload-button">{importing ? "Memeriksa file..." : "Pilih file JSON"}<input type="file" accept="application/json,.json" onChange={handleImport} disabled={importing} /></label></div><div className="panel backup-card"><div className="backup-icon" aria-hidden="true">CSV</div><p className="eyebrow">ANALISIS</p><h3>Export transaksi CSV</h3><p>Gunakan CSV untuk membaca dan mengolah daftar transaksi di spreadsheet.</p><button className="secondary-button" onClick={exportCsv}>Download transaksi CSV</button></div></section><section className="panel safety-panel"><div className="safety-badge">!</div><div><h3>Catatan privasi</h3><p>Data keuangan tidak dikirim ke server. Namun, siapa pun yang dapat memakai profil browser ini berpotensi melihat datanya. Simpan file backup di tempat yang aman.</p></div></section></div>;
}

function PageHeader({ eyebrow, title, copy, action, onClick }: { eyebrow: string; title: string; copy: string; action?: string; onClick?: () => void }) {
  return <section className="page-header"><div><p className="eyebrow teal">{eyebrow}</p><h2>{title}</h2><p>{copy}</p></div>{action && <button className="primary-button" onClick={onClick}>{action}</button>}</section>;
}

function EntryModal({ type: originalType, state, month, editingAsset, editingTransaction, editingRecurring, editingRecurringBudget, editingGoal, reconcileAccountId, onClose, onSave }: { type: Exclude<ModalType, null>; state: AppState; month: string; editingAsset: Asset | null; editingTransaction: Transaction | null; editingRecurring: RecurringTransaction | null; editingRecurringBudget: RecurringBudget | null; editingGoal: Goal | null; reconcileAccountId?: string; onClose: () => void; onSave: (state: AppState, message: string) => void }) {
  const isRecurringBudget = originalType === "recurringBudget";
  const type = isRecurringBudget ? "budget" : originalType;
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const [transaction, setTransaction] = useState<Transaction>(initialTransaction(state, type, editingTransaction));
  const [account, setAccount] = useState({ name: "", type: "bank" as Account["type"], openingBalance: "" });
  const [asset, setAsset] = useState<AssetDraft>({
    name: editingAsset?.name ?? "",
    type: editingAsset?.type ?? "investment",
    value: editingAsset ? String(editingAsset.value) : "",
    liquid: editingAsset?.liquid ?? true,
    daysToCash: editingAsset ? String(editingAsset.daysToCash) : "3",
    marketMode: editingAsset?.market?.coinId ?? "manual",
    bitcoinPurchasePriceUsd: editingAsset?.market ? String(Math.round(editingAsset.market.averagePurchasePriceUsd)) : "",
  });
  const [assetValue, setAssetValue] = useState({ value: editingAsset ? String(editingAsset.value) : "", date: getToday(), note: "" });
  const [purchase, setPurchase] = useState<AssetPurchaseDraft>(initialPurchaseDraft(state));
  const [sale, setSale] = useState<AssetSaleDraft>(initialAssetSaleDraft(state, editingAsset));
  const [assetAccount, setAssetAccount] = useState<AssetToAccountDraft>(initialAssetToAccountDraft(editingAsset));
  const [cryptoReconcile, setCryptoReconcile] = useState<CryptoReconcileDraft>(initialCryptoReconcileDraft(editingAsset));
  const [liability, setLiability] = useState({ name: "", type: "other" as Liability["type"], remainingPrincipal: "", monthlyPayment: "", interestRate: "", dueDay: "" });
  const [budget, setBudget] = useState({ categoryId: editingRecurringBudget?.categoryId ?? state.categories.find((item) => item.kind === "expense")?.id ?? "", amount: editingRecurringBudget ? String(editingRecurringBudget.amount) : "", mode: isRecurringBudget ? "recurring" as const : "single" as const, startMonth: editingRecurringBudget?.startMonth ?? currentMonth(), active: editingRecurringBudget?.active ?? true });
  const [transactionOtherCategory, setTransactionOtherCategory] = useState("");
  const [budgetOtherCategory, setBudgetOtherCategory] = useState("");
  const [recurring, setRecurring] = useState<RecurringDraft>(initialRecurringDraft(state, editingRecurring));
  const [reconcile, setReconcile] = useState<ReconcileDraft>(initialReconcileDraft(state, reconcileAccountId));
  const [goal, setGoal] = useState<GoalDraft>(initialGoalDraft(editingGoal));
  const existingPurchaseAsset = purchase.targetAssetId === "new" ? null : state.assets.find((item) => item.id === purchase.targetAssetId);
  const saleAsset = state.assets.find((item) => item.id === sale.assetId);
  const activeCoinId: CryptoCoinId | null = type === "asset" && asset.marketMode !== "manual"
    ? asset.marketMode
    : type === "assetPurchase"
      ? (existingPurchaseAsset?.market?.coinId ?? (purchase.marketMode !== "manual" ? purchase.marketMode : null))
      : type === "assetSale"
        ? saleAsset?.market?.coinId ?? null
        : type === "cryptoReconcile"
          ? editingAsset?.market?.coinId ?? null
          : null;
  const modalMarket = useCryptoMarketQuotes(activeCoinId ? [activeCoinId] : []);
  const bitcoinMarket = { quote: activeCoinId ? modalMarket.quotes[activeCoinId] ?? null : null, loading: modalMarket.loading, error: modalMarket.error, refresh: modalMarket.refresh };
  const [formError, setFormError] = useState("");

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const firstControl = dialog?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled])") ?? dialog?.querySelector<HTMLElement>("button:not([disabled])");
    firstControl?.focus();

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      previouslyFocused?.focus();
    };
  }, []);

  function keepFocusInside(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])") ?? []);
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const reject = (message: string) => setFormError(message);
    if (originalType === "recurringBudget") {
      const amount = Number(budget.amount);
      if (!budget.categoryId || !Number.isFinite(amount) || amount <= 0) return reject("Pilih kategori dan isi batas bulanan yang lebih besar dari Rp 0.");
      const categoryResult = budget.categoryId === "cat-other"
        ? ensureCustomCategory(state.categories, budgetOtherCategory, "expense")
        : { categories: state.categories, categoryId: budget.categoryId };
      if (!categoryResult.categoryId || !categoryResult.categories.some((category) => category.id === categoryResult.categoryId && category.kind === "expense")) return reject("Kategori anggaran tidak tersedia.");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(budget.startMonth)) return reject("Pilih bulan mulai yang valid.");
      const item: RecurringBudget = { id: editingRecurringBudget?.id ?? createId("recurring-budget"), categoryId: categoryResult.categoryId, amount, startMonth: budget.startMonth, active: budget.active, createdAt: editingRecurringBudget?.createdAt ?? new Date().toISOString() };
      const nextState = editingRecurringBudget ? syncRecurringBudget({ ...state, categories: categoryResult.categories }, editingRecurringBudget, item) : { ...state, categories: categoryResult.categories, recurringBudgets: [...state.recurringBudgets, item] };
      onSave(nextState, editingRecurringBudget ? "Pola anggaran diperbarui." : "Pola anggaran bulanan disimpan.");
      return;
    }
    if (type === "transaction" || type === "transfer") {
      const isTransfer = type === "transfer" || transaction.kind === "transfer";
      const transactionKind = type === "transfer" ? "transfer" : transaction.kind;
      const amount = Number(transaction.amount);
      if (!transaction.accountId || !Number.isFinite(amount) || amount <= 0) return reject("Isi rekening sumber dan nominal yang lebih besar dari Rp 0.");
      if (isTransfer && (!transaction.toAccountId || transaction.toAccountId === transaction.accountId)) return reject("Pilih rekening tujuan yang berbeda dari rekening sumber.");
      const reducesAccount = isTransfer || transactionKind === "expense" || transactionKind === "debtPayment";
      const isFutureDated = transaction.date > getToday();
      if (reducesAccount && !isFutureDated) {
        const transactionsWithoutEdited = editingTransaction
          ? state.transactions.filter((item) => item.id !== editingTransaction.id)
          : state.transactions;
        const availableBalance = getAccountBalances({ accounts: state.accounts, transactions: transactionsWithoutEdited, reconciliations: state.reconciliations }, transaction.date)[transaction.accountId] ?? 0;
        if (amount > availableBalance) return reject(`Saldo sumber tidak cukup. Saldo yang tersedia ${formatCurrency(availableBalance)}.`);
      }

      let liabilities = state.liabilities;
      let assets = state.assets;
      let assetValuations = state.assetValuations;
      if (editingTransaction?.kind === "debtPayment" && editingTransaction.liabilityId) {
        const oldPrincipal = Number(editingTransaction.principal ?? editingTransaction.amount);
        liabilities = liabilities.map((item) => item.id === editingTransaction.liabilityId ? { ...item, remainingPrincipal: item.remainingPrincipal + oldPrincipal } : item);
      }
      if (editingTransaction?.kind === "assetSale" && editingTransaction.assetId) {
        const oldSaleValue = Number(editingTransaction.assetValue ?? editingTransaction.amount);
        assets = assets.map((item) => item.id === editingTransaction.assetId ? { ...item, value: item.value + oldSaleValue } : item);
        assetValuations = assetValuations.filter((item) => item.transactionId !== editingTransaction.id);
      }

      let principal: number | undefined;
      let interest: number | undefined;
      if (transactionKind === "debtPayment") {
        const liability = transaction.liabilityId ? liabilities.find((item) => item.id === transaction.liabilityId) : undefined;
        principal = Number(transaction.principal ?? transaction.amount);
        interest = Number(transaction.interest ?? 0);
        if (!liability) return reject("Pilih utang yang menerima pembayaran.");
        if (!Number.isFinite(principal) || !Number.isFinite(interest) || principal < 0 || interest < 0) return reject("Pokok dan bunga tidak boleh negatif.");
        if (Math.abs(principal + interest - amount) > 0) return reject("Pokok + bunga harus sama dengan nominal pembayaran.");
        if (principal > liability.remainingPrincipal) return reject(`Pokok pembayaran tidak boleh melebihi sisa pokok ${formatCurrency(liability.remainingPrincipal)}.`);
        const paymentPrincipal = principal;
        liabilities = liabilities.map((item) => item.id === liability.id ? { ...item, remainingPrincipal: item.remainingPrincipal - paymentPrincipal } : item);
      }

      let saleValue: number | undefined;
      if (transactionKind === "assetSale") {
        const saleAsset = transaction.assetId ? assets.find((item) => item.id === transaction.assetId) : undefined;
        saleValue = Number(transaction.assetValue ?? transaction.amount);
        if (!saleAsset) return reject("Pilih aset yang dijual.");
        if (!Number.isFinite(saleValue) || saleValue <= 0) return reject("Isi nilai aset yang dilepas dengan angka lebih besar dari Rp 0.");
        if (saleValue > saleAsset.value) return reject(`Nilai yang dilepas tidak boleh melebihi nilai aset ${formatCurrency(saleAsset.value)}.`);
        const recordedSaleValue = saleValue;
        assets = assets.map((item) => item.id === saleAsset.id ? { ...item, value: item.value - recordedSaleValue, updatedAt: transaction.date } : item);
      }

      const categoryKind = transactionKind === "income" || transactionKind === "assetSale" ? "income" : "expense";
      const categoryResult = transaction.categoryId === "cat-other"
        ? ensureCustomCategory(state.categories, transactionOtherCategory, categoryKind)
        : { categories: state.categories, categoryId: transaction.categoryId };
      if (transaction.categoryId === "cat-other" && !categoryResult.categoryId) return reject("Isi nama kategori lainnya terlebih dahulu.");
      const transactionId = editingTransaction?.id ?? createId("tx");
      const nextTransaction: Transaction = {
        ...transaction,
        kind: transactionKind,
        categoryId: isTransfer ? undefined : categoryResult.categoryId,
        id: transactionId,
        amount,
        assetValue: transactionKind === "assetSale" ? saleValue : undefined,
        principal: transactionKind === "debtPayment" ? principal : undefined,
        interest: transactionKind === "debtPayment" ? interest : undefined,
      };
      const nextTransactions = editingTransaction
        ? state.transactions.map((item) => item.id === editingTransaction.id ? nextTransaction : item)
        : [...state.transactions, nextTransaction];
      if (transactionKind === "assetSale" && nextTransaction.assetId && saleValue !== undefined) {
        const saleAsset = assets.find((item) => item.id === nextTransaction.assetId);
        if (saleAsset) assetValuations = [...assetValuations, { id: createId("valuation"), assetId: saleAsset.id, value: saleAsset.value, recordedAt: valuationTimestamp(transaction.date), transactionId, note: `Penjualan ${saleAsset.name}` }];
      }
      const nextState: AppState = { ...state, categories: categoryResult.categories, transactions: nextTransactions, liabilities, assets, assetValuations };
      onSave(nextState, editingTransaction ? "Transaksi berhasil diperbarui." : `${kindLabel(transactionKind)} berhasil dicatat.`); return;
    }
    if (type === "account") {
      const openingBalance = Number(account.openingBalance);
      if (!account.name.trim() || account.openingBalance === "") return reject("Isi nama rekening dan saldo awal.");
      if (!Number.isFinite(openingBalance) || openingBalance < 0) return reject("Saldo awal harus berupa angka nol atau lebih.");
      const item: Account = { id: createId("account"), name: account.name.trim(), type: account.type, openingBalance, createdAt: new Date().toISOString() };
      onSave({ ...state, accounts: [...state.accounts, item] }, "Rekening berhasil ditambahkan."); return;
    }
    if (type === "asset") {
      const coinId: CryptoCoinId | null = asset.marketMode === "manual" ? null : asset.marketMode;
      const isCrypto = coinId !== null;
      const symbol = coinId ? CRYPTO_SYMBOLS[coinId] : null;
      const nextValue = Number(asset.value);
      const purchasePriceUsd = Number(asset.bitcoinPurchasePriceUsd);
      const quote = bitcoinMarket.quote;
      const usdIdrRate = quote ? getUsdIdrRate(quote) : 0;
      const keepsExistingHolding = Boolean(editingAsset?.market && editingAsset.market.coinId === coinId);
      const quantity = isCrypto ? keepsExistingHolding ? editingAsset!.market!.quantity : calculateCryptoQuantity(nextValue, purchasePriceUsd, usdIdrRate) : 0;
      const assetName = isCrypto ? asset.name.trim() || symbol! : asset.name.trim();
      const assetType = isCrypto ? "investment" : asset.type;
      const isLiquid = isCrypto || (assetType !== "property" && asset.liquid);
      const daysToCash = Number(asset.daysToCash || 999);

      if (!assetName || asset.value === "") return reject("Isi nama dan nilai aset.");
      if (!Number.isFinite(nextValue) || nextValue < 0 || (!editingAsset && nextValue === 0)) return reject(editingAsset ? "Nilai aset harus nol atau lebih." : "Nilai aset baru harus lebih besar dari Rp 0.");
      if (isCrypto) {
        if (!Number.isFinite(purchasePriceUsd) || purchasePriceUsd <= 0 || (!keepsExistingHolding && (!quote || quantity <= 0))) return reject(`Harga ${symbol} dan kurs belum tersedia. Tekan Muat ulang lalu isi harga beli USD.`);
        if (quantity === 0 && nextValue !== 0) return reject("Kepemilikan kripto yang sudah habis harus bermodal Rp 0. Gunakan Beli aset untuk menambahnya.");
      } else if (isLiquid && (!Number.isFinite(daysToCash) || daysToCash < 0)) {
        return reject("Waktu pencairan harus berupa angka nol atau lebih.");
      }

      const market: CryptoMarketTracking | undefined = coinId && symbol ? {
        coinId,
        symbol,
        quantity,
        costBasisIdr: keepsExistingHolding && nextValue === editingAsset!.value ? editingAsset!.market!.costBasisIdr : nextValue,
        averagePurchasePriceUsd: purchasePriceUsd,
        usdIdrRateAtPurchase: keepsExistingHolding ? editingAsset!.market!.usdIdrRateAtPurchase : usdIdrRate,
      } : undefined;

      if (editingAsset) {
        const previousValue = editingAsset.value;
        const valueChanged = nextValue !== previousValue || editingAsset.market?.coinId !== coinId;
        const item: Asset = {
          ...editingAsset,
          name: assetName,
          type: assetType,
          value: nextValue,
          liquid: isLiquid,
          daysToCash: isLiquid ? (isCrypto ? 3 : daysToCash) : 999,
          updatedAt: valueChanged ? getToday() : editingAsset.updatedAt,
          market,
        };
        const nextValuations = valueChanged
          ? [...state.assetValuations, { id: createId("valuation"), assetId: item.id, value: nextValue, recordedAt: valuationTimestamp(getToday()), note: isCrypto ? `Modal ${symbol} dikoreksi melalui ubah detail` : "Dikoreksi melalui ubah detail" }]
          : state.assetValuations;
        onSave({ ...state, assets: state.assets.map((entry) => entry.id === item.id ? item : entry), assetValuations: nextValuations }, "Detail aset berhasil diperbarui.");
        return;
      }

      const item: Asset = {
        id: createId("asset"),
        name: assetName,
        type: assetType,
        value: nextValue,
        liquid: isLiquid,
        daysToCash: isLiquid ? (isCrypto ? 3 : daysToCash) : 999,
        updatedAt: getToday(),
        market,
      };
      const valuation: AssetValuation = { id: createId("valuation"), assetId: item.id, value: nextValue, recordedAt: valuationTimestamp(getToday()), note: isCrypto ? `Modal awal ${symbol}` : "Nilai awal" };
      onSave({ ...state, assets: [...state.assets, item], assetValuations: [...state.assetValuations, valuation] }, isCrypto ? `Aset ${symbol} berhasil ditambahkan.` : "Aset berhasil ditambahkan.");
      return;
    }
    if (type === "cryptoReconcile") {
      if (!editingAsset?.market) return reject("Aset kripto yang akan dicocokkan tidak ditemukan.");
      const actualQuantity = Number(cryptoReconcile.actualQuantity);
      const remainingCostBasisIdr = cryptoReconcile.remainingCostBasisIdr === "" ? undefined : Number(cryptoReconcile.remainingCostBasisIdr);
      try {
        const nextState = reconcileCryptoHolding(state, { assetId: editingAsset.id, actualQuantity, remainingCostBasisIdr, date: cryptoReconcile.date, note: cryptoReconcile.note });
        onSave(nextState, `Saldo ${editingAsset.market.symbol} disesuaikan menjadi ${formatCryptoQuantity(actualQuantity)} ${editingAsset.market.symbol}.`);
      } catch (error) {
        reject(error instanceof Error ? error.message : "Saldo kripto belum dapat disesuaikan.");
      }
      return;
    }
    if (type === "assetValue") {
      if (!editingAsset || assetValue.value === "" || !assetValue.date) return reject("Isi tanggal dan nilai aset terbaru.");
      if (assetValue.date > getToday()) return reject("Tanggal pembaruan nilai aset tidak boleh di masa depan.");
      const nextValue = Number(assetValue.value);
      if (!Number.isFinite(nextValue) || nextValue < 0) return reject("Nilai aset harus berupa angka nol atau lebih.");
      const item: Asset = { ...editingAsset, value: nextValue, updatedAt: assetValue.date };
      const valuation: AssetValuation = { id: createId("valuation"), assetId: item.id, value: nextValue, recordedAt: valuationTimestamp(assetValue.date), note: assetValue.note.trim() || undefined };
      onSave({ ...state, assets: state.assets.map((entry) => entry.id === item.id ? item : entry), assetValuations: [...state.assetValuations, valuation] }, "Nilai aset berhasil diperbarui.");
      return;
    }
    if (type === "assetToAccount") {
      if (!editingAsset) return reject("Aset yang akan dipindahkan tidak ditemukan.");
      try {
        const result = convertLiquidAssetToAccount(state, {
          assetId: editingAsset.id,
          name: assetAccount.name,
          type: assetAccount.type,
          asOfDate: getToday(),
        });
        const historyMessage = result.migratedTransactionCount > 0
          ? ` ${result.migratedTransactionCount} riwayat transaksi ikut ditautkan.`
          : "";
        onSave(result.state, `${result.account.name} sekarang berada di Rekening & Kas.${historyMessage}`);
      } catch (error) {
        reject(error instanceof Error ? error.message : "Aset belum dapat dipindahkan ke rekening.");
      }
      return;
    }
    if (type === "assetPurchase") {
      const purchaseAmount = Number(purchase.amount);
      const fee = Number(purchase.fee || 0);
      const totalOutflow = purchaseAmount + fee;
      const sourceAsset = purchase.sourceType === "asset" ? state.assets.find((item) => item.id === purchase.sourceId) : null;
      const sourceAccount = purchase.sourceType === "account" ? state.accounts.find((item) => item.id === purchase.sourceId) : null;
      const accountBalance = sourceAccount ? getAccountBalances(state, purchase.date)[sourceAccount.id] ?? 0 : 0;
      const available = sourceAsset?.value ?? accountBalance;
      const targetIsNew = purchase.targetAssetId === "new";
      const targetAsset = targetIsNew ? null : state.assets.find((item) => item.id === purchase.targetAssetId);
      const targetDaysToCash = Number(purchase.targetDaysToCash || 999);
      const cryptoCoinId: CryptoCoinId | null = targetIsNew
        ? purchase.marketMode !== "manual" ? purchase.marketMode : null
        : targetAsset?.market?.coinId ?? null;
      const isCrypto = cryptoCoinId !== null;
      const cryptoSymbol = cryptoCoinId ? CRYPTO_SYMBOLS[cryptoCoinId] : null;
      const quote = bitcoinMarket.quote;
      const purchasePriceUsd = Number(purchase.bitcoinPurchasePriceUsd);
      const usdIdrRate = quote ? getUsdIdrRate(quote) : 0;
      const quantity = isCrypto ? calculateCryptoQuantity(purchaseAmount, purchasePriceUsd, usdIdrRate) : 0;

      if (!purchase.sourceId || !purchase.amount || !purchase.date || !Number.isFinite(purchaseAmount) || purchaseAmount <= 0) return reject("Pilih sumber dana, tanggal, dan nilai pembelian yang valid.");
      if (purchase.date > getToday()) return reject("Pembelian aset hanya dicatat setelah benar-benar terjadi.");
      if (!Number.isFinite(fee) || fee < 0) return reject("Biaya transaksi tidak boleh negatif.");
      if (totalOutflow > available) return reject("Saldo sumber tidak cukup. Maksimal yang bisa digunakan " + formatCurrency(available) + ".");
      if (!targetIsNew && !targetAsset) return reject("Pilih aset tujuan yang valid.");
      if (sourceAsset?.market) return reject("Aset kripto tidak dapat dipakai sebagai sumber dana pada fitur ini. Gunakan saldo IDR terlebih dahulu.");
      if (sourceAsset && targetAsset?.id === sourceAsset.id) return reject("Aset sumber dan aset tujuan tidak boleh sama.");
      if (targetIsNew && !isCrypto && !purchase.targetName.trim()) return reject("Isi nama aset tujuan.");
      if (targetIsNew && !isCrypto && purchase.targetLiquid && (!Number.isFinite(targetDaysToCash) || targetDaysToCash < 0)) return reject("Waktu pencairan aset tujuan harus valid.");
      if (isCrypto && (!quote || !Number.isFinite(purchasePriceUsd) || purchasePriceUsd <= 0 || quantity <= 0)) return reject(`Harga ${cryptoSymbol} dan kurs belum tersedia. Tekan Muat ulang lalu isi harga beli USD.`);

      const transactionId = createId("tx");
      const targetId = targetAsset?.id ?? createId("asset");
      const targetName = targetAsset?.name ?? (purchase.targetName.trim() || cryptoSymbol || "Aset");
      const purchaseNote = purchase.note.trim() || "Beli " + targetName;
      const transaction: Transaction = {
        id: transactionId,
        date: purchase.date,
        kind: "assetPurchase",
        amount: totalOutflow,
        accountId: sourceAccount?.id,
        sourceAssetId: sourceAsset?.id,
        assetId: targetId,
        assetValue: purchaseAmount,
        fee: fee || undefined,
        targetAssetCreated: targetIsNew,
        note: purchaseNote,
        cryptoQuantity: isCrypto ? quantity : undefined,
        cryptoPurchasePriceUsd: isCrypto ? purchasePriceUsd : undefined,
        cryptoCostBasisIdr: isCrypto ? totalOutflow : undefined,
      };

      let nextAssets = state.assets.map((item) => {
        if (sourceAsset && item.id === sourceAsset.id) return { ...item, value: item.value - totalOutflow, updatedAt: purchase.date };
        if (!targetAsset || item.id !== targetAsset.id) return item;
        if (!isCrypto || !item.market) return { ...item, value: item.value + purchaseAmount, updatedAt: purchase.date };

        const previousQuantity = item.market.quantity;
        const nextQuantity = previousQuantity + quantity;
        const previousCost = item.market.costBasisIdr;
        const nextCost = previousCost + totalOutflow;
        const nextAverageUsd = nextQuantity > 0
          ? ((previousQuantity * item.market.averagePurchasePriceUsd) + (quantity * purchasePriceUsd)) / nextQuantity
          : purchasePriceUsd;
        return {
          ...item,
          value: item.value + purchaseAmount,
          updatedAt: purchase.date,
          market: { ...item.market, quantity: nextQuantity, costBasisIdr: nextCost, averagePurchasePriceUsd: nextAverageUsd, usdIdrRateAtPurchase: usdIdrRate },
        };
      });

      if (targetIsNew) {
        nextAssets = [...nextAssets, {
          id: targetId,
          name: targetName,
          type: isCrypto ? "investment" : purchase.targetType,
          value: purchaseAmount,
          liquid: isCrypto ? true : purchase.targetType !== "property" && purchase.targetLiquid,
          daysToCash: isCrypto ? 3 : purchase.targetType !== "property" && purchase.targetLiquid ? targetDaysToCash : 999,
          updatedAt: purchase.date,
          market: isCrypto ? {
            coinId: cryptoCoinId!,
            symbol: cryptoSymbol!,
            quantity,
            costBasisIdr: totalOutflow,
            averagePurchasePriceUsd: purchasePriceUsd,
            usdIdrRateAtPurchase: usdIdrRate,
          } : undefined,
        }];
      }

      const recordedAt = valuationTimestamp(purchase.date);
      const nextValuations = [...state.assetValuations];
      if (sourceAsset) nextValuations.push({ id: createId("valuation"), assetId: sourceAsset.id, value: sourceAsset.value - totalOutflow, recordedAt, transactionId, note: "Pembelian " + targetName });
      nextValuations.push({ id: createId("valuation"), assetId: targetId, value: targetAsset ? targetAsset.value + purchaseAmount : purchaseAmount, recordedAt, transactionId, note: purchaseNote });
      onSave({ ...state, transactions: [...state.transactions, transaction], assets: nextAssets, assetValuations: nextValuations }, isCrypto ? `Pembelian ${cryptoSymbol} berhasil dicatat.` : "Pembelian aset berhasil dicatat.");
      return;
    }
    if (type === "assetSale") {
      const grossProceedsIdr = Number(sale.grossProceedsIdr);
      const feeIdr = Number(sale.feeIdr || 0);
      const selectedAsset = state.assets.find((item) => item.id === sale.assetId);
      const cryptoSalePriceUsd = Number(sale.cryptoSalePriceUsd);
      const usdIdrRateAtSale = Number(sale.usdIdrRateAtSale || (bitcoinMarket.quote ? Math.round(getUsdIdrRate(bitcoinMarket.quote)) : 0));

      if (!selectedAsset || !sale.accountId || !sale.date) return reject("Pilih aset, rekening penerima, dan tanggal penjualan.");
      if (sale.date > getToday()) return reject("Penjualan hanya dapat dicatat setelah benar-benar terjadi.");
      if (!Number.isFinite(grossProceedsIdr) || grossProceedsIdr <= 0) return reject("Isi hasil penjualan kotor yang lebih besar dari Rp 0.");
      if (!Number.isFinite(feeIdr) || feeIdr < 0 || feeIdr >= grossProceedsIdr) return reject("Biaya transaksi harus nol atau lebih kecil dari hasil penjualan.");
      if (selectedAsset.market && (!Number.isFinite(cryptoSalePriceUsd) || cryptoSalePriceUsd <= 0 || !Number.isFinite(usdIdrRateAtSale) || usdIdrRateAtSale <= 0)) return reject(`Isi harga jual ${selectedAsset.market.symbol} dalam USD dan kurs USD ke Rupiah yang valid.`);

      try {
        const result = recordAssetSale(state, {
          assetId: selectedAsset.id,
          accountId: sale.accountId,
          date: sale.date,
          grossProceedsIdr,
          feeIdr,
          bookValueRemovedIdr: selectedAsset.market ? undefined : Number(sale.bookValueRemovedIdr),
          cryptoSalePriceUsd: selectedAsset.market ? cryptoSalePriceUsd : undefined,
          usdIdrRateAtSale: selectedAsset.market ? usdIdrRateAtSale : undefined,
          note: sale.note,
        });
        const outcome = result.realizedGainIdr > 0
          ? `Untung terealisasi ${formatCurrency(result.realizedGainIdr)}.`
          : result.realizedGainIdr < 0
            ? `Rugi terealisasi ${formatCurrency(Math.abs(result.realizedGainIdr))}.`
            : "Hasil penjualan impas.";
        onSave(result.state, `${selectedAsset.name} berhasil dijual. ${outcome}`);
      } catch (error) {
        reject(error instanceof Error ? error.message : "Penjualan aset belum dapat disimpan.");
      }
      return;
    }
    if (type === "liability") {
      const remainingPrincipal = Number(liability.remainingPrincipal);
      const monthlyPayment = Number(liability.monthlyPayment || 0);
      const interestRate = Number(liability.interestRate || 0);
      const dueDay = Number(liability.dueDay || 0);
      if (!liability.name.trim() || liability.remainingPrincipal === "") return reject("Isi nama utang dan sisa pokok.");
      if (!Number.isFinite(remainingPrincipal) || remainingPrincipal < 0 || !Number.isFinite(monthlyPayment) || monthlyPayment < 0 || !Number.isFinite(interestRate) || interestRate < 0) return reject("Nilai utang, cicilan, dan bunga harus valid.");
      if (dueDay && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) return reject("Jatuh tempo harus berada di antara tanggal 1 sampai 31.");
      const item: Liability = { id: createId("debt"), name: liability.name.trim(), type: liability.type, remainingPrincipal, monthlyPayment, interestRate, dueDay: dueDay || undefined };
      onSave({ ...state, liabilities: [...state.liabilities, item] }, "Utang berhasil ditambahkan."); return;
    }
    if (type === "budget") {
      const budgetAmount = Number(budget.amount);
      if (!budget.categoryId || budget.amount === "") return reject("Pilih kategori dan isi batas anggaran.");
      if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) return reject("Batas anggaran harus lebih besar dari Rp 0.");
      const categoryResult = budget.categoryId === "cat-other"
        ? ensureCustomCategory(state.categories, budgetOtherCategory, "expense")
        : { categories: state.categories, categoryId: budget.categoryId };
      if (budget.categoryId === "cat-other" && !categoryResult.categoryId) return reject("Isi nama kategori lainnya terlebih dahulu.");
      const item: Budget = { id: createId("budget"), categoryId: categoryResult.categoryId ?? budget.categoryId, month, amount: budgetAmount };
      onSave({ ...state, categories: categoryResult.categories, budgets: [...state.budgets.filter((entry) => !(entry.categoryId === item.categoryId && entry.month === item.month)), item] }, "Anggaran berhasil disimpan.");
      return;
    }
    if (type === "recurring") {
      const amount = Number(recurring.amount);
      const dayOfMonth = Number(recurring.dayOfMonth);
      if (!recurring.name.trim() || !Number.isFinite(amount) || amount <= 0 || !recurring.accountId || !Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return reject("Isi transaksi rutin, sumber dana, nominal, dan tanggal yang valid.");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(recurring.startMonth)) return reject("Pilih bulan mulai yang valid.");
      const item: RecurringTransaction = {
        id: editingRecurring?.id ?? createId("recurring"),
        name: recurring.name.trim(),
        kind: recurring.kind,
        amount,
        accountId: recurring.accountId,
        categoryId: recurring.categoryId || undefined,
        dayOfMonth,
        startMonth: recurring.startMonth,
        active: recurring.active,
        note: recurring.note.trim() || undefined,
        createdAt: editingRecurring?.createdAt ?? new Date().toISOString(),
      };
      const nextState = editingRecurring
        ? syncRecurringRule(state, editingRecurring, item)
        : { ...state, recurringTransactions: [...state.recurringTransactions, item] };
      onSave(nextState, editingRecurring ? "Transaksi rutin diperbarui." : "Transaksi rutin disimpan.");
      return;
    }
    if (type === "reconcile") {
      const actualBalance = Number(reconcile.actualBalance);
      if (reconcile.actualBalance === "") return reject("Isi saldo aktual rekening.");
      try {
        const nextState = recordAccountReconciliation(state, { accountId: reconcile.accountId, actualBalance, date: reconcile.date, note: reconcile.note, applyCorrection: reconcile.applyCorrection });
        const item = nextState.reconciliations[nextState.reconciliations.length - 1];
        const message = item.difference === 0 ? "Saldo cocok dengan catatan." : reconcile.applyCorrection ? "Saldo Neraca sudah disesuaikan ke saldo aktual." : "Rekonsiliasi disimpan. Periksa selisih saldo.";
        onSave(nextState, message);
      } catch (error) {
        reject(error instanceof Error ? error.message : "Rekonsiliasi belum dapat disimpan.");
      }
      return;
    }
    if (type === "goal") {
      const targetAmount = Number(goal.targetAmount);
      const manualAmount = Number(goal.currentAmount || 0);
      const sourceId = goal.sourceType === "manual" ? undefined : goal.sourceId || undefined;
      if (!goal.name.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0 || !Number.isFinite(manualAmount) || manualAmount < 0) return reject("Isi nama target dan nominal yang valid.");
      if (goal.sourceType !== "manual" && !sourceId) return reject("Pilih sumber progres target atau gunakan mode manual.");
      if (goal.sourceType === "account" && !state.accounts.some((item) => item.id === sourceId)) return reject("Sumber rekening target tidak tersedia.");
      if (goal.sourceType === "asset" && !state.assets.some((item) => item.id === sourceId)) return reject("Sumber aset target tidak tersedia.");
      const linkedGoal = { id: editingGoal?.id ?? "draft-goal", name: goal.name.trim(), targetAmount, currentAmount: manualAmount, sourceType: goal.sourceType, sourceId, createdAt: editingGoal?.createdAt ?? new Date().toISOString() } satisfies Goal;
      const currentAmount = goal.sourceType === "manual" ? manualAmount : getGoalCurrentAmount(state, linkedGoal);
      if (currentAmount > targetAmount) return reject("Progres terkumpul tidak boleh melebihi nilai target.");
      const item: Goal = { ...linkedGoal, id: editingGoal?.id ?? createId("goal"), currentAmount, targetDate: goal.targetDate || undefined, note: goal.note.trim() || undefined };
      const goals = editingGoal ? state.goals.map((entry) => entry.id === item.id ? item : entry) : [...state.goals, item];
      onSave({ ...state, goals }, editingGoal ? "Target diperbarui." : "Target keuangan disimpan.");
    }
  }

  const titles: Record<Exclude<ModalType, null>, string> = { transaction: editingTransaction ? "Ubah transaksi" : "Catat transaksi", transfer: "Pindah saldo", account: "Tambah rekening", asset: editingAsset ? "Ubah detail aset" : "Tambah aset", assetValue: "Perbarui nilai aset", assetPurchase: "Beli aset", assetSale: "Jual aset", assetToAccount: "Pindahkan ke rekening", cryptoReconcile: "Cocokkan saldo kripto", liability: "Tambah utang", budget: "Buat anggaran", recurring: editingRecurring ? "Ubah transaksi rutin" : "Transaksi rutin", recurringBudget: editingRecurringBudget ? "Ubah anggaran rutin" : "Anggaran rutin", reconcile: "Cek saldo rekening", goal: editingGoal ? "Ubah target" : "Tambah target" };
  const descriptions: Record<Exclude<ModalType, null>, string> = { transaction: "Isi pergerakan uang yang benar-benar terjadi.", transfer: "Pindahkan saldo antar rekening, kas, atau e-wallet milikmu.", account: "Masukkan sumber dana dan saldo awalnya.", asset: editingAsset ? "Koreksi nama, jenis, likuiditas, atau nilai aset yang salah." : "Catat nilai aset berdasarkan pembaruan terakhirmu.", assetValue: "Simpan perubahan nilai tanpa membuat pemasukan atau pengeluaran baru.", assetPurchase: "Pindahkan nilai dari rekening atau aset likuid ke investasi baru.", assetSale: "Catat hasil penjualan, biaya, dan nilai kepemilikan yang dilepas.", assetToAccount: "Ubah saldo IDR exchange menjadi sumber dana tanpa menghitung nilainya dua kali.", cryptoReconcile: "Samakan jumlah kepemilikan dengan saldo aktual di exchange tanpa membuat transaksi palsu.", liability: "Simpan sisa pokok dan komitmen cicilan saat ini.", budget: "Tetapkan batas untuk satu kategori pada bulan aktif.", recurring: "Simpan pola pemasukan atau pengeluaran mulai dari bulan yang kamu pilih.", recurringBudget: "Tetapkan batas kategori yang bisa diterapkan mulai bulan tertentu.", reconcile: "Bandingkan saldo rekening yang tercatat dengan saldo sebenarnya.", goal: "Tetapkan angka tujuan dan perbarui progresnya secara berkala." };
  if (isRecurringBudget) {
    titles.budget = titles.recurringBudget;
    descriptions.budget = descriptions.recurringBudget;
  }
  const submitLabel = type === "assetValue" ? "Simpan nilai" : type === "assetPurchase" ? "Catat pembelian" : type === "assetSale" ? "Catat penjualan" : type === "assetToAccount" ? "Pindahkan sekarang" : type === "cryptoReconcile" ? "Cocokkan saldo" : editingAsset || editingTransaction || editingRecurring || editingRecurringBudget || editingGoal ? "Simpan perubahan" : type === "reconcile" ? reconcile.applyCorrection ? "Sesuaikan saldo" : "Simpan cek" : "Simpan";
  return <div className="modal-backdrop"><section ref={dialogRef} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description" onKeyDown={keepFocusInside}><div className="modal-header"><div><p className="eyebrow teal">INPUT DATA</p><h2 id="modal-title">{titles[type]}</h2><p id="modal-description" className="modal-description">{descriptions[type]}</p></div><button className="close-button" type="button" onClick={onClose} aria-label="Tutup dialog">×</button></div>{formError && <p id="entry-form-error" className="form-error" role="alert">{formError}</p>}<form aria-describedby={formError ? "modal-description entry-form-error" : "modal-description"} onSubmit={submit}>{(type === "transaction" || type === "transfer") && <TransactionForm state={state} value={transaction} onChange={setTransaction} transferOnly={type === "transfer"} otherCategoryName={transactionOtherCategory} onOtherCategoryNameChange={setTransactionOtherCategory} />}{type === "account" && <AccountForm value={account} onChange={setAccount} />}{type === "asset" && <AssetForm value={asset} existingAsset={editingAsset} onChange={setAsset} bitcoinQuote={bitcoinMarket.quote} bitcoinLoading={bitcoinMarket.loading} bitcoinError={bitcoinMarket.error} onRefreshBitcoin={bitcoinMarket.refresh} />}{type === "assetValue" && <AssetValueForm value={assetValue} onChange={setAssetValue} />}{type === "assetPurchase" && <AssetPurchaseForm state={state} month={month} value={purchase} onChange={setPurchase} bitcoinQuote={bitcoinMarket.quote} bitcoinLoading={bitcoinMarket.loading} bitcoinError={bitcoinMarket.error} onRefreshBitcoin={bitcoinMarket.refresh} />}{type === "assetSale" && <AssetSaleForm state={state} value={sale} onChange={setSale} bitcoinQuote={bitcoinMarket.quote} bitcoinLoading={bitcoinMarket.loading} bitcoinError={bitcoinMarket.error} onRefreshBitcoin={bitcoinMarket.refresh} />}{type === "assetToAccount" && <AssetToAccountForm state={state} asset={editingAsset} value={assetAccount} onChange={setAssetAccount} />}{type === "cryptoReconcile" && <CryptoReconcileForm asset={editingAsset} value={cryptoReconcile} onChange={setCryptoReconcile} quote={bitcoinMarket.quote} />}{type === "liability" && <LiabilityForm value={liability} onChange={setLiability} />}{type === "budget" && <BudgetForm state={state} value={budget} onChange={setBudget} otherCategoryName={budgetOtherCategory} onOtherCategoryNameChange={setBudgetOtherCategory} />}{type === "recurring" && <RecurringForm state={state} value={recurring} onChange={setRecurring} />}{type === "reconcile" && <ReconcileForm state={state} month={month} value={reconcile} onChange={setReconcile} />}{type === "goal" && <GoalForm state={state} value={goal} onChange={setGoal} />}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Batal</button><button type="submit" className="primary-button">{submitLabel}</button></div></form></section></div>;
}

function SafetySettingsDialog({ state, onClose, onSave }: { state: AppState; onClose: () => void; onSave: (state: AppState) => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const [bufferTarget, setBufferTarget] = useState(String(state.settings.emergencyBufferTarget ?? ""));
  const [incomeDay, setIncomeDay] = useState(state.settings.nextIncomeDay ? String(state.settings.nextIncomeDay) : "");
  const [essentialCategoryIds, setEssentialCategoryIds] = useState(
    state.categories.filter((category) => category.kind === "expense" && category.essential).map((category) => category.id),
  );
  const [error, setError] = useState("");
  const expenseCategories = state.categories.filter((category) => category.kind === "expense");

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("input, button")?.focus(), 0);
    return () => previousFocus?.focus();
  }, []);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])") ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function toggleEssential(categoryId: string) {
    setEssentialCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const target = Number(bufferTarget || 0);
    const day = incomeDay ? Number(incomeDay) : undefined;
    if (!Number.isFinite(target) || target < 0) {
      setError("Target dana darurat harus berupa angka nol atau lebih.");
      return;
    }
    if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > 31)) {
      setError("Tanggal pemasukan rutin harus antara 1 dan 31.");
      return;
    }
    if (essentialCategoryIds.length === 0) {
      setError("Pilih minimal satu kategori kebutuhan pokok.");
      return;
    }
    onSave({
      ...state,
      categories: state.categories.map((category) =>
        category.kind === "expense"
          ? { ...category, essential: essentialCategoryIds.includes(category.id) }
          : category,
      ),
      settings: {
        ...state.settings,
        emergencyBufferTarget: target,
        nextIncomeDay: day,
      },
    });
  }

  return <div className="modal-backdrop">
    <section ref={dialogRef} className="modal-card safety-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="safety-settings-title" aria-describedby="safety-settings-description" onKeyDown={handleDialogKeyDown}>
      <div className="modal-header">
        <div>
          <p className="eyebrow teal">PENGATURAN DANA AMAN</p>
          <h2 id="safety-settings-title">Tentukan batas yang ingin dilindungi</h2>
          <p id="safety-settings-description" className="modal-description">Pengaturan ini hanya dipakai untuk menghitung batas aman. Tidak ada uang yang dipindahkan atau dikunci.</p>
        </div>
        <button className="close-button" type="button" onClick={onClose} aria-label="Tutup dialog">×</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Target dana darurat (Rp)">
            <CurrencyInput autoFocus value={bufferTarget} onChange={setBufferTarget} />
          </Field>
          <Field label="Tanggal pemasukan rutin">
            <input type="number" inputMode="numeric" min="1" max="31" value={incomeDay} onChange={(event) => setIncomeDay(event.target.value)} placeholder="Contoh: 25" />
          </Field>
          <p className="field-hint wide">Jika tanggal pemasukan dikosongkan, batas harian dihitung sampai akhir bulan. Tanggal 29–31 otomatis menyesuaikan akhir bulan.</p>
          <fieldset className="essential-category-fieldset wide">
            <legend>Kategori kebutuhan pokok</legend>
            <p>Pilih pengeluaran yang tetap harus dibayar saat kondisi keuangan sedang ketat.</p>
            <div className="essential-category-grid">
              {expenseCategories.map((category) => <label className="essential-category-option" key={category.id}>
                <input type="checkbox" checked={essentialCategoryIds.includes(category.id)} onChange={() => toggleEssential(category.id)} />
                <span><i style={{ background: category.color }} aria-hidden="true" />{category.name}</span>
              </label>)}
            </div>
          </fieldset>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Batal</button>
          <button type="submit" className="primary-button">Simpan pengaturan</button>
        </div>
      </form>
    </section>
  </div>;
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>; }

function formatNominalInput(value: string | number | undefined): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("id-ID") : "";
}

function CurrencyInput({ value, onChange, required = false, autoFocus = false, placeholder = "0" }: { value: string | number | undefined; onChange: (value: string) => void; required?: boolean; autoFocus?: boolean; placeholder?: string }) {
  return <input required={required} autoFocus={autoFocus} type="text" inputMode="numeric" value={formatNominalInput(value)} onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))} placeholder={placeholder} />;
}

function formatUsdInput(value: string | number | undefined): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("en-US") : "";
}

function UsdInput({ value, onChange, required = false, placeholder = "78,000" }: { value: string | number | undefined; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return <input required={required} type="text" inputMode="numeric" value={formatUsdInput(value)} onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))} placeholder={placeholder} />;
}

function AssetValueForm({ value, onChange }: { value: { value: string; date: string; note: string }; onChange: (value: { value: string; date: string; note: string }) => void }) {
  return <div className="form-grid">
    <Field label="Nilai aset (Rp)"><CurrencyInput required value={value.value} onChange={(nextValue) => onChange({ ...value, value: nextValue })} /></Field>
    <Field label="Tanggal pembaruan"><input required type="date" max={getToday()} value={value.date} onChange={(event) => onChange({ ...value, date: event.target.value })} /></Field>
    <Field label="Catatan perubahan" wide><input value={value.note} onChange={(event) => onChange({ ...value, note: event.target.value })} placeholder="Contoh: harga pasar terbaru" /></Field>
    <p id="nominal-format-hint" className="field-hint wide">Nominal otomatis memakai titik ribuan, misalnya 100.000.</p>
  </div>;
}

function AssetPurchaseForm({ state, month, value, onChange, bitcoinQuote, bitcoinLoading, bitcoinError, onRefreshBitcoin }: {
  state: AppState;
  month: string;
  value: AssetPurchaseDraft;
  onChange: (value: AssetPurchaseDraft) => void;
  bitcoinQuote: CryptoMarketQuote | null;
  bitcoinLoading: boolean;
  bitcoinError: string;
  onRefreshBitcoin: () => void;
}) {
  const liquidAssets = state.assets.filter((asset) => asset.liquid && asset.daysToCash <= 3 && !asset.market);
  void month;
  const accountBalances = getAccountBalances(state, value.date);
  const sourceAsset = value.sourceType === "asset" ? state.assets.find((asset) => asset.id === value.sourceId) : null;
  const sourceAccount = value.sourceType === "account" ? state.accounts.find((account) => account.id === value.sourceId) : null;
  const sourceBalance = sourceAsset?.value ?? (sourceAccount ? accountBalances[sourceAccount.id] ?? 0 : 0);
  const targetAsset = value.targetAssetId === "new" ? null : state.assets.find((asset) => asset.id === value.targetAssetId);
  const targetIsNew = value.targetAssetId === "new";
  const cryptoCoinId: CryptoCoinId | null = targetIsNew ? value.marketMode !== "manual" ? value.marketMode : null : targetAsset?.market?.coinId ?? null;
  const isCrypto = cryptoCoinId !== null;
  const cryptoSymbol = cryptoCoinId ? CRYPTO_SYMBOLS[cryptoCoinId] : "";
  const purchaseAmount = Number(value.amount || 0);
  const fee = Number(value.fee || 0);
  const purchasePriceUsd = Number(value.bitcoinPurchasePriceUsd || 0);
  const usdIdrRate = bitcoinQuote ? getUsdIdrRate(bitcoinQuote) : 0;
  const quantity = isCrypto && bitcoinQuote ? calculateCryptoQuantity(purchaseAmount, purchasePriceUsd, usdIdrRate) : 0;
  const sourceLabel = sourceAsset?.name ?? sourceAccount?.name ?? "sumber dana";
  const targetLabel = targetAsset?.name ?? (isCrypto ? value.targetName.trim() || cryptoSymbol : value.targetName.trim() || "aset baru");
  const sourceValueAfter = sourceBalance - purchaseAmount - fee;
  const targetValueAfter = (targetAsset?.value ?? 0) + purchaseAmount;

  function changeSource(sourceValue: string) {
    const [sourceType, sourceId] = sourceValue.split(":") as [PurchaseSourceType, string];
    onChange({ ...value, sourceType, sourceId, targetAssetId: sourceType === "asset" && value.targetAssetId === sourceId ? "new" : value.targetAssetId });
  }

  function changeTarget(targetAssetId: string) {
    const selected = targetAssetId === "new" ? null : state.assets.find((asset) => asset.id === targetAssetId);
    onChange({ ...value, targetAssetId, marketMode: selected?.market?.coinId ?? "manual", bitcoinPurchasePriceUsd: selected?.market ? String(selected.market.averagePurchasePriceUsd) : value.bitcoinPurchasePriceUsd });
  }

  function changeMarketMode(marketMode: AssetPurchaseDraft["marketMode"]) {
    onChange({
      ...value,
      marketMode,
      targetName: marketMode === "bitcoin" || marketMode === "ethereum" ? CRYPTO_SYMBOLS[marketMode] : marketMode === "tether" ? value.targetName || "USDT" : value.targetName,
      targetType: marketMode !== "manual" ? "investment" : value.targetType,
      targetLiquid: marketMode !== "manual" ? true : value.targetLiquid,
      targetDaysToCash: marketMode !== "manual" ? "3" : value.targetDaysToCash,
      bitcoinPurchasePriceUsd: marketMode === "tether" && !value.bitcoinPurchasePriceUsd ? "1" : value.bitcoinPurchasePriceUsd,
    });
  }

  return <div className="form-grid">
    <Field label="Sumber dana" wide>
      <select required value={`${value.sourceType}:${value.sourceId}`} onChange={(event) => changeSource(event.target.value)}>
        <option value=":" disabled>Pilih rekening atau aset likuid</option>
        {liquidAssets.length > 0 && <optgroup label="Aset likuid">{liquidAssets.map((asset) => <option key={asset.id} value={`asset:${asset.id}`}>{asset.name} · {formatCurrency(asset.value)}</option>)}</optgroup>}
        {state.accounts.length > 0 && <optgroup label="Rekening & kas">{state.accounts.map((account) => <option key={account.id} value={`account:${account.id}`}>{account.name} · {formatCurrency(accountBalances[account.id] ?? 0)}</option>)}</optgroup>}
      </select>
    </Field>

    <Field label="Aset tujuan" wide>
      <select required value={value.targetAssetId} onChange={(event) => changeTarget(event.target.value)}>
        <option value="new">Buat aset baru</option>
        {state.assets.filter((asset) => asset.id !== value.sourceId || value.sourceType !== "asset").map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · nilai {formatCurrency(asset.value)}</option>)}
      </select>
    </Field>

    {targetIsNew && <Field label="Cara nilai aset" wide>
      <select value={value.marketMode} onChange={(event) => changeMarketMode(event.target.value as AssetPurchaseDraft["marketMode"])}>
        <option value="manual">Nilai aset manual</option>
        <option value="bitcoin">Bitcoin (BTC) dengan harga live</option>
        <option value="ethereum">Ethereum (ETH) dengan harga live</option>
        <option value="tether">Tether (USDT) dengan harga live</option>
      </select>
    </Field>}

    {targetIsNew && !isCrypto && <>
      <Field label="Nama aset baru"><input required value={value.targetName} onChange={(event) => onChange({ ...value, targetName: event.target.value })} placeholder="Contoh: Reksa dana pasar uang" /></Field>
      <Field label="Jenis aset"><select value={value.targetType} onChange={(event) => { const targetType = event.target.value as Asset["type"]; onChange({ ...value, targetType, targetLiquid: targetType === "property" ? false : value.targetLiquid }); }}><option value="investment">Investasi</option><option value="vehicle">Kendaraan</option><option value="property">Properti</option><option value="other">Aset lain</option></select></Field>
      <label className="check-field"><input type="checkbox" checked={value.targetLiquid} disabled={value.targetType === "property"} onChange={(event) => onChange({ ...value, targetLiquid: event.target.checked })} /><span>Aset tujuan likuid{value.targetType === "property" ? " - properti selalu non-likuid" : ""}</span></label>
      {value.targetLiquid && <Field label="Waktu pencairan (hari)"><input type="number" min="0" value={value.targetDaysToCash} onChange={(event) => onChange({ ...value, targetDaysToCash: event.target.value })} /></Field>}
    </>}

    {targetIsNew && isCrypto && <div className="crypto-form-intro wide"><strong>{cryptoSymbol} dengan harga live</strong><span>Modal tetap Rupiah. Harga beli dalam USD dipakai untuk menghitung jumlah {cryptoSymbol}.</span></div>}
    <Field label={isCrypto ? "Modal beli (Rp)" : "Nilai pembelian (Rp)"}><CurrencyInput required value={value.amount} onChange={(amount) => onChange({ ...value, amount })} /></Field>
    <Field label="Biaya transaksi (Rp)"><CurrencyInput value={value.fee} onChange={(feeValue) => onChange({ ...value, fee: feeValue })} /></Field>

    {isCrypto && <>
      <Field label={`Harga ${cryptoSymbol} saat beli (USD)`}><UsdInput required value={value.bitcoinPurchasePriceUsd} onChange={(bitcoinPurchasePriceUsd) => onChange({ ...value, bitcoinPurchasePriceUsd })} /></Field>
      {bitcoinQuote
        ? <div className="crypto-calculation" aria-live="polite"><span>Kurs otomatis {formatCurrency(Math.round(usdIdrRate))}</span><strong>{quantity > 0 ? `${formatCryptoQuantity(quantity)} ${cryptoSymbol}` : "Isi modal dan harga beli"}</strong><small>Harga {cryptoSymbol} sekarang {formatUsd(bitcoinQuote.priceUsd)} dari CoinGecko.</small></div>
        : <div className="crypto-load-state" role={bitcoinError ? "alert" : "status"}>{bitcoinError || (bitcoinLoading ? `Memuat kurs dan harga ${cryptoSymbol}...` : `Harga ${cryptoSymbol} belum tersedia.`)}<button type="button" className="market-refresh" onClick={onRefreshBitcoin} disabled={bitcoinLoading}>{bitcoinLoading ? "Memuat..." : "Muat ulang"}</button></div>}
    </>}

    <Field label="Tanggal pembelian"><input required type="date" max={getToday()} value={value.date} onChange={(event) => onChange({ ...value, date: event.target.value })} /></Field>
    <Field label="Catatan" wide><input value={value.note} onChange={(event) => onChange({ ...value, note: event.target.value })} placeholder={isCrypto ? `Contoh: beli ${cryptoSymbol}` : "Opsional"} /></Field>

    {sourceBalance <= 0 && <p className="form-note warning wide">Sumber dana ini belum memiliki saldo yang bisa digunakan.</p>}
    {purchaseAmount > 0 && purchaseAmount + fee <= sourceBalance && <div className="purchase-preview wide" aria-live="polite">
      <p>Pratinjau setelah pembelian</p>
      <div><span>{sourceLabel}</span><strong>{formatCurrency(sourceValueAfter)}</strong></div>
      <div><span>{targetLabel}</span><strong>{formatCurrency(targetValueAfter)}</strong></div>
      {isCrypto && quantity > 0 && <div><span>{cryptoSymbol} yang tercatat</span><strong>{formatCryptoQuantity(quantity)} {cryptoSymbol}</strong></div>}
      {fee > 0 && <small>Total keluar termasuk biaya: {formatCurrency(purchaseAmount + fee)}</small>}
    </div>}
    <p className="field-hint wide">{isCrypto ? `Harga live ${cryptoSymbol} diperbarui saat halaman aset terbuka. Jumlah kepemilikan tidak dikirim ke penyedia harga.` : "Pembelian mengurangi sumber dana dan menambah nilai aset tujuan. Ini bukan pemasukan."}</p>
  </div>;
}

function AssetToAccountForm({ state, asset, value, onChange }: {
  state: AppState;
  asset: Asset | null;
  value: AssetToAccountDraft;
  onChange: (value: AssetToAccountDraft) => void;
}) {
  if (!asset) return <p className="form-note warning">Aset yang akan dipindahkan tidak ditemukan.</p>;
  const sourceTransactions = state.transactions.filter((transaction) => transaction.sourceAssetId === asset.id);
  const incomingTransactions = state.transactions.filter((transaction) => transaction.assetId === asset.id);
  const unsupportedIncomingTransactions = incomingTransactions.filter((transaction) => transaction.kind !== "assetPurchase");
  const unsupportedSourceTransactions = sourceTransactions.filter((transaction) => transaction.kind !== "assetPurchase");
  const linkedGoals = state.goals.filter((goal) => goal.sourceType === "asset" && goal.sourceId === asset.id);
  const canConvert = !asset.market && asset.liquid && asset.daysToCash <= 3 && unsupportedIncomingTransactions.length === 0 && unsupportedSourceTransactions.length === 0;

  return <div className="form-grid">
    <div className="conversion-summary wide">
      <p className="eyebrow">ASET ASAL</p>
      <div><span>{asset.name}</span><strong>{formatCurrency(asset.value)}</strong></div>
      <small>Saldo akhir ini tetap sama setelah menjadi rekening.</small>
    </div>
    <Field label="Nama rekening"><input required autoFocus value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="Contoh: Pintu IDR" /></Field>
    <Field label="Jenis rekening"><select value={value.type} onChange={(event) => onChange({ ...value, type: event.target.value as Account["type"] })}><option value="ewallet">E-wallet / exchange</option><option value="bank">Bank</option><option value="cash">Tunai</option></select></Field>
    <div className="conversion-preview wide" aria-live="polite">
      <p>Yang akan dipindahkan</p>
      <div><span>Saldo rekening baru</span><strong>{formatCurrency(asset.value)}</strong></div>
      <div><span>Riwayat keluar dialihkan</span><strong>{sourceTransactions.length} transaksi</strong></div>
      <div><span>Riwayat masuk ditautkan</span><strong>{incomingTransactions.length} transaksi</strong></div>
      <div><span>Target keuangan dialihkan</span><strong>{linkedGoals.length} target</strong></div>
      <small>Aset lama dan riwayat nilainya dihapus setelah rekening berhasil dibuat. Total kekayaan tidak berubah.</small>
    </div>
    {incomingTransactions.length > 0 && unsupportedIncomingTransactions.length === 0 && <p className="form-note success wide">{incomingTransactions.length} riwayat masuk akan tetap tersimpan dan ditautkan ke rekening baru.</p>}
    {(unsupportedIncomingTransactions.length > 0 || unsupportedSourceTransactions.length > 0) && <p className="form-note warning wide">Ada jenis transaksi terkait yang belum didukung. Migrasi dihentikan agar saldo tidak rusak.</p>}
    {!canConvert && unsupportedIncomingTransactions.length === 0 && unsupportedSourceTransactions.length === 0 && <p className="form-note warning wide">Hanya aset IDR manual yang likuid maksimal T+3 yang dapat dipindahkan.</p>}
    <p className="field-hint wide">Setelah menjadi rekening, saldo ini ikut dihitung sebagai kas operasional dan Dana Aman. Buat backup JSON terlebih dahulu jika ingin memiliki titik pemulihan.</p>
  </div>;
}

function AssetSaleForm({ state, value, onChange, bitcoinQuote, bitcoinLoading, bitcoinError, onRefreshBitcoin }: {
  state: AppState;
  value: AssetSaleDraft;
  onChange: (value: AssetSaleDraft) => void;
  bitcoinQuote: CryptoMarketQuote | null;
  bitcoinLoading: boolean;
  bitcoinError: string;
  onRefreshBitcoin: () => void;
}) {
  const selectedAsset = state.assets.find((asset) => asset.id === value.assetId);
  const isCrypto = Boolean(selectedAsset?.market);
  const cryptoSymbol = selectedAsset?.market?.symbol ?? "";
  const grossProceedsIdr = Number(value.grossProceedsIdr || 0);
  const feeIdr = Number(value.feeIdr || 0);
  const bookValueRemovedIdr = Number(value.bookValueRemovedIdr || 0);
  const salePriceUsd = Number(value.cryptoSalePriceUsd || 0);
  const automaticRate = bitcoinQuote ? Math.round(getUsdIdrRate(bitcoinQuote)) : 0;
  const effectiveRate = Number(value.usdIdrRateAtSale || automaticRate);
  const cryptoSale = selectedAsset && isCrypto
    ? calculateCryptoSale(selectedAsset, grossProceedsIdr, salePriceUsd, effectiveRate, feeIdr)
    : null;
  const netProceedsIdr = Math.max(0, grossProceedsIdr - feeIdr);
  const manualSaleValid = Boolean(selectedAsset && !isCrypto && bookValueRemovedIdr > 0 && bookValueRemovedIdr <= selectedAsset.value && grossProceedsIdr > feeIdr);
  const realizedGainIdr = cryptoSale?.realizedGainIdr ?? (manualSaleValid ? netProceedsIdr - bookValueRemovedIdr : 0);
  const remainingAssetValue = cryptoSale
    ? selectedAsset!.market!.quantity === cryptoSale.quantitySold ? 0 : Math.max(0, selectedAsset!.value - selectedAsset!.value * (cryptoSale.quantitySold / selectedAsset!.market!.quantity))
    : manualSaleValid && selectedAsset ? selectedAsset.value - bookValueRemovedIdr : selectedAsset?.value ?? 0;
  const hasCalculationInput = grossProceedsIdr > 0 && feeIdr < grossProceedsIdr && (isCrypto ? salePriceUsd > 0 && effectiveRate > 0 : bookValueRemovedIdr > 0);

  function changeAsset(assetId: string) {
    const nextAsset = state.assets.find((asset) => asset.id === assetId);
    onChange({
      ...value,
      assetId,
      bookValueRemovedIdr: nextAsset?.market ? "" : nextAsset ? String(nextAsset.value) : "",
      cryptoSalePriceUsd: "",
      usdIdrRateAtSale: "",
      note: nextAsset ? `Jual ${nextAsset.name}` : "",
    });
  }

  return <div className="form-grid">
    <Field label="Aset yang dijual" wide>
      <select required value={value.assetId} onChange={(event) => changeAsset(event.target.value)}>
        <option value="">Pilih aset</option>
        {state.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.market ? `${formatCryptoQuantity(asset.market.quantity)} ${asset.market.symbol}` : formatCurrency(asset.value)}</option>)}
      </select>
    </Field>
    <Field label="Rekening penerima">
      <select required value={value.accountId} onChange={(event) => onChange({ ...value, accountId: event.target.value })}>
        <option value="">Pilih rekening</option>
        {state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
      </select>
    </Field>
    <Field label="Tanggal penjualan"><input required type="date" max={getToday()} value={value.date} onChange={(event) => onChange({ ...value, date: event.target.value })} /></Field>
    <Field label="Hasil jual kotor (Rp)"><CurrencyInput required value={value.grossProceedsIdr} onChange={(grossValue) => onChange({ ...value, grossProceedsIdr: grossValue })} /></Field>
    <Field label="Biaya transaksi (Rp)"><CurrencyInput value={value.feeIdr} onChange={(feeValue) => onChange({ ...value, feeIdr: feeValue })} /></Field>

    {isCrypto && <>
      <div className="crypto-form-intro wide"><strong>Penjualan {cryptoSymbol}</strong><span>Masukkan total Rupiah sebelum biaya dan harga dalam USD saat transaksi terjadi. Jumlah yang terjual dihitung otomatis.</span></div>
      <Field label={`Harga ${cryptoSymbol} saat jual (USD)`}><UsdInput required value={value.cryptoSalePriceUsd} onChange={(cryptoSalePriceUsd) => onChange({ ...value, cryptoSalePriceUsd })} /></Field>
      <Field label="Kurs USD ke Rupiah"><CurrencyInput required value={value.usdIdrRateAtSale || automaticRate || ""} onChange={(usdIdrRateAtSale) => onChange({ ...value, usdIdrRateAtSale })} placeholder="16.000" /></Field>
      {bitcoinQuote
        ? <div className="crypto-calculation wide" aria-live="polite"><span>Referensi live: {cryptoSymbol} {formatUsd(bitcoinQuote.priceUsd)} · kurs {formatCurrency(automaticRate)}</span><strong>{cryptoSale ? `${formatCryptoQuantity(cryptoSale.quantitySold)} ${cryptoSymbol} terjual` : "Isi hasil jual dan harga USD"}</strong><small>Harga dan kurs transaksi tetap bisa kamu koreksi sesuai bukti penjualan.</small></div>
        : <div className="crypto-load-state wide" role={bitcoinError ? "alert" : "status"}>{bitcoinError || (bitcoinLoading ? `Memuat referensi harga ${cryptoSymbol} dan kurs...` : "Referensi live belum tersedia. Kurs masih bisa diisi manual.")}<button type="button" className="market-refresh" onClick={onRefreshBitcoin} disabled={bitcoinLoading}>{bitcoinLoading ? "Memuat..." : "Muat ulang"}</button></div>}
      {hasCalculationInput && !cryptoSale && <p className="form-note warning wide">Perhitungan melebihi jumlah {cryptoSymbol} yang dimiliki atau salah satu angka belum valid.</p>}
    </>}

    {selectedAsset && !isCrypto && <>
      <Field label="Nilai aset yang dilepas (Rp)"><CurrencyInput required value={value.bookValueRemovedIdr} onChange={(bookValue) => onChange({ ...value, bookValueRemovedIdr: bookValue })} /></Field>
      <p className="field-hint wide">Nilai ini mengurangi catatan aset, sedangkan hasil jual bersih masuk ke rekening penerima.</p>
    </>}

    <Field label="Catatan" wide><input value={value.note} onChange={(event) => onChange({ ...value, note: event.target.value })} placeholder={isCrypto ? `Contoh: jual ${cryptoSymbol} sebagian` : "Contoh: jual kendaraan"} /></Field>
    {state.accounts.length === 0 && <p className="form-note warning wide">Tambahkan rekening, kas, atau e-wallet penerima sebelum mencatat penjualan.</p>}

    {selectedAsset && hasCalculationInput && (cryptoSale || manualSaleValid) && <div className="sale-preview wide" aria-live="polite">
      <p>Pratinjau penjualan</p>
      <div><span>Masuk ke rekening</span><strong>{formatCurrency(netProceedsIdr)}</strong></div>
      {cryptoSale && <div><span>{cryptoSymbol} tersisa</span><strong>{formatCryptoQuantity(cryptoSale.remainingQuantity)} {cryptoSymbol}</strong></div>}
      <div><span>Nilai aset tersisa</span><strong>{formatCurrency(remainingAssetValue)}</strong></div>
      <div><span>Modal/nilai yang dilepas</span><strong>{formatCurrency(cryptoSale?.costBasisRemovedIdr ?? bookValueRemovedIdr)}</strong></div>
      <div><span>Untung/rugi terealisasi</span><strong className={realizedGainIdr > 0 ? "positive" : realizedGainIdr < 0 ? "negative" : "neutral"}>{realizedGainIdr > 0 ? "+" : realizedGainIdr < 0 ? "−" : ""}{formatCurrency(Math.abs(realizedGainIdr))}</strong></div>
      {feeIdr > 0 && <small>Hasil kotor {formatCurrency(grossProceedsIdr)} dikurangi biaya {formatCurrency(feeIdr)}.</small>}
    </div>}
    <p className="field-hint wide">Penjualan menambah saldo rekening sebesar hasil bersih dan mengurangi kepemilikan aset. Harga publik kripto hanya dipakai sebagai referensi.</p>
  </div>;
}

function TransactionForm({ state, value, onChange, otherCategoryName, onOtherCategoryNameChange, transferOnly = false }: { state: AppState; value: Transaction; onChange: (value: Transaction) => void; otherCategoryName: string; onOtherCategoryNameChange: (value: string) => void; transferOnly?: boolean }) {
  if (transferOnly) {
    const sourceAccount = state.accounts.find((item) => item.id === value.accountId);
    const targetAccount = state.accounts.find((item) => item.id === value.toAccountId);
    return <div className="form-grid"><p className="form-note transfer-note wide">Transfer internal antar rekening. Saldo sumber berkurang, saldo tujuan bertambah, tanpa dihitung sebagai pemasukan atau pengeluaran.</p><Field label="Tanggal"><input type="date" required value={value.date} onChange={(event) => onChange({ ...value, kind: "transfer", date: event.target.value })} /></Field><Field label="Nominal (Rp)"><CurrencyInput required value={value.amount || ""} onChange={(rawValue) => onChange({ ...value, kind: "transfer", amount: rawValue ? Number(rawValue) : 0 })} /></Field><Field label="Saldo sumber"><select required value={value.accountId} onChange={(event) => onChange({ ...value, kind: "transfer", accountId: event.target.value, toAccountId: event.target.value === value.toAccountId ? "" : value.toAccountId })}><option value="">Pilih saldo sumber</option>{state.accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Saldo tujuan"><select required value={value.toAccountId ?? ""} onChange={(event) => onChange({ ...value, kind: "transfer", toAccountId: event.target.value })}><option value="">Pilih saldo tujuan</option>{state.accounts.filter((item) => item.id !== value.accountId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{sourceAccount && targetAccount && value.amount > 0 && <p className="field-hint wide" aria-live="polite">{sourceAccount.name} berkurang {formatCurrency(value.amount)} · {targetAccount.name} bertambah {formatCurrency(value.amount)}.</p>}<Field label="Catatan" wide><input value={value.note ?? ""} onChange={(event) => onChange({ ...value, kind: "transfer", note: event.target.value })} placeholder="Contoh: Top up OVO dari BCA" /></Field></div>;
  }
  const categories = state.categories.filter((category) => category.kind === (value.kind === "income" || value.kind === "assetSale" ? "income" : "expense"));
  return <div className="form-grid"><Field label="Jenis"><select value={value.kind} onChange={(event) => onChange({ ...value, kind: event.target.value as TransactionKind, categoryId: undefined, assetId: undefined, assetValue: undefined })}>{(["expense", "income", "transfer", "debtPayment"] as TransactionKind[]).map((item) => <option key={item} value={item}>{kindLabel(item)}</option>)}</select></Field><Field label="Tanggal"><input required type="date" value={value.date} onChange={(event) => onChange({ ...value, date: event.target.value })} /></Field>{value.date > getToday() && <p className="field-hint wide">Ini transaksi terjadwal untuk masa depan. Saldo hari ini tidak diblokir; transaksi akan memengaruhi saldo pada periodenya.</p>}<Field label="Nominal (Rp)"><CurrencyInput required value={value.amount || ""} onChange={(rawValue) => onChange({ ...value, amount: rawValue ? Number(rawValue) : 0 })} /></Field><Field label="Rekening sumber"><select required value={value.accountId} onChange={(event) => onChange({ ...value, accountId: event.target.value })}><option value="">Pilih rekening</option>{state.accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{value.kind === "transfer" && <Field label="Rekening tujuan"><select required value={value.toAccountId ?? ""} onChange={(event) => onChange({ ...value, toAccountId: event.target.value })}><option value="">Pilih rekening tujuan</option>{state.accounts.filter((item) => item.id !== value.accountId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}{value.kind !== "transfer" && <Field label="Kategori"><select value={value.categoryId ?? ""} onChange={(event) => onChange({ ...value, categoryId: event.target.value })}><option value="">Tanpa kategori</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.id === "cat-other" ? "Lainnya - ketik sendiri" : item.name}</option>)}</select></Field>}{value.kind === "expense" && value.categoryId === "cat-other" && <><Field label="Nama kategori lainnya" wide><input required autoFocus value={otherCategoryName} onChange={(event) => onOtherCategoryNameChange(event.target.value)} placeholder="Contoh: Hewan peliharaan" /></Field><p className="field-hint wide">Kategori ini akan tersimpan dan muncul lagi di transaksi, anggaran, laporan, serta backup.</p></>}{value.kind === "debtPayment" && <><Field label="Utang"><select required value={value.liabilityId ?? ""} onChange={(event) => onChange({ ...value, liabilityId: event.target.value })}><option value="">Pilih utang</option>{state.liabilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Bagian pokok (Rp)"><CurrencyInput value={value.principal ?? ""} onChange={(rawValue) => onChange({ ...value, principal: rawValue === "" ? undefined : Number(rawValue) })} /></Field><Field label="Bunga/biaya (Rp)"><CurrencyInput value={value.interest ?? ""} onChange={(rawValue) => onChange({ ...value, interest: rawValue === "" ? undefined : Number(rawValue) })} /></Field></>}<Field label="Catatan" wide><input value={value.note ?? ""} onChange={(event) => onChange({ ...value, note: event.target.value })} placeholder="Contoh: makan siang kantor" /></Field></div>;
}

function AccountForm({ value, onChange }: { value: { name: string; type: Account["type"]; openingBalance: string }; onChange: (value: { name: string; type: Account["type"]; openingBalance: string }) => void }) { return <div className="form-grid"><Field label="Nama rekening" wide><input autoFocus required value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="Contoh: BCA Utama" /></Field><Field label="Jenis"><select value={value.type} onChange={(event) => onChange({ ...value, type: event.target.value as Account["type"] })}><option value="bank">Bank</option><option value="cash">Tunai</option><option value="ewallet">E-wallet</option></select></Field><Field label="Saldo awal (Rp)"><CurrencyInput required value={value.openingBalance} onChange={(openingBalance) => onChange({ ...value, openingBalance })} /></Field></div>; }

function AssetForm({ value, existingAsset, onChange, bitcoinQuote, bitcoinLoading, bitcoinError, onRefreshBitcoin }: {
  value: AssetDraft;
  existingAsset: Asset | null;
  onChange: (value: AssetDraft) => void;
  bitcoinQuote: CryptoMarketQuote | null;
  bitcoinLoading: boolean;
  bitcoinError: string;
  onRefreshBitcoin: () => void;
}) {
  const isCrypto = value.marketMode !== "manual";
  const symbol = value.marketMode !== "manual" ? CRYPTO_SYMBOLS[value.marketMode] : "";
  const modalIdr = Number(value.value || 0);
  const purchasePriceUsd = Number(value.bitcoinPurchasePriceUsd || 0);
  const usdIdrRate = bitcoinQuote ? getUsdIdrRate(bitcoinQuote) : 0;
  const keepsExistingHolding = existingAsset?.market?.coinId === value.marketMode;
  const quantity = keepsExistingHolding ? existingAsset.market!.quantity : bitcoinQuote ? calculateCryptoQuantity(modalIdr, purchasePriceUsd, usdIdrRate) : 0;

  function changeMarketMode(marketMode: AssetDraft["marketMode"]) {
    onChange({
      ...value,
      marketMode,
      name: marketMode === "bitcoin" || marketMode === "ethereum" ? CRYPTO_SYMBOLS[marketMode] : marketMode === "tether" ? value.name || "USDT Gate" : value.name,
      type: marketMode !== "manual" ? "investment" : value.type,
      liquid: marketMode !== "manual" ? true : value.liquid,
      daysToCash: marketMode !== "manual" ? "3" : value.daysToCash,
      bitcoinPurchasePriceUsd: marketMode === "tether" && !value.bitcoinPurchasePriceUsd ? "1" : value.bitcoinPurchasePriceUsd,
    });
  }

  return <div className="form-grid">
    <Field label="Cara nilai aset" wide>
      <select value={value.marketMode} onChange={(event) => changeMarketMode(event.target.value as AssetDraft["marketMode"])}>
        <option value="manual">Nilai diisi manual</option>
        <option value="bitcoin">Bitcoin (BTC) dengan harga live</option>
        <option value="ethereum">Ethereum (ETH) dengan harga live</option>
        <option value="tether">Tether (USDT) dengan harga live</option>
      </select>
    </Field>

    {isCrypto ? <>
      <div className="crypto-form-intro wide"><strong>{symbol} dengan harga live</strong><span>Modal dicatat dalam Rupiah. Harga beli rata-rata dalam USD dipakai untuk menghitung jumlah awal.</span></div>
      <Field label="Nama aset" wide><input required value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder={symbol === "USDT" ? "USDT Gate" : symbol} /></Field>
      <Field label={existingAsset?.market ? "Nilai tercatat (Rp)" : "Modal beli (Rp)"}><CurrencyInput required value={value.value} onChange={(nextValue) => onChange({ ...value, value: nextValue })} /></Field>
      {existingAsset?.market && <p className="field-hint wide">Modal historis termasuk biaya transaksi tetap tersimpan selama nilai tercatat tidak diubah.</p>}
      <Field label={`Harga ${symbol} saat beli (USD)`}><UsdInput required value={value.bitcoinPurchasePriceUsd} onChange={(bitcoinPurchasePriceUsd) => onChange({ ...value, bitcoinPurchasePriceUsd })} /></Field>
      {bitcoinQuote
        ? <div className="crypto-calculation wide" aria-live="polite"><span>Kurs otomatis USD/IDR: {formatCurrency(Math.round(usdIdrRate))}</span><strong>{quantity > 0 ? `${formatCryptoQuantity(quantity)} ${symbol}` : "Isi modal dan harga beli"}</strong><small>Harga {symbol} sekarang {formatUsd(bitcoinQuote.priceUsd)} dari CoinGecko. Pembaruan {formatMarketTime(bitcoinQuote.updatedAt)}.</small></div>
        : <div className="crypto-load-state wide" role={bitcoinError ? "alert" : "status"}>{bitcoinError || (bitcoinLoading ? `Memuat kurs dan harga ${symbol}...` : `Harga ${symbol} belum tersedia.`)}{keepsExistingHolding && <small>Detail aset ini tetap bisa disimpan dengan jumlah kripto yang sudah tercatat.</small>}<button type="button" className="market-refresh" onClick={onRefreshBitcoin} disabled={bitcoinLoading}>{bitcoinLoading ? "Memuat..." : "Muat ulang"}</button></div>}
      <p className="field-hint wide">Nilai aset setelah disimpan mengikuti harga publik {symbol}. Jumlah kepemilikan tetap tersimpan hanya di browser ini.</p>
    </> : <>
      <Field label="Nama aset" wide><input autoFocus required value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="Contoh: Reksa dana pasar uang" /></Field>
      <Field label="Jenis"><select value={value.type} onChange={(event) => { const type = event.target.value as Asset["type"]; onChange({ ...value, type, liquid: type === "property" ? false : value.liquid }); }}><option value="investment">Investasi</option><option value="vehicle">Kendaraan</option><option value="property">Properti</option><option value="other">Aset lain</option></select></Field>
      <Field label="Nilai saat ini (Rp)"><CurrencyInput required value={value.value} onChange={(nextValue) => onChange({ ...value, value: nextValue })} /></Field>
      <label className="check-field"><input type="checkbox" checked={value.liquid} disabled={value.type === "property"} onChange={(event) => onChange({ ...value, liquid: event.target.checked })} /><span>Aset likuid{value.type === "property" ? " - properti selalu non-likuid" : ""}</span></label>
      {value.liquid && <Field label="Waktu pencairan (hari)"><input type="number" min="0" value={value.daysToCash} onChange={(event) => onChange({ ...value, daysToCash: event.target.value })} /></Field>}
    </>}
  </div>;
}

function CryptoReconcileForm({ asset, value, onChange, quote }: { asset: Asset | null; value: CryptoReconcileDraft; onChange: (value: CryptoReconcileDraft) => void; quote: CryptoMarketQuote | null }) {
  if (!asset?.market) return <p className="form-note warning">Aset kripto tidak ditemukan.</p>;
  const actualQuantity = Number(value.actualQuantity || 0);
  const proportionalCostBasis = asset.market.quantity > 0 ? asset.market.costBasisIdr * (actualQuantity / asset.market.quantity) : 0;
  const effectiveCostBasis = value.remainingCostBasisIdr === "" ? proportionalCostBasis : Number(value.remainingCostBasisIdr || 0);
  const liveValue = quote ? actualQuantity * quote.priceIdr : null;
  return <div className="form-grid">
    <div className="conversion-summary wide"><p className="eyebrow">SALDO TERCATAT</p><div><span>{asset.name}</span><strong>{formatCryptoQuantity(asset.market.quantity)} {asset.market.symbol}</strong></div><small>Modal tersisa {formatCurrency(asset.market.costBasisIdr)}</small></div>
    <Field label={`Jumlah aktual ${asset.market.symbol}`} wide><input autoFocus required type="number" min="0" step="0.00000001" value={value.actualQuantity} onChange={(event) => onChange({ ...value, actualQuantity: event.target.value })} /></Field>
    <Field label="Modal tersisa (Rp), opsional" wide><CurrencyInput value={value.remainingCostBasisIdr} onChange={(remainingCostBasisIdr) => onChange({ ...value, remainingCostBasisIdr })} placeholder={String(Math.round(proportionalCostBasis))} /></Field>
    <div className="conversion-preview wide" aria-live="polite"><p>Setelah dicocokkan</p><div><span>Jumlah tersimpan</span><strong>{formatCryptoQuantity(actualQuantity)} {asset.market.symbol}</strong></div><div><span>Modal tersisa</span><strong>{formatCurrency(effectiveCostBasis)}</strong></div>{liveValue !== null && <div><span>Nilai live saat ini</span><strong>{formatCurrency(liveValue)}</strong></div>}<small>Jika modal tersisa dikosongkan, Neraca menyesuaikannya secara proporsional dari modal lama.</small></div>
    <Field label="Tanggal pengecekan"><input required type="date" max={getToday()} value={value.date} onChange={(event) => onChange({ ...value, date: event.target.value })} /></Field>
    <Field label="Catatan"><input value={value.note} onChange={(event) => onChange({ ...value, note: event.target.value })} placeholder="Contoh: saldo Pintu pukul 23.04" /></Field>
    <p className="field-hint wide">Rekonsiliasi tidak membuat transaksi jual atau beli dan tidak mengubah saldo IDR. Gunakan ini untuk membetulkan histori lama yang tidak lengkap.</p>
  </div>;
}

function LiabilityForm({ value, onChange }: { value: { name: string; type: Liability["type"]; remainingPrincipal: string; monthlyPayment: string; interestRate: string; dueDay: string }; onChange: (value: { name: string; type: Liability["type"]; remainingPrincipal: string; monthlyPayment: string; interestRate: string; dueDay: string }) => void }) { return <div className="form-grid"><Field label="Nama utang" wide><input autoFocus required value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="Contoh: Kartu kredit BCA" /></Field><Field label="Jenis"><select value={value.type} onChange={(event) => onChange({ ...value, type: event.target.value as Liability["type"] })}><option value="creditCard">Kartu kredit</option><option value="paylater">Paylater</option><option value="vehicle">Kendaraan</option><option value="mortgage">KPR</option><option value="personal">Pribadi</option><option value="other">Lainnya</option></select></Field><Field label="Sisa pokok (Rp)"><CurrencyInput required value={value.remainingPrincipal} onChange={(remainingPrincipal) => onChange({ ...value, remainingPrincipal })} /></Field><Field label="Cicilan per bulan (Rp)"><CurrencyInput value={value.monthlyPayment} onChange={(monthlyPayment) => onChange({ ...value, monthlyPayment })} /></Field><Field label="Bunga tahunan (%)"><input type="number" min="0" step="0.01" value={value.interestRate} onChange={(event) => onChange({ ...value, interestRate: event.target.value })} placeholder="0" /></Field><Field label="Jatuh tempo (tanggal)"><input type="number" min="1" max="31" value={value.dueDay} onChange={(event) => onChange({ ...value, dueDay: event.target.value })} placeholder="Opsional" /></Field></div>; }

function BudgetForm({ state, value, onChange, otherCategoryName, onOtherCategoryNameChange }: { state: AppState; value: { categoryId: string; amount: string; mode: "single" | "recurring"; startMonth: string; active: boolean }; onChange: (value: { categoryId: string; amount: string; mode: "single" | "recurring"; startMonth: string; active: boolean }) => void; otherCategoryName: string; onOtherCategoryNameChange: (value: string) => void }) { return <div className="form-grid"><Field label="Kategori"><select autoFocus value={value.categoryId} onChange={(event) => onChange({ ...value, categoryId: event.target.value })}>{state.categories.filter((item) => item.kind === "expense").map((item) => <option key={item.id} value={item.id}>{item.id === "cat-other" ? "Lainnya - ketik sendiri" : item.name}</option>)}</select></Field>{value.categoryId === "cat-other" && <><Field label="Nama kategori lainnya" wide><input required autoFocus value={otherCategoryName} onChange={(event) => onOtherCategoryNameChange(event.target.value)} placeholder="Contoh: Hewan peliharaan" /></Field><p className="field-hint wide">Kategori ini akan tersimpan dan muncul lagi di transaksi, anggaran, laporan, serta backup.</p></>}<Field label="Batas bulanan (Rp)"><CurrencyInput required value={value.amount} onChange={(amount) => onChange({ ...value, amount })} /></Field>{value.mode === "recurring" && <><Field label="Mulai dari bulan"><input required type="month" value={value.startMonth} onChange={(event) => onChange({ ...value, startMonth: event.target.value })} /></Field><label className="check-field"><input type="checkbox" checked={value.active} onChange={(event) => onChange({ ...value, active: event.target.checked })} /><span>Aktifkan pola anggaran ini</span></label><p className="field-hint wide">Pola mulai dari bulan yang dipilih dan tidak menimpa anggaran manual yang sudah ada. Gunakan “Buat bulan ini” untuk menerapkannya.</p></>}</div>; }

function RecurringForm({ state, value, onChange }: { state: AppState; value: RecurringDraft; onChange: (value: RecurringDraft) => void }) {
  const categories = state.categories.filter((category) => category.kind === value.kind);
  return <div className="form-grid"><Field label="Nama pola" wide><input autoFocus required value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="Contoh: Kos bulanan" /></Field><Field label="Jenis"><select value={value.kind} onChange={(event) => onChange({ ...value, kind: event.target.value as RecurringDraft["kind"], categoryId: "" })}><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></Field><Field label="Nominal (Rp)"><CurrencyInput required value={value.amount} onChange={(amount) => onChange({ ...value, amount })} /></Field><Field label="Rekening"><select required value={value.accountId} onChange={(event) => onChange({ ...value, accountId: event.target.value })}><option value="">Pilih rekening</option>{state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Kategori"><select value={value.categoryId} onChange={(event) => onChange({ ...value, categoryId: event.target.value })}><option value="">Tanpa kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Field label="Tanggal tiap bulan"><input required type="number" min="1" max="31" value={value.dayOfMonth} onChange={(event) => onChange({ ...value, dayOfMonth: event.target.value })} /></Field><Field label="Mulai dari bulan"><input required type="month" value={value.startMonth} onChange={(event) => onChange({ ...value, startMonth: event.target.value })} /></Field><label className="check-field"><input type="checkbox" checked={value.active} onChange={(event) => onChange({ ...value, active: event.target.checked })} /><span>Aktifkan pola ini</span></label><Field label="Catatan" wide><input value={value.note} onChange={(event) => onChange({ ...value, note: event.target.value })} placeholder="Opsional" /></Field><p className="field-hint wide">Pola hanya dibuat mulai bulan yang kamu pilih. Mengubah pola akan memperbarui transaksi otomatis yang belum kamu ubah manual. Duplikat bulan yang sama tidak akan dibuat.</p></div>;
}

function ReconcileForm({ state, month, value, onChange }: { state: AppState; month: string; value: ReconcileDraft; onChange: (value: ReconcileDraft) => void }) {
  void month;
  const recordedBalance = getAccountBalances(state, value.date)[value.accountId] ?? 0;
  const actualBalance = value.actualBalance === "" ? null : Number(value.actualBalance);
  const difference = actualBalance === null ? null : actualBalance - recordedBalance;
  return <div className="form-grid"><Field label="Rekening" wide><select autoFocus required value={value.accountId} onChange={(event) => onChange({ ...value, accountId: event.target.value })}><option value="">Pilih rekening</option>{state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><div className="reconcile-preview wide"><span>Menurut Neraca</span><strong>{formatCurrency(recordedBalance)}</strong></div><Field label="Saldo aktual (Rp)" wide><CurrencyInput required value={value.actualBalance} onChange={(actualBalance) => onChange({ ...value, actualBalance })} /></Field>{difference !== null && <div className={`reconcile-difference wide ${difference === 0 ? "matched" : "mismatch"}`}><span>{difference === 0 ? "Saldo cocok" : difference > 0 ? "Saldo aktual lebih besar" : "Saldo aktual lebih kecil"}</span><strong>{difference === 0 ? "Tidak ada selisih" : formatCurrency(Math.abs(difference))}</strong></div>}<label className="check-field wide"><input type="checkbox" checked={value.applyCorrection} onChange={(event) => onChange({ ...value, applyCorrection: event.target.checked })} /><span>Sesuaikan saldo Neraca ke saldo aktual</span></label>{value.applyCorrection && <p className="form-note warning wide">Koreksi berlaku mulai tanggal pengecekan dan tidak dihitung sebagai pemasukan atau pengeluaran.</p>}<Field label="Tanggal pengecekan"><input required type="date" max={getToday()} value={value.date} onChange={(event) => onChange({ ...value, date: event.target.value })} /></Field><Field label="Catatan"><input value={value.note} onChange={(event) => onChange({ ...value, note: event.target.value })} placeholder="Contoh: saldo Pintu pukul 23.04" /></Field></div>;
}

function GoalForm({ state, value, onChange }: { state: AppState; value: GoalDraft; onChange: (value: GoalDraft) => void }) {
  const metrics = calculateMetrics(state);
  const sourceAccount = value.sourceType === "account" ? state.accounts.find((item) => item.id === value.sourceId) : undefined;
  const sourceAsset = value.sourceType === "asset" ? state.assets.find((item) => item.id === value.sourceId) : undefined;
  const sourceAmount = sourceAccount ? Math.max(0, metrics.accountBalances[sourceAccount.id] ?? 0) : Math.max(0, sourceAsset?.value ?? 0);
  const sourceLabel = sourceAccount ? "Saldo " + sourceAccount.name : sourceAsset ? "Nilai " + sourceAsset.name : "Pilih sumber progres";
  return <div className="form-grid"><Field label="Nama target" wide><input autoFocus required value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="Contoh: Dana darurat" /></Field><Field label="Target nominal (Rp)"><CurrencyInput required value={value.targetAmount} onChange={(targetAmount) => onChange({ ...value, targetAmount })} /></Field><Field label="Sumber progres" wide><select value={value.sourceType} onChange={(event) => onChange({ ...value, sourceType: event.target.value as GoalSourceType, sourceId: "", currentAmount: "" })}><option value="manual">Isi manual</option><option value="account">Ikuti saldo rekening</option><option value="asset">Ikuti nilai aset</option></select></Field>{value.sourceType === "account" && <Field label="Rekening sumber" wide><select required value={value.sourceId} onChange={(event) => onChange({ ...value, sourceId: event.target.value })}><option value="">Pilih rekening</option>{state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field>}{value.sourceType === "asset" && <Field label="Aset sumber" wide><select required value={value.sourceId} onChange={(event) => onChange({ ...value, sourceId: event.target.value })}><option value="">Pilih aset</option>{state.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></Field>}{value.sourceType === "manual" ? <Field label="Sudah terkumpul (Rp)"><CurrencyInput value={value.currentAmount} onChange={(currentAmount) => onChange({ ...value, currentAmount })} /></Field> : <div className="goal-source-preview wide" aria-live="polite"><span>{sourceLabel}</span><strong>{formatCurrency(sourceAmount)}</strong><small>Progres mengikuti nilai sumber ini dan diperbarui otomatis saat saldo atau aset berubah.</small></div>}<Field label="Tanggal target"><input type="date" value={value.targetDate} onChange={(event) => onChange({ ...value, targetDate: event.target.value })} /></Field><Field label="Catatan"><input value={value.note} onChange={(event) => onChange({ ...value, note: event.target.value })} placeholder="Opsional" /></Field><p className="field-hint wide">Sumber progres tidak memindahkan uang. Ia hanya membantu membaca progres target dari rekening atau aset yang dipilih.</p></div>;
}
