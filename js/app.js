const $ = id => document.getElementById(id);

const els = {
  accountButton: $("accountButton"),
  profileButton: $("profileButton"),
  cycleTotal: $("cycleTotal"), monthTotal: $("monthTotal"), yearTotal: $("yearTotal"),
  cycleRange: $("cycleRange"), monthRange: $("monthRange"), yearRange: $("yearRange"),
  recordsList: $("recordsList"), refreshButton: $("refreshButton"),
  billingButton: $("billingButton"), billingLabel: $("billingLabel"),
  addButton: $("addButton"), exportButton: $("exportButton"), toast: $("toast"),

  authSheet: $("authSheet"), authCancel: $("authCancel"), authGoogle: $("authGoogle"),
  authRetrySync: $("authRetrySync"), authSignOut: $("authSignOut"),
  authMessage: $("authMessage"), authHint: $("authHint"),

  expenseSheet: $("expenseSheet"), expenseCancel: $("expenseCancel"), expenseDone: $("expenseDone"),
  sheetTitle: $("sheetTitle"), amount: $("amount"), dateButton: $("dateButton"),
  category: $("category"), note: $("note"), deleteEditingButton: $("deleteEditingButton"),

  dateSheet: $("dateSheet"), dateCancel: $("dateCancel"), dateDone: $("dateDone"),
  todayButton: $("todayButton"), dateYear: $("dateYear"), dateMonth: $("dateMonth"), dateDay: $("dateDay"),

  billingSheet: $("billingSheet"), billingCancel: $("billingCancel"), billingDone: $("billingDone"),
  billingStartDay: $("billingStartDay"), viewYear: $("viewYear"), viewMonth: $("viewMonth"),
  billingPreview: $("billingPreview"),

  accountSheet: $("accountSheet"), accountCancel: $("accountCancel"),
  accountDone: $("accountDone"), accountNameInput: $("accountNameInput")
};

let records = [];
let billingStartDay = 16;
let accountName = "建行 AMEX";
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth() + 1;
let selectedDate = new Date();
let editingId = null;
let lastSyncAt = null;
let syncHealth = "idle";
const today = new Date();

init();

async function init() {
  initStaticSelects();
  initEvents();
  updateDateButton();

  billingStartDay = Number(await DB.getSetting("billingStartDay", 16));
  accountName = await DB.getSetting("accountName", "建行 AMEX");
  viewYear = Number(await DB.getSetting("viewYear", today.getFullYear()));
  viewMonth = Number(await DB.getSetting("viewMonth", today.getMonth() + 1));
  els.accountButton.textContent = accountName;

  records = await DB.getAllRecords();
  await normalizeLocalRecords();
  records = await DB.getAllRecords();
  render();
  registerServiceWorker();

  Cloud.init();
  try {
    await Cloud.getSession();
    Cloud.onAuthStateChange(async (_event, _session, authError) => {
      if (authError) {
        syncHealth = "error";
        updateAuthUI(authError.message);
        openAuthSheet();
        return;
      }
      updateAuthUI();
      if (Cloud.isSignedIn()) await syncNow({ silent: true });
    });
    updateAuthUI();
    if (Cloud.isSignedIn()) await syncNow({ silent: true });
  } catch (error) {
    console.error(error);
    syncHealth = navigator.onLine ? "error" : "offline";
    updateAuthUI(error.message);
  }
}

function initStaticSelects() {
  const currentYear = today.getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)
    .map(y => `<option value="${y}">${y}年</option>`).join("");
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)
    .map(m => `<option value="${m}">${m}月</option>`).join("");

  els.dateYear.innerHTML = yearOptions;
  els.dateMonth.innerHTML = monthOptions;
  els.viewYear.innerHTML = yearOptions;
  els.viewMonth.innerHTML = monthOptions;
  els.billingStartDay.innerHTML = Array.from({ length: 28 }, (_, i) => i + 1)
    .map(d => `<option value="${d}">每月 ${d} 日开始</option>`).join("");
}

function initEvents() {
  els.addButton.addEventListener("click", () => openExpenseSheet());
  els.expenseCancel.addEventListener("click", closeExpenseSheet);
  els.expenseDone.addEventListener("click", saveRecord);
  els.deleteEditingButton.addEventListener("click", () => editingId && deleteRecord(editingId));

  els.dateButton.addEventListener("click", openDateSheet);
  els.dateCancel.addEventListener("click", closeDateSheet);
  els.dateDone.addEventListener("click", confirmDate);
  els.todayButton.addEventListener("click", () => { setSelectedDate(new Date()); closeDateSheet(); });
  els.dateYear.addEventListener("change", () => refreshDayOptions());
  els.dateMonth.addEventListener("change", () => refreshDayOptions());

  els.billingButton.addEventListener("click", openBillingSheet);
  els.billingCancel.addEventListener("click", closeBillingSheet);
  els.billingDone.addEventListener("click", saveBillingSettings);
  els.billingStartDay.addEventListener("change", updateBillingPreview);
  els.viewYear.addEventListener("change", updateBillingPreview);
  els.viewMonth.addEventListener("change", updateBillingPreview);

  els.exportButton.addEventListener("click", exportCSV);
  els.refreshButton.addEventListener("click", () => syncNow());

  els.accountButton.addEventListener("click", openAccountSheet);
  els.accountCancel.addEventListener("click", closeAccountSheet);
  els.accountDone.addEventListener("click", saveAccountName);

  els.profileButton.addEventListener("click", openAuthSheet);
  els.authCancel.addEventListener("click", closeAuthSheet);
  els.authGoogle.addEventListener("click", signInGoogle);
  els.authRetrySync.addEventListener("click", () => syncNow());
  els.authSignOut.addEventListener("click", signOutCloud);

  [els.expenseSheet, els.dateSheet, els.billingSheet, els.accountSheet, els.authSheet].forEach(backdrop => {
    backdrop.addEventListener("click", event => {
      if (event.target === backdrop) backdrop.classList.add("hidden");
    });
  });

  window.addEventListener("online", () => syncNow({ silent: true }));
  window.addEventListener("offline", () => { syncHealth = "offline"; updateAuthUI(); });
  window.addEventListener("focus", () => Cloud.isSignedIn() && syncNow({ silent: true }));
}

async function seedExistingRecordsOnce() {
  const done = await DB.getSetting("seededExistingRecordsV1", false);
  if (done) return;
  const now = new Date().toISOString();
  const rows = [
    ["2026-06-30","🍜餐饮",19.28,"午餐"],["2026-06-27","🍜餐饮",106,"晚餐"],
    ["2026-06-27","🎁购物",5,"头绳"],["2026-06-27","🚗交通",50,"换驾照"],
    ["2026-06-26","🍜餐饮",32.8,"晚餐 tqco"],["2026-06-24","🍜餐饮",68,"晚餐 咖喱饭"],
    ["2026-06-23","🎁购物",44,"发膜"],["2026-06-22","🎁购物",178,"移动硬盘"],
    ["2026-06-22","🍜餐饮",100,"午餐"],["2026-06-21","🍜餐饮",126.12,"晚餐"],
    ["2026-06-18","🎁购物",68.64,"眼霜"],["2026-06-16","🚗交通",98,"Uber 回波士顿"],
    ["2026-06-15","🛒买菜",150,"Trader Joe's"],["2026-06-06","🎁购物",9,"扫把"],
    ["2026-06-03","🏠房租",1550,"房租"],["2026-06-01","🎁购物",8.5,"花"],
    ["2026-05-29","🛒买菜",216.61,"Costco"],["2026-05-28","🍜餐饮",60,"生煎"],
    ["2026-05-27","🎁购物",14,"冲鼻器"],["2026-05-27","🍜餐饮",72.02,"晚餐"],
    ["2026-05-26","🎁购物",84.18,"柜子"],["2026-05-21","🏠房租",169.62,"电费"],
    ["2026-05-21","🛒买菜",39,"买菜"],["2026-05-18","🍜餐饮",138,"Eva"],
    ["2026-05-18","🛒买菜",56.74,"Trader Joe's"],["2026-05-16","🍜餐饮",6.9,"星巴克"],
    ["2026-05-15","🍜餐饮",31.24,"麦当劳"],["2026-05-15","🍜餐饮",21.3,"面包"],
    ["2026-05-13","🛒买菜",89,"买菜"],["2026-05-13","🛒买菜",128.42,"买菜"],
    ["2026-05-05","🛒买菜",93,"买菜"],["2026-05-03","🏠房租",1500,"房租"],
    ["2026-05-02","🍜餐饮",82.44,"餐饮"]
  ];
  for (const [date, category, amount, note] of rows) {
    await DB.saveRecord({
      id: makeId(), date, category, amount, note, accountName,
      createdAt: now, updatedAt: now, deleted: false, syncState: "pending"
    });
  }
  await DB.setSetting("seededExistingRecordsV1", true);
  showToast(`已连接 ${rows.length} 条历史记录`);
}

async function normalizeLocalRecords() {
  const local = await DB.getAllRecords();
  for (const record of local) {
    const normalized = {
      ...record,
      accountName: record.accountName || accountName,
      createdAt: record.createdAt || record.updatedAt || new Date().toISOString(),
      updatedAt: record.updatedAt || new Date().toISOString(),
      clientUpdatedAt: record.clientUpdatedAt || record.updatedAt || new Date().toISOString(),
      deleted: Boolean(record.deleted),
      syncState: record.syncState || "pending"
    };
    if (!isUuid(record.id)) {
      normalized.id = makeId();
      await DB.replaceRecordId(record.id, normalized);
    } else if (JSON.stringify(record) !== JSON.stringify(normalized)) {
      await DB.saveRecord(normalized);
    }
  }
}

function openExpenseSheet(record = null) {
  editingId = record?.id || null;
  els.sheetTitle.textContent = editingId ? "编辑花销" : "新增花销";
  els.expenseDone.textContent = editingId ? "更新" : "保存";
  els.deleteEditingButton.classList.toggle("hidden", !editingId);
  if (record) {
    els.amount.value = record.amount;
    els.category.value = record.category;
    els.note.value = record.note || "";
    setSelectedDate(parseDate(record.date));
  } else {
    els.amount.value = "";
    els.note.value = "";
    setSelectedDate(new Date());
  }
  els.expenseSheet.classList.remove("hidden");
  setTimeout(() => els.amount.focus(), 120);
}

function closeExpenseSheet() {
  els.expenseSheet.classList.add("hidden");
  editingId = null;
}

async function saveRecord() {
  const amount = Number(els.amount.value);
  if (!els.amount.value || !Number.isFinite(amount) || amount <= 0) return showToast("先填金额哦");
  const now = new Date().toISOString();
  const existing = editingId ? records.find(r => r.id === editingId) : null;
  const wasEditing = Boolean(editingId);
  await DB.saveRecord({
    id: editingId || makeId(),
    date: formatLocalDate(selectedDate),
    category: els.category.value,
    amount,
    note: els.note.value.trim(),
    accountName,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    clientUpdatedAt: now,
    deleted: false,
    syncState: "pending"
  });
  records = await DB.getAllRecords();
  closeExpenseSheet();
  render();
  showToast(wasEditing ? "已更新" : "已保存");
  syncNow({ silent: true });
}

async function deleteRecord(id) {
  if (!confirm("确定删除这条记录吗？")) return;
  const existing = records.find(r => r.id === id);
  if (!existing) return;
  const now = new Date().toISOString();
  await DB.saveRecord({ ...existing, deleted: true, updatedAt: now, clientUpdatedAt: now, syncState: "pending" });
  records = await DB.getAllRecords();
  closeExpenseSheet();
  render();
  showToast("已删除");
  syncNow({ silent: true });
}

function openDateSheet() {
  els.dateYear.value = selectedDate.getFullYear();
  els.dateMonth.value = selectedDate.getMonth() + 1;
  refreshDayOptions(selectedDate.getDate());
  els.dateSheet.classList.remove("hidden");
}
function closeDateSheet() { els.dateSheet.classList.add("hidden"); }
function refreshDayOptions(preferredDay) {
  const y = Number(els.dateYear.value);
  const m = Number(els.dateMonth.value);
  const days = new Date(y, m, 0).getDate();
  const current = preferredDay || Math.min(Number(els.dateDay.value || 1), days);
  els.dateDay.innerHTML = Array.from({ length: days }, (_, i) => `<option value="${i + 1}">${i + 1}日</option>`).join("");
  els.dateDay.value = String(current);
}
function confirmDate() {
  setSelectedDate(new Date(Number(els.dateYear.value), Number(els.dateMonth.value) - 1, Number(els.dateDay.value)));
  closeDateSheet();
}
function setSelectedDate(date) { selectedDate = date; updateDateButton(); }
function updateDateButton() { els.dateButton.textContent = formatChineseDate(selectedDate); }

function openBillingSheet() {
  els.billingStartDay.value = String(billingStartDay);
  els.viewYear.value = String(viewYear);
  els.viewMonth.value = String(viewMonth);
  updateBillingPreview();
  els.billingSheet.classList.remove("hidden");
}
function closeBillingSheet() { els.billingSheet.classList.add("hidden"); }
async function saveBillingSettings() {
  billingStartDay = Number(els.billingStartDay.value);
  viewYear = Number(els.viewYear.value);
  viewMonth = Number(els.viewMonth.value);
  const updatedAt = new Date().toISOString();
  await DB.setSetting("billingStartDay", billingStartDay);
  await DB.setSetting("viewYear", viewYear);
  await DB.setSetting("viewMonth", viewMonth);
  await DB.setSetting("settingsUpdatedAt", updatedAt);
  closeBillingSheet();
  render();
  showToast(`正在查看 ${viewYear}年${viewMonth}月账期`);
  syncNow({ silent: true });
}
function updateBillingPreview() {
  const startDay = Number(els.billingStartDay.value || billingStartDay);
  const year = Number(els.viewYear.value || viewYear);
  const month = Number(els.viewMonth.value || viewMonth);
  const cycle = getBillingCycleByMonth(year, month, startDay);
  els.billingPreview.textContent = `${formatChineseDate(cycle.start)} ～ ${formatChineseDate(addDays(cycle.end, -1))}`;
}

function openAccountSheet() {
  els.accountNameInput.value = accountName;
  els.accountSheet.classList.remove("hidden");
  setTimeout(() => els.accountNameInput.focus(), 120);
}
function closeAccountSheet() { els.accountSheet.classList.add("hidden"); }
async function saveAccountName() {
  accountName = els.accountNameInput.value.trim() || "建行 AMEX";
  const updatedAt = new Date().toISOString();
  await DB.setSetting("accountName", accountName);
  await DB.setSetting("settingsUpdatedAt", updatedAt);
  els.accountButton.textContent = accountName;
  closeAccountSheet();
  showToast("名称已更新");
  syncNow({ silent: true });
}

function openAuthSheet() {
  updateAuthUI();
  els.authSheet.classList.remove("hidden");
}
function closeAuthSheet() { els.authSheet.classList.add("hidden"); }
function updateAuthUI(message = "") {
  const signedIn = Cloud.isSignedIn();
  els.authGoogle.classList.toggle("hidden", signedIn);
  els.authSignOut.classList.toggle("hidden", !signedIn);
  els.authRetrySync.classList.toggle("hidden", !signedIn || syncHealth !== "error");
  els.profileButton.dataset.state = syncHealth === "error" ? "error" : (signedIn ? "signed-in" : "signed-out");

  if (message) {
    els.authMessage.textContent = message;
  } else if (signedIn) {
    els.authMessage.textContent = `已登录：${Cloud.getUser()?.email || ""}`;
  } else {
    els.authMessage.textContent = "使用你的 Google Account 登录，账单会在后台安全同步。";
  }

  if (syncHealth === "error") {
    els.authHint.textContent = "上次同步失败。本地账单仍然安全保存，可稍后重试。";
  } else if (!navigator.onLine) {
    els.authHint.textContent = "当前离线。你仍可正常记账，联网后会自动同步。";
  } else if (signedIn && lastSyncAt) {
    els.authHint.textContent = `最近同步：${lastSyncAt.toLocaleString("zh-CN")}`;
  } else {
    els.authHint.textContent = `仅允许 ${window.APP_CONFIG.ALLOWED_EMAIL} 使用此应用。`;
  }
}
async function signInGoogle() {
  els.authGoogle.disabled = true;
  try {
    await Cloud.signInWithGoogle();
  } catch (error) {
    console.error(error);
    syncHealth = "error";
    updateAuthUI(error.message || "Google 登录失败");
  } finally {
    els.authGoogle.disabled = false;
  }
}
async function signOutCloud() {
  try {
    await Cloud.signOut();
    syncHealth = "idle";
    closeAuthSheet();
    updateAuthUI();
    showToast("已退出登录");
  } catch (error) {
    showToast(error.message || "退出失败");
  }
}

async function syncNow({ silent = false } = {}) {
  if (!Cloud.isSignedIn()) {
    syncHealth = navigator.onLine ? "idle" : "offline";
    updateAuthUI();
    if (!silent) openAuthSheet();
    return;
  }
  if (!navigator.onLine) {
    syncHealth = "offline";
    updateAuthUI();
    if (!silent) showToast("当前离线，本地记录已保存");
    return;
  }
  if (Cloud.isSyncing()) return;
  syncHealth = "syncing";
  updateAuthUI();
  try {
    await normalizeLocalRecords();
    records = await DB.getAllRecords();

    const localSettings = {
      accountName,
      billingStartDay,
      currency: "USD",
      updatedAt: await DB.getSetting("settingsUpdatedAt", new Date(0).toISOString()),
      clientUpdatedAt: await DB.getSetting("settingsUpdatedAt", new Date(0).toISOString())
    };
    const syncedSettings = await Cloud.syncSettings(localSettings);
    accountName = syncedSettings.accountName;
    billingStartDay = Number(syncedSettings.billingStartDay);
    await DB.setSetting("accountName", accountName);
    await DB.setSetting("billingStartDay", billingStartDay);
    await DB.setSetting("settingsUpdatedAt", syncedSettings.updatedAt);
    els.accountButton.textContent = accountName;

    const result = await Cloud.syncRecords(records);
    records = result.records;
    lastSyncAt = new Date();
    syncHealth = "healthy";
    render();
    updateAuthUI();
  } catch (error) {
    console.error(error);
    syncHealth = "error";
    updateAuthUI(error.message || "同步失败");
    if (!silent) showToast("同步失败，本地数据未丢失");
  }
}

function render() {
  const active = records.filter(r => !r.deleted);
  const sorted = active.sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const viewDate = new Date(viewYear, viewMonth - 1, billingStartDay);
  const cycle = getBillingCycleByMonth(viewYear, viewMonth, billingStartDay);
  const month = getNaturalMonth(viewDate);
  const year = getNaturalYear(viewDate);
  const cycleRecords = sorted.filter(r => inRange(parseDate(r.date), cycle.start, cycle.end));
  const monthRecords = sorted.filter(r => inRange(parseDate(r.date), month.start, month.end));
  const yearRecords = sorted.filter(r => inRange(parseDate(r.date), year.start, year.end));

  els.cycleTotal.textContent = money(sum(cycleRecords));
  els.monthTotal.textContent = money(sum(monthRecords));
  els.yearTotal.textContent = money(sum(yearRecords));
  els.cycleRange.textContent = `${formatShort(cycle.start)} ~ ${formatShort(addDays(cycle.end, -1))}`;
  els.monthRange.textContent = `${formatShort(month.start)} ~ ${formatShort(addDays(month.end, -1))}`;
  els.yearRange.textContent = `${year.start.getFullYear()}年`;
  els.billingLabel.textContent = `${viewMonth}月 · ${billingStartDay}日`;
  renderRecords(cycleRecords, cycle);
}

function renderRecords(list, cycle) {
  if (!list.length) {
    els.recordsList.innerHTML = `<div class="empty"><div class="empty-icon">🧾</div><div>${formatShort(cycle.start)} ~ ${formatShort(addDays(cycle.end, -1))} 没有记录</div><div>点下方 + 记一笔吧</div></div>`;
    return;
  }
  els.recordsList.innerHTML = list.map(record => `
    <button class="record" onclick="openExpenseSheetById('${record.id}')">
      <div class="record-icon ${categoryClass(record.category)}">${categoryIcon(record.category)}</div>
      <div class="record-body">
        <div class="record-title">${escapeHtml(record.note || categoryName(record.category))}</div>
        <div class="record-sub">${formatRecordDate(parseDate(record.date))} · ${escapeHtml(categoryName(record.category))}</div>
      </div>
      <div class="record-amount">${money(record.amount)}</div>
      <div class="record-chevron">›</div>
    </button>`).join("");
}

function openExpenseSheetById(id) {
  const record = records.find(r => r.id === id && !r.deleted);
  if (record) openExpenseSheet(record);
}

function exportCSV() {
  const header = ["日期","类别","金额","备注","ID","UpdatedAt"];
  const rows = records.filter(r => !r.deleted).sort((a,b) => a.date.localeCompare(b.date))
    .map(r => [r.date, r.category, r.amount, r.note || "", r.id, r.updatedAt || ""]);
  const csv = [header, ...rows].map(row => row.map(cell => `"${String(cell).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `amex-expenses-${formatLocalDate(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("CSV 已导出");
}

function getBillingCycleByMonth(year, month, startDay) {
  const start = new Date(Number(year), Number(month) - 1, Number(startDay));
  return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, Number(startDay)) };
}
function getNaturalMonth(date) { return { start: new Date(date.getFullYear(), date.getMonth(), 1), end: new Date(date.getFullYear(), date.getMonth() + 1, 1) }; }
function getNaturalYear(date) { return { start: new Date(date.getFullYear(), 0, 1), end: new Date(date.getFullYear() + 1, 0, 1) }; }
function inRange(date, start, end) { return date >= start && date < end; }
function sum(list) { return list.reduce((total, record) => total + Number(record.amount || 0), 0); }
function money(value) { return "$" + Number(value || 0).toFixed(2); }
function addDays(date, days) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }
function formatLocalDate(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function parseDate(value) { const [y,m,d] = value.split("-").map(Number); return new Date(y, m - 1, d); }
function formatShort(date) { return `${date.getMonth()+1}.${date.getDate()}`; }
function formatChineseDate(date) { return `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`; }
function formatRecordDate(date) { return `${date.getMonth()+1}月${date.getDate()}日`; }
function categoryIcon(category) { return category?.slice(0, 2).trim() || "📦"; }
function categoryName(category) { return (category || "📦其他").replace(/^[^\p{L}\p{N}]+/u, "") || "其他"; }
function categoryClass(category) {
  if (category.startsWith("🍜")) return "food";
  if (category.startsWith("🛒")) return "grocery";
  if (category.startsWith("🚗")) return "transport";
  if (category.startsWith("🎮")) return "entertainment";
  if (category.startsWith("📄")) return "study";
  if (category.startsWith("🏠")) return "rent";
  if (category.startsWith("🎁")) return "shopping";
  return "other";
}
function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || ""); }
function escapeHtml(text) { return String(text).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  if (navigator.vibrate) navigator.vibrate(12);
  setTimeout(() => els.toast.classList.remove("show"), 1600);
}
function registerServiceWorker() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js");
}

window.openExpenseSheetById = openExpenseSheetById;
