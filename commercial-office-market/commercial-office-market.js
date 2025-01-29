"use strict";

const commercialOfficeMarket = () => {
  // Local and remote data.
  const dataUrl = "commercial-office-market.json";
  let cacheData = {};
  let dropdown = null;
  const getParamKey = "market";

  const buttonIconFilter = document.getElementById("button-icon-filter"); // The <button> tag.
  const dropdownButtonApply = document.getElementById("dropdown-button-apply"); // The <button> tag.
  const dropdownFilter = document.getElementById("dropdown-filter"); // The <div> tag.

  // Headline and list group.
  const headline = document.getElementById("com-office-market-headline"); // The <a> tag.
  const listGroup = document.getElementById("com-office-market-list-group"); // The <ul> tag.
  const noResult = document.getElementById("com-office-market-no-result"); // The <div> tag.

  const fn = {
    init: () => {
      fn.initUserTheme();
      fn.initTooltips();
      fn.initDropdown();
      fn.eventListens();
      api.init();
    },

    initUserTheme: () => {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.body.setAttribute("data-bs-theme", "dark");
      }
    },

    initTooltips: () => {
      const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
      [...tooltips].map((value) => new bootstrap.Tooltip(value));
    },

    initDropdown: () => {
      dropdown = new bootstrap.Dropdown(buttonIconFilter);
    },

    eventListens: () => {
      // Redirect when click on the list items.
      listGroup.addEventListener("click", fn.redirect);
      window.addEventListener("load", helpers.addGamTrackUrls);

      // Update and print results after new filter was chosen.
      dropdownButtonApply.addEventListener("click", api.updateResults);
    },

    redirect: () => {
      window.open(
        helpers.getGamTrackUrl("https://therealdeal.com/data/"),
        "_blank"
      );
    },
  };

  const api = {
    init: () => {
      api
        .fetchData(dataUrl)
        .then((data) => {
          cacheData = data;
          api.setResults();
        })
        .catch((e) => {
          console.error(e);
        });
    },

    fetchData: async (url) => {
      const response = await fetch(url);
      return response.json();
    },

    updateResults: () => {
      const input = dropdownFilter.querySelector(
        `input[name="${getParamKey}"]:checked`
      );
      const value = input ? input.getAttribute("value") : "";
      if (!helpers.isEmpty(value)) {
        helpers.trackEvent("filter", value);
        dropdown.hide();
        const url = new URL(window.location);
        if (url.searchParams.has(getParamKey)) {
          url.searchParams.delete(getParamKey);
        }
        url.searchParams.set(getParamKey, value);
        window.history.pushState({}, "", url);
        api.setResults(value);
      }
    },

    setResults: (value = "") => {
      const data = cacheData;
      const getParamValue =
        value || helpers.getGetParamValue(getParamKey) || "New_York_-_Downtown";

      const result = data.filter(
        (item) => item.region === getParamValue.replaceAll("_", " ")
      );

      listGroup.innerHTML = "";

      if (result.length === 0) {
        headline.innerHTML = "Office Market";
        noResult.classList.remove("d-none");
        listGroup.classList.add("d-none");
        return;
      }

      noResult.classList.add("d-none");
      listGroup.classList.remove("d-none");
      headline.innerHTML = `${result[0].region} Office Market ${result[0].date_period}`;

      result.forEach((item) => {
        const row = api.renderRow(item.display_title.trim(), item.value);
        listGroup.innerHTML += row;
      });
    },

    renderRow: (label, value) => {
      let formattedValue = value;
      if (
        label === "Inventory" ||
        label === "Deliveries 2024" ||
        label === "Under Construction" ||
        label === "Absorption"
      ) {
        formattedValue = `${value} SF`;
      }

      return `<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">${label}</div>
					<div class="list-group-item-data">${formattedValue}</div>
				</li>`;
    },
  };

  const helpers = {
    formatQuarter: (value) => {
      let result = "";

      if (helpers.isString(value)) {
        result = value.replace("p", "");
      }

      return result;
    },

    formatString: (value) => {
      let result = "";

      if (helpers.isString(value)) {
        result = value.replace(/\–/g, "-");
      }

      return result;
    },

    formatFloat: (value, precision, prefix, postfix) => {
      let result = "";

      if (helpers.isNumber(value)) {
        result = prefix + parseFloat(value.toFixed(precision)) + postfix;
      }

      return result;
    },

    formatInt: (value, prefix, postfix) => {
      let result = "";

      if (helpers.isNumber(value)) {
        result = prefix + value.toLocaleString("en-US") + postfix;
      }

      return result;
    },

    getNumColorCssClass: (value) => {
      return value >= 0 ? " positive" : " negative";
    },

    isString: (value) => {
      return typeof value === "string" || value instanceof String;
    },

    isNumber: (value) => {
      return typeof value == "number" && !isNaN(value - value);
    },

    isEmpty: (value) => {
      return (
        !value ||
        value === "" ||
        (helpers.isString(value) && value.trim() === "")
      );
    },

    maybeInt: (value) => {
      if (helpers.isNumber(value)) {
        value = parseInt(value);
      } else if (helpers.isString(value)) {
        value = parseInt(value.replace(/\,/g, ""));
      } else {
        value = "";
      }

      return value;
    },

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

    trackEvent: (action, label) => {
      if (window.dataLayer) {
        window.dataLayer.push({
          event: "event_tracking",
          trd: {
            category: "commercial-office-market",
            action: `list_${action}`,
            label: label,
          },
        });
      }
    },

    getGetParamValue: (key) => {
      let result = "";
      if (!helpers.isEmpty(key)) {
        const params = new URLSearchParams(document.location.search);
        const value = params.get(key);
        if (helpers.isString(value)) result = value;
      }

      if (key === "market") {
        return helpers.mapMarket(result);
      }
      return result;
    },

    mapMarket(value) {
      const mapMarkets = {
        new_york_midtown: "New_York_-_Midtown",
        new_york_midtown_south: "New_York_-_Midtown_South",
        new_york_downtown: "New_York_-_Downtown",
        new_york_brooklyn: "New_York_-_Brooklyn",
        miami_fl: "Miami",
        palm_beach_fl: "Palm_Beach",
        fort_lauderdale_fl: "Fort_Lauderdale",
        chicago_il: "Chicago",
        los_angeles_cbd: "Los_Angeles_CBD",
        los_angeles_non_cbd: "Los_Angeles_Non-CBD",
        orange_county_ca: "Orange_County",
        inland_empire_ca: "Inland_Empire_CA",
        san_francisco_ca: "San_Francisco",
        san_mateo_county_ca: "San_Mateo_County",
        oakland_east_bay_ca: "Oakland/East_Bay",
        san_jose_ca: "San_Jose",
        austin_tx: "Austin",
        dallas_tx: "Dallas",
        houston_tx: "Houston",
      };

      return mapMarkets[value] || value;
    },
  };

  fn.init();
};

/**
 * Call the Commercial Office Market.
 */
commercialOfficeMarket();
