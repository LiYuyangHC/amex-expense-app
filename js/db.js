const DB_NAME = "amex-expense-db";
const DB_VERSION = 1;
const STORE_RECORDS = "records";
const STORE_SETTINGS = "settings";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        const store = db.createObjectStore(STORE_RECORDS, { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx(storeName, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    result = callback(store);
  });
}

const DB = {
  async getAllRecords() {
    return tx(STORE_RECORDS, "readonly", store => new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }));
  },

  async saveRecord(record) {
    return tx(STORE_RECORDS, "readwrite", store => store.put(record));
  },

  async deleteRecord(id) {
    return tx(STORE_RECORDS, "readwrite", store => store.delete(id));
  },

  async getSetting(key, fallback) {
    return tx(STORE_SETTINGS, "readonly", store => new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
      req.onerror = () => reject(req.error);
    }));
  },

  async setSetting(key, value) {
    return tx(STORE_SETTINGS, "readwrite", store => store.put({ key, value }));
  }
};
