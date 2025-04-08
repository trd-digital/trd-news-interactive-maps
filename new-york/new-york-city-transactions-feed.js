const dataUrl =
  "https://static.therealdeal.com/data_feeds/realtime_nyc_sales.json";

const excludeValue = [
  "null",
  "undefined",
  "n/a",
  "na",
  "none",
  "no",
  "0",
  "false",
  "unknown",
  "nan",
];
const trdTheme = TrdTheme();

const trdList = () => {
  const list = document.querySelector("#sales-list");

  const listLimit = 100;

  let scroller;

  const fn = {
    init: () => {
      fn.setupTooltip();
      fn.addEventListeners();
      trdTheme.init();

      fn.getData(dataUrl).then(fn.renderListItems).catch(console.error);
    },

    setupTooltip: () => {
      const tooltipTriggerList = document.querySelectorAll(
        '[data-bs-toggle="tooltip"]'
      );
      [...tooltipTriggerList].map(
        (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
      );
    },

    addEventListeners: () => {
      list.addEventListener("click", () => {
        const url = helpers.getGamTrackUrl(
          "https://therealdeal.com/data/new-york/2024/nyc-transactions/?utm_source=embed&utm_medium=widget"
        );
        window.open(url, "_blank");
      });
      window.addEventListener("load", helpers.addGamTrackUrls);
      window.addEventListener("blur", helpers.autoScrollListStart);
      window.addEventListener("load", helpers.autoScrollListStart);
      list.addEventListener("mouseleave", helpers.autoScrollListStart);
      list.addEventListener("mouseenter", helpers.autoScrollListStop);
      list.addEventListener("touchstart", helpers.autoScrollListStop);
    },

    getData: async (url) => {
      const response = await fetch(url);
      return response.json();
    },

    renderListItems: (data) => {
      const items = data.data
        .filter(helpers.filterListEmptyData)
        .filter(helpers.filterToLast30Days)
        .slice(0, listLimit)
        .map((item) => {
          let address = helpers.getFirstAddress(item.transaction_properties);
          const price = helpers.formatCurrency(
            item.transactions.doc_amount,
            true
          );
          const date = helpers.formatDate(item.transactions.recorded_date);

          return `
            <li class="list-group-item d-flex justify-content-between align-items-start">
              <div class="me-2 left-side">${address}</div>
              <div class="right-side">
                <div class="text-success price">${price}</div>
                <div class="text-muted date">${date}</div>
              </div>
            </li>
          `;
        })
        .join("");

      list.innerHTML = items;
    },

    autoScrollList: () => {
      const listHeight = list.scrollHeight;
      scroller = setInterval(() => {
        if (list.scrollTop + list.clientHeight >= listHeight) {
          list.scrollTop = 0;
        } else {
          list.scrollBy({
            top: 1,
            behavior: "smooth",
          });
        }
      }, 10);
    },
  };

  const helpers = {
    getGamTrackUrl: (url) => {
      if (!window.frameElement || !url || url === "") return url;

      const clickUrlUnescaped = window.frameElement.getAttribute(
        "data-click-url-unesc"
      );
      if (
        !clickUrlUnescaped ||
        !clickUrlUnescaped.startsWith("http://") ||
        !clickUrlUnescaped.startsWith("https://")
      ) {
        return url;
      }

      const newUrl = new URL(clickUrlUnescaped);
      if (newUrl.searchParams.has("adurl")) {
        newUrl.searchParams.delete("adurl");
      }
      newUrl.searchParams.append("adurl", url);
      return newUrl.toString();
    },

    addGamTrackUrls: () => {
      const links = document.querySelectorAll("a");
      links.forEach((link) => {
        link.href = helpers.getGamTrackUrl(link.href);
      });
    },

    autoScrollListStart: () => {
      clearInterval(scroller);
      fn.autoScrollList();
    },

    autoScrollListStop: () => {
      clearInterval(scroller);
    },

    getFirstAddress: (data) => {
      if (data.length === 0) return "";
      let address = "";
      for (const property of data) {
        if (!helpers.isEmptyValue(property.property_address)) {
          address = property.property_address;
          break;
        }
      }

      if (address) {
        address = address.replace("Unit UNIT", "Unit ");
        address = address.replace(", NY", "");
        address = address.replace("NEW YORK", "MN");
        address = address.replace("QUEENS", "QN");
        address = address.replace("BROOKLYN", "BK");
        address = address.replace("BRONX", "BX");
        address = address.replace("STATEN ISLAND", "SI");
      }
      return address;
    },

    filterListEmptyData: (data) => {
      const address = helpers.getFirstAddress(data.transaction_properties);
      const price = data.transactions.doc_amount;
      const date = data.transactions.recorded_date;

      return (
        !helpers.isEmptyValue(price) &&
        !helpers.isEmptyValue(date) &&
        !helpers.isEmptyValue(address)
      );
    },

    filterToLast30Days: (data) => {
      const date = Date.parse(data.transactions.recorded_date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return date > thirtyDaysAgo;
    },

    sortListBySalePrice: (a, b) => {
      const priceA = a.transactions.doc_amount;
      const priceB = b.transactions.doc_amount;
      return priceB - priceA;
    },

    isEmptyValue: (value) => {
      if (!value) return true;
      if (value === "") return true;
      if (typeof value === "string") {
        if (value.trim() === "") return true;
        if (excludeValue.includes(value.toLowerCase())) return true;
      }
      return false;
    },

    cleanWhiteSpace: (str) => {
      return str.toString().replace(/\s+/g, " ").trim();
    },

    formatCurrency: (currency, round = false) => {
      const amount = parseInt(
        // Clean string and keep only digits w/ decimal.
        helpers.cleanWhiteSpace(currency.toString()).replace(/[^0-9.]/g, ""),
        10
      );

      try {
        // Default zero decimal places for under a million, or when round=true
        let maximumFractionDigits = 0;

        if (round === false) {
          if (amount > 1_000_000_000) {
            maximumFractionDigits = 2; // Two decimals for a billion or more.
          } else if (amount >= 1_000_000) {
            maximumFractionDigits = 1; // One decimal for a million or more.
          }
        }

        const formattedCurrency = `$${Intl.NumberFormat("en-US", {
          notation: "compact",
          maximumFractionDigits,
        }).format(amount)}`;

        return formattedCurrency;
      } catch (e) {
        return amount.toString();
      }
    },

    formatDate: (
      date,
      dateTimeFormatOptions = {
        year: "2-digit",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
      }
    ) => {
      try {
        const dateFormatted = new Intl.DateTimeFormat(
          "en-US",
          dateTimeFormatOptions
        ).format(Date.parse(date.toString()));

        return dateFormatted;
      } catch (e) {
        return helpers.cleanWhiteSpace(date.toString());
      }
    },
  };

  fn.init();
};

trdList();
