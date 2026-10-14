window.Ato = window.Ato || {};

Ato.Render = (function () {
  "use strict";

  var U = Ato.Util;
  var B = Ato.Config.BRAND;

  function esc(v) { return U.escapeHtml(v); }

  var ICONS = {
    web: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h4l2 5-2.5 1.5a12 12 0 0 0 6 6L15 14l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 3 5a1 1 0 0 1 1-1z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5H16.5V5c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1V11H7.7v3h2.4v7z"/></svg>'
  };
  function icon(name) { return '<span class="ci" aria-hidden="true">' + ICONS[name] + '</span>'; }

  function badgeClass(status) {
    switch (status) {
      case "Paid": return "badge badge-paid";
      case "Partially Paid": return "badge badge-partial";
      case "Overdue": return "badge badge-overdue";
      case "Unpaid": return "badge badge-unpaid";
      default: return "badge badge-draft";
    }
  }

  function logoHTML(state) {
    var src = state.logo || B.logoSrc;
    var cls = state.logo ? "inv-logo" : "inv-logo is-default";
    return '<img class="' + cls + '" src="' + esc(src) + '" alt="Ationic logo">';
  }

  function headerHTML(state) {
    var a = state.agency || {};
    var rows = [];
    if (U.nonEmpty(a.website)) rows.push(contactRow("web", esc(a.website)));
    if (U.nonEmpty(a.email)) rows.push(contactRow("mail", esc(a.email)));
    if (U.nonEmpty(a.phone)) rows.push(contactRow("phone", esc(a.phone)));
    return '<header class="inv-header">' +
      '<div class="inv-header-brand">' + logoHTML(state) + '</div>' +
      (rows.length ? '<div class="inv-header-contact">' + rows.join("") + '</div>' : '') +
      '</header>';
  }

  function contactRow(name, valueHtml) {
    return '<div class="contact-row">' + icon(name) + '<span>' + valueHtml + '</span></div>';
  }

  function titleHTML(state, totals, flags, cur) {
    var m = state.meta || {};
    var rows = [];
    if (U.nonEmpty(m.invoiceNumber)) rows.push(metaRow("Invoice No.", esc(m.invoiceNumber)));
    if (U.nonEmpty(m.invoiceDate)) rows.push(metaRow("Issue Date", esc(U.formatDate(m.invoiceDate))));
    if (U.nonEmpty(m.dueDate)) rows.push(metaRow("Due Date", esc(U.formatDate(m.dueDate))));
    if (flags.showReference) rows.push(metaRow("Reference", esc(m.reference)));
    if (flags.showPoNumber) rows.push(metaRow("PO Number", esc(m.poNumber)));
    if (flags.showPlaceOfSupply) rows.push(metaRow("Place of Supply", esc(state.options.gst.placeOfSupply)));
    if (totals.status) rows.push('<div class="meta-status">' + '<span class="' + badgeClass(totals.status) + '">' + esc(totals.status) + '</span>' + '</div>');

    return '<section class="inv-title">' +
      '<div class="inv-title-left">' +
      '<h1 class="inv-heading">INVOICE</h1>' +
      '<span class="inv-accent"></span>' +
      '<p class="inv-tagline">' + esc(B.headingTagline) + '</p>' +
      '</div>' +
      '<div class="inv-title-divider"></div>' +
      '<div class="inv-title-right">' + rows.join("") + '</div>' +
      '</section>';
  }

  function metaRow(label, valueHtml) {
    return '<div class="meta-row"><span class="meta-label">' + esc(label) + '</span><span class="meta-value">' + valueHtml + '</span></div>';
  }

  function partyHead(title) {
    return '<h3 class="party-head">' + esc(title) + '<span class="inv-accent small"></span></h3>';
  }

  function infoLine(name, valueHtml) {
    return '<div class="party-line info">' + icon(name) + '<span>' + valueHtml + '</span></div>';
  }

  function customerLines(state, flags) {
    var c = state.customer || {};
    var html = [];
    html.push('<div class="party-name">' + (U.nonEmpty(c.name) ? esc(c.name) : '<span class="muted">\u2014</span>') + '</div>');
    if (flags.showCustomerContact) {
      if (U.nonEmpty(c.contactPerson)) html.push('<div class="party-line">' + esc(c.contactPerson) + '</div>');
      if (U.nonEmpty(c.email)) html.push(infoLine("mail", esc(c.email)));
      if (U.nonEmpty(c.phone)) html.push(infoLine("phone", esc(c.phone)));
    }
    if (flags.showBillingAddress) {
      if (U.nonEmpty(c.address)) html.push('<div class="party-line">' + U.nl2br(c.address) + '</div>');
      var cityline = [c.city, c.state, c.pincode].filter(U.nonEmpty).join(", ");
      if (cityline) html.push('<div class="party-line">' + esc(cityline) + '</div>');
      if (U.nonEmpty(c.country)) html.push('<div class="party-line">' + esc(c.country) + '</div>');
    }
    if (flags.showCustomerGstin) html.push('<div class="party-line"><span class="lbl">GSTIN:</span> ' + esc(c.gstin) + '</div>');
    return html.join("");
  }

  function agencyLines(state, flags) {
    var a = state.agency || {};
    var html = [];
    if (U.nonEmpty(a.name)) html.push('<div class="party-name">' + esc(a.name) + '</div>');
    if (U.nonEmpty(a.address)) html.push('<div class="party-line">' + U.nl2br(a.address) + '</div>');
    var cityline = [a.city, a.state, a.pincode].filter(U.nonEmpty).join(", ");
    if (cityline) html.push('<div class="party-line">' + esc(cityline) + '</div>');
    if (U.nonEmpty(a.country)) html.push('<div class="party-line">' + esc(a.country) + '</div>');
    if (U.nonEmpty(a.phone)) html.push(infoLine("phone", esc(a.phone)));
    if (U.nonEmpty(a.email)) html.push(infoLine("mail", esc(a.email)));
    if (U.nonEmpty(a.website)) html.push(infoLine("web", esc(a.website)));
    if (flags.showAgencyGstin) html.push('<div class="party-line"><span class="lbl">GSTIN:</span> ' + esc(a.gstin) + '</div>');
    if (flags.showRegistration) html.push('<div class="party-line"><span class="lbl">Reg. No.:</span> ' + esc(a.registration) + '</div>');
    return html.join("");
  }

  function partiesHTML(state, flags) {
    return '<section class="inv-parties">' +
      '<div class="party party-to">' + partyHead("Billed To") + '<div class="party-panel">' + customerLines(state, flags) + '</div></div>' +
      '<div class="party party-from">' + partyHead("From") + '<div class="party-panel">' + agencyLines(state, flags) + '</div></div>' +
      '</section>';
  }

  function servicesTableHTML(state, totals, flags, cur) {
    var gst = flags.showGst;
    var head = '<tr><th class="c-num">#</th><th class="c-desc">Service / Description</th>' +
      '<th class="c-qty">Qty</th><th class="c-rate">Unit Price (' + esc(cur) + ')</th><th class="c-disc">Discount</th>' +
      (gst ? '<th class="c-tax">Tax</th>' : '') + '<th class="c-amt">Amount (' + esc(cur) + ')</th></tr>';

    var rows = totals.lines.map(function (line) {
      var desc = '<div class="row-name">' + (line.hasName ? esc(line.name) : '<span class="muted">\u2014</span>') + '</div>';
      if (line.hasDescription) desc += '<div class="row-desc">' + U.nl2br(line.description) + '</div>';
      var sac = flags.showSac ? (line.sac || (state.options.gst && state.options.gst.sac)) : "";
      if (sac) desc += '<div class="row-sac">SAC: ' + esc(sac) + '</div>';

      var disc = "";
      if (line.discount > 0.004) {
        disc = '<div>' + esc(U.formatMoney(line.discount, cur)) + '</div>';
        if (U.nonEmpty(line.discountLabel)) disc += '<div class="row-sub">' + esc(line.discountLabel) + '</div>';
      }

      var qty = '<div>' + esc(U.formatQty(line.qty)) + '</div>' + (U.nonEmpty(line.unit) ? '<div class="row-sub">' + esc(line.unit) + '</div>' : '');

      return '<tr>' +
        '<td class="c-num">' + line.index + '</td>' +
        '<td class="c-desc">' + desc + '</td>' +
        '<td class="c-qty">' + qty + '</td>' +
        '<td class="c-rate">' + esc(U.formatMoney(line.rate, cur)) + '</td>' +
        '<td class="c-disc">' + disc + '</td>' +
        (gst ? '<td class="c-tax">' + (line.taxRate > 0 ? esc(U.round2(line.taxRate)) + "%" : "\u2014") + '</td>' : '') +
        '<td class="c-amt">' + esc(U.formatMoney(line.lineTotal, cur)) + '</td>' +
        '</tr>';
    }).join("");

    return '<section class="inv-table-wrap"><table class="inv-table' + (gst ? ' has-gst' : '') + '">' +
      '<thead>' + head + '</thead><tbody>' + rows + '</tbody></table></section>';
  }

  function totalsHTML(state, totals, flags, cur) {
    var rows = [];
    rows.push(totalRow("Subtotal", U.formatMoney(totals.subtotal, cur)));
    if (totals.lineDiscountTotal > 0.004) {
      rows.push(totalRow("Line Discounts", "\u2212" + U.formatMoney(totals.lineDiscountTotal, cur)));
    }
    if (totals.invoiceDiscount > 0.004) {
      rows.push(totalRow(U.displayOr(totals.invoiceDiscountLabel, "Discount"), "\u2212" + U.formatMoney(totals.invoiceDiscount, cur)));
    }
    if (flags.showGst) {
      rows.push(totalRow("Taxable Amount", U.formatMoney(totals.taxableSubtotal, cur)));
      totals.taxes.forEach(function (t) {
        rows.push(totalRow(t.label, U.formatMoney(t.amount, cur)));
      });
    }
    if (flags.showAdditionalCharges) {
      totals.chargeLines.forEach(function (c) {
        rows.push(totalRow(c.label, U.formatMoney(c.amount, cur)));
      });
    }
    rows.push('<div class="total-row grand"><span>Total Due</span><span>' + esc(U.formatMoney(totals.grandTotal, cur)) + '</span></div>');
    if (totals.amountPaid > 0.004) {
      rows.push(totalRow("Amount Paid", "\u2212" + U.formatMoney(totals.amountPaid, cur)));
      rows.push('<div class="total-row balance"><span>Balance Due</span><span>' + esc(U.formatMoney(totals.balanceDue, cur)) + '</span></div>');
    }

    return '<section class="inv-totals"><div class="totals-panel">' + rows.join("") + '</div></section>';
  }

  function totalRow(label, valueHtml) {
    return '<div class="total-row"><span>' + esc(label) + '</span><span>' + valueHtml + '</span></div>';
  }

  function wordsHTML(state, totals, flags, cur) {
    if (!flags.showAmountInWords) return "";
    var words = U.amountToWords(totals.grandTotal, cur);
    return '<section class="inv-words"><span class="words-label">Amount in Words:</span> <span class="words-value">' + esc(words) + '</span></section>';
  }

  function paymentPanelHTML(state, flags) {
    if (!flags.showPaymentPanel) return "";
    var b = state.bank || {};
    var parts = [];
    if (flags.showBank) {
      var lines = [];
      if (U.nonEmpty(b.bankName)) lines.push(payLine("Bank", b.bankName));
      if (U.nonEmpty(b.accountHolder)) lines.push(payLine("Account Holder", b.accountHolder));
      if (U.nonEmpty(b.accountNumber)) lines.push(payLine("Account No.", b.accountNumber));
      if (U.nonEmpty(b.ifsc)) lines.push(payLine("IFSC", b.ifsc));
      if (U.nonEmpty(b.branch)) lines.push(payLine("Branch", b.branch));
      if (lines.length) parts.push('<div class="pay-group"><h4 class="pay-subhead">Bank Transfer</h4>' + lines.join("") + '</div>');
    }
    if (flags.showUpi && U.nonEmpty(state.upi && state.upi.id)) {
      parts.push('<div class="pay-group"><h4 class="pay-subhead">UPI</h4>' + payLine("UPI ID", state.upi.id) + '</div>');
    }
    if (flags.showPaymentInstructions && U.nonEmpty(state.paymentInstructions)) {
      parts.push('<div class="pay-group"><h4 class="pay-subhead">Payment Instructions</h4><div class="pay-text">' + U.nl2br(state.paymentInstructions) + '</div></div>');
    }
    if (flags.showPaymentTerms && U.nonEmpty(state.paymentTerms)) {
      parts.push('<div class="pay-group"><h4 class="pay-subhead">Payment Terms</h4><div class="pay-text">' + U.nl2br(state.paymentTerms) + '</div></div>');
    }
    return parts.length ? '<div class="lower-col pay-col"><h3 class="lower-head">Payment Details<span class="inv-accent small"></span></h3><div class="pay-panel">' + parts.join("") + '</div></div>' : "";
  }

  function payLine(label, value) {
    return '<div class="pay-line"><span class="pay-label">' + esc(label) + '</span><span class="pay-value">' + esc(value) + '</span></div>';
  }

  function notesPanelHTML(state, flags) {
    if (!flags.showNotesPanel) return "";
    var parts = [];
    if (flags.showNotes && U.nonEmpty(state.notes)) {
      parts.push('<div class="pay-group"><h4 class="pay-subhead">Notes</h4><div class="pay-text">' + U.nl2br(state.notes) + '</div></div>');
    }
    if (flags.showTerms && U.nonEmpty(state.terms)) {
      var termLines = String(state.terms || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(function (s) { return s; });
      parts.push('<div class="pay-group"><h4 class="pay-subhead">Terms &amp; Conditions</h4><ol class="terms-list">' + termLines.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join("") + '</ol></div>');
    }
    if (flags.showFooterMessage && U.nonEmpty(state.footerMessage)) {
      parts.push('<div class="pay-group"><div class="pay-text">' + U.nl2br(state.footerMessage) + '</div></div>');
    }
    return parts.length ? '<div class="lower-col notes-col"><h3 class="lower-head">Notes &amp; Terms<span class="inv-accent small"></span></h3>' + parts.join("") + '</div>' : "";
  }

  function lowerHTML(state, flags) {
    if (!flags.showLowerSection) return "";
    var pay = paymentPanelHTML(state, flags);
    var notes = notesPanelHTML(state, flags);
    if (!pay && !notes) return "";
    return '<section class="inv-lower">' + pay + notes + '</section>';
  }

  function footerTaglineHTML() {
    var words = String(B.tagline || "").split(/\s+/).filter(function (s) { return s; });
    if (!words.length) return "";
    var last = words.pop();
    var lead = words.join(" ");
    return '<span class="footer-tagline">' + (lead ? esc(lead) + " " : "") + '<span class="grow">' + esc(last) + '</span></span>';
  }

  function footerHTML(state, flags) {
    var right = [];
    if (flags.footerInstagram) right.push('<span class="soc">' + icon("instagram") + 'Instagram: ' + esc(B.instagram) + '</span>');
    if (flags.footerFacebook) right.push('<span class="soc">' + icon("facebook") + 'Facebook: ' + esc(B.facebook) + '</span>');
    if (flags.footerWebsite) right.push('<span class="soc">' + icon("web") + esc(B.websiteLabel) + '</span>');
    var left = flags.footerTagline ? footerTaglineHTML() : "";
    if (!left && right.length === 0) {
      return "";
    }
    return '<footer class="inv-footer">' +
      '<div class="footer-rule"></div>' +
      '<div class="footer-row"><div class="footer-left">' + left + '</div>' +
      '<div class="footer-right">' + right.join('<span class="sep"></span>') + '</div></div>' +
      '</footer>';
  }

  function invoiceHTML(state, totals, flags) {
    var cur = state.meta.currency || "INR";
    return '<div class="inv">' +
      headerHTML(state) +
      '<div class="inv-body">' +
      titleHTML(state, totals, flags, cur) +
      '<div class="inv-yellow-line"></div>' +
      partiesHTML(state, flags) +
      servicesTableHTML(state, totals, flags, cur) +
      totalsHTML(state, totals, flags, cur) +
      wordsHTML(state, totals, flags, cur) +
      lowerHTML(state, flags) +
      footerHTML(state, flags) +
      '</div>' +
      '</div>';
  }

  function renderPreview(container, state, totals, flags) {
    container.innerHTML = invoiceHTML(state, totals, flags);
  }

  return {
    invoiceHTML: invoiceHTML,
    renderPreview: renderPreview,
    badgeClass: badgeClass,
    logoHTML: logoHTML
  };
})();
