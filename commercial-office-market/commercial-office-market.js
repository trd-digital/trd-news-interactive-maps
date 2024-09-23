"use strict";

/**
 * Provide functionality for main points of the Commercial office market.
 * Contains the following API:
 * 1. initUserTheme — Enable Bootstrap dark theme.
 * 2. initTooltips — Enable all Bootstrap tooltips.
 * 3. setDropdown — Init Bootstrap dropdown.
 * 4. listenEvents — All events.
 * 5. getGetParamValue — Set legalKey by getParamKey.
 * 6. setResults — Get all data from files and set results.
 * 7. renderResults — Render and print the headline and list items.
 */
const commercialOfficeMarket = () => {
  // Local and remote data.
  const localDataUrls = {
    officeMarketsInventory:
      "data/market_level_inventory_deliveries_underConstruction_tables.json",
    vacancyRate: "data/market_level_vacancy_rates.json",
    askingPrice: "data/market_level_asking_rents.json",
    netAbsorption: "data/market_level_absorption_data.json",
  };
  const remoteDataUrls = {
    officeMarketsInventory:
      "https://github.com/trd-digital/research-notebook/blob/main/widget_data/market_level_inventory_deliveries_underConstruction_tables.json",
    vacancyRate:
      "https://github.com/trd-digital/research-notebook/blob/main/widget_data/market_level_vacancy_rates.json",
    askingPrice:
      "https://github.com/trd-digital/research-notebook/blob/main/widget_data/market_level_asking_rents.json",
    netAbsorption:
      "https://github.com/trd-digital/research-notebook/blob/main/widget_data/market_level_absorption_data.json",
  };

  // Connector is a list of data that provides access to local/remote data.
  // 1. The "searchByDistrict" — used to retrieve the row ID from officeMarketsInventory data.
  // Keys are the GET parameter values. Values are the search words.
  // 2. The "rowId" and "accessKeys" — used to retrieve the data from officeMarketsInventory,
  // vacancyRate, askingPrice, netAbsorption sources.
  let connector = {
    rowId: -1,
    searchByDistrict: {
      new_york_midtown: "New York - Midtown",
      new_york_midtown_south: "Midtown South",
      new_york_downtown: "New York - Downtown",
      new_york_brooklyn: "Brooklyn",
      miami_fl: "Miami",
      palm_beach_fl: "Palm Beach",
      fort_lauderdale_fl: "Fort Lauderdale",
      chicago_il: "Chicago",
      los_angeles_cbd: "Los Angeles CBD",
      los_angeles_non_cbd: "Los Angeles Non-CBD",
      orange_county_ca: "Orange County",
      inland_empire_ca: "Inland Empire",
      san_francisco_ca: "San Francisco, CA",
      san_mateo_county_ca: "San Mateo",
      oakland_east_bay_ca: "Oakland",
      san_jose_ca: "San Jose",
      austin_tx: "Austin",
      dallas_tx: "Dallas",
      houston_tx: "Houston",
    },
    accessKeys: {
      officeMarkets: "U.S. Office Markets",
      inventory: "Inventory",
      deliveries: "Deliveries 2024 YTD",
      underConstruction: "Under Construction as of Q2 2024p",
      vacancyRate: "Q2 2024p",
      vacancyRatePercentChange: "percent_change",
      askingPrice: "Q2 2024p",
      askingPricePercentChange: "percent_change",
      netAbsorption: "Q2 2024p",
      netAbsorptionPercentChange: "percent_change",
    },
  };

  // Filter data.
  // GET parameter.
  // Legal key is: GET parameter value or Filter value.
  let dropdown = null;
  const buttonIconFilter = document.getElementById("button-icon-filter"); // The <button> tag.
  const dropdownButtonApply = document.getElementById("dropdown-button-apply"); // The <button> tag.
  const filterName = "filter";
  const getParamKey = "market";
  let legalKey = "";

  // Headline and list group.
  const headline = document.getElementById("com-office-market-headline"); // The <a> tag.
  const listGroup = document.getElementById("com-office-market-list-group"); // The <ul> tag.

  // Results.
  let results = {
    headline: "",
    vacancyRate: "",
    vacancyRatePercentChange: "",
    askingPrice: "",
    askingPricePercentChange: "",
    netAbsorption: "",
    netAbsorptionPercentChange: "",
    inventory: "",
    deliveries: "",
    underConstruction: "",
  };
  let haveError = false;

  const api = {
    init: async () => {
      api.initUserTheme();
      api.initTooltips();
      api.setDropdown();
      api.listenEvents();
      legalKey = api.getGetParamValue(getParamKey);
      api.setRadioInput();
      await api.setResults();
      if (!haveError) api.renderResults();
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

    setDropdown: () => {
      dropdown = new bootstrap.Dropdown(buttonIconFilter);
    },

    listenEvents: () => {
      // Redirect when click on the list items.
      listGroup.addEventListener("click", api.redirect);

      // AutoScroll to the checked input when the dropdown list is opened.
      buttonIconFilter.addEventListener("show.bs.dropdown", (event) =>
        api.autoScroll(event)
      );

      // Update and print results after new filter was chosen.
      dropdownButtonApply.addEventListener("click", api.updateResults);
    },

    redirect: () => {
      window.open("https://therealdeal.com/data/", "_blank");
    },

    autoScroll: (event) => {
      setTimeout(() => {
        const input = event.target.parentElement.querySelector("input:checked");
        if (input)
          input.scrollIntoView({
            behavior: "instant",
            block: "nearest",
            inline: "start",
          });
      }, 20);
    },

    updateResults: async () => {
      const dropdownFilter = document.getElementById("dropdown-filter"); // The <div> tag.
      const input = dropdownFilter.querySelector(
        `input[name="${filterName}"]:checked`
      );
      const value = input ? input.getAttribute("value") : "";
      if (!helpers.isEmpty(value)) {
        dropdown.hide();
        if (legalKey != value) {
          haveError = false;
          connector.rowId = -1;
          legalKey = value;
          await api.setResults();
          if (!haveError) api.renderResults();
        }
      }
    },

    getGetParamValue: (key) => {
      let result = "";
      if (!helpers.isEmpty(key)) {
        const params = new URLSearchParams(document.location.search);
        const value = params.get(key);
        if (helpers.isString(value)) result = value;
      }

      return result;
    },

    setRadioInput: () => {
      if (!helpers.isEmpty(legalKey)) {
        const dropdownFilter = document.getElementById("dropdown-filter"); // The <div> tag.
        const inputs = dropdownFilter.querySelectorAll(
          `input[name="${filterName}"]`
        );
        inputs.forEach((element) => {
          if (element.getAttribute("value") == legalKey) {
            element.checked = true;
          }
        });
      }
    },

    fetchData: async (url) => {
      const response = await fetch(url);

      return response.json();
    },

    setResults: async () => {
      try {
        if (!(legalKey in connector.searchByDistrict))
          throw Error(
            `The setResults method: Unable to set results. An illegal key was provided: "${legalKey}".`
          );

        const [
          officeMarketsInventoryData,
          vacancyRateData,
          askingPriceData,
          netAbsorptionData,
        ] = await Promise.allSettled([
          await api.fetchData(localDataUrls.officeMarketsInventory),
          await api.fetchData(localDataUrls.vacancyRate),
          await api.fetchData(localDataUrls.askingPrice),
          await api.fetchData(localDataUrls.netAbsorption),
        ]);

        api.setRowId(officeMarketsInventoryData.value);
        api.setOfficeMarketsInventory(officeMarketsInventoryData.value);
        api.setVacancyRate(vacancyRateData.value);
        api.setAskingPrice(askingPriceData.value);
        api.setNetAbsorption(netAbsorptionData.value);
      } catch (e) {
        if (
          e instanceof Error ||
          e instanceof TypeError ||
          e instanceof RangeError ||
          e instanceof EvalError
        ) {
          console.error("[" + e.name + "] " + e.message);
          haveError = true;
        } else {
          console.log(e);
        }
      }
    },

    setRowId: (data) => {
      if (!(connector.accessKeys.officeMarkets in data))
        throw new Error(
          `The setRowId method: The expected "${connector.accessKeys.officeMarkets}" key was not found in the data.`
        );

      if (connector.rowId < 0) {
        const rowId = api.getRowId(data[connector.accessKeys.officeMarkets]);
        if (rowId >= 0) {
          connector.rowId = rowId;
        } else {
          throw Error(
            `The setRowId method: The requested "${connector.searchByDistrict[legalKey]}" market was not found in the data.`
          );
        }
      }
    },

    getRowId: (officeMarkets) => {
      let result = -1;

      const markets = Object.values(officeMarkets);
      const ids = Object.keys(officeMarkets);
      markets.forEach((market, index) => {
        if (
          market
            .toLowerCase()
            .indexOf(connector.searchByDistrict[legalKey].toLowerCase()) !== -1
        ) {
          result = parseInt(ids[index]);
        }
      });

      return result;
    },

    setOfficeMarketsInventory: (data) => {
      if (
        connector.accessKeys.officeMarkets in data &&
        connector.rowId in data[connector.accessKeys.officeMarkets]
      ) {
        results.headline = helpers.isString(
          data[connector.accessKeys.officeMarkets][connector.rowId]
        )
          ? data[connector.accessKeys.officeMarkets][connector.rowId]
          : "";
      }
      results.inventory =
        connector.accessKeys.inventory in data &&
        connector.rowId in data[connector.accessKeys.inventory]
          ? helpers.maybeInt(
              data[connector.accessKeys.inventory][connector.rowId]
            )
          : "";
      results.deliveries =
        connector.accessKeys.deliveries in data &&
        connector.rowId in data[connector.accessKeys.deliveries]
          ? helpers.maybeInt(
              data[connector.accessKeys.deliveries][connector.rowId]
            )
          : "";
      results.underConstruction =
        connector.accessKeys.underConstruction in data &&
        connector.rowId in data[connector.accessKeys.underConstruction]
          ? helpers.maybeInt(
              data[connector.accessKeys.underConstruction][connector.rowId]
            )
          : "";
    },

    setVacancyRate: (data) => {
      results.vacancyRate =
        connector.accessKeys.vacancyRate in data &&
        connector.rowId in data[connector.accessKeys.vacancyRate]
          ? parseFloat(data[connector.accessKeys.vacancyRate][connector.rowId])
          : "";
      results.vacancyRatePercentChange =
        connector.accessKeys.vacancyRatePercentChange in data &&
        connector.rowId in data[connector.accessKeys.vacancyRatePercentChange]
          ? parseFloat(
              data[connector.accessKeys.vacancyRatePercentChange][
                connector.rowId
              ]
            )
          : "";
    },

    setAskingPrice: (data) => {
      results.askingPrice =
        connector.accessKeys.askingPrice in data &&
        connector.rowId in data[connector.accessKeys.askingPrice]
          ? parseFloat(data[connector.accessKeys.askingPrice][connector.rowId])
          : "";
      results.askingPricePercentChange =
        connector.accessKeys.askingPricePercentChange in data &&
        connector.rowId in data[connector.accessKeys.askingPricePercentChange]
          ? parseFloat(
              data[connector.accessKeys.askingPricePercentChange][
                connector.rowId
              ]
            )
          : "";
    },

    setNetAbsorption: (data) => {
      results.netAbsorption =
        connector.accessKeys.netAbsorption in data &&
        connector.rowId in data[connector.accessKeys.netAbsorption]
          ? helpers.maybeInt(
              data[connector.accessKeys.netAbsorption][connector.rowId]
            )
          : "";
      results.netAbsorptionPercentChange =
        connector.accessKeys.netAbsorptionPercentChange in data &&
        connector.rowId in data[connector.accessKeys.netAbsorptionPercentChange]
          ? parseFloat(
              data[connector.accessKeys.netAbsorptionPercentChange][
                connector.rowId
              ]
            )
          : "";
    },

    renderResults: () => {
      // Show headline.
      if (results.headline) {
        const quarter = connector.accessKeys.vacancyRate
          ? ` ${helpers.formatQuarter(connector.accessKeys.vacancyRate)}`
          : "";
        headline.innerHTML = `${helpers.formatString(
          results.headline
        )} Office Market${quarter}`;
      } else {
        headline.innerHTML = `Office Market`;
      }

      // Prepare print.
      let print = {
        vacancyRate: helpers.formatFloat(results.vacancyRate, 1, "", "%"),
        vacancyRatePercentChange: helpers.formatFloat(
          results.vacancyRatePercentChange,
          0,
          results.vacancyRatePercentChange > 0 ? "+" : "",
          "%"
        ),
        askingPrice: helpers.formatFloat(results.askingPrice, 2, "$", ""),
        askingPricePercentChange: helpers.formatFloat(
          results.askingPricePercentChange,
          0,
          results.askingPricePercentChange > 0 ? "+" : "",
          "%"
        ),
        netAbsorption: helpers.formatInt(results.netAbsorption, "", " sf"),
        netAbsorptionPercentChange: helpers.formatFloat(
          results.netAbsorptionPercentChange,
          0,
          results.netAbsorptionPercentChange > 0 ? "+" : "",
          "%"
        ),
        inventory: helpers.formatInt(results.inventory, "", " sf"),
        deliveries: helpers.formatInt(results.deliveries, "", " sf"),
        underConstruction: helpers.formatInt(
          results.underConstruction,
          "",
          " sf"
        ),
      };
      if (print.vacancyRatePercentChange) {
        print.vacancyRatePercentChange = `<span class="number${helpers.getNumColorCssClass(
          results.vacancyRatePercentChange
        )}">${
          print.vacancyRatePercentChange
        }</span><span class="unit">YoY</span>`;
      }
      if (print.askingPricePercentChange) {
        print.askingPricePercentChange = `<span class="number${helpers.getNumColorCssClass(
          results.askingPricePercentChange
        )}">${
          print.askingPricePercentChange
        }</span><span class="unit">YoY</span>`;
      }
      if (print.netAbsorptionPercentChange) {
        print.netAbsorptionPercentChange = `<span class="number${helpers.getNumColorCssClass(
          results.netAbsorptionPercentChange
        )}">${
          print.netAbsorptionPercentChange
        }</span><span class="unit">YoY</span>`;
      }

      // Show list items.
      listGroup.innerHTML = `
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Vacancy Rate</div>
					<div class="list-group-item-data">
						<div class="rate">${print.vacancyRate}</div>
						<div class="rate-yoy">${print.vacancyRatePercentChange}</div>
					</div>
				</li>
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Asking Price Per Sf</div>
					<div class="list-group-item-data">
						<div class="rate">${print.askingPrice}</div>
						<div class="rate-yoy">${print.askingPricePercentChange}</div>
					</div>
				</li>
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Net Absorption</div>
					<div class="list-group-item-data">
						<div class="rate">${print.netAbsorption}</div>
						<div class="rate-yoy">${print.netAbsorptionPercentChange}</div>
					</div>
				</li>
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Inventory</div>
					<div class="list-group-item-data">
						<div class="rate">${print.inventory}</div>
					</div>
				</li>
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Deliveries YTD</div>
					<div class="list-group-item-data">
						<div class="rate">${print.deliveries}</div>
					</div>
				</li>
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Under Construction</div>
					<div class="list-group-item-data">
						<div class="rate">${print.underConstruction}</div>
					</div>
				</li>
			`;
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
  };

  api.init();
};

/**
 * Call the Commercial Office Market.
 */
commercialOfficeMarket();
