const dbName = "tenra-desktop-store";
const storeName = "json-records";

type StoreRow<T> = {
  key: string;
  updatedAt: string;
  value: T;
};

const openStore = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Desktop store could not open."));
  });

export const readDesktopStore = async <T>(key: string): Promise<T | null> => {
  if (typeof indexedDB === "undefined") return null;

  const db = await openStore();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);

    request.onsuccess = () => {
      const row = request.result as StoreRow<T> | undefined;
      resolve(row?.value ?? null);
    };
    request.onerror = () => reject(request.error ?? new Error("Desktop store read failed."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Desktop store read failed."));
  });
};

export const writeDesktopStore = async <T>(key: string, value: T): Promise<void> => {
  if (typeof indexedDB === "undefined") return;

  const db = await openStore();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put({
      key,
      updatedAt: new Date().toISOString(),
      value
    } satisfies StoreRow<T>);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error ?? new Error("Desktop store write failed."));
  });
};

export const readLegacyLocalStorage = <T>(key: string): T | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
