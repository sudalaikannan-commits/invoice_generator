window.Ato = window.Ato || {};

Ato.Calc = (function () {
  "use strict";

  var U = Ato.Util;

  function lineGross(item) {
    var qty = U.toPosNum(item.qty);
    var rate = U.toPosNum(item.rate);
    return U.round2(qty * rate);
  }

  function lineDiscount(item, gross) {
    var val = U.toPosNum(item.discountValue);
    if (item.discountType === "percent") {
      var pct = U.clamp(val, 0, 100);
      return U.round2(gross * pct / 100);
    }
    return U.round2(U.clamp(val, 0, gross));
  }

  function compute(state) {
    var opts = state.options || Ato.Config.defaultOptions();
    var gstOn = !!(opts.gst && opts.gst.enabled);
    var inclusive = gstOn && opts.gst.mode === "inclusive";
    var split = (opts.gst && opts.gst.split) || "cgst_sgst";

    var items = Array.isArray(state.items) ? state.items : [];

    var lines = [];
    var subtotal = 0;
    var lineDiscountTotal = 0;
    var taxableLineTotal = 0;
    var uniformRate = true;
    var firstRate = null;

    items.forEach(function (item, idx) {
      var gross = lineGross(item);
      var disc = lineDiscount(item, gross);
      var taxableLine = U.round2(gross - disc);
      var rate = gstOn ? U.clamp(U.toPosNum(item.taxRate), 0, 100) : 0;
      if (firstRate === null) firstRate = rate;
      else if (Math.abs(firstRate - rate) > 1e-9) uniformRate = false;

      subtotal = U.round2(subtotal + gross);
      lineDiscountTotal = U.round2(lineDiscountTotal + disc);
      taxableLineTotal = U.round2(taxableLineTotal + taxableLine);

      lines.push({
        index: idx + 1,
        id: item.id,
        name: U.displayOr(item.name, ""),
        description: U.displayOr(item.description, ""),
        hasDescription: U.nonEmpty(item.description),
        hasName: U.nonEmpty(item.name),
        qty: U.toPosNum(item.qty),
        unit: U.displayOr(item.unit, ""),
        rate: U.toPosNum(item.rate),
        gross: gross,
        discount: disc,
        discountLabel: item.discountType === "percent" ? (U.toPosNum(item.discountValue) + "%") : "",
        taxRate: rate,
        sac: U.displayOr(item.sac, ""),
        taxableLine: taxableLine
      });
    });

    var invDisc = state.discount || { type: "amount", value: 0 };
    var invDiscValue = U.toPosNum(invDisc.value);
    var invoiceDiscount;
    if (invDisc.type === "percent") {
      invoiceDiscount = U.round2(taxableLineTotal * U.clamp(invDiscValue, 0, 100) / 100);
    } else {
      invoiceDiscount = U.round2(U.clamp(invDiscValue, 0, taxableLineTotal));
    }

    var factor = taxableLineTotal > 0 ? (taxableLineTotal - invoiceDiscount) / taxableLineTotal : 0;

    var totalTax = 0;
    var taxableSubtotal = 0;

    lines.forEach(function (line) {
      var adjTaxable = U.round2(line.taxableLine * factor);
      var lineTax = 0;
      var netTaxable = adjTaxable;
      if (gstOn && line.taxRate > 0) {
        if (inclusive) {
          lineTax = U.round2(adjTaxable * line.taxRate / (100 + line.taxRate));
          netTaxable = U.round2(adjTaxable - lineTax);
        } else {
          lineTax = U.round2(adjTaxable * line.taxRate / 100);
          netTaxable = adjTaxable;
        }
      }
      line.adjTaxable = adjTaxable;
      line.netTaxable = netTaxable;
      line.taxAmount = lineTax;
      line.lineTotal = inclusive ? adjTaxable : U.round2(adjTaxable + lineTax);
      totalTax = U.round2(totalTax + lineTax);
      taxableSubtotal = U.round2(taxableSubtotal + netTaxable);
    });

    var charges = Array.isArray(state.additionalCharges) ? state.additionalCharges : [];
    var chargeLines = [];
    var chargesTotal = 0;
    charges.forEach(function (c) {
      var amt = U.toNum(c.amount, 0);
      if (U.nonEmpty(c.label) || Math.abs(amt) > 0.004) {
        chargeLines.push({ label: U.displayOr(c.label, "Additional Charge"), amount: U.round2(amt) });
        chargesTotal = U.round2(chargesTotal + amt);
      }
    });

    var preCharges = U.round2(taxableSubtotal + totalTax);
    var grandTotal = U.round2(preCharges + chargesTotal);
    var amountPaid = U.round2(U.clamp(U.toPosNum(state.payment ? state.payment.amountPaid : 0), 0, Math.max(grandTotal, 0)));
    var balanceDue = U.round2(grandTotal - amountPaid);
    var totalDiscounts = U.round2(lineDiscountTotal + invoiceDiscount);
    var lineTaxableBase = lines.reduce(function (a, l) { return U.round2(a + l.taxableLine); }, 0);
    var lineBase = U.round2(taxableLineTotal - invoiceDiscount);

    var taxes = [];
    if (gstOn && totalTax > 0) {
      if (split === "igst") {
        taxes.push({ label: "IGST" + (uniformRate && firstRate ? " @ " + firstRate + "%" : ""), amount: totalTax });
      } else {
        var cgst = U.round2(totalTax / 2);
        var sgst = U.round2(totalTax - cgst);
        var suffix = uniformRate && firstRate ? " @ " + U.round2(firstRate / 2) + "%" : "";
        taxes.push({ label: "CGST" + suffix, amount: cgst });
        taxes.push({ label: "SGST" + suffix, amount: sgst });
      }
    }

    var status = deriveStatus(state, grandTotal, amountPaid, balanceDue);

    return {
      gstOn: gstOn,
      inclusive: inclusive,
      split: split,
      lines: lines,
      subtotal: subtotal,
      lineDiscountTotal: lineDiscountTotal,
      invoiceDiscount: invoiceDiscount,
      invoiceDiscountLabel: invDisc.label || "Discount",
      totalDiscounts: totalDiscounts,
      taxableLineTotal: lineTaxableBase,
      lineBase: lineBase,
      taxableSubtotal: taxableSubtotal,
      taxes: taxes,
      totalTax: totalTax,
      chargeLines: chargeLines,
      chargesTotal: chargesTotal,
      grandTotal: grandTotal,
      amountPaid: amountPaid,
      balanceDue: balanceDue,
      uniformRate: uniformRate,
      status: status.effective,
      manualStatus: status.manual,
      statusConflict: status.conflict
    };
  }

  function deriveStatus(state, grandTotal, amountPaid, balanceDue) {
    var manual = (state.payment && state.payment.status) || "Draft";
    var due = state.meta ? state.meta.dueDate : "";
    var derived;
    if (grandTotal <= 0.004) {
      derived = manual === "Draft" ? "Draft" : "Unpaid";
    } else if (balanceDue <= 0.004) {
      derived = "Paid";
    } else if (due && U.isPast(due) && balanceDue > 0.004) {
      derived = "Overdue";
    } else if (amountPaid > 0.004) {
      derived = "Partially Paid";
    } else {
      derived = "Unpaid";
    }
    var effective = manual === "Draft" ? "Draft" : derived;
    if (manual !== "Draft" && amountPaid > 0.004) effective = derived;
    var conflict = manual !== "Draft" && manual !== derived;
    return { effective: effective, manual: manual, conflict: conflict };
  }

  var DEFAULT_FLAGS = {
    showReference: false,
    showPoNumber: false,
    showCustomerContact: false,
    showBillingAddress: false,
    showCustomerGstin: false,
    showAgencyGstin: false,
    showRegistration: false,
    showGst: false,
    showSac: false,
    showPlaceOfSupply: false,
    showBank: false,
    showUpi: false,
    showPaymentInstructions: false,
    showPaymentTerms: false,
    showNotes: false,
    showTerms: false,
    showAmountInWords: false,
    showAdditionalCharges: false,
    showDiscount: false,
    hasCustomer: false,
    hasCustomerName: false
  };

  function buildFlags(state, totals) {
    var opts = state.options || Ato.Config.defaultOptions();
    var s = opts.sections || {};
    var c = state.customer || {};
    var a = state.agency || {};
    var g = opts.gst || {};
    var f = {};
    for (var k in DEFAULT_FLAGS) f[k] = DEFAULT_FLAGS[k];

    var customerDetail = U.nonEmpty(c.name) || U.nonEmpty(c.contactPerson) || U.nonEmpty(c.email) ||
      U.nonEmpty(c.phone) || U.nonEmpty(c.address) || U.nonEmpty(c.city) || U.nonEmpty(c.state) ||
      U.nonEmpty(c.pincode) || U.nonEmpty(c.country);
    f.hasCustomerName = U.nonEmpty(c.name);
    f.hasCustomer = customerDetail;

    f.showReference = !!s.reference && U.nonEmpty(state.meta.reference);
    f.showPoNumber = !!s.poNumber && U.nonEmpty(state.meta.poNumber);
    f.showCustomerContact = !!s.customerContact && (U.nonEmpty(c.contactPerson) || U.nonEmpty(c.email) || U.nonEmpty(c.phone));
    f.showBillingAddress = !!s.billingAddress && (U.nonEmpty(c.address) || U.nonEmpty(c.city) || U.nonEmpty(c.state) || U.nonEmpty(c.pincode) || U.nonEmpty(c.country));
    f.showCustomerGstin = !!s.customerGstin && totals.gstOn && U.nonEmpty(c.gstin);
    f.showAgencyGstin = !!s.agencyGstin && totals.gstOn && U.nonEmpty(a.gstin);
    f.showRegistration = !!s.registration && U.nonEmpty(a.registration);

    f.showGst = totals.gstOn && totals.totalTax > 0;
    f.showSac = !!s.sac && totals.gstOn && (U.nonEmpty(g.sac) || totals.lines.some(function (l) { return U.nonEmpty(l.sac); }));
    f.showPlaceOfSupply = !!s.placeOfSupply && totals.gstOn && U.nonEmpty(g.placeOfSupply);

    var b = state.bank || {};
    f.showBank = !!s.bank && (U.nonEmpty(b.bankName) || U.nonEmpty(b.accountHolder) || U.nonEmpty(b.accountNumber) || U.nonEmpty(b.ifsc) || U.nonEmpty(b.branch));
    f.showUpi = !!s.upi && U.nonEmpty(state.upi && state.upi.id);
    f.showPaymentInstructions = !!s.paymentInstructions && U.nonEmpty(state.paymentInstructions);
    f.showPaymentTerms = !!s.paymentTerms && U.nonEmpty(state.paymentTerms);

    f.showNotes = !!s.notes && U.nonEmpty(state.notes);
    f.showTerms = !!s.terms && U.nonEmpty(state.terms);

    f.showAmountInWords = !!s.amountInWords && totals.grandTotal > 0;
    f.showAdditionalCharges = totals.chargeLines.length > 0;
    f.showDiscount = totals.totalDiscounts > 0.004;

    f.showFooterMessage = !!s.footerMessage && U.nonEmpty(state.footerMessage);
    f.footerTagline = !!s.footerTagline;
    f.footerInstagram = !!s.footerInstagram;
    f.footerFacebook = !!s.footerFacebook;
    f.footerWebsite = !!s.footerWebsite;

    f.showPaymentPanel = f.showBank || f.showUpi || f.showPaymentInstructions || f.showPaymentTerms;
    f.showNotesPanel = f.showNotes || f.showTerms || f.showFooterMessage;
    f.showLowerSection = f.showPaymentPanel || f.showNotesPanel;

    return f;
  }

  function build(state) {
    var totals = compute(state);
    var flags = buildFlags(state, totals);
    return { totals: totals, flags: flags };
  }

  function validate(state, totals, savedInvoices, currentId) {
    var errors = [];
    var m = state.meta || {};
    var c = state.customer || {};

    if (!U.nonEmpty(m.invoiceNumber)) errors.push("Invoice number is required.");
    if (!U.nonEmpty(c.name)) errors.push("Customer name is required.");
    if (!U.nonEmpty(m.invoiceDate)) errors.push("Invoice date is required.");
    if (U.nonEmpty(m.dueDate) && U.nonEmpty(m.invoiceDate) && m.dueDate < m.invoiceDate) {
      errors.push("Due date cannot be earlier than the invoice date.");
    }
    if (U.nonEmpty(c.email) && !U.isValidEmail(c.email)) errors.push("Customer email format is invalid.");

    var validRows = 0;
    (state.items || []).forEach(function (item, i) {
      var hasName = U.nonEmpty(item.name);
      var hasRate = U.toNum(item.rate, 0) > 0;
      var hasQty = U.toNum(item.qty, 0) > 0;
      if (!hasName && !hasRate && !hasQty) return;
      var row = i + 1;
      if (hasRate || hasQty) {
        if (!U.nonEmpty(item.name)) errors.push("Service row " + row + ": service name is required.");
        if (!(U.toNum(item.qty, 0) > 0)) errors.push("Service row " + row + ": quantity must be greater than 0.");
        if (U.toNum(item.rate, 0) < 0) errors.push("Service row " + row + ": unit price cannot be negative.");
        if (U.nonEmpty(item.discountValue)) {
          var dv = U.toNum(item.discountValue, 0);
          if (dv < 0) errors.push("Service row " + row + ": discount cannot be negative.");
          if (item.discountType === "percent" && dv > 100) errors.push("Service row " + row + ": discount percent cannot exceed 100%.");
        }
        validRows++;
      }
    });
    if (validRows === 0) errors.push("Add at least one service with a name, quantity and unit price.");

    var paidRaw = state.payment ? U.toNum(state.payment.amountPaid, 0) : 0;
    if (paidRaw < 0) errors.push("Amount paid cannot be negative.");

    var opts = state.options || {};
    if (opts.gst && opts.gst.enabled) {
      (state.items || []).forEach(function (item, i) {
        var r = U.toNum(item.taxRate, 0);
        if (r < 0 || r > 100) errors.push("Service row " + (i + 1) + ": tax rate must be between 0% and 100%.");
      });
    }

    var norm = String(m.invoiceNumber || "").trim().toLowerCase();
    (savedInvoices || []).forEach(function (inv) {
      if (inv.id === currentId) return;
      var other = String(inv.meta && inv.meta.invoiceNumber || "").trim().toLowerCase();
      if (norm && other === norm) errors.push('Invoice number "' + m.invoiceNumber + '" already exists in history.');
    });

    return errors;
  }

  return {
    compute: compute,
    build: build,
    buildFlags: buildFlags,
    validate: validate,
    deriveStatus: deriveStatus
  };
})();
