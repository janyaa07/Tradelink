import { MemoryOutboxStorage, sortBySeq, type OutboxStorage, type QueuedItem } from "./outbox";

const DB_NAME = "tradelink-ai-outbox";
const DB_VERSION = 1;
const STORE = "items";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "clientId" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Let a newer version of the app upgrade the database from another tab.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("The outbox database is open in an older tab."));
  });
}

/**
 * The outbox in IndexedDB, keyed by client id so duplicates are refused by the store itself.
 * Each write resolves only once its transaction commits. When IndexedDB cannot be opened (some
 * private browsing modes), it keeps the queue in memory for this page instead.
 */
export class IndexedDbOutboxStorage implements OutboxStorage {
  private database: Promise<IDBDatabase | null> | null = null;
  private readonly fallback = new MemoryOutboxStorage();

  private db(): Promise<IDBDatabase | null> {
    this.database ??= openDatabase().catch(() => null);
    return this.database;
  }

  private async write(change: (store: IDBObjectStore) => IDBRequest, ignore?: string): Promise<boolean> {
    const db = await this.db();
    if (!db) throw new Error("The outbox database is not available.");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      let applied = true;
      const request = change(transaction.objectStore(STORE));
      request.onerror = (event) => {
        if (request.error?.name === ignore) {
          // Keep the transaction alive: a refused duplicate is an answer, not a failure.
          event.preventDefault();
          applied = false;
        }
      };
      transaction.oncomplete = () => resolve(applied);
      transaction.onerror = () => reject(transaction.error ?? request.error);
      transaction.onabort = () => reject(transaction.error ?? request.error);
    });
  }

  async add(item: QueuedItem): Promise<boolean> {
    if (!(await this.db())) return this.fallback.add(item);
    return this.write((store) => store.add(item), "ConstraintError");
  }

  async update(item: QueuedItem): Promise<void> {
    if (!(await this.db())) return this.fallback.update(item);
    await this.write((store) => store.put(item));
  }

  async remove(clientId: string): Promise<void> {
    if (!(await this.db())) return this.fallback.remove(clientId);
    await this.write((store) => store.delete(clientId));
  }

  async list(): Promise<QueuedItem[]> {
    const db = await this.db();
    if (!db) return this.fallback.list();
    const items = await new Promise<QueuedItem[]>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result as QueuedItem[]);
      request.onerror = () => reject(request.error);
    });
    return sortBySeq(items);
  }
}
