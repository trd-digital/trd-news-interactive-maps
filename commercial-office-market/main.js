"use strict";

/**
 * Provide functionality for main points of the Commercial office market.
 * Contains the following API:
 * 1. setUserTheme — Enable/disable Bootstrap dark theme.
 * 2. setTooltips — Enable all Bootstrap tooltips.
 * 3. setGetParamValue — Set getParamValue by getParamKey.
 * 4. setHeadline — Set page headline base on getParamValue.
 * 5. listenEvents — List group area events: redirect by click.
 * 6. startGettingData — Get all data from files.
 * 7. renderListItems — Render and print list items data.
 */
const сommercialOfficeMarket = () => {
	// GET param init.
	const getParamKey = "market";
	let getParamValue = "";

	// Headline init.
	// Example for GET: ?market=broward, ?market=san_francisco
	const headline = document.getElementById("commercial-office-market-headline"); // The <a> tag.
	const trdHeadlines = {
		broward: "Broward",
		chicago: "Chicago",
		dallas: "Dallas",
		fort_worth: "Fort Worth",
		houston: "Houston",
		los_angeles: "Los Angeles",
		miami: "Miami",
		new_york_city: "New York City",
		palm_beach_county: "Palm Beach County",
		san_antonio: "San Antonio",
		san_francisco: "San Francisco",
	};

	// Data URLs init.
	const localDataUrl = {
		cityOfficeInventory: "data/city_office_inventory_tables_08_12_24.json",
		vacancyRates: "data/office_market_vacancy_rates.json",
		askingPrice: "data/asking_office_rents.json",
		netAbsorption: "data/net_absorption.json",
	};
	const remoteDataUrl = {
		cityOfficeInventory: "https://github.com/trd-digital/research-notebook/tree/main/Widget_Data/city_office_inventory_tables_08_12_24.json",
		vacancyRates: "https://github.com/trd-digital/research-notebook/tree/main/Widget_Data/office_market_vacancy_rates.json",
		askingPrice: "https://github.com/trd-digital/research-notebook/tree/main/Widget_Data/asking_office_rents.json",
		netAbsorption: "https://github.com/trd-digital/research-notebook/tree/main/Widget_Data/net_absorption.json",
	};

	// Market data init.
	// Example for GET: ?market=broward, ?market=san_francisco
	const listGroup = document.getElementById("commercial-office-market-list-group"); // The <ul> tag.
	const trdMarkets = {
		broward: "Broward",
		chicago: "Chicago",
		dallas: "Dallas",
		fort_worth: "Fort Worth",
		houston: "Houston",
		los_angeles: "Los Angeles",
		miami: "Miami",
		new_york_city: "New York",
		palm_beach_county: "Palm Beach",
		san_antonio: "San Antonio",
		san_francisco: "San Francisco",
	};
	let result = {
		vacancyRate: "",
		askingPrice: "",
		netAbsorption: "",
		inventory: "",
		deliveriesYtd: "",
		underConstruction: "",
	};

	const api = {
		init: async () => {
			api.setUserTheme();
			api.setTooltips();
			getParamValue = api.setGetParamValue(getParamKey);
			api.setHeadline(getParamValue);
			api.listenEvents();
			await api.startGettingData();
			api.renderListItems();
		},

		setUserTheme: () => {
			if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
				document.body.setAttribute("data-bs-theme", "dark");
			}
		},

		setTooltips: () => {
			const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
			[...tooltips].map(value => new bootstrap.Tooltip(value));
		},

		setGetParamValue: (key) => {
			let result = "";
			if (!helpers.isEmpty(key)) {
				const params = new URLSearchParams(document.location.search);
				const value = params.get(key);
				if (helpers.isString(value)) result = value;
			}

			return result;
		},

		setHeadline: (value) => {
			if (value in trdHeadlines) {
				headline.innerHTML = `${trdHeadlines[value]} Office Makret Q2 2024`;
			} else {
				headline.innerHTML = `Office Makret Q2 2024`;
			}
		},

		listenEvents: () => {
			// Redirect by click on the List group area.
			listGroup.addEventListener("click", helpers.redirect);
		},

		getData: async (url) => {
			const response = await fetch(url);

			return response.json();
		},

		startGettingData: async () => {
			try {
				if (helpers.isEmpty(getParamKey)) throw new RangeError(`The getParamKey constant is empty.`);
				if (helpers.isEmpty(getParamValue)) throw new RangeError(`The "${getParamKey}" GET parameter is empty.`);
				if (!(getParamValue in trdMarkets)) throw (`The "${getParamValue}" GET parameter value was not found in the list of available markets.`);

				const [
					vacancyRatesData,
					askingPriceData,
					netAbsorptionData,
					cityOfficeInventoryData,
				] = await Promise.allSettled([
					await api.getData(localDataUrl.vacancyRates),
					await api.getData(localDataUrl.askingPrice),
					await api.getData(localDataUrl.netAbsorption),
					await api.getData(localDataUrl.cityOfficeInventory),
				]);

				api.getVacancyRate(vacancyRatesData.value);
				api.getAskingPrice(askingPriceData.value);
				api.getNetAbsorption(netAbsorptionData.value);
				api.getThreeRates(cityOfficeInventoryData.value);
			} catch (e) {
				if (e instanceof Error ||
					e instanceof TypeError ||
					e instanceof RangeError ||
					e instanceof EvalError) {
					console.error("[" + e.name + "] " + e.message);
				} else {
					console.log(e);
				}
			}
		},

		getVacancyRate: (data) => {
			if (!("U.S. Office Markets" in data)) throw new Error(`The saveVacancyRate method: The expected "U.S. Office Markets" response key was not found.`);

			const id = helpers.getIdByName(data["U.S. Office Markets"], "United States");
			if (id == -1) throw new RangeError(`The saveVacancyRate method: The "United States" value was not found for the "U.S. Office Markets" key.`);

			const quarter = helpers.getMaxQuarter(Object.keys(data));
			if (helpers.isEmpty(quarter)) throw new RangeError(`The saveVacancyRate method: No quarter keys were found in the data.`);

			result.vacancyRate = data[quarter][id];
		},

		getAskingPrice: (data) => {
			if (!("U.S. Office Markets" in data)) throw new Error(`The getAskingPrice method: The expected "U.S. Office Markets" response key was not found.`);

			const id = helpers.getIdByName(data["U.S. Office Markets"], "United States");
			if (id == -1) throw new RangeError(`The getAskingPrice method: The "United States" value was not found for the "U.S. Office Markets" key.`);

			const quarter = helpers.getMaxQuarter(Object.keys(data));
			if (helpers.isEmpty(quarter)) throw new RangeError(`The getAskingPrice method: No quarter keys were found in the data.`);

			result.askingPrice = data[quarter][id];
		},

		getNetAbsorption: (data) => {
			if (!("U.S. Office Markets" in data)) throw new Error(`The getNetAbsorption method: The expected "U.S. Office Markets" response key was not found.`);

			const id = helpers.getIdByName(data["U.S. Office Markets"], "United States");
			if (id == -1) throw new RangeError(`The getNetAbsorption method: The "United States" value was not found for the "U.S. Office Markets" key.`);

			const quarter = helpers.getMaxQuarter(Object.keys(data));
			if (helpers.isEmpty(quarter)) throw new RangeError(`The getNetAbsorption method: No quarter keys were found in the data.`);

			result.netAbsorption = data[quarter][id];
		},

		getThreeRates: (data) => {
			if (!("U.S. Office Markets" in data)) throw new Error(`The getThreeRates method: The expected "U.S. Office Markets" response key was not found.`);

			const officeMarkets = data["U.S. Office Markets"];
			const ids = helpers.getIdsByGetParam(officeMarkets, getParamValue);
			if (!(0 in ids)) throw `The getThreeRates method: The requested "${getParamValue}" market was not found in the data of the "U.S. Office Markets" response key.`;

			result.inventory = (("Inventory" in data) && (ids[0] in data["Inventory"]) ? data["Inventory"][ids[0]] : "");
			result.deliveriesYtd = (("Deliveries 2024 YTD" in data) && (ids[0] in data["Deliveries 2024 YTD"]) ? data["Deliveries 2024 YTD"][ids[0]] : "");
			result.underConstruction = (("Under Construction as of Q2 2024p" in data) && (ids[0] in data["Under Construction as of Q2 2024p"]) ? data["Under Construction as of Q2 2024p"][ids[0]] : "");
		},

		renderListItems: () => {
			listGroup.innerHTML = `
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Vacancy Rate</div>
					<div class="list-group-item-data">
						<div class="rate">${result.vacancyRate}</div>
						<div class="rate-yoy">
							<span class="number positive">+5%</span><span class="unit">YoY</span>
						</div>
					</div>
				</li>
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Asking Price Per Sf</div>
					<div class="list-group-item-data">
						<div class="rate">${result.askingPrice}</div>
						<div class="rate-yoy">
							<span class="number positive">+4%</span><span class="unit">YoY</span>
						</div>
					</div>
				</li>
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Net Absorption</div>
					<div class="list-group-item-data">
						<div class="rate">${result.netAbsorption}</div>
						<div class="rate-yoy">
							<span class="number negative">-1%</span><span class="unit">YoY</span>
						</div>
					</div>
				</li>
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Inventory</div>
					<div class="list-group-item-data">
						<div class="rate">${result.inventory} sf</div>
						<div class="rate-yoy">&nbsp;</div>
					</div>
				</li>
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Deliveries YTD</div>
					<div class="list-group-item-data">
						<div class="rate">${result.deliveriesYtd} sf</div>
						<div class="rate-yoy">&nbsp;</div>
					</div>
				</li>
				<li class="list-group-item d-flex justify-content-between align-items-center">
					<div class="list-group-item-name me-2">Under Construction</div>
					<div class="list-group-item-data">
						<div class="rate">${result.underConstruction} sf</div>
						<div class="rate-yoy">&nbsp;</div>
					</div>
				</li>
			`;
		},
	};

	const helpers = {
		redirect: () => {
			window.open("https://therealdeal.com/data/", "_blank");
		},

		isString: (value) => {
			return typeof value === 'string' || value instanceof String;
		},

		isEmpty: (value) => {
			return (!value) ||
			(value === "") ||
			(helpers.isString(value) && value.trim() === "");
		},

		getIdByName: (officeMarkets, value) => {
			let result = -1;
			const markets = Object.values(officeMarkets);
			const marketIndexes = Object.keys(officeMarkets);
			markets.forEach((market, index) => {
				if (market.toLowerCase() == value.toLowerCase()) {
					result = parseInt(marketIndexes[index]);
				}
			});

			return result;
		},

		getMaxQuarter: (marketIndexes) => {
			let parts = [];
			let currentQuarter;
			let currentYear;
			let quarter = 0;
			let year = 0;
			let selectedIndex = "";
			marketIndexes.forEach((marketIndex) => {
				parts = marketIndex.split(" ");
				if (parts.length == 2) {
					currentQuarter = parseInt(parts[0].replace(/[^0-9]*/g, ""));
					currentYear = parseInt(parts[1]);
					if (currentYear > year) {
						year = currentYear;
						quarter = currentQuarter;
						selectedIndex = marketIndex;
					} else if ((currentYear == year) &&
					(currentQuarter > quarter) &&
					(currentQuarter <= 4)) {
						quarter = currentQuarter;
						selectedIndex = marketIndex;
					}
				}
			});

			return selectedIndex;
		},

		getIdsByGetParam: (officeMarkets, getParamValue) => {
			let result = [];
			const markets = Object.values(officeMarkets);
			const marketIndexes = Object.keys(officeMarkets);
			const trdMarket = trdMarkets[getParamValue];
			markets.forEach((market, index) => {
				if (market.startsWith(trdMarket)) {
					result.push(marketIndexes[index]);
				}
			});
	
			return result;
		},
	};

	api.init();
};

/**
 * Call сommercial office market.
 */
сommercialOfficeMarket();
