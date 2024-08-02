const dataUrl =
  "https://static.therealdeal.com/interactive-maps/map_data.geojson";

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
  "address not available",
  "address unavailable",
  "address not found",
  "-",
];

const trdList = () => {
  const list = document.querySelector("#luxury-sales-list");

  const listLimit = 30;

  let scroller;

  const fn = {
    init: () => {
      helpers.setUserPersistedTheme();
      fn.setupTooltip();
      fn.addEventListeners();

      fn.getData(dataUrl)
        .then(fn.renderListItems)
        .catch(console.error)
        .finally(fn.autoScrollListEvent);
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
        window.open(
          "https://therealdeal.com/data/miami/2024/priciest-south-florida-sales/?utm_source=embed&utm_medium=widget&utm_campaign=south_florida_sales",
          "_blank"
        );
      });

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
      const items = data.features
        .filter(helpers.filterListEmptyData)
        .sort(helpers.sortListBySalePrice)
        .slice(0, listLimit)
        .map((feature) => {
          const properties = feature.properties;
          const address = properties["Physical Address"];
          const price = helpers.formatCurrency(properties["Sale Price"], true);
          const date = helpers.formatDate(properties["Record Date"]);

          return `
            <li class="list-group-item d-flex justify-content-between align-items-start">
              <div class="me-2">${address}</div>
              <div>
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
    setUserPersistedTheme: () => {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.body.setAttribute("data-bs-theme", "dark");
      }
    },

    autoScrollListStart: () => {
      clearInterval(scroller);
      fn.autoScrollList();
    },

    autoScrollListStop: () => {
      clearInterval(scroller);
    },

    filterListEmptyData: (data) => {
      const properties = data.properties;
      const address = properties["Physical Address"];
      const price = properties["Sale Price"];
      const date = properties["Record Date"];

      return (
        !helpers.isEmptyValue(price) &&
        !helpers.isEmptyValue(date) &&
        !helpers.isEmptyValue(address)
      );
    },

    sortListBySalePrice: (a, b) => {
      const priceA = a.properties["Sale Price"];
      const priceB = b.properties["Sale Price"];
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
        timeZone: "GMT",
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
