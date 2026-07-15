const DB_NAME = "amex-expense-db";
const DB_VERSION = 3;
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

async function runTx(storeName, mode, work) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Database transaction aborted"));
    result = work(store);
  });
}

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const DB = {
  async getAllRecords() {
    return runTx(STORE_RECORDS, "readonly", store => requestPromise(store.getAll()).then(v => v || []));
  },

  async getRecord(id) {
    return runTx(STORE_RECORDS, "readonly", store => requestPromise(store.get(id)));
  },

  async saveRecord(record) {
    return runTx(STORE_RECORDS, "readwrite", store => store.put(record));
  },

  async saveRecords(records) {
    if (!records.length) return;
    return runTx(STORE_RECORDS, "readwrite", store => records.forEach(record => store.put(record)));
  },

  async replaceAllRecords(records) {
    return runTx(STORE_RECORDS, "readwrite", store => {
      store.clear();
      records.forEach(record => store.put(record));
    });
  },

  async deleteRecordPermanently(id) {
    return runTx(STORE_RECORDS, "readwrite", store => store.delete(id));
  },

  async replaceRecordId(oldId, record) {
    return runTx(STORE_RECORDS, "readwrite", store => {
      store.delete(oldId);
      store.put(record);
    });
  },

  async getSetting(key, fallback) {
    return runTx(STORE_SETTINGS, "readonly", store => requestPromise(store.get(key)).then(v => v ? v.value : fallback));
  },

  async setSetting(key, value) {
    return runTx(STORE_SETTINGS, "readwrite", store => store.put({ key, value }));
  }
};
