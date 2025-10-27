const dataUrl = "south-florida-agent-headcount-list.json";

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

const trdTheme = TrdTheme();

const trdList = () => {
  const list = document.querySelector("#list");
  const queryParams = new URLSearchParams(window.location.search);
  const view = queryParams.get("view");
  const propertyType = queryParams.get("property-type");
  const uniqueBuilding = queryParams.get("uniqueBuilding");
  const updateHeight = queryParams.get("updateHeight");
  const maxLimit = 30;
  let listLimit = queryParams.get("limit");
  if (!listLimit || isNaN(listLimit)) {
    listLimit = maxLimit;
  } else {
    listLimit = parseInt(listLimit, 10);
    if (listLimit > maxLimit) {
      listLimit = maxLimit;
    }
  }

  let scroller;

  const fn = {
    init: () => {
      fn.setupTooltip();
      fn.addEventListeners();
      trdTheme.init();
      fn.updateView();
      fn.addLoadingListItems();
      fn.getData()
        .then(fn.renderListItems)
        .catch(console.error)
        .finally(() => {
          if (view === "dashboard") {
            fn.updateParentWithHeight();
          }
        });
    },

    updateView: () => {
      if (view === "dashboard") {
        document.querySelector(".card").classList.remove("card");
        document.querySelector(".card-body").classList.add("d-none");
        list.classList.add("list-view-numbers");
        fn.updateParentWithHeight();
      }
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
          "https://therealdeal.com/data/miami/2024/priciest-south-florida-sales/?utm_source=embed&utm_medium=widget"
        );
        window.open(url, "_blank");
      });
      window.addEventListener("load", helpers.addGamTrackUrls);
      window.addEventListener("blur", helpers.autoScrollListStart);
      window.addEventListener("load", helpers.autoScrollListStart);
      list.addEventListener("mouseleave", helpers.autoScrollListStart);
      list.addEventListener("mouseenter", helpers.autoScrollListStop);
      list.addEventListener("touchstart", helpers.autoScrollListStop);
      window.addEventListener("resize", fn.updateParentWithHeight);
      window.addEventListener("load", fn.updateParentWithHeight);
      window.addEventListener("message", (event) => {
        if (event.data.type === "updateHeight") {
          fn.updateParentWithHeight();
        }
      });
    },

    getData: async () => {
      const response = await fetch(dataUrl);
      return response.json();
    },

    addLoadingListItems: () => {
      const items = Array.from({ length: listLimit }, (_, i) => {
        return `
          <li class="list-group-item d-flex justify-content-between align-items-start">
            <div class="me-2" style="width: 100%;">
              <div class="loading-placeholder" style="width: 100%; height: 20px;"></div>
            </div>
            <div>
              <div class="loading-placeholder" style="width: 100px; height: 20px;"></div>
              <div class="loading-placeholder" style="width: 80px; height: 15px;"></div>
            </div>
          </li>
        `;
      }).join("");

      list.innerHTML = items;
    },

    renderListItems: (data) => {
      let items = data
        .filter(helpers.filterListEmptyData)
        .sort(helpers.sortListByCount)
        .slice(0, listLimit)
        .map((feature) => {
          const licenseeName = feature["Licensee Name"];
          const activeAgentCount = feature["# of active agents and brokers"];

          return `
            <li class="list-group-item d-flex justify-content-between align-items-start">
              <div class="me-2">
                <div>${licenseeName}</div>
              </div>
              <div>
                <div class="text-success price">${activeAgentCount}</div>
              </div>
            </li>
          `;
        })
        .join("");

      list.innerHTML = items;

      if (view === "dashboard") {
        const viewMore = document.createElement("div");
        viewMore.className = "text-center";
        viewMore.innerHTML = `
        <a href="https://therealdeal.com/data/new-york/2024/nyc-transactions/?utm_source=embed&utm_medium=widget" class="btn btn-primary" target="_parent">
          <div class="me-2 text-uppercase label">View More</div>
        </a>
        `;
        list.parentNode.appendChild(viewMore);
      }
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

    updateParentWithHeight: () => {
      if (!updateHeight) return;

      const origin =
        window.location.origin === "https://trd-digital.github.io"
          ? "https://therealdeal.com"
          : "http://localhost:3010";

      const height = list.offsetHeight;
      window.parent.postMessage(
        { updateHeight: height + 10, src: window.location.href },
        origin
      );
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

    filterListEmptyData: (data) => {
      const properties = data;
      const license = properties["License #"];
      const activeAgentCount = properties["# of active agents and brokers"];
      const licenseeName = properties["Licensee Name"];

      return (
        !helpers.isEmptyValue(activeAgentCount) &&
        !helpers.isEmptyValue(licenseeName) &&
        !helpers.isEmptyValue(license)
      );
    },

    sortListByCount: (a, b) => {
      const countA = a["# of active agents and brokers"];
      const countB = b["# of active agents and brokers"];
      return countB - countA;
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
