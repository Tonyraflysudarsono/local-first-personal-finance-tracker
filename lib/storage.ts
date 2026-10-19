import { AppState, emptyState, ensureCurrentSnapshot, normalizeImportedState } from "./finance";

const DB_NAME = "neraca-pribadi";
const DB_VERSION = 4;
const STORES = ["settings", "categories", "accounts", "transactions", "recurringTransactions", "assets", "assetValuations", "liabilities", "budgets", "recurringBudgets", "snapshots", "reconciliations", "goals"] as const;

type StoreName = (typeof STORES)[number];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Database lokal tidak dapat dibuka."));
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const storeName of STORES) {
        if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function readAll<T>(database: IDBDatabase, storeName: StoreName): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onerror = () => reject(request.error ?? new Error("Data lokal tidak dapat dibaca."));
    request.onsuccess = () => resolve(request.result as T[]);
  });
}

export async function loadState(): Promise<AppState> {
  if (typeof indexedDB === "undefined") return emptyState();
  const database = await openDatabase();
  try {
    const [settings, categories, accounts, transactions, recurringTransactions, assets, assetValuations, liabilities, budgets, recurringBudgets, snapshots, reconciliations, goals] = await Promise.all(
      STORES.map((storeName) => readAll<unknown>(database, storeName)),
    );
    const persisted = {
      version: 1 as const,
      settings: settings[0] ?? { id: "settings", currency: "IDR", monthStartDay: 1 },
      categories,
      accounts,
      transactions,
      recurringTransactions,
      assets,
      assetValuations,
      liabilities,
      budgets,
      recurringBudgets,
      snapshots,
      reconciliations,
      goals,
    } as AppState;
    return normalizeImportedState(persisted);
  } finally {
    database.close();
  }
}

async function saveStateNow(input: AppState): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const state = ensureCurrentSnapshot(input);
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([...STORES], "readwrite");
      transaction.onerror = () => reject(transaction.error ?? new Error("Data lokal tidak dapat disimpan."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Penyimpanan lokal dibatalkan."));
      transaction.oncomplete = () => resolve();
      for (const storeName of STORES) transaction.objectStore(storeName).clear();
      transaction.objectStore("settings").put({ id: "settings", ...state.settings });
      for (const item of state.categories) transaction.objectStore("categories").put(item);
      for (const item of state.accounts) transaction.objectStore("accounts").put(item);
      for (const item of state.transactions) transaction.objectStore("transactions").put(item);
      for (const item of state.recurringTransactions) transaction.objectStore("recurringTransactions").put(item);
      for (const item of state.assets) transaction.objectStore("assets").put(item);
      for (const item of state.assetValuations) transaction.objectStore("assetValuations").put(item);
      for (const item of state.liabilities) transaction.objectStore("liabilities").put(item);
      for (const item of state.budgets) transaction.objectStore("budgets").put(item);
      for (const item of state.recurringBudgets) transaction.objectStore("recurringBudgets").put(item);
      for (const item of state.snapshots) transaction.objectStore("snapshots").put(item);
      for (const item of state.reconciliations) transaction.objectStore("reconciliations").put(item);
      for (const item of state.goals) transaction.objectStore("goals").put(item);
    });
  } finally {
    database.close();
  }
}

let saveQueue: Promise<void> = Promise.resolve();

export function saveState(input: AppState): Promise<void> {
  const operation = saveQueue.then(() => saveStateNow(input));
  saveQueue = operation.catch(() => undefined);
  return operation;
}

export function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function serializeState(state: AppState): string {
  return JSON.stringify(ensureCurrentSnapshot(state), null, 2);
}

export async function parseBackup(file: File): Promise<AppState> {
  return normalizeImportedState(JSON.parse(await file.text()));
}
