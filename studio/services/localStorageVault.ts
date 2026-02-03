export interface VaultFile {
  id: string;
  userId: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  data: Blob;
}

const DB_NAME = 'droidforge_storage_v1';
const STORE = 'files';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('userId', 'userId', { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const saveVaultFile = async (userId: string, file: File) => {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const record: VaultFile = {
    id: Math.random().toString(36).slice(2),
    userId,
    name: file.name,
    type: file.type,
    size: file.size,
    createdAt: Date.now(),
    data: file
  };
  store.put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return record;
};

export const listVaultFiles = async (userId: string) => {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const index = store.index('userId');
  const request = index.getAll(IDBKeyRange.only(userId));
  const result = await new Promise<VaultFile[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as VaultFile[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result.sort((a, b) => b.createdAt - a.createdAt);
};

export const deleteVaultFile = async (id: string) => {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  store.delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};

export const getVaultFile = async (id: string) => {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const request = store.get(id);
  const result = await new Promise<VaultFile | null>((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as VaultFile) || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
};

export const getVaultUsage = async (userId: string) => {
  const files = await listVaultFiles(userId);
  return files.reduce((sum, f) => sum + f.size, 0);
};
