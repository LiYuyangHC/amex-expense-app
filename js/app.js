const $ = id => document.getElementById(id);

const els = {
  accountButton: $("accountButton"),
  profileButton: $("profileButton"),
  cycleTotal: $("cycleTotal"), monthTotal: $("monthTotal"), yearTotal: $("yearTotal"),
  cycleRange: $("cycleRange"), monthRange: $("monthRange"), yearRange: $("yearRange"),
  recordsList: $("recordsList"), refreshButton: $("refreshButton"),
  billingButton: $("billingButton"), billingLabel: $("billingLabel"),
  addButton: $("addButton"), analysisButton: $("analysisButton"), toast: $("toast"),
  analyticsPage: $("analyticsPage"), analyticsBack: $("analyticsBack"), analyticsExport: $("analyticsExport"),
  analyticsYearLabel: $("analyticsYearLabel"), analyticsYearTotal: $("analyticsYearTotal"),
  analyticsYearCompare: $("analyticsYearCompare"), analyticsPeakLabel: $("analyticsPeakLabel"),
  trendChart: $("trendChart"), categoryBreakdown: $("categoryBreakdown"),

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
let syncNowPromise = null;
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

  els.analysisButton.addEventListener("click", openAnalyticsPage);
  els.analyticsBack.addEventListener("click", closeAnalyticsPage);
  els.analyticsExport.addEventListener("click", exportCSV);
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
  window.addEventListener("resize", () => {
    requestAnimationFrame(fitStatNumbers);
    if (!els.analyticsPage.classList.contains("hidden")) renderAnalytics();
  });
}

async function normalizeLocalRecords() {
  const migrationVersion = Number(await DB.getSetting("dataMigrationVersion", 0));
  const local = await DB.getAllRecords();
  const normalizedRecords = [];
  const activeKeys = new Map();
  const now = new Date().toISOString();

  for (const record of local) {
    const normalized = {
      ...record,
      id: isUuid(record.id) ? record.id : makeId(),
      accountName: record.accountName || accountName,
      createdAt: record.createdAt || record.updatedAt || now,
      updatedAt: record.updatedAt || now,
      clientUpdatedAt: record.clientUpdatedAt || record.updatedAt || now,
      deleted: Boolean(record.deleted),
      syncState: migrationVersion < 3 ? "pending" : (record.syncState || "pending")
    };

    if (!normalized.deleted) {
      const key = expenseContentKey(normalized);
      const existingIndex = activeKeys.get(key);
      if (existingIndex !== undefined) {
        const existing = normalizedRecords[existingIndex];
        const keepExisting = String(existing.createdAt || "") <= String(normalized.createdAt || "");
        const duplicate = keepExisting ? normalized : existing;
        duplicate.deleted = true;
        duplicate.updatedAt = now;
        duplicate.clientUpdatedAt = now;
        duplicate.syncState = "pending";
        if (!keepExisting) {
          normalizedRecords[existingIndex] = normalized;
          activeKeys.set(key, existingIndex);
          normalizedRecords.push(duplicate);
        } else {
          normalizedRecords.push(duplicate);
        }
        continue;
      }
      activeKeys.set(key, normalizedRecords.length);
    }
    normalizedRecords.push(normalized);
  }

  await DB.replaceAllRecords(normalizedRecords);
  await DB.setSetting("dataMigrationVersion", 3);
  await DB.setSetting("legacyImportCompleted", true);
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

  const draft = {
    date: formatLocalDate(selectedDate),
    category: els.category.value,
    amount,
    note: els.note.value.trim()
  };
  const duplicate = records.find(record =>
    !record.deleted && record.id !== editingId && expenseContentKey(record) === expenseContentKey(draft)
  );
  if (duplicate) return showToast("这笔记录已经存在");

  const now = new Date().toISOString();
  const existing = editingId ? records.find(r => r.id === editingId) : null;
  const wasEditing = Boolean(editingId);
  await DB.saveRecord({
    id: editingId || makeId(),
    ...draft,
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
  if (syncNowPromise) return syncNowPromise;

  syncNowPromise = (async () => {
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

    syncHealth = "syncing";
    updateAuthUI();
    try {
      await normalizeLocalRecords();
      records = await DB.getAllRecords();

      const settingsUpdatedAt = await DB.getSetting("settingsUpdatedAt", new Date(0).toISOString());
      const localSettings = {
        accountName,
        billingStartDay,
        currency: "USD",
        updatedAt: settingsUpdatedAt,
        clientUpdatedAt: settingsUpdatedAt
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
  })();

  try {
    return await syncNowPromise;
  } finally {
    syncNowPromise = null;
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
  requestAnimationFrame(fitStatNumbers);
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

function openAnalyticsPage() {
  renderAnalytics();
  els.analyticsPage.classList.remove("hidden");
  document.body.classList.add("analytics-open");
}

function closeAnalyticsPage() {
  els.analyticsPage.classList.add("hidden");
  document.body.classList.remove("analytics-open");
}

function renderAnalytics() {
  const year = today.getFullYear();
  const active = records.filter(record => !record.deleted && parseDate(record.date).getFullYear() === year);
  const total = sum(active);
  const monthly = Array.from({ length: 12 }, () => 0);
  const categories = new Map();

  active.forEach(record => {
    const monthIndex = parseDate(record.date).getMonth();
    monthly[monthIndex] += Number(record.amount || 0);
    const category = record.category || "📦其他";
    categories.set(category, (categories.get(category) || 0) + Number(record.amount || 0));
  });

  els.analyticsYearLabel.textContent = `${year} 年`;
  els.analyticsYearTotal.textContent = money(total);
  els.analyticsYearCompare.textContent = active.length ? `${active.length} 笔记录 · 1–12 月` : "今年还没有消费记录";

  const peakValue = Math.max(...monthly);
  const peakMonth = monthly.indexOf(peakValue) + 1;
  els.analyticsPeakLabel.textContent = peakValue > 0 ? `${peakMonth} 月最高` : "暂无数据";
  els.trendChart.innerHTML = buildTrendChart(monthly);

  const sortedCategories = [...categories.entries()].sort((a, b) => b[1] - a[1]);
  if (!sortedCategories.length) {
    els.categoryBreakdown.innerHTML = `<div class="analytics-empty">今年还没有可以分析的记录</div>`;
    return;
  }

  els.categoryBreakdown.innerHTML = sortedCategories.map(([category, amount], index) => {
    const percentage = total > 0 ? amount / total * 100 : 0;
    return `
      <article class="category-row">
        <div class="category-rank">${index + 1}</div>
        <div class="category-main">
          <div class="category-line">
            <span><b>${escapeHtml(categoryIcon(category))}</b>${escapeHtml(categoryName(category))}</span>
            <strong>${percentage.toFixed(1)}%</strong>
          </div>
          <div class="category-progress"><i style="width:${Math.max(percentage, 1.5).toFixed(2)}%"></i></div>
          <div class="category-amount">${money(amount)}</div>
        </div>
      </article>`;
  }).join("");
}

function buildTrendChart(monthly) {
  const width = 360;
  const height = 210;
  const pad = { top: 24, right: 12, bottom: 34, left: 12 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const max = Math.max(...monthly, 1);
  const points = monthly.map((value, index) => {
    const x = pad.left + chartWidth * index / 11;
    const y = pad.top + chartHeight - (value / max) * chartHeight;
    return { x, y, value, month: index + 1 };
  });
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const area = `${path} L${points.at(-1).x.toFixed(2)},${(pad.top + chartHeight).toFixed(2)} L${points[0].x.toFixed(2)},${(pad.top + chartHeight).toFixed(2)} Z`;
  const labels = points.map((point, index) => index % 2 === 0
    ? `<text x="${point.x}" y="${height - 9}" text-anchor="middle">${point.month}</text>`
    : "").join("");
  const dots = points.filter(point => point.value > 0).map(point =>
    `<circle cx="${point.x}" cy="${point.y}" r="3.8"><title>${point.month}月 ${money(point.value)}</title></circle>`
  ).join("");
  const grid = [0, .5, 1].map(ratio => {
    const y = pad.top + chartHeight * ratio;
    return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"/>`;
  }).join("");

  return `<svg class="trend-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="月度消费趋势图">
    <defs>
      <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0a84ff" stop-opacity=".34"/>
        <stop offset="1" stop-color="#0a84ff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g class="trend-grid">${grid}</g>
    <path class="trend-area" d="${area}"/>
    <path class="trend-line" d="${path}"/>
    <g class="trend-dots">${dots}</g>
    <g class="trend-labels">${labels}</g>
  </svg>`;
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
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
function money(value) { return currencyFormatter.format(Number(value || 0)); }

function fitStatNumbers() {
  [els.cycleTotal, els.monthTotal, els.yearTotal].forEach(element => {
    if (!element) return;
    const maxSize = 23;
    const minSize = 13;
    element.style.fontSize = `${maxSize}px`;

    let size = maxSize;
    while (element.scrollWidth > element.clientWidth && size > minSize) {
      size -= 0.5;
      element.style.fontSize = `${size}px`;
    }
  });
}
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
function expenseContentKey(record) {
  return [
    record.date || "",
    Number(record.amount || 0).toFixed(2),
    String(record.category || "").trim(),
    String(record.note || "").trim()
  ].join("\u001f");
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
