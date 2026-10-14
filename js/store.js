window.Ato = window.Ato || {};

Ato.Store = (function () {
  "use strict";

  var KEYS = {
    invoices: "ationic.invoices.v1",
    settings: "ationic.settings.v1",
    customers: "ationic.customers.v1",
    draft: "ationic.draft.v1"
  };

  var memory = {};
  var persistent = false;

  try {
    var testKey = "ationic.__test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    persistent = true;
  } catch (e) {
    persistent = false;
  }

  function read(key, fallback) {
    try {
      if (persistent) {
        var raw = window.localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
      }
      return key in memory ? memory[key] : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      if (persistent) {
        window.localStorage.setItem(key, JSON.stringify(value));
      } else {
        memory[key] = value;
      }
      return true;
    } catch (e) {
      memory[key] = value;
      return false;
    }
  }

  function isPersistent() {
    return persistent;
  }

  function listInvoices() {
    var list = read(KEYS.invoices, []);
    if (!Array.isArray(list)) list = [];
    return list;
  }

  function getInvoice(id) {
    var list = listInvoices();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function saveInvoice(state) {
    var list = listInvoices();
    var copy = Ato.Util.deepClone(state);
    copy.updatedAt = new Date().toISOString();
    if (!copy.createdAt) copy.createdAt = copy.updatedAt;
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === copy.id) {
        list[i] = copy;
        found = true;
        break;
      }
    }
    if (!found) list.push(copy);
    write(KEYS.invoices, list);
    return copy;
  }

  function deleteInvoice(id) {
    var list = listInvoices().filter(function (inv) { return inv.id !== id; });
    write(KEYS.invoices, list);
  }

  function duplicateInvoice(id) {
    var src = getInvoice(id);
    if (!src) return null;
    var copy = Ato.Util.deepClone(src);
    copy.id = Ato.Config.newId("inv");
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    copy.meta.invoiceNumber = Ato.Config.newInvoiceNumber(numberList());
    copy.payment = copy.payment || {};
    copy.payment.status = "Draft";
    copy.payment.amountPaid = 0;
    var list = listInvoices();
    list.push(copy);
    write(KEYS.invoices, list);
    return copy;
  }

  function numberList() {
    return listInvoices().map(function (inv) { return inv.meta && inv.meta.invoiceNumber; });
  }

  function getSettings() {
    var s = read(KEYS.settings, null);
    var base = Ato.Util.deepClone(Ato.Config.DEFAULT_SETTINGS);
    if (s && typeof s === "object") {
      for (var k in s) base[k] = s[k];
    }
    return base;
  }

  function saveSettings(settings) {
    write(KEYS.settings, settings);
  }

  function listCustomers() {
    var list = read(KEYS.customers, []);
    if (!Array.isArray(list)) list = [];
    return list;
  }

  function saveCustomer(name, customer) {
    if (!Ato.Util.nonEmpty(name)) return;
    var list = listCustomers();
    var clean = Ato.Util.deepClone(customer);
    clean.name = name;
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i].name.toLowerCase() === name.toLowerCase()) {
        list[i] = clean;
        found = true;
        break;
      }
    }
    if (!found) list.push(clean);
    write(KEYS.customers, list);
    return clean;
  }

  function deleteCustomer(name) {
    var list = listCustomers().filter(function (c) {
      return c.name.toLowerCase() !== String(name).toLowerCase();
    });
    write(KEYS.customers, list);
  }

  function saveDraft(state) {
    write(KEYS.draft, state);
  }

  function getDraft() {
    return read(KEYS.draft, null);
  }

  function clearDraft() {
    write(KEYS.draft, null);
  }

  function exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      invoices: listInvoices(),
      customers: listCustomers(),
      settings: getSettings()
    };
  }

  return {
    KEYS: KEYS,
    isPersistent: isPersistent,
    listInvoices: listInvoices,
    getInvoice: getInvoice,
    saveInvoice: saveInvoice,
    deleteInvoice: deleteInvoice,
    duplicateInvoice: duplicateInvoice,
    numberList: numberList,
    getSettings: getSettings,
    saveSettings: saveSettings,
    listCustomers: listCustomers,
    saveCustomer: saveCustomer,
    deleteCustomer: deleteCustomer,
    saveDraft: saveDraft,
    getDraft: getDraft,
    clearDraft: clearDraft,
    exportAll: exportAll
  };
})();
