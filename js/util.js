window.Ato = window.Ato || {};

Ato.Util = (function () {
  "use strict";

  function round2(n) {
    if (typeof n !== "number" || !isFinite(n)) return 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function toNum(v, fallback) {
    if (v === null || v === undefined || v === "") return fallback === undefined ? 0 : fallback;
    var n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
    if (isNaN(n) || !isFinite(n)) return fallback === undefined ? 0 : fallback;
    return n;
  }

  function toPosNum(v) {
    var n = toNum(v, 0);
    return n < 0 ? 0 : n;
  }

  function clamp(n, min, max) {
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function pad(n, len) {
    var s = String(n);
    while (s.length < len) s = "0" + s;
    return s;
  }

  function groupDigits(integerStr, style) {
    var neg = integerStr.charAt(0) === "-";
    if (neg) integerStr = integerStr.slice(1);
    var out;
    if (style === "indian") {
      if (integerStr.length <= 3) {
        out = integerStr;
      } else {
        var last3 = integerStr.slice(-3);
        var rest = integerStr.slice(0, -3);
        rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
        out = rest + "," + last3;
      }
    } else {
      out = integerStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    return (neg ? "-" : "") + out;
  }

  function formatNumber(n, style, decimals) {
    var d = decimals === undefined ? 2 : decimals;
    n = round2(toNum(n, 0));
    var neg = n < 0;
    var abs = Math.abs(n);
    var fixed = abs.toFixed(d);
    var parts = fixed.split(".");
    var intPart = groupDigits(parts[0], style || "western");
    var out = intPart;
    if (d > 0 && parts[1]) out += "." + parts[1];
    return (neg ? "-" : "") + out;
  }

  function currencyByCode(code) {
    var list = Ato.Config.CURRENCIES;
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === code) return list[i];
    }
    return list[0];
  }

  function formatMoney(n, currencyCode) {
    var c = currencyByCode(currencyCode);
    return c.symbol + formatNumber(n, c.group, 2);
  }

  function formatMoneyPlain(n, currencyCode) {
    var c = currencyByCode(currencyCode);
    return formatNumber(n, c.group, 2);
  }

  function formatQty(n) {
    var v = toNum(n, 0);
    if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
    return String(round2(v));
  }

  var ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  var TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigits(n) {
    if (n < 20) return ONES[n];
    var t = Math.floor(n / 10);
    var o = n % 10;
    return TENS[t] + (o ? " " + ONES[o] : "");
  }

  function threeDigits(n) {
    var h = Math.floor(n / 100);
    var r = n % 100;
    var parts = [];
    if (h) parts.push(ONES[h] + " Hundred");
    if (r) parts.push(twoDigits(r));
    return parts.join(" ");
  }

  function intWordsIndian(num) {
    num = Math.floor(Math.abs(num));
    if (num === 0) return "Zero";
    var crore = Math.floor(num / 10000000);
    num = num % 10000000;
    var lakh = Math.floor(num / 100000);
    num = num % 100000;
    var thousand = Math.floor(num / 1000);
    num = num % 1000;
    var hundred = num;
    var parts = [];
    if (crore) parts.push(intWordsIndian(crore) + " Crore");
    if (lakh) parts.push(twoDigits(lakh) + " Lakh");
    if (thousand) parts.push(twoDigits(thousand) + " Thousand");
    if (hundred) parts.push(threeDigits(hundred));
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  var SCALES = [
    { v: 1000000000, n: "Billion" },
    { v: 1000000, n: "Million" },
    { v: 1000, n: "Thousand" }
  ];

  function intWordsWestern(num) {
    num = Math.floor(Math.abs(num));
    if (num === 0) return "Zero";
    var parts = [];
    for (var i = 0; i < SCALES.length; i++) {
      var s = SCALES[i];
      if (num >= s.v) {
        var q = Math.floor(num / s.v);
        parts.push(threeDigits(q) + " " + s.n);
        num = num % s.v;
      }
    }
    if (num) parts.push(threeDigits(num));
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  function amountToWords(amount, currencyCode) {
    var c = currencyByCode(currencyCode);
    var total = round2(Math.abs(toNum(amount, 0)));
    var intPart = Math.floor(total);
    var frac = Math.round((total - intPart) * 100);
    if (frac === 100) {
      intPart += 1;
      frac = 0;
    }
    var conv = c.group === "indian" ? intWordsIndian : intWordsWestern;
    var words = conv(intPart) + " " + c.major;
    if (frac > 0) {
      words += " and " + twoDigits(frac) + " " + c.minor;
    }
    return words + " Only";
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function nl2br(str) {
    return escapeHtml(str).replace(/\r?\n/g, "<br>");
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function isValidEmail(email) {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function formatDate(iso) {
    if (!iso) return "";
    var parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return iso;
    return pad(d, 2) + " " + MONTHS[m - 1] + " " + y;
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2);
  }

  function isPast(iso) {
    if (!iso) return false;
    return iso < todayISO();
  }

  function displayOr(value, fallback) {
    if (value === null || value === undefined) return fallback || "";
    var s = String(value).trim();
    return s ? s : (fallback || "");
  }

  function nonEmpty(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }

  return {
    round2: round2,
    toNum: toNum,
    toPosNum: toPosNum,
    clamp: clamp,
    formatNumber: formatNumber,
    formatMoney: formatMoney,
    formatMoneyPlain: formatMoneyPlain,
    formatQty: formatQty,
    currencyByCode: currencyByCode,
    amountToWords: amountToWords,
    escapeHtml: escapeHtml,
    nl2br: nl2br,
    deepClone: deepClone,
    isValidEmail: isValidEmail,
    formatDate: formatDate,
    todayISO: todayISO,
    isPast: isPast,
    displayOr: displayOr,
    nonEmpty: nonEmpty
  };
})();
