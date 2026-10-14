window.Ato = window.Ato || {};

Ato.App = (function () {
  "use strict";

  var U = Ato.Util;
  var C = Ato.Config;
  var S = Ato.Store;
  var R = Ato.Render;
  var P = Ato.Pdf;

  var state = null;
  var settings = null;
  var currentTotals = null;
  var currentFlags = null;
  var dirty = false;
  var showValidation = false;
  var draftTimer = null;
  var toastTimer = null;
  var confirmCallback = null;
  var el = {};

  function $(id) { return document.getElementById(id); }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function getPath(obj, path) {
    var parts = path.split(".");
    var o = obj;
    for (var i = 0; i < parts.length; i++) {
      if (o === null || o === undefined) return undefined;
      o = o[parts[i]];
    }
    return o;
  }

  function setPath(obj, path, value) {
    var parts = path.split(".");
    var o = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (o[parts[i]] === null || typeof o[parts[i]] !== "object") o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = value;
  }

  function byBind(path) {
    return qsa('[data-bind="' + path + '"]');
  }

  function cacheElements() {
    el.previewScaler = $("previewScaler");
    el.invoicePreview = $("invoicePreview");
    el.previewPane = $("previewPane");
    el.previewMeta = $("previewMeta");
    el.editorPane = $("editorPane");
    el.itemsContainer = $("itemsContainer");
    el.chargesContainer = $("chargesContainer");
    el.gstFields = $("gstFields");
    el.gstOffHint = $("gstOffHint");
    el.gstEnabled = $("gstEnabled");
    el.validationBox = $("validationBox");
    el.validationList = $("validationList");
    el.storageBanner = $("storageBanner");
    el.summaryStrip = $("editorSummary");
    el.statusNote = $("statusNote");
    el.logoPreview = $("logoPreview");
    el.logoInput = $("logoInput");
    el.historyDrawer = $("historyDrawer");
    el.historyList = $("historyList");
    el.historySearch = $("historySearch");
    el.historyStatusFilter = $("historyStatusFilter");
    el.historySort = $("historySort");
    el.overlay = $("overlay");
    el.confirmModal = $("confirmModal");
    el.confirmTitle = $("confirmTitle");
    el.confirmText = $("confirmText");
    el.toast = $("toast");
    el.customerSavedSelect = $("customerSavedSelect");
    el.storageNote = $("storageNote");
  }

  function populateStatic() {
    fillSelect($("currencySelect"), C.CURRENCIES.map(function (c) {
      return { value: c.code, label: c.code + "  " + c.symbol + "  " + c.name };
    }));
    fillSelect($("statusSelect"), C.STATUSES.map(function (s) { return { value: s, label: s }; }));
    fillSelect($("paymentStatusSelect"), C.STATUSES.map(function (s) { return { value: s, label: s }; }));
    fillSelect($("paymentMethodSelect"), [{ value: "", label: "Select method…" }].concat(C.PAYMENT_METHODS.map(function (m) {
      return { value: m, label: m };
    })));
    fillSelect($("gstDefaultRate"), C.GST_RATES.map(function (r) { return { value: r, label: r + "%" }; }));
    fillSelect($("historyStatusFilter"), [{ value: "", label: "All statuses" }].concat(C.STATUSES.map(function (s) {
      return { value: s, label: s };
    })));

    var svc = $("serviceList");
    svc.innerHTML = C.SERVICE_SUGGESTIONS.map(function (s) { return '<option value="' + U.escapeHtml(s) + '"></option>'; }).join("");
    var units = $("unitList");
    units.innerHTML = C.UNITS.map(function (u) { return '<option value="' + U.escapeHtml(u) + '"></option>'; }).join("");
  }

  function fillSelect(select, options) {
    if (!select) return;
    select.innerHTML = options.map(function (o) {
      return '<option value="' + U.escapeHtml(o.value) + '">' + U.escapeHtml(o.label) + "</option>";
    }).join("");
  }

  function loadInitial() {
    settings = S.getSettings();
    var draft = S.getDraft();
    if (draft && draft.meta) {
      state = ensureShape(draft);
    } else {
      state = C.newInvoice(S.numberList(), settings);
      state.options.gst.defaultRate = settings.defaultTaxRate;
      state.items[0].taxRate = settings.defaultTaxRate;
    }
    if (!S.isPersistent()) {
      el.storageBanner.hidden = false;
      el.storageBanner.textContent = "This browser has blocked persistent storage. Invoices work normally but will NOT be saved after you close the tab. Serve the app from a local web server or allow site storage to enable saving.";
    }
  }

  function ensureShape(inv) {
    var def = C.newInvoice([], settings);
    function merge(target, source) {
      for (var k in source) {
        if (!(k in target) || target[k] === null || target[k] === undefined) {
          target[k] = source[k];
        } else if (typeof source[k] === "object" && source[k] !== null && !Array.isArray(source[k])) {
          merge(target[k], source[k]);
        }
      }
      return target;
    }
    merge(inv, def);
    if (!Array.isArray(inv.items) || inv.items.length === 0) inv.items = [C.newServiceRow()];
    if (!Array.isArray(inv.additionalCharges)) inv.additionalCharges = [];
    return inv;
  }

  function bindDataBinds() {
    qsa("[data-bind]").forEach(function (inp) {
      var path = inp.getAttribute("data-bind");
      var type = inp.getAttribute("data-type") || "text";
      var evt = (inp.tagName === "SELECT" || type === "bool" || inp.type === "date" || inp.type === "checkbox") ? "change" : "input";
      inp.addEventListener(evt, function () { handleBoundChange(inp, path, type); });
    });
  }

  function handleBoundChange(inp, path, type) {
    var val;
    if (type === "bool") val = !!inp.checked;
    else if (type === "number") val = inp.value === "" ? 0 : U.toNum(inp.value, 0);
    else val = inp.value;
    setPath(state, path, val);
    onStateChanged(path);
  }

  function bindEvents() {
    bindDataBinds();

    el.itemsContainer.addEventListener("input", onItemInput);
    el.itemsContainer.addEventListener("change", onItemInput);
    el.itemsContainer.addEventListener("click", function (e) {
      var btn = e.target.closest('[data-action="remove-item"]');
      if (btn) removeItem(parseInt(btn.getAttribute("data-index"), 10));
    });

    el.chargesContainer.addEventListener("input", onChargeInput);
    el.chargesContainer.addEventListener("click", function (e) {
      var btn = e.target.closest('[data-action="remove-charge"]');
      if (btn) removeCharge(parseInt(btn.getAttribute("data-index"), 10));
    });

    $("btnAddService").addEventListener("click", addItem);
    $("btnAddCharge").addEventListener("click", addCharge);
    $("btnSuggestNumber").addEventListener("click", suggestNumber);
    $("btnSaveCustomer").addEventListener("click", saveCustomer);
    $("btnDeleteCustomer").addEventListener("click", deleteCustomer);
    el.customerSavedSelect.addEventListener("change", function () { loadCustomer(this.value); });
    el.logoInput.addEventListener("change", onLogoChange);
    $("btnRemoveLogo").addEventListener("click", removeLogo);

    $("btnNew").addEventListener("click", function () { confirmDiscard(doNew); });
    $("btnReset").addEventListener("click", function () { confirmDiscard(doNew); });
    $("btnSave").addEventListener("click", doSave);
    $("btnPreview").addEventListener("click", doPreview);
    $("btnDownload").addEventListener("click", doDownload);
    $("btnPrint").addEventListener("click", doPrint);
    $("btnHistory").addEventListener("click", openHistory);
    $("btnCloseHistory").addEventListener("click", closeHistory);
    $("btnHistoryNew").addEventListener("click", function () { confirmDiscard(doNew); });

    el.historySearch.addEventListener("input", renderHistory);
    el.historyStatusFilter.addEventListener("change", renderHistory);
    el.historySort.addEventListener("change", renderHistory);
    el.historyList.addEventListener("click", onHistoryAction);

    el.overlay.addEventListener("click", function () {
      if (el.confirmModal && !el.confirmModal.hidden) closeConfirm();
      else closeHistory();
    });
    $("confirmCancel").addEventListener("click", function (e) {
      e.preventDefault();
      closeConfirm();
    });
    $("confirmOk").addEventListener("click", function (e) {
      e.preventDefault();
      var cb = confirmCallback;
      confirmCallback = null;
      if (cb) cb();
      if (el.confirmModal) el.confirmModal.hidden = true;
      updateOverlay();
    });

    qsa(".chip[data-terms]").forEach(function (chip) {
      chip.addEventListener("click", function () { applyTerms(parseInt(chip.getAttribute("data-terms"), 10)); });
    });

    qsa(".mobile-tabs .tab").forEach(function (tab) {
      tab.addEventListener("click", function () { switchTab(tab.getAttribute("data-tab")); });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (el.confirmModal && !el.confirmModal.hidden) closeConfirm();
        else if (el.historyDrawer && !el.historyDrawer.hidden) closeHistory();
      }
    });

    window.addEventListener("beforeunload", function (e) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    });

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { fitPreview(); });
      ro.observe(el.previewScaler);
    }
    window.addEventListener("resize", fitPreview);
  }

  function onStateChanged(path) {
    dirty = true;
    if (path === "meta.currency") {
      renderItems();
    }
    syncStatusSelects();
    syncUI();
    recompute();
    scheduleDraft();
  }

  function syncStatusSelects() {
    var v = state.payment ? state.payment.status : "Draft";
    var a = $("statusSelect");
    var b = $("paymentStatusSelect");
    if (a) a.value = v;
    if (b) b.value = v;
  }

  function scheduleDraft() {
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(function () { S.saveDraft(state); }, 500);
  }

  function syncUI() {
    var gst = !!(state.options && state.options.gst && state.options.gst.enabled);
    el.gstFields.hidden = !gst;
    el.gstOffHint.hidden = gst;
    el.gstEnabled.checked = gst;
    el.itemsContainer.classList.toggle("no-tax", !gst);
    renderLogoPreview();
  }

  function renderLogoPreview() {
    var src = state.logo || C.BRAND.logoSrc;
    el.logoPreview.innerHTML = '<img src="' + U.escapeHtml(src) + '" alt="Ationic logo preview">';
  }

  function sniffImageMime(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "image/jpeg";
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "image/png";
    if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "image/webp";
    if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
    return "image/png";
  }

  function bytesToDataUrl(bytes, mime) {
    var binary = "";
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return "data:" + mime + ";base64," + window.btoa(binary);
  }

  function loadOfficialLogo() {
    var brand = C.BRAND;
    if (!brand.logoSrc || brand.logoDataUrl) return;
    var pendingDataUrl = null;
    function commit() {
      if (pendingDataUrl && brand.logoMeta) brand.logoDataUrl = pendingDataUrl;
    }
    var img = new Image();
    img.onload = function () {
      brand.logoMeta = { w: img.naturalWidth, h: img.naturalHeight };
      commit();
    };
    img.src = brand.logoSrc;
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", brand.logoSrc, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = function () {
        if (xhr.response && (xhr.status === 200 || xhr.status === 0)) {
          var bytes = new Uint8Array(xhr.response);
          pendingDataUrl = bytesToDataUrl(bytes, sniffImageMime(bytes));
          commit();
        }
      };
      xhr.send();
    } catch (e) { /* PDF generation falls back gracefully if unavailable */ }
  }

  function currencySymbol() {
    return U.currencyByCode(state.meta.currency || "INR").symbol;
  }

  function itemRowHTML(it, i, sym) {
    var rateOpts = C.GST_RATES.map(function (r) {
      return '<option value="' + r + '"' + (Number(it.taxRate) === r ? " selected" : "") + ">" + r + "%</option>";
    }).join("");
    return '<div class="item-row" data-index="' + i + '">' +
      '<div class="cell cell-service">' +
      '<input type="text" list="serviceList" data-item-bind="name" placeholder="Service name" value="' + U.escapeHtml(it.name || "") + '">' +
      '<input type="text" data-item-bind="description" placeholder="Description (optional)" value="' + U.escapeHtml(it.description || "") + '">' +
      "</div>" +
      '<div class="cell"><input type="number" min="0" step="0.01" data-item-bind="qty" value="' + U.escapeHtml(it.qty) + '"></div>' +
      '<div class="cell"><input type="text" list="unitList" data-item-bind="unit" placeholder="Nos" value="' + U.escapeHtml(it.unit || "") + '"></div>' +
      '<div class="cell"><input type="number" min="0" step="0.01" data-item-bind="rate" value="' + U.escapeHtml(it.rate) + '"></div>' +
      '<div class="cell discount-cell">' +
      '<select data-item-bind="discountType">' +
      '<option value="amount"' + (it.discountType === "amount" ? " selected" : "") + ">" + U.escapeHtml(sym) + "</option>" +
      '<option value="percent"' + (it.discountType === "percent" ? " selected" : "") + ">%</option>" +
      "</select>" +
      '<input type="number" min="0" step="0.01" data-item-bind="discountValue" placeholder="0" value="' + U.escapeHtml(it.discountValue || 0) + '">' +
      "</div>" +
      '<div class="cell tax-cell"><select data-item-bind="taxRate">' + rateOpts + "</select></div>" +
      '<div class="item-total" data-total="' + i + '">' + U.escapeHtml(U.formatMoney(0, state.meta.currency)) + "</div>" +
      '<button type="button" class="remove-btn" data-action="remove-item" data-index="' + i + '" aria-label="Remove service">&times;</button>' +
      "</div>";
  }

  function renderItems() {
    var sym = currencySymbol();
    el.itemsContainer.innerHTML = state.items.map(function (it, i) { return itemRowHTML(it, i, sym); }).join("");
  }

  function onItemInput(e) {
    var inp = e.target.closest("[data-item-bind]");
    if (!inp) return;
    var row = inp.closest(".item-row");
    var index = parseInt(row.getAttribute("data-index"), 10);
    var field = inp.getAttribute("data-item-bind");
    var item = state.items[index];
    if (!item) return;
    if (field === "qty" || field === "rate" || field === "discountValue") {
      item[field] = inp.value === "" ? 0 : U.toNum(inp.value, 0);
    } else if (field === "taxRate") {
      item[field] = U.toNum(inp.value, 0);
    } else {
      item[field] = inp.value;
    }
    onStateChanged("items." + field);
  }

  function addItem() {
    var row = C.newServiceRow();
    row.taxRate = U.toNum(state.options.gst.defaultRate, 18);
    state.items.push(row);
    renderItems();
    onStateChanged("items.add");
  }

  function removeItem(index) {
    if (state.items.length <= 1) {
      state.items = [C.newServiceRow()];
    } else {
      state.items.splice(index, 1);
    }
    renderItems();
    onStateChanged("items.remove");
  }

  function chargeRowHTML(c, i, sym) {
    return '<div class="charge-row" data-index="' + i + '">' +
      '<input type="text" data-charge-bind="label" placeholder="Charge description" value="' + U.escapeHtml(c.label || "") + '">' +
      '<input type="number" min="0" step="0.01" data-charge-bind="amount" placeholder="0.00" value="' + U.escapeHtml(c.amount || 0) + '">' +
      '<button type="button" class="remove-btn" data-action="remove-charge" data-index="' + i + '" aria-label="Remove charge">&times;</button>' +
      "</div>";
  }

  function renderCharges() {
    var sym = currencySymbol();
    if (!state.additionalCharges.length) {
      el.chargesContainer.innerHTML = '<p class="hint">No additional charges added.</p>';
      return;
    }
    el.chargesContainer.innerHTML = state.additionalCharges.map(function (c, i) { return chargeRowHTML(c, i, sym); }).join("");
  }

  function onChargeInput(e) {
    var inp = e.target.closest("[data-charge-bind]");
    if (!inp) return;
    var row = inp.closest(".charge-row");
    var index = parseInt(row.getAttribute("data-index"), 10);
    var field = inp.getAttribute("data-charge-bind");
    var charge = state.additionalCharges[index];
    if (!charge) return;
    charge[field] = field === "amount" ? (inp.value === "" ? 0 : U.toNum(inp.value, 0)) : inp.value;
    onStateChanged("charges." + field);
  }

  function addCharge() {
    var st = state.options.sections;
    st.additionalCharges = true;
    var toggle = byBind("options.sections.additionalCharges")[0];
    if (toggle) toggle.checked = true;
    state.additionalCharges.push({ id: C.newId("chg"), label: "", amount: 0 });
    renderCharges();
    onStateChanged("charges.add");
  }

  function removeCharge(index) {
    state.additionalCharges.splice(index, 1);
    renderCharges();
    onStateChanged("charges.remove");
  }

  function suggestNumber() {
    var n = C.newInvoiceNumber(S.numberList());
    var inp = $("invoiceNumber");
    inp.value = n;
    state.meta.invoiceNumber = n;
    onStateChanged("meta.invoiceNumber");
    toast("Suggested invoice number " + n);
  }

  function applyTerms(days) {
    if (!state.meta.invoiceDate) state.meta.invoiceDate = C.todayISO();
    var due = C.addDaysISO(state.meta.invoiceDate, days);
    state.meta.dueDate = due;
    byBind("meta.invoiceDate").forEach(function (i) { i.value = state.meta.invoiceDate; });
    byBind("meta.dueDate").forEach(function (i) { i.value = due; });
    onStateChanged("meta.dueDate");
    toast("Due date set to " + U.formatDate(due));
  }

  function renderForm() {
    qsa("[data-bind]").forEach(function (inp) {
      var path = inp.getAttribute("data-bind");
      var type = inp.getAttribute("data-type") || "text";
      var v = getPath(state, path);
      if (type === "bool") inp.checked = !!v;
      else inp.value = (v === null || v === undefined) ? "" : v;
    });
    syncStatusSelects();
  }

  function populateCustomers() {
    var list = S.listCustomers();
    var opts = ['<option value="">Select a saved customer…</option>'];
    list.forEach(function (c) {
      opts.push('<option value="' + U.escapeHtml(c.name) + '">' + U.escapeHtml(c.name) + "</option>");
    });
    el.customerSavedSelect.innerHTML = opts.join("");
  }

  function loadCustomer(name) {
    if (!name) return;
    var list = S.listCustomers();
    var found = null;
    list.forEach(function (c) { if (c.name === name) found = c; });
    if (!found) return;
    ["name", "contactPerson", "email", "phone", "address", "city", "state", "pincode", "country", "gstin"].forEach(function (k) {
      state.customer[k] = found[k] || "";
    });
    renderForm();
    onStateChanged("customer");
    toast("Loaded customer " + name);
  }

  function saveCustomer() {
    if (!U.nonEmpty(state.customer.name)) { toast("Enter a customer name before saving.", "error"); return; }
    S.saveCustomer(state.customer.name, state.customer);
    populateCustomers();
    el.customerSavedSelect.value = state.customer.name;
    toast("Customer saved for reuse.", "ok");
  }

  function deleteCustomer() {
    var name = el.customerSavedSelect.value;
    if (!name) { toast("Select a saved customer to delete.", "error"); return; }
    S.deleteCustomer(name);
    populateCustomers();
    toast("Saved customer removed.");
  }

  function onLogoChange(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) { toast("Logo is larger than 2.5 MB. Choose a smaller file.", "error"); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = reader.result;
      var img = new Image();
      img.onload = function () {
        state.logo = dataUrl;
        state.logoMeta = { w: img.naturalWidth, h: img.naturalHeight };
        renderLogoPreview();
        onStateChanged("logo");
        toast("Logo uploaded. It will appear unmodified on the invoice.", "ok");
      };
      img.onerror = function () {
        state.logo = dataUrl;
        state.logoMeta = null;
        renderLogoPreview();
        onStateChanged("logo");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function removeLogo() {
    state.logo = null;
    state.logoMeta = null;
    renderLogoPreview();
    onStateChanged("logo");
  }

  function recompute() {
    var built = Ato.Calc.build(state);
    currentTotals = built.totals;
    currentFlags = built.flags;
    R.renderPreview(el.invoicePreview, state, built.totals, built.flags);
    updateItemTotals();
    updateSummary(built.totals);
    updateStatusNote(built.totals);
    updatePreviewMeta(built.totals);
    if (showValidation) {
      updateValidationBox(Ato.Calc.validate(state, built.totals, S.listInvoices(), state.id));
    }
    requestAnimationFrame(fitPreview);
  }

  function updateItemTotals() {
    var cur = state.meta.currency;
    qsa("[data-total]", el.itemsContainer).forEach(function (node) {
      var i = parseInt(node.getAttribute("data-total"), 10);
      var line = currentTotals.lines[i];
      node.textContent = line ? U.formatMoney(line.lineTotal, cur) : U.formatMoney(0, cur);
    });
  }

  function summaryCell(key, value, highlight) {
    return '<div class="summary-cell' + (highlight ? " highlight" : "") + '"><div class="k">' + U.escapeHtml(key) + '</div><div class="v">' + U.escapeHtml(value) + "</div></div>";
  }

  function updateSummary(t) {
    var cur = state.meta.currency;
    var cells = [];
    cells.push(summaryCell("Subtotal", U.formatMoney(t.subtotal, cur)));
    if (t.totalDiscounts > 0.004) cells.push(summaryCell("Discounts", "\u2212" + U.formatMoney(t.totalDiscounts, cur)));
    if (t.gstOn) cells.push(summaryCell("Taxable", U.formatMoney(t.taxableSubtotal, cur)));
    if (t.gstOn) cells.push(summaryCell("Tax", U.formatMoney(t.totalTax, cur)));
    if (t.chargesTotal !== 0) cells.push(summaryCell("Addl. charges", U.formatMoney(t.chargesTotal, cur)));
    cells.push(summaryCell("Grand Total", U.formatMoney(t.grandTotal, cur), true));
    cells.push(summaryCell("Amount Paid", U.formatMoney(t.amountPaid, cur)));
    cells.push(summaryCell("Balance Due", U.formatMoney(t.balanceDue, cur), t.balanceDue > 0.004));
    el.summaryStrip.innerHTML = cells.join("");
  }

  function updateStatusNote(t) {
    if (t.statusConflict) {
      el.statusNote.innerHTML = '<span class="warn">Warning:</span> the selected status "' + U.escapeHtml(t.manualStatus) + '" differs from the calculated status "' + U.escapeHtml(t.status) + '" based on the balance due. The calculated status will be shown on the invoice.';
    } else {
      el.statusNote.textContent = "Calculated status: " + t.status + "  \u2014  Balance due: " + U.formatMoney(t.balanceDue, state.meta.currency);
    }
  }

  function updatePreviewMeta(t) {
    el.previewMeta.textContent = "A4 \u00B7 210 \u00D7 297 mm \u00B7 " + U.formatMoney(t.grandTotal, state.meta.currency) + " \u00B7 " + t.status;
  }

  function fitPreview() {
    var page = el.invoicePreview;
    var scaler = el.previewScaler;
    if (!page || !scaler || page.offsetWidth === 0) return;
    if (el.previewPane && getComputedStyle(el.previewPane).display === "none") return;
    var avail = scaler.clientWidth - 2;
    if (avail <= 0) return;
    var scale = avail / page.offsetWidth;
    if (scale > 1.4) scale = 1.4;
    page.style.transform = "scale(" + scale + ")";
    scaler.style.height = Math.ceil(page.offsetHeight * scale) + "px";
  }

  function updateValidationBox(errors) {
    if (!errors || errors.length === 0) {
      el.validationBox.hidden = true;
      el.validationList.innerHTML = "";
      return;
    }
    el.validationBox.hidden = false;
    el.validationList.innerHTML = errors.map(function (e) { return "<li>" + U.escapeHtml(e) + "</li>"; }).join("");
  }

  function clearInvalid() {
    qsa(".invalid").forEach(function (n) { n.classList.remove("invalid"); });
  }

  function markInvalid(path) {
    byBind(path).forEach(function (n) { n.classList.add("invalid"); });
  }

  function validateNow() {
    showValidation = true;
    clearInvalid();
    var errors = Ato.Calc.validate(state, currentTotals, S.listInvoices(), state.id);
    if (!U.nonEmpty(state.meta.invoiceNumber)) markInvalid("meta.invoiceNumber");
    if (!U.nonEmpty(state.customer.name)) markInvalid("customer.name");
    if (!U.nonEmpty(state.meta.invoiceDate)) markInvalid("meta.invoiceDate");
    updateValidationBox(errors);
    return errors;
  }

  function doSave() {
    var errors = validateNow();
    if (errors.length) {
      toast(errors.length + " issue(s) need attention before saving.", "error");
      return;
    }
    S.saveInvoice(state);
    S.saveDraft(state);
    dirty = false;
    toast("Invoice " + state.meta.invoiceNumber + " saved to history.", "ok");
    populateCustomers();
    renderHistory();
  }

  function doDownload() {
    var errors = validateNow();
    if (errors.length) { toast("Fix validation errors before downloading.", "error"); return; }
    try {
      var name = P.download(state, currentTotals, currentFlags);
      toast("PDF downloaded: " + name, "ok");
    } catch (err) {
      toast("PDF generation failed: " + (err && err.message ? err.message : err), "error");
    }
  }

  function doPreview() {
    var errors = validateNow();
    if (errors.length) { toast("Fix validation errors before previewing.", "error"); return; }
    try {
      var url = P.openInTab(state, currentTotals, currentFlags);
      if (!url) toast("Preview opened.", "ok");
    } catch (err) {
      toast("Could not open PDF preview: " + (err && err.message ? err.message : err), "error");
    }
  }

  function doPrint() {
    var errors = validateNow();
    if (errors.length) { toast("Fix validation errors before printing.", "error"); return; }
    toast("Opening print dialog \u2014 choose 'Save as PDF' for a true A4 document.");
    setTimeout(function () { window.print(); }, 300);
  }

  function doNew() {
    state = C.newInvoice(S.numberList(), settings);
    state.options.gst.defaultRate = settings.defaultTaxRate;
    state.items[0].taxRate = settings.defaultTaxRate;
    dirty = false;
    showValidation = false;
    el.validationBox.hidden = true;
    clearInvalid();
    renderItems();
    renderCharges();
    renderForm();
    syncUI();
    recompute();
    S.saveDraft(state);
    toast("New blank invoice created.");
    if (window.matchMedia("(max-width: 980px)").matches) switchTab("editor");
  }

  function switchTab(name) {
    document.body.setAttribute("data-tab", name);
    qsa(".mobile-tabs .tab").forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === name);
    });
    if (name === "preview") requestAnimationFrame(fitPreview);
  }

  function updateOverlay() {
    if (!el.overlay) return;
    var show = (el.historyDrawer && !el.historyDrawer.hidden) || (el.confirmModal && !el.confirmModal.hidden);
    el.overlay.hidden = !show;
  }

  function openHistory() {
    // Close confirmation modal if open to avoid overlapping states
    if (el.confirmModal) el.confirmModal.hidden = true;
    confirmCallback = null;
    renderHistory();
    if (el.historyDrawer) el.historyDrawer.hidden = false;
    updateOverlay();
    updateStorageNote();
  }

  function closeHistory() {
    if (el.historyDrawer) el.historyDrawer.hidden = true;
    updateOverlay();
  }

  function updateStorageNote() {
    var persistent = S.isPersistent();
    el.storageNote.textContent = persistent
      ? "Saved in this browser only (localStorage). Not synced across devices."
      : "Storage unavailable \u2014 records exist only for this session.";
  }

  function renderHistory() {
    var all = S.listInvoices();
    var q = el.historySearch.value.trim().toLowerCase();
    var statusFilter = el.historyStatusFilter.value;
    var sort = el.historySort.value;

    var rows = all.map(function (inv) {
      var built = Ato.Calc.build(inv);
      return { inv: inv, t: built.totals };
    });

    rows = rows.filter(function (r) {
      if (statusFilter && r.t.status !== statusFilter) return false;
      if (!q) return true;
      var hay = [r.inv.meta.invoiceNumber, r.inv.customer && r.inv.customer.name, r.t.status].join(" ").toLowerCase();
      return hay.indexOf(q) !== -1;
    });

    rows.sort(function (a, b) {
      switch (sort) {
        case "date-asc": return String(a.inv.meta.invoiceDate).localeCompare(String(b.inv.meta.invoiceDate));
        case "total-desc": return b.t.grandTotal - a.t.grandTotal;
        case "total-asc": return a.t.grandTotal - b.t.grandTotal;
        default: return String(b.inv.meta.invoiceDate).localeCompare(String(a.inv.meta.invoiceDate));
      }
    });

    if (!rows.length) {
      el.historyList.innerHTML = '<div class="history-empty">No saved invoices yet. Create one and press Save Invoice.</div>';
      return;
    }

    el.historyList.innerHTML = rows.map(function (r) {
      var inv = r.inv, t = r.t;
      var cur = inv.meta.currency || "INR";
      return '<div class="history-item" data-id="' + U.escapeHtml(inv.id) + '">' +
        '<div class="history-top">' +
        '<span class="history-num">' + U.escapeHtml(inv.meta.invoiceNumber || "(no number)") + "</span>" +
        '<span class="' + R.badgeClass(t.status) + '">' + U.escapeHtml(t.status) + "</span>" +
        "</div>" +
        '<div class="history-grid">' +
        hCell("Customer", U.displayOr(inv.customer && inv.customer.name, "\u2014")) +
        hCell("Issue date", U.formatDate(inv.meta.invoiceDate) || "\u2014") +
        hCell("Due date", U.formatDate(inv.meta.dueDate) || "\u2014") +
        hCell("Total", U.formatMoney(t.grandTotal, cur)) +
        hCell("Paid", U.formatMoney(t.amountPaid, cur)) +
        hCell("Balance due", U.formatMoney(t.balanceDue, cur)) +
        "</div>" +
        '<div class="history-actions">' +
        '<button type="button" class="mini" data-action="open">Open</button>' +
        '<button type="button" class="mini" data-action="edit">Edit</button>' +
        '<button type="button" class="mini" data-action="duplicate">Duplicate</button>' +
        '<button type="button" class="mini" data-action="download">Download PDF</button>' +
        '<button type="button" class="mini" data-action="delete">Delete</button>' +
        "</div></div>";
    }).join("");
  }

  function hCell(k, v) {
    return '<div class="history-cell"><div class="k">' + U.escapeHtml(k) + '</div><div class="v">' + U.escapeHtml(v) + "</div></div>";
  }

  function onHistoryAction(e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var item = btn.closest(".history-item");
    var id = item.getAttribute("data-id");
    var action = btn.getAttribute("data-action");
    if (action === "open") openInvoice(id, true);
    else if (action === "edit") openInvoice(id, false);
    else if (action === "duplicate") doDuplicate(id);
    else if (action === "download") doHistoryDownload(id);
    else if (action === "delete") doDelete(id);
  }

  function openInvoice(id, showPreview) {
    var inv = S.getInvoice(id);
    if (!inv) { toast("Invoice not found.", "error"); return; }
    confirmDiscard(function () {
      state = ensureShape(U.deepClone(inv));
      dirty = false;
      showValidation = false;
      el.validationBox.hidden = true;
      clearInvalid();
      renderItems();
      renderCharges();
      renderForm();
      syncUI();
      recompute();
      S.saveDraft(state);
      closeHistory();
      switchTab(showPreview ? "preview" : "editor");
      toast("Loaded invoice " + state.meta.invoiceNumber);
    });
  }

  function doDuplicate(id) {
    var copy = S.duplicateInvoice(id);
    if (!copy) { toast("Could not duplicate invoice.", "error"); return; }
    renderHistory();
    toast("Duplicated as " + copy.meta.invoiceNumber, "ok");
  }

  function doHistoryDownload(id) {
    var inv = S.getInvoice(id);
    if (!inv) { toast("Invoice not found.", "error"); return; }
    try {
      var built = Ato.Calc.build(inv);
      P.download(inv, built.totals, built.flags);
      toast("PDF downloaded.", "ok");
    } catch (err) {
      toast("PDF generation failed: " + (err && err.message ? err.message : err), "error");
    }
  }

  function doDelete(id) {
    var inv = S.getInvoice(id);
    if (!inv) return;
    confirmDialog("Delete invoice?", "Delete invoice " + (inv.meta.invoiceNumber || "") + "? This cannot be undone.", function () {
      S.deleteInvoice(id);
      renderHistory();
      toast("Invoice deleted.");
    });
  }

  function confirmDiscard(onProceed) {
    if (!dirty) { onProceed(); return; }
    confirmDialog("Discard unsaved changes?", "This invoice has unsaved changes. Continue and discard them?", onProceed);
  }

  function confirmDialog(title, text, onOk) {
    if (el.confirmTitle) {
      el.confirmTitle.textContent = (title === undefined || title === null) ? "Confirm" : String(title);
    }
    if (el.confirmText) {
      el.confirmText.textContent = (text === undefined || text === null) ? "" : String(text);
    }
    confirmCallback = (typeof onOk === "function") ? onOk : null;
    // Ensure drawer is closed before showing modal to prevent overlap
    if (el.historyDrawer) el.historyDrawer.hidden = true;
    if (el.confirmModal) el.confirmModal.hidden = false;
    updateOverlay();
  }

  function closeConfirm() {
    if (el.confirmModal) el.confirmModal.hidden = true;
    confirmCallback = null;
    updateOverlay();
  }

  function toast(msg, type) {
    el.toast.textContent = msg;
    el.toast.className = "toast" + (type ? " " + type : "");
    el.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, 3400);
  }

  function init() {
    cacheElements();
    populateStatic();
    loadOfficialLogo();
    loadInitial();
    populateCustomers();
    renderItems();
    renderCharges();
    renderForm();
    syncUI();
    bindEvents();
    recompute();
    updateStorageNote();
  }

  return { init: init };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", Ato.App.init);
} else {
  Ato.App.init();
}
