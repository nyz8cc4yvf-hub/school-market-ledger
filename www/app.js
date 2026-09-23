const STORAGE_KEY = "school-market-ledger-v1";

const statusText = {
  paid: "已结",
  unpaid: "未结",
  held: "压单",
};

const els = {
  purchaseForm: document.querySelector("#purchaseForm"),
  revenueForm: document.querySelector("#revenueForm"),
  supplierInput: document.querySelector("#supplierInput"),
  purchaseAmountInput: document.querySelector("#purchaseAmountInput"),
  purchaseDateInput: document.querySelector("#purchaseDateInput"),
  receiptInput: document.querySelector("#receiptInput"),
  purchaseNoteInput: document.querySelector("#purchaseNoteInput"),
  revenueAmountInput: document.querySelector("#revenueAmountInput"),
  revenueDateInput: document.querySelector("#revenueDateInput"),
  revenueNoteInput: document.querySelector("#revenueNoteInput"),
  recordsList: document.querySelector("#recordsList"),
  searchInput: document.querySelector("#searchInput"),
  dateFilterInput: document.querySelector("#dateFilterInput"),
  statusFilterInput: document.querySelector("#statusFilterInput"),
  clearFiltersBtn: document.querySelector("#clearFiltersBtn"),
  statsRangeInput: document.querySelector("#statsRangeInput"),
  exportMonthInput: document.querySelector("#exportMonthInput"),
  exportSupplierMonthBtn: document.querySelector("#exportSupplierMonthBtn"),
  exportBackupBtn: document.querySelector("#exportBackupBtn"),
  dialog: document.querySelector("#recordDialog"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogBody: document.querySelector("#dialogBody"),
  closeDialogBtn: document.querySelector("#closeDialogBtn"),
};

let state = loadState();

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      purchases: Array.isArray(parsed?.purchases) ? parsed.purchases : [],
      revenues: Array.isArray(parsed?.revenues) ? parsed.revenues : [],
    };
  } catch {
    return { purchases: [], revenues: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function money(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function parseAmount(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

function sum(items, getter) {
  return items.reduce((total, item) => total + getter(item), 0);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

function render() {
  renderHome();
  renderRecords();
  renderStats();
}

function renderHome() {
  const month = currentMonth();
  const monthPurchases = state.purchases.filter((item) => item.date.startsWith(month));
  const monthRevenues = state.revenues.filter((item) => item.date.startsWith(month));
  const allUnpaid = state.purchases.filter((item) => item.status === "unpaid");
  const allHeld = state.purchases.filter((item) => item.status === "held");
  const revenue = sum(monthRevenues, (item) => item.amount);
  const purchases = sum(monthPurchases, (item) => item.amount);

  document.querySelector("#homeUnpaid").textContent = money(sum(allUnpaid, (item) => item.amount));
  document.querySelector("#homeHeld").textContent = money(sum(allHeld, (item) => item.amount));
  document.querySelector("#homeRevenue").textContent = money(revenue);
  document.querySelector("#homeProfit").textContent = money(revenue - purchases);
}

function renderRecords() {
  const query = els.searchInput.value.trim().toLowerCase();
  const date = els.dateFilterInput.value;
  const status = els.statusFilterInput.value;

  const records = state.purchases
    .filter((item) => !query || item.supplier.toLowerCase().includes(query))
    .filter((item) => !date || item.date === date)
    .filter((item) => !status || item.status === status)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

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

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function showRecord(recordId) {
  const item = state.purchases.find((record) => record.id === recordId);
  if (!item) return;

  els.dialogTitle.textContent = item.supplier;
  els.dialogBody.innerHTML = `
    <div class="detail-grid">
      <p><strong>金额：</strong>${money(item.amount)}</p>
      <p><strong>日期：</strong>${item.date}</p>
      <p><strong>状态：</strong><span class="pill ${item.status}">${statusText[item.status]}</span></p>
      ${item.note ? `<p><strong>备注：</strong>${escapeHtml(item.note)}</p>` : ""}
      ${item.receipt ? `<img src="${item.receipt}" alt="单据照片">` : `<div class="empty">没有上传单据照片</div>`}
    </div>
  `;
  els.dialog.showModal();
}

async function handlePurchaseSubmit(event) {
  event.preventDefault();
  const receipt = await readFileAsDataUrl(els.receiptInput.files[0]);
  const record = {
    id: crypto.randomUUID(),
    supplier: els.supplierInput.value.trim(),
    amount: parseAmount(els.purchaseAmountInput.value),
    date: els.purchaseDateInput.value,
    status: new FormData(els.purchaseForm).get("status"),
    receipt,
    note: els.purchaseNoteInput.value.trim(),
    createdAt: new Date().toISOString(),
  };

  state.purchases.push(record);
  saveState();
  els.purchaseForm.reset();
  els.purchaseDateInput.value = today();
  render();
}

function handleRevenueSubmit(event) {
  event.preventDefault();
  state.revenues.push({
    id: crypto.randomUUID(),
    amount: parseAmount(els.revenueAmountInput.value),
    date: els.revenueDateInput.value,
    note: els.revenueNoteInput.value.trim(),
    createdAt: new Date().toISOString(),
  });
  saveState();
  els.revenueForm.reset();
  els.revenueDateInput.value = today();
  render();
}

function exportSupplierMonth() {
  const month = els.exportMonthInput.value || currentMonth();
  const grouped = new Map();
  for (const item of state.purchases.filter((record) => record.date.startsWith(month))) {
    grouped.set(item.supplier, (grouped.get(item.supplier) || 0) + item.amount);
  }
  const rows = [["月份", "送货方", "送货金额"]].concat(
    [...grouped.entries()].sort((a, b) => b[1] - a[1]).map(([supplier, amount]) => [month, supplier, amount.toFixed(2)])
  );
  download(`${month}-每家送货金额.csv`, rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
}

function exportBackup() {
  download(`校园超市账本备份-${today()}.json`, JSON.stringify(state, null, 2), "application/json;charset=utf-8");
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
  els.closeDialogBtn.addEventListener("click", () => els.dialog.close());
  els.exportSupplierMonthBtn.addEventListener("click", exportSupplierMonth);
  els.exportBackupBtn.addEventListener("click", exportBackup);
}

function init() {
  els.purchaseDateInput.value = today();
  els.revenueDateInput.value = today();
  els.exportMonthInput.value = currentMonth();
  bindEvents();
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

init();
