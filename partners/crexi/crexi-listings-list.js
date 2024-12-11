const dataUrl =
  "https://static.therealdeal.com/interactive-maps/crexi-listings-data.json";

const trdList = () => {
  const list = document.querySelector("#list");

  const listLimit = 30;

  let scroller;

  const fn = {
    init: () => {
      helpers.setUserPersistedTheme();
      fn.setupTooltip();
      fn.addEventListeners();

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
      const items = data
        .filter(helpers.filterListEmptyData)
        .sort(helpers.sortListByPrice)
        .slice(0, listLimit)
        .map((item) => {
          const name = item["Property Name"];
          const address = item["Address"];
          const state = item["State"];
          const zip = item["Zip"];
          const brokerage = item["Brokerage"];
          const price = helpers.formatCurrency(item["Asking Price"], false);
          const url = item["Full UTM Tracker"];

          return `
            <li class="list-group-item">
              <a href="${url}" target="_blank">
                <div class="price">${price}</div>
                <div>${name}</div>
                <div>${address}</div>
                <div>${state} ${zip}</div>
                <div>${brokerage}</div>
              </a>
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
      const name = data["Property Name"];
      const address = data["Address"];
      const price = data["Asking Price"];

      return (
        !helpers.isEmptyValue(name) &&
        !helpers.isEmptyValue(address) &&
        !helpers.isEmptyValue(price)
      );
    },

    sortListByPrice: (a, b) => {
      const priceA = a["Asking Price"];
      const priceB = b["Asking Price"];
      return priceB - priceA;
    },

    isEmptyValue: (value) => {
      if (!value) return true;
      if (value === "") return true;
      if (typeof value === "string") {
        if (value.trim() === "") return true;
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

        const formattedCurrency = `$${Intl.NumberFormat("en-US", {
          maximumFractionDigits,
        }).format(amount)}`;

        return formattedCurrency;
      } catch (e) {
        return amount.toString();
      }
    },
  };

  fn.init();
};

trdList();
