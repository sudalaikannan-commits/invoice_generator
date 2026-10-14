window.Ato = window.Ato || {};

Ato.Config = (function () {
  "use strict";

  var BRAND = {
    name: "Ationic Digital Marketing Agency",
    shortName: "Ationic",
    website: "https://ationic.agency",
    websiteLabel: "ationic.agency",
    email: "hello@ationic.agency",
    phone: "+91 8680060912",
    instagram: "@ationic_digital",
    facebook: "Ationic",
    tagline: "BUILD. MARKET. GROW.",
    headingTagline: "BUILDING BRANDS FOR A DIGITAL TOMORROW.",
    logoSrc: "assets/ationic-logo.png",
    logoDataUrl: null,
    logoMeta: null,
    colors: {
      black: "#080808",
      white: "#FFFFFF",
      yellow: "#FFD600",
      text: "#171717",
      muted: "#666666",
      border: "#E2E2E2"
    }
  };

  var CURRENCIES = [
    { code: "INR", symbol: "\u20B9", name: "Indian Rupee", major: "Rupees", minor: "Paise", group: "indian" },
    { code: "USD", symbol: "$", name: "US Dollar", major: "Dollars", minor: "Cents", group: "western" },
    { code: "EUR", symbol: "\u20AC", name: "Euro", major: "Euros", minor: "Cents", group: "western" },
    { code: "GBP", symbol: "\u00A3", name: "Pound Sterling", major: "Pounds", minor: "Pence", group: "western" },
    { code: "JPY", symbol: "\u00A5", name: "Japanese Yen", major: "Yen", minor: "Sen", group: "western" },
    { code: "AUD", symbol: "$", name: "Australian Dollar", major: "Dollars", minor: "Cents", group: "western" },
    { code: "CAD", symbol: "$", name: "Canadian Dollar", major: "Dollars", minor: "Cents", group: "western" },
    { code: "SGD", symbol: "$", name: "Singapore Dollar", major: "Dollars", minor: "Cents", group: "western" },
    { code: "AED", symbol: "AED ", name: "UAE Dirham", major: "Dirhams", minor: "Fils", group: "western" }
  ];

  var GST_RATES = [0, 5, 12, 18, 28];

  var UNITS = ["Nos", "Hours", "Days", "Weeks", "Month", "Project", "Campaign", "Page", "Words", "Article", "Piece", "Set", "Unit", "Licence", "Retainer"];

  var SERVICE_SUGGESTIONS = [
    "Website Design & Development",
    "Full-Stack Web Development",
    "E-commerce Development",
    "SEO Services",
    "Social Media Marketing",
    "Social Media Management",
    "Content Marketing",
    "Performance Marketing",
    "Meta Ads Management",
    "Google Ads Management",
    "Branding and Creative Design",
    "Conversion Rate Optimization",
    "Monthly Digital Marketing Retainer",
    "Custom Services"
  ];

  var PAYMENT_METHODS = ["Bank Transfer", "UPI", "Cash", "Cheque", "Credit Card", "Debit Card", "Net Banking", "Other"];

  var STATUSES = ["Draft", "Unpaid", "Partially Paid", "Paid", "Overdue"];

  var THEMES = ["Premium White", "Classic", "Minimal"];

  var AGENCY_DEFAULTS = {
    name: "Ationic Digital Marketing Agency",
    contactPerson: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    country: "",
    phone: "+91 8680060912",
    email: "hello@ationic.agency",
    website: "https://ationic.agency",
    gstin: "",
    registration: ""
  };

  function defaultOptions() {
    return {
      gst: {
        enabled: false,
        mode: "exclusive",
        split: "cgst_sgst",
        defaultRate: 18,
        sac: "",
        placeOfSupply: ""
      },
      sections: {
        reference: false,
        poNumber: false,
        customerContact: true,
        billingAddress: true,
        customerGstin: true,
        agencyGstin: true,
        registration: false,
        bank: false,
        upi: false,
        paymentInstructions: false,
        paymentTerms: false,
        notes: false,
        terms: false,
        amountInWords: true,
        additionalCharges: false,
        sac: true,
        placeOfSupply: true,
        footerMessage: false,
        footerTagline: true,
        footerInstagram: true,
        footerFacebook: true,
        footerWebsite: true
      }
    };
  }

  var idCounter = 0;
  function newId(prefix) {
    idCounter += 1;
    return (prefix || "id") + "-" + Date.now().toString(36) + "-" + idCounter.toString(36);
  }

  function newServiceRow() {
    return {
      id: newId("svc"),
      name: "",
      description: "",
      qty: 1,
      unit: "Nos",
      rate: 0,
      discountType: "amount",
      discountValue: 0,
      taxRate: 18,
      sac: ""
    };
  }

  function pad(n, len) {
    var s = String(n);
    while (s.length < len) s = "0" + s;
    return s;
  }

  function year() {
    return new Date().getFullYear();
  }

  function newInvoiceNumber(existingNumbers) {
    existingNumbers = existingNumbers || [];
    var yr = year();
    var prefix = "AT-" + yr + "-";
    var max = 0;
    existingNumbers.forEach(function (n) {
      if (typeof n !== "string") return;
      var m = n.match(/^AT-(\d{4})-(\d+)$/);
      if (m && String(m[1]) === String(yr)) {
        var v = parseInt(m[2], 10);
        if (!isNaN(v) && v > max) max = v;
      }
    });
    return prefix + pad(max + 1, 3);
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2);
  }

  function addDaysISO(iso, days) {
    if (!iso) return "";
    var parts = iso.split("-");
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + (parseInt(days, 10) || 0));
    return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2);
  }

  function newInvoice(existingNumbers, settings) {
    settings = settings || {};
    var terms = parseInt(settings.defaultTerms, 10);
    if (isNaN(terms)) terms = 15;
    var issue = todayISO();
    return {
      id: newId("inv"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      theme: "Premium White",
      meta: {
        invoiceNumber: newInvoiceNumber(existingNumbers),
        invoiceDate: issue,
        dueDate: addDaysISO(issue, terms),
        status: "Draft",
        currency: settings.defaultCurrency || "INR",
        reference: "",
        poNumber: ""
      },
      logo: null,
      logoMeta: null,
      customer: {
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        country: "",
        gstin: ""
      },
      agency: JSON.parse(JSON.stringify(AGENCY_DEFAULTS)),
      items: [newServiceRow()],
      discount: { type: "amount", value: 0, label: "Discount" },
      additionalCharges: [],
      options: defaultOptions(),
      bank: { bankName: "", accountHolder: "", accountNumber: "", ifsc: "", branch: "" },
      upi: { id: "" },
      paymentInstructions: "",
      paymentTerms: "",
      notes: "",
      terms: "",
      footerMessage: "",
      payment: {
        amountPaid: 0,
        paymentDate: "",
        method: "",
        txnRef: "",
        status: "Draft"
      }
    };
  }

  var DEFAULT_SETTINGS = {
    defaultCurrency: "INR",
    defaultTerms: 15,
    defaultTaxRate: 18,
    autoSave: true
  };

  return {
    BRAND: BRAND,
    CURRENCIES: CURRENCIES,
    GST_RATES: GST_RATES,
    UNITS: UNITS,
    SERVICE_SUGGESTIONS: SERVICE_SUGGESTIONS,
    PAYMENT_METHODS: PAYMENT_METHODS,
    STATUSES: STATUSES,
    THEMES: THEMES,
    AGENCY_DEFAULTS: AGENCY_DEFAULTS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    defaultOptions: defaultOptions,
    newServiceRow: newServiceRow,
    newId: newId,
    newInvoice: newInvoice,
    newInvoiceNumber: newInvoiceNumber,
    todayISO: todayISO,
    addDaysISO: addDaysISO
  };
})();
