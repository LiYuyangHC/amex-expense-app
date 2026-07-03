const $ = id => document.getElementById(id);

const els = {
  accountButton: $("accountButton"),
  cycleTotal: $("cycleTotal"),
  monthTotal: $("monthTotal"),
  yearTotal: $("yearTotal"),
  cycleRange: $("cycleRange"),
  monthRange: $("monthRange"),
  yearRange: $("yearRange"),
  recordsList: $("recordsList"),
  refreshButton: $("refreshButton"),
  billingButton: $("billingButton"),
  billingLabel: $("billingLabel"),
  addButton: $("addButton"),
  exportButton: $("exportButton"),
  toast: $("toast"),

  expenseSheet: $("expenseSheet"),
  expenseCancel: $("expenseCancel"),
  expenseDone: $("expenseDone"),
  sheetTitle: $("sheetTitle"),
  amount: $("amount"),
  dateButton: $("dateButton"),
  category: $("category"),
  note: $("note"),
  deleteEditingButton: $("deleteEditingButton"),

  dateSheet: $("dateSheet"),
  dateCancel: $("dateCancel"),
  dateDone: $("dateDone"),
  todayButton: $("todayButton"),
  dateYear: $("dateYear"),
  dateMonth: $("dateMonth"),
  dateDay: $("dateDay"),

  billingSheet: $("billingSheet"),
  billingCancel: $("billingCancel"),
  billingDone: $("billingDone"),
  billingStartDay: $("billingStartDay"),

  accountSheet: $("accountSheet"),
  accountCancel: $("accountCancel"),
  accountDone: $("accountDone"),
  accountNameInput: $("accountNameInput")
};

let records = [];
let billingStartDay = 16;
let accountName = "建行 AMEX";
let selectedDate = new Date();
let editingId = null;
const today = new Date();

init();

async function init() {
  initStaticSelects();
  initEvents();
  selectedDate = new Date();
  updateDateButton();

  billingStartDay = Number(await DB.getSetting("billingStartDay", 16));
  accountName = await DB.getSetting("accountName", "建行 AMEX");
  els.accountButton.textContent = accountName;
  els.billingStartDay.value = String(billingStartDay);

  records = await DB.getAllRecords();
  await seedExistingRecordsOnce();
  records = await DB.getAllRecords();
  render();
  registerServiceWorker();
}

function initStaticSelects() {
  const year = today.getFullYear();
  els.dateYear.innerHTML = Array.from({ length: 9 }, (_, i) => year - 4 + i)
    .map(y => `<option value="${y}">${y}年</option>`).join("");
  els.dateMonth.innerHTML = Array.from({ length: 12 }, (_, i) => i + 1)
    .map(m => `<option value="${m}">${m}月</option>`).join("");
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
  els.billingDone.addEventListener("click", saveBillingStartDay);
  els.exportButton.addEventListener("click", exportCSV);
  els.refreshButton.addEventListener("click", async () => { records = await DB.getAllRecords(); render(); showToast("已刷新"); });
  els.accountButton.addEventListener("click", openAccountSheet);
  els.accountCancel.addEventListener("click", closeAccountSheet);
  els.accountDone.addEventListener("click", saveAccountName);

  [els.expenseSheet, els.dateSheet, els.billingSheet, els.accountSheet].forEach(backdrop => {
    backdrop.addEventListener("click", e => { if (e.target === backdrop) backdrop.classList.add("hidden"); });
  });
}


async function seedExistingRecordsOnce() {
  const done = await DB.getSetting("seededExistingRecordsV1", false);
  if (done) return;

  const existingIds = new Set(records.map(r => r.id));
  const now = new Date().toISOString();
  const existingRecords = [
    { id:"legacy_20260630_1928", date:"2026-06-30", category:"🍜餐饮", amount:19.28, note:"午餐" },
    { id:"legacy_20260627_106", date:"2026-06-27", category:"🍜餐饮", amount:106, note:"晚餐" },
    { id:"legacy_20260627_5", date:"2026-06-27", category:"🎁购物", amount:5, note:"头绳" },
    { id:"legacy_20260627_50", date:"2026-06-27", category:"🚗交通", amount:50, note:"换驾照" },
    { id:"legacy_20260626_328", date:"2026-06-26", category:"🍜餐饮", amount:32.8, note:"晚餐 tqco" },
    { id:"legacy_20260624_68", date:"2026-06-24", category:"🍜餐饮", amount:68, note:"晚餐 咖喱饭" },
    { id:"legacy_20260623_44", date:"2026-06-23", category:"🎁购物", amount:44, note:"发膜" },
    { id:"legacy_20260622_178", date:"2026-06-22", category:"🎁购物", amount:178, note:"移动硬盘" },
    { id:"legacy_20260622_100", date:"2026-06-22", category:"🍜餐饮", amount:100, note:"午餐" },
    { id:"legacy_20260621_12612", date:"2026-06-21", category:"🍜餐饮", amount:126.12, note:"晚餐" },
    { id:"legacy_20260618_6864", date:"2026-06-18", category:"🎁购物", amount:68.64, note:"眼霜" },
    { id:"legacy_20260616_98", date:"2026-06-16", category:"🚗交通", amount:98, note:"Uber 回波士顿" },
    { id:"legacy_20260615_150", date:"2026-06-15", category:"🛒买菜", amount:150, note:"Trader Joe's" },
    { id:"legacy_20260606_9", date:"2026-06-06", category:"🎁购物", amount:9, note:"扫把" },
    { id:"legacy_20260603_1550", date:"2026-06-03", category:"🏠房租", amount:1550, note:"房租" },
    { id:"legacy_20260601_85", date:"2026-06-01", category:"🎁购物", amount:8.5, note:"花" },
    { id:"legacy_20260529_21661", date:"2026-05-29", category:"🛒买菜", amount:216.61, note:"Costco" },
    { id:"legacy_20260528_60", date:"2026-05-28", category:"🍜餐饮", amount:60, note:"生煎" },
    { id:"legacy_20260527_14", date:"2026-05-27", category:"🎁购物", amount:14, note:"冲鼻器" },
    { id:"legacy_20260527_7202", date:"2026-05-27", category:"🍜餐饮", amount:72.02, note:"晚餐" },
    { id:"legacy_20260526_8418", date:"2026-05-26", category:"🎁购物", amount:84.18, note:"柜子" },
    { id:"legacy_20260521_16962", date:"2026-05-21", category:"🏠房租", amount:169.62, note:"电费" },
    { id:"legacy_20260521_39", date:"2026-05-21", category:"🛒买菜", amount:39, note:"买菜" },
    { id:"legacy_20260518_138", date:"2026-05-18", category:"🍜餐饮", amount:138, note:"Eva" },
    { id:"legacy_20260518_5674", date:"2026-05-18", category:"🛒买菜", amount:56.74, note:"Trader Joe's" },
    { id:"legacy_20260516_69", date:"2026-05-16", category:"🍜餐饮", amount:6.9, note:"星巴克" },
    { id:"legacy_20260515_3124", date:"2026-05-15", category:"🍜餐饮", amount:31.24, note:"麦当劳" },
    { id:"legacy_20260515_213", date:"2026-05-15", category:"🍜餐饮", amount:21.3, note:"面包" },
    { id:"legacy_20260513_89", date:"2026-05-13", category:"🛒买菜", amount:89, note:"买菜" },
    { id:"legacy_20260513_12842", date:"2026-05-13", category:"🛒买菜", amount:128.42, note:"买菜" },
    { id:"legacy_20260505_93", date:"2026-05-05", category:"🛒买菜", amount:93, note:"买菜" },
    { id:"legacy_20260503_1500", date:"2026-05-03", category:"🏠房租", amount:1500, note:"房租" },
    { id:"legacy_20260502_8244", date:"2026-05-02", category:"🍜餐饮", amount:82.44, note:"餐饮" }
  ];

  let added = 0;
  for (const record of existingRecords) {
    if (existingIds.has(record.id)) continue;
    await DB.saveRecord({
      ...record,
      createdAt: now,
      updatedAt: now
    });
    added++;
  }
  await DB.setSetting("seededExistingRecordsV1", true);
  if (added > 0) setTimeout(() => showToast(`已连接 ${added} 条历史记录`), 400);
}

function openExpenseSheet(record) {
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
    clearExpenseForm(false);
  }

  els.expenseSheet.classList.remove("hidden");
  setTimeout(() => els.amount.focus(), 120);
}

function closeExpenseSheet() {
  els.expenseSheet.classList.add("hidden");
  editingId = null;
}

function clearExpenseForm(resetDate = true) {
  els.amount.value = "";
  els.note.value = "";
  if (resetDate) setSelectedDate(new Date());
  else updateDateButton();
}

async function saveRecord() {
  const amount = Number(els.amount.value);
  if (!els.amount.value || isNaN(amount) || amount <= 0) return showToast("先填金额哦");

  const now = new Date().toISOString();
  const existing = editingId ? records.find(r => r.id === editingId) : null;
  const record = {
    id: editingId || makeId(),
    date: formatLocalDate(selectedDate),
    category: els.category.value,
    amount,
    note: els.note.value.trim(),
    updatedAt: now,
    createdAt: existing?.createdAt || now
  };

  await DB.saveRecord(record);
  records = await DB.getAllRecords();
  closeExpenseSheet();
  render();
  showToast(editingId ? "已更新" : "已保存");
  editingId = null;
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
  els.dateDay.innerHTML = Array.from({ length: days }, (_, i) => `<option value="${i+1}">${i+1}日</option>`).join("");
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
  els.billingSheet.classList.remove("hidden");
}
function closeBillingSheet() { els.billingSheet.classList.add("hidden"); }
async function saveBillingStartDay() {
  billingStartDay = Number(els.billingStartDay.value);
  await DB.setSetting("billingStartDay", billingStartDay);
  closeBillingSheet();
  render();
  showToast(`账期已改为每月${billingStartDay}日开始`);
}

function openAccountSheet() {
  els.accountNameInput.value = accountName;
  els.accountSheet.classList.remove("hidden");
  setTimeout(() => els.accountNameInput.focus(), 120);
}
function closeAccountSheet() { els.accountSheet.classList.add("hidden"); }
async function saveAccountName() {
  const value = els.accountNameInput.value.trim() || "建行 AMEX";
  accountName = value;
  await DB.setSetting("accountName", value);
  els.accountButton.textContent = value;
  closeAccountSheet();
  showToast("名称已更新");
}

async function deleteRecord(id) {
  if (!confirm("确定删除这条记录吗？")) return;
  await DB.deleteRecord(id);
  records = await DB.getAllRecords();
  closeExpenseSheet();
  render();
  showToast("已删除");
}

function render() {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const now = new Date();
  const cycle = getBillingCycle(now, billingStartDay);
  const month = getNaturalMonth(now);
  const year = getNaturalYear(now);

  const cycleRecords = sorted.filter(r => inRange(parseDate(r.date), cycle.start, cycle.end));
  const monthRecords = sorted.filter(r => inRange(parseDate(r.date), month.start, month.end));
  const yearRecords = sorted.filter(r => inRange(parseDate(r.date), year.start, year.end));

  els.cycleTotal.textContent = money(sum(cycleRecords));
  els.monthTotal.textContent = money(sum(monthRecords));
  els.yearTotal.textContent = money(sum(yearRecords));
  els.cycleRange.textContent = `${formatShort(cycle.start)} ~ ${formatShort(addDays(cycle.end, -1))}`;
  els.monthRange.textContent = `${formatShort(month.start)} ~ ${formatShort(addDays(month.end, -1))}`;
  els.yearRange.textContent = `${year.start.getFullYear()}年`;
  els.billingLabel.textContent = `${billingStartDay}日开始`;

  renderRecords(cycleRecords);
}

function renderRecords(list) {
  if (!list.length) {
    els.recordsList.innerHTML = `<div class="empty"><div class="empty-icon">🧾</div><div>当前账期还没有记录</div><div>点下方 + 记一笔吧</div></div>`;
    return;
  }

  els.recordsList.innerHTML = list.map(r => `
    <button class="record" onclick="openExpenseSheetById('${r.id}')">
      <div class="record-icon">${categoryIcon(r.category)}</div>
      <div class="record-body">
        <div class="record-title">${escapeHtml(r.note || categoryName(r.category))}</div>
        <div class="record-sub">${formatRecordDate(parseDate(r.date))} · ${escapeHtml(categoryName(r.category))}</div>
      </div>
      <div class="record-amount">${money(r.amount)}</div>
    </button>
  `).join("");
}

function openExpenseSheetById(id) {
  const record = records.find(r => r.id === id);
  if (record) openExpenseSheet(record);
}

function exportCSV() {
  const header = ["日期","类别","金额","备注","ID","UpdatedAt"];
  const rows = [...records].sort((a,b)=>a.date.localeCompare(b.date)).map(r => [r.date,r.category,r.amount,r.note || "",r.id,r.updatedAt || ""]);
  const csv = [header, ...rows].map(row => row.map(cell => `"${String(cell).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `amex-expenses-${formatLocalDate(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV 已导出");
}

function getBillingCycle(date, startDay) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const start = d >= startDay ? new Date(y, m, startDay) : new Date(y, m - 1, startDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, startDay);
  return { start, end };
}
function getNaturalMonth(date) { return { start: new Date(date.getFullYear(), date.getMonth(), 1), end: new Date(date.getFullYear(), date.getMonth() + 1, 1) }; }
function getNaturalYear(date) { return { start: new Date(date.getFullYear(), 0, 1), end: new Date(date.getFullYear() + 1, 0, 1) }; }
function inRange(date, start, end) { return date >= start && date < end; }
function sum(list) { return list.reduce((total, r) => total + Number(r.amount || 0), 0); }
function money(n) { return "$" + Number(n || 0).toFixed(2); }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function formatLocalDate(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function parseDate(s) { const [y,m,d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function formatShort(date) { return `${date.getMonth()+1}.${date.getDate()}`; }
function formatChineseDate(date) { return `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`; }
function formatRecordDate(date) { return `${date.getMonth()+1}月${date.getDate()}日`; }
function categoryIcon(category) { return category.match(/^\S+/)?.[0] || "📦"; }
function categoryName(category) { return category.replace(/^\S+/, "").trim() || category; }
function makeId() { return "exp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9); }
function escapeHtml(text) { return String(text).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  if (navigator.vibrate) navigator.vibrate(12);
  setTimeout(() => els.toast.classList.remove("show"), 1500);
}
function registerServiceWorker() { if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js"); }

window.openExpenseSheetById = openExpenseSheetById;
