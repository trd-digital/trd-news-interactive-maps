/**
 * Adds list items by top sale price to the Luxury Sales List.
 * Contains the following API:
 * 1. initUserTheme — Enable Bootstrap dark theme.
 * 2. initTooltips — Enable all Bootstrap tooltips.
 * 3. listenEvents — All events: redirect by click and
 * start/stop list auto scroll by blur, mouseleave,
 * mouseenter, touchstart.
 * 4. getData/renderListItems/startAutoScrollList — Get data from source file,
 * filter/sort/limit data, build the HTML and fill the Luxury Sales List.
 * Then run the auto scroll feautre.
 */
const trdList = () => {
	// Local and remote data.
	const localDataUrl =
		"data/new-york-city-transactions-map.geojson";
	const remoteDataUrl =
		"https://static.therealdeal.com/interactive-maps/new-york-city-transactions-map.geojson";

	// List group.
	const listGroup = document.getElementById("luxury-sales-list"); // The <ul> tag.
	const listLimit = 10;

	// Scroller.
	let scroller;

	// Exclude values.
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

	const api = {
		init: () => {
			api.initUserTheme();
			api.initTooltips();
			api.listenEvents();
			api.getData(localDataUrl)
				.then(api.renderListItems)
				.catch(console.error)
				.finally(api.startAutoScrollList);
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

		listenEvents: () => {
			// Redirect when click on the list items.
			listGroup.addEventListener("click", api.redirect);

			// Start or stop auto scroll actions as reaction
			// on blur, mouseleave, mouseenter, touchstart events.
			window.addEventListener("blur", api.startAutoScrollList);
			listGroup.addEventListener("mouseleave", api.startAutoScrollList);
			listGroup.addEventListener("mouseenter", api.stopAutoScrollList);
			listGroup.addEventListener("touchstart", api.stopAutoScrollList);
		},

		redirect: () => {
			window.open("https://therealdeal.com/data/", "_blank");
		},

		startAutoScrollList: () => {
			clearInterval(scroller);
			api.runAutoScrollList();
		},

		runAutoScrollList: () => {
			const listHeight = listGroup.scrollHeight;
			scroller = setInterval(() => {
				if ((listGroup.scrollTop + listGroup.clientHeight) >= listHeight) {
					listGroup.scrollTop = 0;
				} else {
					listGroup.scrollBy({
						top: 1,
						behavior: "smooth",
					});
				}
			}, 10);
		},

		stopAutoScrollList: () => {
			clearInterval(scroller);
		},

		getData: async (url) => {
			const response = await fetch(url);

			return response.json();
		},

		renderListItems: (data) => {
			const items = data.features
				.filter(api.filterListEmptyData)
				.sort(api.sortListBySalePrice)
				.slice(0, listLimit)
				.map((feature) => {
					const properties = feature.properties;
					const address = properties["Physical Address"];
					const price = helpers.formatCurrency(properties["Sale Price"], true);
					const date = helpers.formatDate(properties["Record Date"]);

					return `
						<li class="list-group-item d-flex justify-content-between align-items-center">
							<div class="me-2">${address}</div>
							<div>
								<div class="text-success price">${price}</div>
								<div class="text-muted date">${date}</div>
							</div>
						</li>
					`;
				})
				.join("");

			listGroup.innerHTML = items;
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
	};

	const helpers = {
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
				// Default zero decimal places for under a million, or when round=true.
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

	api.init();
};

/**
 * Call the TRD List.
 */
trdList();
