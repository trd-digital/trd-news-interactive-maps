"use strict";

/**
 * Provide functionality for main points of the Commercial office market.
 * Contains the following API:
 * 1. initUserTheme — Enable Bootstrap dark theme.
 * 2. initTooltips — Enable all Bootstrap tooltips.
 * 3. setDropdown — Init Bootstrap dropdown.
 * 4. listenEvents — List events: redirect by click on list items
 *    and update list data by click on the Filter Apply button.
 * 5. getGetParamValue — Set legalKey by getParamKey.
 * 6. setResults — Get all data from files and set results.
 * 7. renderResults — Render and print the headline and list items data.
 */
const сommercialOfficeMarket = () => {
	// Local and remote data.
	const localDataUrls = {
		officeMarketsInventory: "data/market_level_inventory_deliveries_underConstruction_tables.json",
		vacancyRate: "data/market_level_vacancy_rates.json",
		askingPrice: "data/market_level_asking_rents.json",
		netAbsorption: "data/market_level_absorption_data.json",
	};
	const remoteDataUrls = {
		officeMarketsInventory: "https://github.com/trd-digital/research-notebook/blob/main/widget_data/market_level_inventory_deliveries_underConstruction_tables.json",
		vacancyRate: "https://github.com/trd-digital/research-notebook/blob/main/widget_data/market_level_vacancy_rates.json",
		askingPrice: "https://github.com/trd-digital/research-notebook/blob/main/widget_data/market_level_asking_rents.json",
		netAbsorption: "https://github.com/trd-digital/research-notebook/blob/main/widget_data/market_level_absorption_data.json",
	};

	// Connector is a list of data that provides access to local/remote data.
	// 1. The "searchByDistrict" — used to retrieve the row ID from officeMarketsInventory data.
	// Keys are the GET parameter values. Values are the search words.
	// 2. The "rowId" and "accessKeys" — used to retrieve the data from officeMarketsInventory,
	// vacancyRate, askingPrice, netAbsorption.
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
	}

	// Filter data.
	// GET parameter.
	// Legal key is: GET parameter value or Filter value.
	let dropdown = null;
	const buttonIconFilter = document.getElementById("button-icon-filter"); // The <button> tag.
	const dropdownButtonApply = document.getElementById("dropdown-button-apply"); // The <button> tag.
	const filterName = "filter";
	const getParamKey = "market";
	let legalKey = "";

	// Headline init.
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


			dropdownButtonApply.addEventListener("click", async() => {
				const dropdownMarkets = document.getElementById("dropdown-markets"); // The <div> tag.
				const input = dropdownMarkets.querySelector(`input[name="${filterName}"]:checked`);
				const value = (input ? input.getAttribute("value") : "");
				if (!helpers.isEmpty(value)) {
					legalKey = value;
					await api.setResults();
					if (!haveError) api.renderResults();
					dropdown.hide();
				}
			});
		},

		initUserTheme: () => {
			if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
				document.body.setAttribute("data-bs-theme", "dark");
			}
		},

		initTooltips: () => {
			const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
			[...tooltips].map(value => new bootstrap.Tooltip(value));
		},

		setDropdown: () => {
			dropdown = new bootstrap.Dropdown(buttonIconFilter);

			// S
			buttonIconFilter.addEventListener('show.bs.dropdown', event => {
				setTimeout(() => {
					const input = event.target.parentElement.querySelector("input:checked");
					input.scrollIntoView(true);
				}, 20);
			});
		},

		listenEvents: () => {
			listGroup.addEventListener("click", helpers.redirect);
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
				const dropdownMarkets = document.getElementById("dropdown-markets"); // The <div> tag.
				const inputs = dropdownMarkets.querySelectorAll(`input[name="${filterName}"]`);
				console.log(inputs);
				inputs.forEach((element) => {
					if (element.getAttribute("value") == legalKey) {
						element.checked = true;
						element.scrollIntoView(true);
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
				if (!(legalKey in connector.searchByDistrict)) throw Error(`The setResults method: Unable to set results. An illegal key was provided: "${legalKey}".`);

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
				if (e instanceof Error ||
					e instanceof TypeError ||
					e instanceof RangeError ||
					e instanceof EvalError) {
					console.error("[" + e.name + "] " + e.message);
					haveError = true;
				} else {
					console.log(e);
				}
			}
		},

		setRowId: (data) => {
			if (!(connector.accessKeys.officeMarkets in data)) throw new Error(`The setRowId method: The expected "${connector.accessKeys.officeMarkets}" key was not found in the data.`);

			//if (connector.rowId < 0) {
				const rowId = helpers.getRowId(data[ connector.accessKeys.officeMarkets ]);
				if (rowId >= 0) {
					connector.rowId = rowId;
				} else {
					throw Error(`The setRowId method: The requested "${connector.searchByDistrict[legalKey]}" market was not found in the data.`);
				}
			//}
		},

		setOfficeMarketsInventory: (data) => {
			results.headline = ((connector.accessKeys.officeMarkets in data) && (connector.rowId in data[ connector.accessKeys.officeMarkets ]) ? data[ connector.accessKeys.officeMarkets ][ connector.rowId ] : "");
			results.inventory = ((connector.accessKeys.inventory in data) && (connector.rowId in data[ connector.accessKeys.inventory ]) ? data[ connector.accessKeys.inventory ][ connector.rowId ] : "");
			results.deliveries = ((connector.accessKeys.deliveries in data) && (connector.rowId in data[ connector.accessKeys.deliveries ]) ? data[ connector.accessKeys.deliveries ][ connector.rowId ] : "");
			results.underConstruction = ((connector.accessKeys.underConstruction in data) && (connector.rowId in data[ connector.accessKeys.underConstruction ]) ? data[ connector.accessKeys.underConstruction ][ connector.rowId ] : "");
		},

		setVacancyRate: (data) => {
			results.vacancyRate = ((connector.accessKeys.vacancyRate in data) && (connector.rowId in data[ connector.accessKeys.vacancyRate ]) ? data[ connector.accessKeys.vacancyRate ][ connector.rowId ] : "");
			results.vacancyRatePercentChange = ((connector.accessKeys.vacancyRatePercentChange in data) && (connector.rowId in data[ connector.accessKeys.vacancyRatePercentChange ]) ? data[ connector.accessKeys.vacancyRatePercentChange ][ connector.rowId ] : "");
		},

		setAskingPrice: (data) => {
			results.askingPrice = ((connector.accessKeys.askingPrice in data) && (connector.rowId in data[ connector.accessKeys.askingPrice ]) ? data[ connector.accessKeys.askingPrice ][ connector.rowId ] : "");
			results.askingPricePercentChange = ((connector.accessKeys.askingPricePercentChange in data) && (connector.rowId in data[ connector.accessKeys.askingPricePercentChange ]) ? data[ connector.accessKeys.askingPricePercentChange ][ connector.rowId ] : "");
		},

		setNetAbsorption: (data) => {
			results.netAbsorption = ((connector.accessKeys.netAbsorption in data) && (connector.rowId in data[ connector.accessKeys.netAbsorption ]) ? data[ connector.accessKeys.netAbsorption ][ connector.rowId ] : "");
			results.netAbsorptionPercentChange = ((connector.accessKeys.netAbsorptionPercentChange in data) && (connector.rowId in data[ connector.accessKeys.netAbsorptionPercentChange ]) ? data[ connector.accessKeys.netAbsorptionPercentChange ][ connector.rowId ] : "");
		},

		renderResults: () => {
			if (!helpers.isEmpty(results.headline)) {
				const quarter = (!helpers.isEmpty(connector.accessKeys.vacancyRate) ? " " + connector.accessKeys.vacancyRate : "");
				headline.innerHTML = `${results.headline} Office Makret${quarter}`;
			}
			listGroup.innerHTML = `
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Vacancy Rate</div>
					<div class="list-group-item-data">
						<div class="rate">${results.vacancyRate}</div>
						<div class="rate-yoy">
							<span class="number${helpers.getCssClass(results.vacancyRatePercentChange)}">${helpers.formatToPercent(results.vacancyRatePercentChange)}</span><span class="unit">YoY</span>
						</div>
					</div>
				</li>
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Asking Price Per Sf</div>
					<div class="list-group-item-data">
						<div class="rate">${results.askingPrice}</div>
						<div class="rate-yoy">
							<span class="number${helpers.getCssClass(results.askingPricePercentChange)}">${helpers.formatToPercent(results.askingPricePercentChange)}</span><span class="unit">YoY</span>
						</div>
					</div>
				</li>
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Net Absorption</div>
					<div class="list-group-item-data">
						<div class="rate">${results.netAbsorption}</div>
						<div class="rate-yoy">
							<span class="number${helpers.getCssClass(results.netAbsorptionPercentChange)}">${helpers.formatToPercent(results.netAbsorptionPercentChange)}</span><span class="unit">YoY</span>
						</div>
					</div>
				</li>
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Inventory</div>
					<div class="list-group-item-data">
						<div class="rate">${results.inventory} sf</div>
					</div>
				</li>
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Deliveries YTD</div>
					<div class="list-group-item-data">
						<div class="rate">${results.deliveries} sf</div>
					</div>
				</li>
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Under Construction</div>
					<div class="list-group-item-data">
						<div class="rate">${results.underConstruction} sf</div>
					</div>
				</li>
			`;
		},
	};

	const helpers = {
		isString: (value) => {
			return (typeof value === 'string') || (value instanceof String);
		},

		isEmpty: (value) => {
			return (!value) ||
			(value === "") ||
			(helpers.isString(value) && value.trim() === "");
		},

		redirect: () => {
			window.open("https://therealdeal.com/data/", "_blank");
		},

		getRowId: (officeMarkets) => {
			let result = -1;

			const markets = Object.values(officeMarkets);
			const ids = Object.keys(officeMarkets);
			markets.forEach((market, index) => {
				if (market.toLowerCase().indexOf(connector.searchByDistrict[ legalKey ].toLowerCase()) !== -1) {
					result = parseInt(ids[index]);
				}
			});
	
			return result;
		},

		formatToPercent: (value) => {
			return (value > 0 ? "+" : "") + Math.round(value) + "%";
		},

		getCssClass: (value) => {
			return (value >= 0 ? " positive" : " negative");
		},
	};

	api.init();
};

/**
 * Call сommercial office market.
 */
сommercialOfficeMarket();
