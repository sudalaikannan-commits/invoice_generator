window.Ato = window.Ato || {};

Ato.Pdf = (function () {
  "use strict";

  var U = Ato.Util;
  var B = Ato.Config.BRAND;

  var BLACK = [8, 8, 8];
  var WHITE = [255, 255, 255];
  var YELLOW = [255, 214, 0];
  var TEXT = [23, 23, 23];
  var MUTED = [102, 102, 102];
  var BORDER = [226, 226, 226];
  var HEADER_CONTACT = [222, 222, 222];
  var PANEL_BG = [246, 246, 247];
  var PANEL_BORDER = [234, 234, 236];
  var PALE_Y = [255, 247, 209];

  var W = 210, H = 297, M = 14, CW = 182;
  var HEADER_H = 25;
  var CONT_HEADER_H = 13;
  var BOTTOM = H - 24;
  var PANEL_W = 84;

  function makeCtx(doc, state) {
    return {
      doc: doc,
      state: state,
      cur: (state.meta && state.meta.currency) || "INR",
      font: "helvetica",
      y: 0,
      page: 1
    };
  }

  function registerFonts(ctx) {
    var doc = ctx.doc;
    var fonts = window.ATIONIC_FONTS;
    if (!fonts || !fonts.regular || !fonts.bold) return;
    try {
      doc.addFileToVFS("NotoSans-Regular.ttf", fonts.regular);
      doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
      doc.addFileToVFS("NotoSans-Bold.ttf", fonts.bold);
      doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
      ctx.font = "NotoSans";
    } catch (e) {
      ctx.font = "helvetica";
    }
  }

  function setFont(ctx, size, bold, color) {
    var doc = ctx.doc;
    doc.setFont(ctx.font, bold ? "bold" : "normal");
    doc.setFontSize(size);
    var c = color || TEXT;
    doc.setTextColor(c[0], c[1], c[2]);
  }

  function T(ctx, str, x, y, o) {
    o = o || {};
    setFont(ctx, o.size || 9, o.bold, o.color);
    ctx.doc.text(String(str), x, y, {
      align: o.align || "left",
      baseline: o.baseline || "top",
      maxWidth: o.maxWidth
    });
  }

  function TW(ctx, str, size, bold) {
    setFont(ctx, size || 9, bold);
    return ctx.doc.getTextWidth(String(str));
  }

  function wrap(ctx, str, size, bold, maxWidth) {
    setFont(ctx, size, bold);
    return ctx.doc.splitTextToSize(String(str), maxWidth);
  }

  function fill(ctx, x, y, w, h, color) {
    ctx.doc.setFillColor(color[0], color[1], color[2]);
    ctx.doc.rect(x, y, w, h, "F");
  }

  function hline(ctx, x1, x2, y, color, wd) {
    ctx.doc.setDrawColor(color[0], color[1], color[2]);
    ctx.doc.setLineWidth(wd || 0.2);
    ctx.doc.line(x1, y, x2, y);
  }

  function resolveLogo(state) {
    if (state && state.logo) return { dataUrl: state.logo, meta: state.logoMeta };
    var brand = Ato.Config.BRAND;
    if (brand && brand.logoDataUrl) return { dataUrl: brand.logoDataUrl, meta: brand.logoMeta };
    return null;
  }

  function drawLogo(ctx, x, centerY, maxW, maxH) {
    var logo = resolveLogo(ctx.state);
    if (!logo) return false;
    try {
      var fmt = /^data:image\/jpe?g/i.test(logo.dataUrl) ? "JPEG" : "PNG";
      var w = maxW;
      var h = maxH;
      if (logo.meta && logo.meta.w && logo.meta.h) {
        var ratio = logo.meta.w / logo.meta.h;
        h = maxH;
        w = h * ratio;
        if (w > maxW) { w = maxW; h = w / ratio; }
      }
      ctx.doc.addImage(logo.dataUrl, fmt, x, centerY - h / 2, w, h);
      return true;
    } catch (e) {
      return false;
    }
  }

  function drawHeader(ctx) {
    var st = ctx.state;
    fill(ctx, 0, 0, W, HEADER_H, BLACK);
    fill(ctx, 0, HEADER_H - 1, W, 1, YELLOW);

    // Official logo contains empty black padding; fit it to the full header
    // height so the visible artwork matches the on-screen preview.
    // Custom uploaded logos keep the original contained sizing.
    drawLogo(ctx, M, HEADER_H / 2, st.logo ? 66 : 72, st.logo ? 22 : 25);

    var a = st.agency || {};
    var contacts = [];
    if (U.nonEmpty(a.website)) contacts.push(a.website);
    if (U.nonEmpty(a.email)) contacts.push(a.email);
    if (U.nonEmpty(a.phone)) contacts.push(a.phone);
    var step = 6;
    var startY = (HEADER_H - (contacts.length - 1) * step) / 2 - 1.2;
    contacts.forEach(function (c, i) {
      var yy = startY + i * step;
      var tw = TW(ctx, c, 8.3, false);
      ctx.doc.setFillColor(YELLOW[0], YELLOW[1], YELLOW[2]);
      ctx.doc.circle(W - M - tw - 4.6, yy + 1.5, 1.0, "F");
      T(ctx, c, W - M, yy, { size: 8.3, color: HEADER_CONTACT, align: "right" });
    });
  }

  function drawContinuationHeader(ctx) {
    fill(ctx, 0, 0, W, CONT_HEADER_H, BLACK);
    fill(ctx, 0, CONT_HEADER_H - 1, W, 1, YELLOW);
    drawLogo(ctx, M, CONT_HEADER_H / 2, 22, 7.5);
    var num = (ctx.state.meta && ctx.state.meta.invoiceNumber) || "";
    T(ctx, "Invoice " + num + "  \u2014  continued", W - M, 4.6, { size: 8, color: HEADER_CONTACT, align: "right" });
  }

  function newPage(ctx) {
    ctx.doc.addPage();
    ctx.page += 1;
    drawContinuationHeader(ctx);
    ctx.y = CONT_HEADER_H + 6;
  }

  function ensureSpace(ctx, needed) {
    if (ctx.y + needed > BOTTOM) {
      newPage(ctx);
      return true;
    }
    return false;
  }

  function titleBlock(ctx, totals, flags) {
    var st = ctx.state;
    var m = st.meta || {};
    var top = ctx.y;

    T(ctx, "INVOICE", M, top, { size: 26, bold: true, color: TEXT });
    fill(ctx, M, top + 12, 22, 1.4, YELLOW);
    T(ctx, B.headingTagline, M, top + 16, { size: 7.5, bold: true, color: MUTED });

    var rows = [];
    if (U.nonEmpty(m.invoiceNumber)) rows.push(["Invoice No.", m.invoiceNumber]);
    if (U.nonEmpty(m.invoiceDate)) rows.push(["Issue Date", U.formatDate(m.invoiceDate)]);
    if (U.nonEmpty(m.dueDate)) rows.push(["Due Date", U.formatDate(m.dueDate)]);
    if (flags.showReference) rows.push(["Reference", m.reference]);
    if (flags.showPoNumber) rows.push(["PO Number", m.poNumber]);
    if (flags.showPlaceOfSupply) rows.push(["Place of Supply", st.options.gst.placeOfSupply]);

    var rx = W - M;
    var labelX = 132;
    var ry = top + 1;
    rows.forEach(function (r) {
      T(ctx, r[0], labelX, ry, { size: 8, color: MUTED });
      T(ctx, r[1], rx, ry, { size: 8.8, bold: true, color: TEXT, align: "right" });
      ry += 6;
    });

    if (totals.status) {
      var label = String(totals.status).toUpperCase();
      var tw = TW(ctx, label, 7.5, true) + 8;
      var bh = 6.4;
      var bx = rx - tw;
      ctx.doc.setFillColor(YELLOW[0], YELLOW[1], YELLOW[2]);
      ctx.doc.roundedRect(bx, ry + 0.5, tw, bh, 1.6, 1.6, "F");
      T(ctx, label, bx + tw / 2, ry + 0.5 + bh / 2, { size: 7.5, bold: true, color: BLACK, align: "center", baseline: "middle" });
      ry += bh + 1;
    }

    var dividerTop = top - 1;
    var dividerBottom = Math.max(ry, top + 18);
    hline(ctx, 0, 0, 0, BORDER, 0);
    ctx.doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    ctx.doc.setLineWidth(0.3);
    ctx.doc.line(126, dividerTop, 126, dividerBottom);

    ctx.y = Math.max(top + 20, dividerBottom) + 4;
    fill(ctx, M, ctx.y, CW, 0.8, YELLOW);
    ctx.y += 6;
  }

  function partyColumns(ctx, flags) {
    var st = ctx.state;
    var c = st.customer || {};
    var a = st.agency || {};
    var gap = 8, padX = 3.6, padY = 3.4;
    var panelW = 87;
    var leftPanelX = M;
    var rightPanelX = M + panelW + gap;
    var leftX = leftPanelX + padX;
    var rightX = rightPanelX + padX;
    var textW = panelW - padX * 2;
    var top = ctx.y;
    var lh = 4.2;
    var left = [];
    var right = [];

    left.push({ t: U.nonEmpty(c.name) ? c.name : "\u2014", size: 9.5, bold: true, color: U.nonEmpty(c.name) ? TEXT : MUTED, name: true });
    if (flags.showCustomerContact) {
      if (U.nonEmpty(c.contactPerson)) left.push({ t: c.contactPerson, size: 8.3, color: TEXT });
      if (U.nonEmpty(c.email)) left.push({ t: c.email, size: 8.3, color: TEXT });
      if (U.nonEmpty(c.phone)) left.push({ t: c.phone, size: 8.3, color: TEXT });
    }
    if (flags.showBillingAddress) {
      if (U.nonEmpty(c.address)) wrap(ctx, c.address, 8.3, false, textW).forEach(function (l) { left.push({ t: l, size: 8.3, color: TEXT }); });
      var cityline = [c.city, c.state, c.pincode].filter(U.nonEmpty).join(", ");
      if (cityline) left.push({ t: cityline, size: 8.3, color: TEXT });
      if (U.nonEmpty(c.country)) left.push({ t: c.country, size: 8.3, color: TEXT });
    }
    if (flags.showCustomerGstin) left.push({ t: "GSTIN: " + c.gstin, size: 8.3, color: TEXT });

    if (U.nonEmpty(a.name)) right.push({ t: a.name, size: 9.5, bold: true, color: TEXT, name: true });
    if (U.nonEmpty(a.address)) wrap(ctx, a.address, 8.3, false, textW).forEach(function (l) { right.push({ t: l, size: 8.3, color: TEXT }); });
    var acity = [a.city, a.state, a.pincode].filter(U.nonEmpty).join(", ");
    if (acity) right.push({ t: acity, size: 8.3, color: TEXT });
    if (U.nonEmpty(a.country)) right.push({ t: a.country, size: 8.3, color: TEXT });
    if (U.nonEmpty(a.phone)) right.push({ t: a.phone, size: 8.3, color: TEXT });
    if (U.nonEmpty(a.email)) right.push({ t: a.email, size: 8.3, color: TEXT });
    if (U.nonEmpty(a.website)) right.push({ t: a.website, size: 8.3, color: TEXT });
    if (flags.showAgencyGstin) right.push({ t: "GSTIN: " + a.gstin, size: 8.3, color: TEXT });
    if (flags.showRegistration) right.push({ t: "Reg. No.: " + a.registration, size: 8.3, color: TEXT });

    function measure(arr) { return arr.reduce(function (s, x) { return s + (x.name ? lh + 0.6 : lh); }, 0); }
    var panelTop = top + 7;
    var panelH = Math.max(measure(left), measure(right)) + padY * 2;

    ctx.doc.setFillColor(PANEL_BG[0], PANEL_BG[1], PANEL_BG[2]);
    ctx.doc.roundedRect(leftPanelX, panelTop, panelW, panelH, 2.4, 2.4, "F");
    ctx.doc.roundedRect(rightPanelX, panelTop, panelW, panelH, 2.4, 2.4, "F");
    ctx.doc.setDrawColor(PANEL_BORDER[0], PANEL_BORDER[1], PANEL_BORDER[2]);
    ctx.doc.setLineWidth(0.2);
    ctx.doc.roundedRect(leftPanelX, panelTop, panelW, panelH, 2.4, 2.4, "S");
    ctx.doc.roundedRect(rightPanelX, panelTop, panelW, panelH, 2.4, 2.4, "S");

    function head(x, y, title) {
      T(ctx, title, x, y, { size: 8, bold: true, color: TEXT });
      fill(ctx, x, y + 4.2, 9, 1, YELLOW);
    }
    head(leftX, top, "BILLED TO");
    head(rightX, top, "FROM");

    function drawLines(arr, x) {
      var y = panelTop + padY;
      arr.forEach(function (it) {
        T(ctx, it.t, x, y, { size: it.size, bold: it.bold, color: it.color });
        y += it.name ? lh + 0.6 : lh;
      });
      return y;
    }
    drawLines(left, leftX);
    drawLines(right, rightX);

    ctx.y = panelTop + panelH + 6;
  }

  function columns(ctx, flags) {
    if (flags.showGst) {
      return [
        { label: "#", width: 8, align: "left", key: "num" },
        { label: "SERVICE / DESCRIPTION", width: 74, align: "left", key: "desc" },
        { label: "QTY", width: 16, align: "right", key: "qty" },
        { label: "UNIT PRICE (" + ctx.cur + ")", width: 24, align: "right", key: "rate" },
        { label: "DISC", width: 16, align: "right", key: "disc" },
        { label: "TAX", width: 16, align: "right", key: "tax" },
        { label: "AMOUNT (" + ctx.cur + ")", width: 28, align: "right", key: "amt" }
      ];
    }
    return [
      { label: "#", width: 9, align: "left", key: "num" },
      { label: "SERVICE / DESCRIPTION", width: 75, align: "left", key: "desc" },
      { label: "QTY", width: 18, align: "right", key: "qty" },
      { label: "UNIT PRICE (" + ctx.cur + ")", width: 28, align: "right", key: "rate" },
      { label: "DISCOUNT", width: 22, align: "right", key: "disc" },
      { label: "AMOUNT (" + ctx.cur + ")", width: 30, align: "right", key: "amt" }
    ];
  }

  function tableHeaderRow(ctx, cols) {
    var h = 8;
    fill(ctx, M, ctx.y, CW, h, BLACK);
    var x = M;
    cols.forEach(function (col, i) {
      var tx = col.align === "right" ? x + col.width - 2 : x + 2;
      T(ctx, col.label, tx, ctx.y + h / 2, { size: 6.6, bold: true, color: WHITE, align: col.align, baseline: "middle" });
      x += col.width;
      if (i < cols.length - 1) {
        ctx.doc.setDrawColor(80, 80, 80);
        ctx.doc.setLineWidth(0.2);
        ctx.doc.line(x, ctx.y + 1.2, x, ctx.y + h - 1.2);
      }
    });
    ctx.y += h;
  }

  function table(ctx, totals, flags) {
    var cols = columns(ctx, flags);
    var gst = flags.showGst;
    var st = ctx.state;

    ensureSpace(ctx, 20);
    tableHeaderRow(ctx, cols);

    totals.lines.forEach(function (line, idx) {
      var segs = [];
      var descW = cols[1].width - 4;

      if (line.hasName) {
        wrap(ctx, line.name, 8.6, true, descW).forEach(function (l) { segs.push({ t: l, size: 8.6, bold: true, color: TEXT, lh: 4.3 }); });
      } else {
        segs.push({ t: "\u2014", size: 8.6, bold: true, color: MUTED, lh: 4.3 });
      }
      if (line.hasDescription) {
        wrap(ctx, line.description, 7.7, false, descW).forEach(function (l) { segs.push({ t: l, size: 7.7, color: MUTED, lh: 3.7 }); });
      }
      var sac = flags.showSac ? (line.sac || (st.options.gst && st.options.gst.sac)) : "";
      if (sac) segs.push({ t: "SAC: " + sac, size: 7, color: MUTED, lh: 3.4 });

      var descH = segs.reduce(function (a, s) { return a + s.lh; }, 0);
      var rowH = Math.max(9, descH + 3.4);

      if (ctx.y + rowH > BOTTOM) {
        newPage(ctx);
        tableHeaderRow(ctx, cols);
      }

      var rowTop = ctx.y;
      var textY = rowTop + 1.8;
      var x = M;
      cols.forEach(function (col) {
        var cx = col.align === "right" ? x + col.width - 2 : x + 2;
        if (col.key === "num") {
          T(ctx, String(line.index), x + 2, textY, { size: 8, color: MUTED });
        } else if (col.key === "desc") {
          var dy = textY;
          segs.forEach(function (s) { T(ctx, s.t, x + 2, dy, { size: s.size, bold: s.bold, color: s.color }); dy += s.lh; });
        } else if (col.key === "qty") {
          T(ctx, U.formatQty(line.qty), cx, textY, { size: 8.4, color: TEXT, align: "right" });
          if (U.nonEmpty(line.unit)) T(ctx, line.unit, cx, textY + 4, { size: 7, color: MUTED, align: "right" });
        } else if (col.key === "rate") {
          T(ctx, U.formatMoney(line.rate, ctx.cur), cx, textY, { size: 8.4, color: TEXT, align: "right" });
        } else if (col.key === "disc") {
          if (line.discount > 0.004) {
            T(ctx, U.formatMoney(line.discount, ctx.cur), cx, textY, { size: 8.4, color: TEXT, align: "right" });
            if (U.nonEmpty(line.discountLabel)) T(ctx, line.discountLabel, cx, textY + 4, { size: 7, color: MUTED, align: "right" });
          } else {
            T(ctx, "\u2014", cx, textY, { size: 8.4, color: MUTED, align: "right" });
          }
        } else if (col.key === "tax") {
          T(ctx, line.taxRate > 0 ? U.round2(line.taxRate) + "%" : "\u2014", cx, textY, { size: 8.4, color: TEXT, align: "right" });
        } else if (col.key === "amt") {
          T(ctx, U.formatMoney(line.lineTotal, ctx.cur), cx, textY, { size: 8.6, bold: true, color: TEXT, align: "right" });
        }
        x += col.width;
      });

      hline(ctx, M, M + CW, rowTop + rowH, BORDER, 0.2);
      ctx.y = rowTop + rowH;
    });

    ctx.y += 4;
  }

  function buildTotalRows(totals, flags, cur) {
    var rows = [];
    rows.push({ label: "Subtotal", value: U.formatMoney(totals.subtotal, cur), kind: "normal" });
    if (totals.lineDiscountTotal > 0.004) rows.push({ label: "Line Discounts", value: "\u2212" + U.formatMoney(totals.lineDiscountTotal, cur), kind: "normal" });
    if (totals.invoiceDiscount > 0.004) rows.push({ label: U.displayOr(totals.invoiceDiscountLabel, "Discount"), value: "\u2212" + U.formatMoney(totals.invoiceDiscount, cur), kind: "normal" });
    if (flags.showGst) {
      rows.push({ label: "Taxable Amount", value: U.formatMoney(totals.taxableSubtotal, cur), kind: "normal" });
      totals.taxes.forEach(function (t) { rows.push({ label: t.label, value: U.formatMoney(t.amount, cur), kind: "normal" }); });
    }
    if (flags.showAdditionalCharges) {
      totals.chargeLines.forEach(function (c) { rows.push({ label: c.label, value: U.formatMoney(c.amount, cur), kind: "normal" }); });
    }
    rows.push({ label: "Total Due", value: U.formatMoney(totals.grandTotal, cur), kind: "grand" });
    if (totals.amountPaid > 0.004) {
      rows.push({ label: "Amount Paid", value: "\u2212" + U.formatMoney(totals.amountPaid, cur), kind: "normal" });
      rows.push({ label: "Balance Due", value: U.formatMoney(totals.balanceDue, cur), kind: "balance" });
    }
    return rows;
  }

  function totalsPanel(ctx, totals, flags) {
    var rows = buildTotalRows(totals, flags, ctx.cur);
    var rowH = 5.9;
    var grandH = 8;
    var needed = rows.length * rowH + grandH + 8;
    ensureSpace(ctx, needed);

    var x = W - M - PANEL_W;
    var y = ctx.y + 2;

    rows.forEach(function (r) {
      if (r.kind === "grand") {
        ctx.doc.setFillColor(YELLOW[0], YELLOW[1], YELLOW[2]);
        ctx.doc.roundedRect(x, y, PANEL_W, grandH, 1.2, 1.2, "F");
        T(ctx, r.label, x + 4, y + grandH / 2, { size: 9.4, bold: true, color: BLACK, baseline: "middle" });
        T(ctx, r.value, x + PANEL_W - 4, y + grandH / 2, { size: 10.2, bold: true, color: BLACK, align: "right", baseline: "middle" });
        y += grandH;
      } else if (r.kind === "balance") {
        T(ctx, r.label, x + 4, y + rowH / 2, { size: 8.6, bold: true, color: TEXT, baseline: "middle" });
        T(ctx, r.value, x + PANEL_W - 4, y + rowH / 2, { size: 8.8, bold: true, color: TEXT, align: "right", baseline: "middle" });
        y += rowH;
      } else {
        T(ctx, r.label, x + 4, y + rowH / 2, { size: 8.4, color: MUTED, baseline: "middle" });
        T(ctx, r.value, x + PANEL_W - 4, y + rowH / 2, { size: 8.6, color: TEXT, align: "right", baseline: "middle" });
        y += rowH;
      }
    });

    ctx.y = y + 4;
  }

  function wordsSection(ctx, totals, flags) {
    if (!flags.showAmountInWords) return;
    var words = U.amountToWords(totals.grandTotal, ctx.cur);
    var maxW = CW - 8;
    var lines = wrap(ctx, words, 8.5, true, maxW - 34);
    var h = Math.max(9, lines.length * 4.4 + 4);
    ensureSpace(ctx, h + 4);

    fill(ctx, M, ctx.y, CW, h, PALE_Y);
    fill(ctx, M, ctx.y, 1.6, h, YELLOW);
    T(ctx, "Amount in Words:", M + 4, ctx.y + h / 2, { size: 8, bold: true, color: MUTED, baseline: "middle" });
    var ty = ctx.y + h / 2 - ((lines.length - 1) * 4.4) / 2;
    lines.forEach(function (l, i) {
      T(ctx, l, M + 34, ty + i * 4.4, { size: 8.5, bold: true, color: TEXT, baseline: "middle" });
    });
    ctx.y += h + 6;
  }

  function lowerSection(ctx, flags) {
    if (!flags.showLowerSection) return;
    var st = ctx.state;
    var gap = 8, padX = 3.6, padY = 3.4;
    var panelW = 87;
    var leftPanelX = M;
    var rightPanelX = M + panelW + gap;
    var leftX = leftPanelX + padX;
    var rightX = rightPanelX + padX;
    var textW = panelW - padX * 2;

    var leftItems = [];
    var rightItems = [];

    if (flags.showBank) {
      var b = st.bank || {};
      var bankLines = [];
      if (U.nonEmpty(b.bankName)) bankLines.push({ kv: ["Bank", b.bankName] });
      if (U.nonEmpty(b.accountHolder)) bankLines.push({ kv: ["Account Holder", b.accountHolder] });
      if (U.nonEmpty(b.accountNumber)) bankLines.push({ kv: ["Account No.", b.accountNumber] });
      if (U.nonEmpty(b.ifsc)) bankLines.push({ kv: ["IFSC", b.ifsc] });
      if (U.nonEmpty(b.branch)) bankLines.push({ kv: ["Branch", b.branch] });
      if (bankLines.length) { leftItems.push({ head: "Bank Transfer" }); bankLines.forEach(function (x) { leftItems.push(x); }); }
    }
    if (flags.showUpi && U.nonEmpty(st.upi && st.upi.id)) {
      leftItems.push({ head: "UPI" });
      leftItems.push({ kv: ["UPI ID", st.upi.id] });
    }
    if (flags.showPaymentInstructions && U.nonEmpty(st.paymentInstructions)) {
      leftItems.push({ head: "Payment Instructions" });
      wrap(ctx, st.paymentInstructions, 8, false, textW).forEach(function (l) { leftItems.push({ text: l }); });
    }
    if (flags.showPaymentTerms && U.nonEmpty(st.paymentTerms)) {
      leftItems.push({ head: "Payment Terms" });
      wrap(ctx, st.paymentTerms, 8, false, textW).forEach(function (l) { leftItems.push({ text: l }); });
    }

    if (flags.showNotes && U.nonEmpty(st.notes)) {
      rightItems.push({ head: "Notes" });
      wrap(ctx, st.notes, 8, false, textW).forEach(function (l) { rightItems.push({ text: l }); });
    }
    if (flags.showTerms && U.nonEmpty(st.terms)) {
      rightItems.push({ head: "Terms & Conditions" });
      String(st.terms).split(/\r?\n/).map(function (s) { return s.trim(); }).filter(function (s) { return s; }).forEach(function (t, i) {
        wrap(ctx, (i + 1) + ". " + t, 8, false, textW - 4).forEach(function (l) { rightItems.push({ text: l, indent: true }); });
      });
    }
    if (flags.showFooterMessage && U.nonEmpty(st.footerMessage)) {
      wrap(ctx, st.footerMessage, 8, false, textW).forEach(function (l) { rightItems.push({ text: l }); });
    }

    if (!leftItems.length && !rightItems.length) return;

    function measure(items) {
      var h = 0;
      items.forEach(function (it) {
        if (it.head) h += 5.8;
        else if (it.kv) h += 5;
        else h += 4.2;
      });
      return h;
    }
    var panelH = Math.max(measure(leftItems), measure(rightItems)) + padY * 2;
    ensureSpace(ctx, 7 + panelH + 8);

    var top = ctx.y;
    var panelTop = top + 7;

    T(ctx, "PAYMENT DETAILS", leftX, top, { size: 8, bold: true, color: TEXT });
    fill(ctx, leftX, top + 4.2, 9, 1, YELLOW);
    T(ctx, "NOTES & TERMS", rightX, top, { size: 8, bold: true, color: TEXT });
    fill(ctx, rightX, top + 4.2, 9, 1, YELLOW);

    ctx.doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    ctx.doc.setLineWidth(0.3);
    ctx.doc.line(leftPanelX + panelW + gap / 2, top, leftPanelX + panelW + gap / 2, panelTop + panelH);

    ctx.doc.setFillColor(PANEL_BG[0], PANEL_BG[1], PANEL_BG[2]);
    ctx.doc.roundedRect(leftPanelX, panelTop, panelW, panelH, 2.4, 2.4, "F");
    ctx.doc.roundedRect(rightPanelX, panelTop, panelW, panelH, 2.4, 2.4, "F");
    ctx.doc.setDrawColor(PANEL_BORDER[0], PANEL_BORDER[1], PANEL_BORDER[2]);
    ctx.doc.setLineWidth(0.2);
    ctx.doc.roundedRect(leftPanelX, panelTop, panelW, panelH, 2.4, 2.4, "S");
    ctx.doc.roundedRect(rightPanelX, panelTop, panelW, panelH, 2.4, 2.4, "S");

    function draw(items, x) {
      var y = panelTop + padY;
      items.forEach(function (it) {
        if (it.head) {
          T(ctx, it.head, x, y, { size: 8, bold: true, color: TEXT });
          y += 5.8;
        } else if (it.kv) {
          T(ctx, it.kv[0] + ":", x, y, { size: 7.8, color: MUTED });
          var vx = x + TW(ctx, it.kv[0] + ": ", 7.8, false);
          T(ctx, it.kv[1], vx, y, { size: 8, color: TEXT });
          y += 5;
        } else {
          T(ctx, it.text, x + (it.indent ? 3 : 0), y, { size: 8, color: TEXT });
          y += 4.2;
        }
      });
      return y;
    }

    var lEnd = draw(leftItems, leftX);
    var rEnd = draw(rightItems, rightX);
    ctx.y = Math.max(lEnd, rEnd) + 4;
  }

  function footer(ctx, flags) {
    var y = Math.max(ctx.y + 6, H - 16);
    hline(ctx, M, W - M, y - 4, BORDER, 0.3);

    if (flags.footerTagline) {
      var words = String(B.tagline || "").split(/\s+/).filter(function (s) { return s; });
      if (words.length) {
        var last = words.pop();
        var lead = words.join(" ");
        if (lead) T(ctx, lead, M, y, { size: 8, bold: true, color: TEXT });
        var lw = lead ? TW(ctx, lead + " ", 8, true) : 0;
        var gw = TW(ctx, last, 8, true);
        fill(ctx, M + lw, y - 0.9, gw + 2, 5.4, YELLOW);
        T(ctx, last, M + lw + 1, y, { size: 8, bold: true, color: BLACK });
      }
    }

    var right = [];
    if (flags.footerInstagram) right.push("Instagram: " + B.instagram);
    if (flags.footerFacebook) right.push("Facebook: " + B.facebook);
    if (flags.footerWebsite) right.push(B.websiteLabel);
    if (right.length) {
      T(ctx, right.join("    |    "), W - M, y, { size: 7.8, color: MUTED, align: "right" });
    }
  }

  function pageNumbers(ctx) {
    var doc = ctx.doc;
    var total = doc.getNumberOfPages();
    if (total <= 1) return;
    for (var p = 1; p <= total; p++) {
      doc.setPage(p);
      T(ctx, "Page " + p + " of " + total, W - M, H - 8, { size: 7, color: MUTED, align: "right" });
    }
  }

  function generate(state, totals, flags) {
    var jsPDF = (window.jspdf || {}).jsPDF;
    if (!jsPDF) throw new Error("PDF library failed to load.");
    var doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    var ctx = makeCtx(doc, state);
    registerFonts(ctx);

    drawHeader(ctx);
    ctx.y = HEADER_H + 8;

    titleBlock(ctx, totals, flags);
    partyColumns(ctx, flags);
    table(ctx, totals, flags);
    totalsPanel(ctx, totals, flags);
    wordsSection(ctx, totals, flags);
    lowerSection(ctx, flags);
    footer(ctx, flags);
    pageNumbers(ctx);

    return doc;
  }

  function safeName(state) {
    var num = (state.meta && state.meta.invoiceNumber) || "invoice";
    num = String(num).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return "Ationic-Invoice-" + (num || "invoice") + ".pdf";
  }

  function download(state, totals, flags) {
    var doc = generate(state, totals, flags);
    doc.save(safeName(state));
    return safeName(state);
  }

  function openInTab(state, totals, flags) {
    var doc = generate(state, totals, flags);
    var url = doc.output("bloburl");
    window.open(url, "_blank");
    return url;
  }

  return {
    generate: generate,
    download: download,
    openInTab: openInTab,
    safeName: safeName
  };
})();
