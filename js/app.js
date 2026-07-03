const $ = id => document.getElementById(id);

const els = {
  amount: $("amount"),
  dateButton: $("dateButton"),
  category: $("category"),
  note: $("note"),
  saveButton: $("saveButton"),
  cancelEditButton: $("cancelEditButton"),
  formTitle: $("formTitle"),
  msg: $("msg"),
  billingStartDay: $("billingStartDay"),
  cycleLabel: $("cycleLabel"),
  cycleTotal: $("cycleTotal"),
  monthTotal: $("monthTotal"),
  yearTotal: $("yearTotal"),
  cycleRange: $("cycleRange"),
  monthRange: $("monthRange"),
  yearRange: $("yearRange"),
  recordsList: $("recordsList"),
  exportButton: $("exportButton"),
  dateSheet: $("dateSheet"),
  dateCancel: $("dateCancel"),
  dateDone: $("dateDone"),
  todayButton: $("todayButton"),
  dateYear: $("dateYear"),
  dateMonth: $("dateMonth"),
  dateDay: $("dateDay")
};

let records = [];
let billingStartDay = 16;
let selectedDate = new Date();
let editingId = null;

init();

async function init() {
  initSelects();
  initEvents();
  selectedDate = new Date();
  updateDateButton();
  billingStartDay = Number(await DB.getSetting("billingStartDay", 16));
  els.billingStartDay.value = String(billingStartDay);
  records = await DB.getAllRecords();
  render();
  registerServiceWorker();
}

function initSelects() {
  els.billingStartDay.innerHTML = Array.from({ length: 28 }, (_, i) => {
    const day = i + 1;
    return `<option value="${day}">每月 ${day} 日</option>`;
  }).join("");

  const year = new Date().getFullYear();
  els.dateYear.innerHTML = Array.from({ length: 7 }, (_, i) => year - 3 + i)
    .map(y => `<option value="${y}">${y}年</option>`).join("");
  els.dateMonth.innerHTML = Array.from({ length: 12 }, (_, i) => i + 1)
    .map(m => `<option value="${m}">${m}月</option>`).join("");
}

function initEvents() {
  els.saveButton.addEventListener("click", saveRecord);
  els.cancelEditButton.addEventListener("click", cancelEdit);
  els.dateButton.addEventListener("click", openDateSheet);
  els.dateCancel.addEventListener("click", closeDateSheet);
  els.dateDone.addEventListener("click", confirmDate);
  els.todayButton.addEventListener("click", () => { selectedDate = new Date(); updateDateButton(); closeDateSheet(); });
  els.dateMonth.addEventListener("change", () => refreshDayOptions());
  els.dateYear.addEventListener("change", () => refreshDayOptions());
  els.billingStartDay.addEventListener("change", async () => {
    billingStartDay = Number(els.billingStartDay.value);
    await DB.setSetting("billingStartDay", billingStartDay);
    render();
  });
  els.exportButton.addEventListener("click", exportCSV);
}

async function saveRecord() {
  const amount = Number(els.amount.value);
  if (!els.amount.value || isNaN(amount)) return showMsg("先填金额哦", false);

  const now = new Date().toISOString();
  const record = {
    id: editingId || makeId(),
    date: formatLocalDate(selectedDate),
    category: els.category.value,
    amount,
    note: els.note.value.trim(),
    updatedAt: now,
    createdAt: editingId ? (records.find(r => r.id === editingId)?.createdAt || now) : now
  };

  await DB.saveRecord(record);
  records = await DB.getAllRecords();
  clearForm();
  showMsg(editingId ? "✅ 已更新" : "✅ 已保存", true);
  editingId = null;
  setEditMode(false);
  render();
}

function editRecord(id) {
  const r = records.find(item => item.id === id);
  if (!r) return;
  editingId = id;
  els.amount.value = r.amount;
  selectedDate = parseDate(r.date);
  updateDateButton();
  els.category.value = r.category;
  els.note.value = r.note || "";
  setEditMode(true);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteRecord(id) {
  if (!confirm("确定删除这条记录吗？")) return;
  await DB.deleteRecord(id);
  records = await DB.getAllRecords();
  showMsg("已删除", true);
  render();
}

function cancelEdit() {
  editingId = null;
  clearForm();
  setEditMode(false);
}

function setEditMode(isEditing) {
  els.formTitle.textContent = isEditing ? "编辑记录" : "记一笔";
  els.saveButton.textContent = isEditing ? "更新记录" : "保存记录";
  els.cancelEditButton.classList.toggle("hidden", !isEditing);
}

function clearForm() {
  els.amount.value = "";
  els.note.value = "";
  selectedDate = new Date();
  updateDateButton();
  els.amount.focus();
}

function render() {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  const now = new Date();
  const cycle = getBillingCycle(now, billingStartDay);
  const month = getNaturalMonth(now);
  const year = getNaturalYear(now);

  const cycleRecords = sorted.filter(r => inRange(parseDate(r.date), cycle.start, cycle.end));
  els.cycleTotal.textContent = money(sum(cycleRecords));
  els.monthTotal.textContent = money(sum(sorted.filter(r => inRange(parseDate(r.date), month.start, month.end))));
  els.yearTotal.textContent = money(sum(sorted.filter(r => inRange(parseDate(r.date), year.start, year.end))));

  els.cycleRange.textContent = `${formatShort(cycle.start)} ~ ${formatShort(addDays(cycle.end, -1))}`;
  els.monthRange.textContent = `${formatShort(month.start)} ~ ${formatShort(addDays(month.end, -1))}`;
  els.yearRange.textContent = `${year.start.getFullYear()}年`;
  els.cycleLabel.textContent = `当前账期：${formatShort(cycle.start)} ~ ${formatShort(addDays(cycle.end, -1))}`;

  renderRecords(cycleRecords);
}

function renderRecords(list) {
  if (!list.length) {
    els.recordsList.innerHTML = `<div class="empty"><div class="empty-icon">🧾</div><div>当前账期还没有记录</div><div style="margin-top:6px;font-size:13px;">快去记一笔吧～</div></div>`;
    return;
  }

  els.recordsList.innerHTML = list.map(r => `
    <div class="record">
      <div class="record-icon">${categoryIcon(r.category)}</div>
      <div class="record-main">
        <div class="record-title">${escapeHtml(r.note || categoryName(r.category))}</div>
        <div class="record-sub">${formatChineseDate(parseDate(r.date))} · ${escapeHtml(r.category)}</div>
        <div class="record-actions">
          <button class="mini" onclick="editRecord('${r.id}')">编辑</button>
          <button class="mini danger" onclick="deleteRecord('${r.id}')">删除</button>
        </div>
      </div>
      <div class="record-amount">${money(r.amount)}</div>
    </div>
  `).join("");
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
  selectedDate = new Date(Number(els.dateYear.value), Number(els.dateMonth.value) - 1, Number(els.dateDay.value));
  updateDateButton();
  closeDateSheet();
}

function updateDateButton() {
  els.dateButton.textContent = formatChineseDate(selectedDate);
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
function categoryIcon(category) { return category.match(/^\S+/)?.[0] || "📦"; }
function categoryName(category) { return category.replace(/^\S+/, "").trim() || category; }
function makeId() { return "exp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9); }
function escapeHtml(text) { return String(text).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function showMsg(text, ok=true) { els.msg.textContent = text; els.msg.style.color = ok ? "var(--green)" : "var(--danger)"; setTimeout(() => { els.msg.textContent = ""; }, 1600); }

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
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js");
}

window.editRecord = editRecord;
window.deleteRecord = deleteRecord;
