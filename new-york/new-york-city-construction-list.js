const dataUrl =
  "https://static.therealdeal.com/interactive-maps/new-york-city-dob-now-job-filings-map.geojson";

const trdTheme = TrdTheme();

const trdList = () => {
  const list = document.querySelector("#list");

  const queryParams = new URLSearchParams(window.location.search);
  const updateHeight = queryParams.get("updateHeight");

  const maxLimit = 10;
  let listLimit = queryParams.get("limit");
  if (!listLimit || isNaN(listLimit)) {
    listLimit = maxLimit;
  } else {
    listLimit = parseInt(listLimit, 10);
    if (listLimit > maxLimit) {
      listLimit = maxLimit;
    }
  }

  const fn = {
    init: () => {
      trdTheme.init();
      fn.addEventListeners();
      fn.addLoadingListItems();
      fn.getData(dataUrl)
        .then(fn.renderListItems)
        .catch(console.error)
        .finally(fn.updateParentWithHeight);
    },

    getData: async (url) => {
      const response = await fetch(url);
      return response.json();
    },

    addLoadingListItems: () => {
      const items = Array.from({ length: listLimit }, (_, i) => {
        return `
          <li class="list-group-item d-flex justify-content-between align-items-start">
            <div class="me-2" style="width: 100%;">
              <div class="loading-placeholder" style="width: 70%; height: 20px;"></div>
              <div class="loading-placeholder" style="width: 100%; height: 20px;"></div>
              <div class="loading-placeholder" style="width: 80%; height: 15px;"></div>
            </div>
            <div>
              <div class="loading-placeholder" style="width: 100px; height: 20px;"></div>
              <div class="loading-placeholder" style="width: 85px; height: 20px;"></div>
              <div class="loading-placeholder" style="width: 70px; height: 15px;"></div>
            </div>
          </li>
        `;
      }).join("");

      list.innerHTML = items;
    },

    addEventListeners: () => {
      window.addEventListener("resize", fn.updateParentWithHeight);
      window.addEventListener("load", fn.updateParentWithHeight);
      window.addEventListener("message", (event) => {
        if (event.data.type === "updateHeight") {
          fn.updateParentWithHeight();
        }
      });
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

    renderListItems: (data) => {
      const items = data.features
        .filter(helpers.filterListEmptyData)
        .filter(helpers.filterToLast30Days)
        .sort(helpers.sortListByStatusDate)
        .slice(0, listLimit)
        .map((feature) => {
          const properties = feature.properties;
          const price = helpers.formatCurrency(
            properties["Estimated Job Cost"],
            true
          );
          const sqft = TrdFormatters.formatNumber(
            properties["Total Construction Floor Area"],
            true
          );
          const date = helpers.formatDate(properties["Instrument Status Date"]);
          const borough = helpers.formatBorough(properties["Borough"]);

          const place = [];
          if (!helpers.isEmptyValue(properties["Neighborhood"])) {
            place.push(properties["Neighborhood"]);
          }

          if (!helpers.isEmptyValue(borough)) {
            place.push(borough);
          }

          return `
            <li class="list-group-item d-flex justify-content-between align-items-start">
              <div class="me-2">
                <div class="text-muted text-small">${
                  properties["Instrument Type"]
                } | ${properties["Instrument Status"]}</div>
                <div>${properties["Property Address"]}</div>
                <div class="text-muted">${place.join(", ")}</div>
              </div>
              <div>
                <div class="text-success price">${price}</div>
                <div class="text-success sqft">${sqft} SqFt</div>
                <div class="text-muted date">${date}</div>
              </div>
            </li>
          `;
        })
        .join("");

      list.innerHTML = items;
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

    filterListEmptyData: (data) => {
      const properties = data.properties;
      const address = properties["Property Address"];

      return !helpers.isEmptyValue(address);
    },

    filterToLast30Days: (data) => {
      const date = Date.parse(data.properties["Instrument Status Date"]);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return date > thirtyDaysAgo;
    },

    sortListByStatusDate: (a, b) => {
      const priceA = a.properties["Instrument Status Date"];
      const priceB = b.properties["Instrument Status Date"];
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

    formatBorough: (value) => {
      const borough = value.toLowerCase().replace("county", "").trim();
      switch (borough) {
        case "bronx":
          return "BX";
        case "kings":
        case "brooklyn":
          return "BK";
        case 'new york"':
        case "manhattan":
          return "MN";
        case "queens":
          return "QN";
        case "richmond":
        case "staten island":
          return "SI";
        default:
          return "";
      }
    },
  };

  fn.init();
};

trdList();
