const DATABASE_NAME = 'kaito-private';
const STORE_NAME = 'secrets';
let database: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    database = undefined;
    throw error;
  });
  return database;
}

async function transact<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error ?? request.error);
    transaction.onerror = () => reject(transaction.error ?? request.error);
  });
}

export function readPrivateValue<T>(key: string): Promise<T | undefined> {
  return transact('readonly', (store) => store.get(key));
}

export async function writePrivateValue(key: string, value: unknown): Promise<void> {
  await transact('readwrite', (store) => store.put(value, key));
}

export async function removePrivateValue(key: string): Promise<void> {
  await transact('readwrite', (store) => store.delete(key));
}
