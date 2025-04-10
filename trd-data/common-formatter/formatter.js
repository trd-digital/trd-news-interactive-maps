const excludeValue = [
  "null",
  "undefined",
  "n/a",
  "na",
  "none",
  "not available",
  "not applicable",
  "no",
  "0",
  "false",
  "unknown",
  "data not found",
  "nan",
  "-",
  "folio not found!",
  "folio not found",
  "--/--/--",
];

const TrdFormatters = {
  isEmptyValue: (value) => {
    if (!value) return true;
    if (value === "") return true;
    if (typeof value === "string") {
      if (value.trim() === "") return true;
      if (excludeValue.includes(value.toLowerCase())) return true;
    }
    return false;
  },

  getNumberValue: (value) => {
    if (TrdFormatters.isEmptyValue(value)) {
      return 0;
    }
    if (typeof value === "string") {
      return parseFloat(value.replace(/[$,]/g, ""));
    }
    return value;
  },

  getFieldName: (value) => {
    return value.toLowerCase().replace(/ /g, "_").replace(/\./g, "");
  },

  formatNumber: (value) => {
    if (TrdFormatters.isEmptyValue(value)) {
      return '<span class="text-muted">N/A</span>';
    }

    if (typeof value === "string") {
      value = value.replace(/[$,]/g, "");
    }
    if (isNaN(value)) {
      return value;
    }
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
    }).format(value);
  },

  formatPrice: (value) => {
    if (TrdFormatters.isEmptyValue(value)) {
      return '<span class="text-muted">N/A</span>';
    }
    if (typeof value === "string") {
      value = value.replace(/[$,]/g, "");
    }
    if (isNaN(value)) {
      return value;
    }
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0, // No decimal places
        maximumFractionDigits: 0, // No decimal places
      }).format(parseFloat(value));
    } catch (e) {
      return value;
    }
  },

  formatDate: (value) => {
    if (TrdFormatters.isEmptyValue(value)) {
      return '<span class="text-muted">N/A</span>';
    }

    try {
      return new Date(value).toLocaleDateString();
    } catch (e) {
      return value;
    }
  },

  formatTrimWithEllipsis: (value, length = 40) => {
    if (TrdFormatters.isEmptyValue(value)) {
      return '<span class="text-muted">N/A</span>';
    }

    if (value.length > length) {
      return value.slice(0, length) + "...";
    }
    return value;
  },
  formatLink: (value, text) => {
    if (TrdFormatters.isEmptyValue(value)) {
      return '<span class="text-muted">N/A</span>';
    }
    if (value.includes("http")) {
      return `<a href="${value}" target="_blank" rel="noopener noreferrer">${
        text || value
      }</a>`;
    }
    return value;
  },

  formatterValue: (value) => {
    if (TrdFormatters.isEmptyValue(value)) {
      return '<span class="text-muted">N/A</span>';
    }

    return value;
  },
};
