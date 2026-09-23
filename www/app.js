const STORAGE_KEY = "school-market-ledger-v1";

const statusText = {
  paid: "已结",
  unpaid: "未结",
  held: "压单",
};

const statusOrder = ["paid", "unpaid", "held"];

const els = {
  purchaseForm: document.querySelector("#purchaseForm"),
  revenueForm: document.querySelector("#revenueForm"),
  supplierInput: document.querySelector("#supplierInput"),
  supplierOptions: document.querySelector("#supplierOptions"),
  purchaseAmountInput: document.querySelector("#purchaseAmountInput"),
  purchaseDateInput: document.querySelector("#purchaseDateInput"),
  receiptInput: document.querySelector("#receiptInput"),
  purchaseNoteInput: document.querySelector("#purchaseNoteInput"),
  revenueAmountInput: document.querySelector("#revenueAmountInput"),
  revenueDateInput: document.querySelector("#revenueDateInput"),
  revenueNoteInput: document.querySelector("#revenueNoteInput"),
  todayStrip: document.querySelector("#todayStrip"),
  daySummary: document.querySelector("#daySummary"),
  recordsList: document.querySelector("#recordsList"),
  searchInput: document.querySelector("#searchInput"),
  dateFilterInput: document.querySelector("#dateFilterInput"),
  statusFilterInput: document.querySelector("#statusFilterInput"),
  todayFilterBtn: document.querySelector("#todayFilterBtn"),
  clearFiltersBtn: document.querySelector("#clearFiltersBtn"),
  statsRangeInput: document.querySelector("#statsRangeInput"),
  exportMonthInput: document.querySelector("#exportMonthInput"),
  exportSupplierMonthBtn: document.querySelector("#exportSupplierMonthBtn"),
  exportBackupBtn: document.querySelector("#exportBackupBtn"),
  dialog: document.querySelector("#recordDialog"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogBody: document.querySelector("#dialogBody"),
  closeDialogBtn: document.querySelector("#closeDialogBtn"),
  toast: document.querySelector("#toast"),
};

let state = loadState();
let toastTimer;

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonth() {
  return localDate().slice(0, 7);
}

function createId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeRecord(record) {
  return {
    id: record.id || createId(),
    supplier: String(record.supplier || "").trim() || "未填写送货方",
    amount: Number(record.amount) || 0,
    date: record.date || localDate(),
    status: statusText[record.status] ? record.status : "paid",
    receipt: record.receipt || "",
    note: String(record.note || "").trim(),
    createdAt: record.createdAt || new Date().toISOString(),
  };
}

function normalizeRevenue(record) {
  return {
    id: record.id || createId(),
    amount: Number(record.amount) || 0,
    date: record.date || localDate(),
    note: String(record.note || "").trim(),
    createdAt: record.createdAt || new Date().toISOString(),
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      purchases: Array.isArray(parsed?.purchases) ? parsed.purchases.map(normalizeRecord) : [],
      revenues: Array.isArray(parsed?.revenues) ? parsed.revenues.map(normalizeRevenue) : [],
    };
  } catch {
    return { purchases: [], revenues: [] };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    showToast("保存失败：手机本地空间可能不足，请先导出备份或减少照片大小。");
    return false;
  }
}

function money(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function parseAmount(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function sum(items, getter) {
  return items.reduce((total, item) => total + getter(item), 0);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
}

function sortByNewest(a, b) {
  return b.date.localeCompare(a.date) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
}

function getRangeDates(range) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  } else if (range === "month") {
    start.setDate(1);
  } else {
    start.setMonth(0, 1);
  }

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function inRange(dateText, range) {
  const date = new Date(`${dateText}T12:00:00`);
  const [start, end] = getRangeDates(range);
  return date >= start && date <= end;
}

function updateSupplierOptions() {
  const suppliers = [...new Set(state.purchases.map((item) => item.supplier).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  els.supplierOptions.innerHTML = suppliers.map((supplier) => `<option value="${escapeHtml(supplier)}"></option>`).join("");
}

async function readCompressedImage(file) {
  if (!file) return "";
  if (!file.type.startsWith("image/")) {
    showToast("单据照片只能选择图片。");
    return "";
  }

  const rawUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = rawUrl;
  });

  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

function download(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function getDayTotals(date) {
  const purchases = state.purchases.filter((item) => item.date === date);
  const revenues = state.revenues.filter((item) => item.date === date);
  return {
    purchaseCount: purchases.length,
    purchaseTotal: sum(purchases, (item) => item.amount),
    revenueTotal: sum(revenues, (item) => item.amount),
    paidTotal: sum(purchases.filter((item) => item.status === "paid"), (item) => item.amount),
    unpaidTotal: sum(purchases.filter((item) => item.status === "unpaid"), (item) => item.amount),
    heldTotal: sum(purchases.filter((item) => item.status === "held"), (item) => item.amount),
  };
}

function render() {
  updateSupplierOptions();
  renderHome();
  renderRecords();
  renderStats();
}

function renderHome() {
  const month = currentMonth();
  const today = localDate();
  const monthPurchases = state.purchases.filter((item) => item.date.startsWith(month));
  const monthRevenues = state.revenues.filter((item) => item.date.startsWith(month));
  const allUnpaid = state.purchases.filter((item) => item.status === "unpaid");
  const allHeld = state.purchases.filter((item) => item.status === "held");
  const revenue = sum(monthRevenues, (item) => item.amount);
  const purchases = sum(monthPurchases, (item) => item.amount);
  const day = getDayTotals(today);

  document.querySelector("#homeUnpaid").textContent = money(sum(allUnpaid, (item) => item.amount));
  document.querySelector("#homeHeld").textContent = money(sum(allHeld, (item) => item.amount));
  document.querySelector("#homeRevenue").textContent = money(revenue);
  document.querySelector("#homeProfit").textContent = money(revenue - purchases);
  els.todayStrip.innerHTML = `
    <div class="today-strip-row"><strong>今日概览</strong><span>${today}</span></div>
    <div class="today-strip-row">
      <span>营业额 ${money(day.revenueTotal)}</span>
      <span>送货 ${money(day.purchaseTotal)} / ${day.purchaseCount} 笔</span>
      <span>未结 ${money(day.unpaidTotal)}</span>
      <span>压单 ${money(day.heldTotal)}</span>
    </div>
  `;
}

function renderDaySummary() {
  const date = els.dateFilterInput.value;
  if (!date) {
    els.daySummary.classList.remove("is-visible");
    els.daySummary.innerHTML = "";
    return;
  }

  const day = getDayTotals(date);
  els.daySummary.classList.add("is-visible");
  els.daySummary.innerHTML = `
    <div class="day-summary-title">${date} 当天汇总</div>
    <div class="day-summary-grid">
      <span>营业额：${money(day.revenueTotal)}</span>
      <span>送货：${money(day.purchaseTotal)}</span>
      <span>已结：${money(day.paidTotal)}</span>
      <span>未结：${money(day.unpaidTotal)}</span>
      <span>压单：${money(day.heldTotal)}</span>
      <span>笔数：${day.purchaseCount} 笔</span>
    </div>
  `;
}

function renderRecords() {
  const query = els.searchInput.value.trim().toLowerCase();
  const date = els.dateFilterInput.value;
  const status = els.statusFilterInput.value;

  renderDaySummary();

  const records = state.purchases
    .filter((item) => !query || item.supplier.toLowerCase().includes(query))
    .filter((item) => !date || item.date === date)
    .filter((item) => !status || item.status === status)
    .sort(sortByNewest);

  if (!records.length) {
    els.recordsList.innerHTML = `<div class="empty">没有找到送货记录</div>`;
    return;
  }

  els.recordsList.innerHTML = records.map((item) => `
    <button class="record-card status-${item.status}" data-record-id="${item.id}" type="button">
      <div class="record-top">
        <span class="record-name">${escapeHtml(item.supplier)}</span>
        <span class="record-amount">${money(item.amount)}</span>
      </div>
      <div class="record-meta">
        <span>${item.date}</span>
        <span class="pill ${item.status}">${statusText[item.status]}</span>
        ${item.receipt ? "<span>有单据照片</span>" : "<span>无照片</span>"}
      </div>
      ${item.note ? `<div class="record-note">${escapeHtml(item.note)}</div>` : ""}
    </button>
  `).join("");
}

function renderStats() {
  const range = els.statsRangeInput.value;
  const purchases = state.purchases.filter((item) => inRange(item.date, range));
  const revenues = state.revenues.filter((item) => inRange(item.date, range));
  const purchaseTotal = sum(purchases, (item) => item.amount);
  const revenueTotal = sum(revenues, (item) => item.amount);
  const unpaid = state.purchases.filter((item) => item.status === "unpaid");
  const held = state.purchases.filter((item) => item.status === "held");

  document.querySelector("#statsRevenue").textContent = money(revenueTotal);
  document.querySelector("#statsPurchases").textContent = money(purchaseTotal);
  document.querySelector("#statsProfit").textContent = money(revenueTotal - purchaseTotal);
  document.querySelector("#statsPending").textContent = money(sum(unpaid.concat(held), (item) => item.amount));
  renderCompact("#unpaidList", unpaid, "unpaid");
  renderCompact("#heldList", held, "held");
}

function renderCompact(selector, records, status) {
  const grouped = new Map();
  for (const item of records) {
    grouped.set(item.supplier, (grouped.get(item.supplier) || 0) + item.amount);
  }
  const rows = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
  const target = document.querySelector(selector);

  if (!rows.length) {
    target.innerHTML = `<div class="empty">暂无${statusText[status]}</div>`;
    return;
  }

  target.innerHTML = rows.map(([supplier, amount]) => `
    <div class="compact-row status-${status}">
      <strong>${escapeHtml(supplier)}</strong>
      <span>${money(amount)}</span>
    </div>
  `).join("");
}

function setRecordStatus(recordId, status) {
  const item = state.purchases.find((record) => record.id === recordId);
  if (!item) return;
  item.status = status;
  if (saveState()) {
    showRecord(recordId);
    render();
    showToast(`已改为${statusText[status]}`);
  }
}

function deleteRecord(recordId) {
  const item = state.purchases.find((record) => record.id === recordId);
  if (!item) return;
  const ok = window.confirm(`确定删除“${item.supplier} ${money(item.amount)}”这条送货记录吗？`);
  if (!ok) return;
  state.purchases = state.purchases.filter((record) => record.id !== recordId);
  if (saveState()) {
    els.dialog.close();
    render();
    showToast("记录已删除");
  }
}

function showRecord(recordId) {
  const item = state.purchases.find((record) => record.id === recordId);
  if (!item) return;

  els.dialogTitle.textContent = item.supplier;
  els.dialogBody.innerHTML = `
    <div class="detail-grid">
      <p class="detail-line"><strong>金额：</strong>${money(item.amount)}</p>
      <p class="detail-line"><strong>日期：</strong>${item.date}</p>
      <p class="detail-line"><strong>当前状态：</strong><span class="pill ${item.status}">${statusText[item.status]}</span></p>
      ${item.note ? `<p class="detail-line"><strong>备注：</strong>${escapeHtml(item.note)}</p>` : ""}
      <div class="dialog-actions">
        <div class="status-actions">
          ${statusOrder.map((status) => `
            <button class="status-action ${item.status === status ? "is-active" : ""}" data-status="${status}" data-record-id="${item.id}" type="button">
              ${statusText[status]}
            </button>
          `).join("")}
        </div>
        <button class="danger-btn" data-delete-id="${item.id}" type="button">删除这条记录</button>
      </div>
      ${item.receipt ? `<img src="${item.receipt}" alt="单据照片">` : `<div class="empty">没有上传单据照片</div>`}
    </div>
  `;

  if (typeof els.dialog.showModal === "function") {
    if (!els.dialog.open) els.dialog.showModal();
  } else {
    alert(`${item.supplier}\n金额：${money(item.amount)}\n日期：${item.date}\n状态：${statusText[item.status]}`);
  }
}

async function handlePurchaseSubmit(event) {
  event.preventDefault();
  const supplier = els.supplierInput.value.trim();
  const amount = parseAmount(els.purchaseAmountInput.value);
  const date = els.purchaseDateInput.value;
  const status = new FormData(els.purchaseForm).get("status");

  if (!supplier) {
    showToast("请填写送货方。");
    els.supplierInput.focus();
    return;
  }
  if (amount <= 0) {
    showToast("进货金额必须大于 0。");
    els.purchaseAmountInput.focus();
    return;
  }
  if (!date) {
    showToast("请选择进货日期。");
    els.purchaseDateInput.focus();
    return;
  }

  let receipt = "";
  try {
    receipt = await readCompressedImage(els.receiptInput.files[0]);
  } catch {
    showToast("单据照片读取失败，请换一张或先不上传。");
    return;
  }

  const record = {
    id: createId(),
    supplier,
    amount,
    date,
    status,
    receipt,
    note: els.purchaseNoteInput.value.trim(),
    createdAt: new Date().toISOString(),
  };

  state.purchases.push(record);
  if (!saveState()) {
    state.purchases.pop();
    return;
  }

  els.purchaseForm.reset();
  els.purchaseDateInput.value = localDate();
  document.querySelector('input[name="status"][value="paid"]').checked = true;
  render();
  showToast("进货记录已保存");
}

function handleRevenueSubmit(event) {
  event.preventDefault();
  const amount = parseAmount(els.revenueAmountInput.value);
  const date = els.revenueDateInput.value;

  if (amount <= 0) {
    showToast("营业额必须大于 0。");
    els.revenueAmountInput.focus();
    return;
  }
  if (!date) {
    showToast("请选择营业额日期。");
    els.revenueDateInput.focus();
    return;
  }

  state.revenues.push({
    id: createId(),
    amount,
    date,
    note: els.revenueNoteInput.value.trim(),
    createdAt: new Date().toISOString(),
  });

  if (!saveState()) {
    state.revenues.pop();
    return;
  }

  els.revenueForm.reset();
  els.revenueDateInput.value = localDate();
  render();
  showToast("营业额已保存");
}

function exportSupplierMonth() {
  const month = els.exportMonthInput.value || currentMonth();
  const grouped = new Map();
  for (const item of state.purchases.filter((record) => record.date.startsWith(month))) {
    const current = grouped.get(item.supplier) || { total: 0, paid: 0, unpaid: 0, held: 0, count: 0 };
    current.total += item.amount;
    current[item.status] += item.amount;
    current.count += 1;
    grouped.set(item.supplier, current);
  }

  const rows = [["月份", "送货方", "总送货金额", "已结金额", "未结金额", "压单金额", "笔数"]].concat(
    [...grouped.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([supplier, data]) => [
        month,
        supplier,
        data.total.toFixed(2),
        data.paid.toFixed(2),
        data.unpaid.toFixed(2),
        data.held.toFixed(2),
        data.count,
      ])
  );

  download(
    `${month}-每家送货金额.csv`,
    `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`,
    "text/csv;charset=utf-8"
  );
  showToast("导出文件已生成");
}

function exportBackup() {
  download(`校园超市账本备份-${localDate()}.json`, JSON.stringify(state, null, 2), "application/json;charset=utf-8");
  showToast("完整备份已导出");
}

function bindEvents() {
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((item) => item.classList.toggle("is-active", item === button));
      document.querySelectorAll(".view").forEach((view) => view.classList.toggle("is-active", view.id === button.dataset.view));
      render();
    });
  });

  els.purchaseForm.addEventListener("submit", handlePurchaseSubmit);
  els.revenueForm.addEventListener("submit", handleRevenueSubmit);
  els.searchInput.addEventListener("input", renderRecords);
  els.dateFilterInput.addEventListener("change", renderRecords);
  els.statusFilterInput.addEventListener("change", renderRecords);
  els.statsRangeInput.addEventListener("change", renderStats);
  els.todayFilterBtn.addEventListener("click", () => {
    els.dateFilterInput.value = localDate();
    renderRecords();
  });
  els.clearFiltersBtn.addEventListener("click", () => {
    els.searchInput.value = "";
    els.dateFilterInput.value = "";
    els.statusFilterInput.value = "";
    renderRecords();
  });
  els.recordsList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-record-id]");
    if (card) showRecord(card.dataset.recordId);
  });
  els.dialogBody.addEventListener("click", (event) => {
    const statusButton = event.target.closest("[data-status]");
    const deleteButton = event.target.closest("[data-delete-id]");
    if (statusButton) setRecordStatus(statusButton.dataset.recordId, statusButton.dataset.status);
    if (deleteButton) deleteRecord(deleteButton.dataset.deleteId);
  });
  els.closeDialogBtn.addEventListener("click", () => els.dialog.close());
  els.exportSupplierMonthBtn.addEventListener("click", exportSupplierMonth);
  els.exportBackupBtn.addEventListener("click", exportBackup);
}

function init() {
  els.purchaseDateInput.value = localDate();
  els.revenueDateInput.value = localDate();
  els.exportMonthInput.value = currentMonth();
  bindEvents();
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

init();
