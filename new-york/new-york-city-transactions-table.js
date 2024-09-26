(function () {
	const localDataUrl = "data/new-york-city-transactions-map.geojson";
	const remoteDataUrl = "https://static.therealdeal.com/interactive-maps/new-york-city-transactions-map.geojson";

	const table = document.querySelector("#luxury-sales-table");

	const displayColumns = [
		{ dataField: "Sellers", },
		{ dataField: "Buyers", },
		{
			dataField: "Record Date",
			sorterCallback: (a, b) => {
				if (isEmptyValue(a) || isEmptyValue(b)) return 0;

				return new Date(a).getTime() - new Date(b).getTime();
			},
		},
		{ dataField: "Sale Price", },
		{ dataField: "Physical Address", },
		{ dataField: "Use Code Description", },
		{ dataField: "Property Sq. Ft", },
	];

	const displayFields = [
		"Doc Type",
		"Record Date",
		"Sellers",
		"Buyers",
		"Sale Price",
		"Use Code Description",
		"Property Sq. Ft",
		"Doc Date of Previous Sale",
		"Previous Owner Name",
		"Previous Sale Price",
		"Physical Address",
	];

	const tableFieldNames = [
		"Doc Type",
		"Record Date",
		"Sellers",
		"Buyers",
		"Sale Price",
		"Use Code Description",
		"Sq. Ft",
		"Date of Previous Sale",
		"Previous Owner Name",
		"Previous Sale Price",
		"Physical Address",
	];

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
		"-",
		"folio not found!",
		"folio not found",
	];

	let stickyHeaderOffsetY = 121;

   /**
	* General functions section.
    */

	if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
		document.body.setAttribute("data-bs-theme", "dark");
	}

	const isEmptyValue = (value) => {
		if (!value) return true;
		if (value === "") return true;
		if (typeof value === "string") {
			if (value.trim() === "") return true;
			if (excludeValue.includes(value.toLowerCase())) return true;
		}
		return false;
	};

	const getFieldName = (value) => {
		return value.toLowerCase().replace(/ /g, "_").replace(/\./g, "");
	};

	const formatter = (value, row, index, field) => {
		if (isEmptyValue(value)) {
			return '<span class="text-muted">N/A</span>';
		}

		if (field === "property_sq_ft") {
			return new Intl.NumberFormat("en-US", {
				style: "decimal",
			}).format(value);
		}

		if (
			field === "sale_price" ||
			field === "previous_sale_price"
		) {
			try {
				const number =
					typeof value === "string"
						? parseFloat(value.replace(/[$,]/g, ""))
						: value;

				return new Intl.NumberFormat("en-US", {
					style: "currency",
					currency: "USD",
					minimumFractionDigits: 0, // No decimal places
					maximumFractionDigits: 0, // No decimal places
				}).format(number);
			} catch (e) {
				return value;
			}
		}

		if (field === "record_date" ||
		field === "doc_date_of_previous_sale") {
			return new Date(value).toLocaleDateString();
		}

		return value;
	};

	/**
	 * Get data section.
	 */

	const getData = async (url) => {
		const response = await fetch(url);

		return response.json();
	};

   /**
	* Map data to table section. 
	*/

	const formatterRowValue = (value, row, index, field) => {
		if (isEmptyValue(value)) {
			return '<span class="text-muted">N/A</span>';
		}

		if (field === "sellers" || field === "buyers") {
			// check the value is not link
			if (!value.includes("http") && value.length > 40) {
				return value.slice(0, 40) + "...";
			}
			return value;
		}

		return formatter(value, row, index, field);
	};

	const columnConfig = {
		sortable: true,
		formatter: formatterRowValue,
	};

	const mapDataToTable = (data) => {
		const columns = Object.keys(data.features[0].properties)
			.sort((a, b) => {
				// sort it by displayColumns order
				const aIndex = displayColumns.findIndex(
					(column) => column.dataField === a
				);
				const bIndex = displayColumns.findIndex(
					(column) => column.dataField === b
				);
				if (aIndex === -1 && bIndex !== -1) return 1;
				if (aIndex !== -1 && bIndex === -1) return -1;
				if (aIndex === -1 && bIndex === -1) return 0;

				return aIndex - bIndex;
			})
			.map((property) => {
				if (!displayFields.includes(property)) {
					return null;
				}
				const displayColumn = displayColumns.find(
					(column) => column.dataField === property
				);

				const tableFieldNamesIndex = displayFields.findIndex((value) => value === property);
				const tableFieldName = tableFieldNames[tableFieldNamesIndex];

				const sorter = displayColumn && typeof displayColumn.sorterCallback === "function"
					? displayColumn.sorterCallback
					: undefined;

				return {
					...columnConfig,
					field: getFieldName(property),
					title: tableFieldName || property,
					sorter,
					visible: displayColumn ? true : false,
				};
			})
			.filter((column) => column);

		const rows = data.features.map((feature) => {
			const properties = feature.properties;
			const row = {};

			displayFields.forEach((field) => {
				row[getFieldName(field)] = properties[field];
			});

			return row;
		});

		return { columns, rows };
	};

   /**
	* Render table section.
	*/

	const trackEvent = (action, label) => {
		if (window.dataLayer) {
			window.dataLayer.push({
				event: "event_tracking",
				trd: {
					category: "south-florida-transactions-table",
					action: `table_${action}`,
					label: label,
				},
			});
		}
	};

	const mapDetailRow = (key, row, i) => {
		const fieldName = getFieldName(key);
		const value = row[fieldName];
		if (isEmptyValue(value)) {
			return "";
		}
		const fieldIndex = Object.keys(displayFields).find(
			(index) => displayFields[index] === key
		);

		return `<tr>
			<td class="text-capitalize">
			${tableFieldNames[fieldIndex].replace(/_/g, " ")}
			</td>
			<td>${formatter(value, row, i, fieldName)}</td>
		</tr>`;
	};

	const detailFormatter = (index, row) => {
		const displayRows = displayFields.filter(
			(field) => !isEmptyValue(row[getFieldName(field)])
		);

		trackEvent(
			"detail_open",
			row.physical_address ? row.physical_address : "Unknown Address"
		);

		return `
			<div class="container">
				<div class="row my-5">
					<div class="col-12 col-md-6">
						<table class="table table-sm">
							<tbody>
								${displayRows
									.slice(0, Math.ceil(displayRows.length / 2))
									.map((key, i) => mapDetailRow(key, row, i))
									.join("")}
							</tbody>
						</table>
					</div>
					<div class="col-12 col-md-6">
						<table class="table table-sm">
							<tbody>
								${displayRows
									.slice(Math.ceil(displayRows.length / 2))
									.map((key, i) => mapDetailRow(key, row, i))
									.join("")}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		`;
	};

	const tableConfig = {
		classes: "table table-responsive",
		theadClasses: "header-style",
		search: true,
		searchHighlight: true,
		sortable: true,
		sortEmptyLast: true,
		sortName: "record_date",
		sortOrder: "desc",
		detailView: true,
		detailFormatter: detailFormatter,
		icons: {
			detailOpen: "bi bi-chevron-down",
			detailClose: "bi bi-chevron-up",
		},
		showColumns: true,
		showColumnsToggleAll: true,
		minimumCountColumns: 2,
		stickyHeader: true,
		stickyHeaderOffsetY: stickyHeaderOffsetY,
		pagination: true,
		paginationDetailHAlign: "left",
		paginationHAlign: "right",
		paginationLoadMore: false,
		paginationLoop: false,
		paginationPreText: "<i class=\"bi bi-caret-left-fill\"></i>",
		paginationNextText: "<i class=\"bi bi-caret-right-fill\"></i>",
		paginationPagesBySide: 1,
		paginationSuccessivelySize: 3,
		paginationVAlign: "top",
		sidePagination: "client",
		showJumpTo: true,
		pageSize: 16,
		pageList: [16, 32, 64, 128, 256, 512],
		//stickyHeaderOffsetLeft: parseInt($("body").css("padding-left"), 10),
		//stickyHeaderOffsetRight: parseInt($("body").css("padding-right"), 10),
		onSort: (name, order) => {
			document.querySelectorAll(".header-style .sorted").forEach((header) => {
				header.classList.remove("sorted");
			});
			const header = document.querySelector(`[data-field="${name}"]`);
			header.classList.add("sorted");
		},
		onPostHeader: () => {
			document.querySelectorAll(".header-style .sortable.desc, .header-style .sortable.asc")
			.forEach((header) => {
				header.parentNode.classList.add("sorted");
			});
		},
	};

	const renderTable = (data) => {
		$(table).bootstrapTable({
			...tableConfig,
			columns: data.columns,
			data: data.rows,
		});
	};

	/**
	 * Final actions.
	 */

	const calcTopBarHeight = (deviation) => {
		const tableToolbar = document.querySelector(".fixed-table-toolbar");
		const tablePagination = document.querySelector(".fixed-table-pagination");
		const tableToolbarHeight = tableToolbar.offsetHeight;
		const tablePaginationHeight = tablePagination.offsetHeight - deviation;

		const margins = parseInt(window.getComputedStyle(tableToolbar).getPropertyValue("margin-top")) + 
		parseInt(window.getComputedStyle(tableToolbar).getPropertyValue("margin-bottom")) +
		parseInt(window.getComputedStyle(tablePagination).getPropertyValue("margin-top")) +
		parseInt(window.getComputedStyle(tablePagination).getPropertyValue("margin-bottom"));

		let result = (tableToolbarHeight + tablePaginationHeight + margins);
		if (result < 0) result = stickyHeaderOffsetY;

		return result;
	};

	const initStickyHeaderOffsetY = (needInitMain) => {
		const topBarHeight = calcTopBarHeight(2);
		const areEqual = (topBarHeight === stickyHeaderOffsetY ? true : false);
		if (!areEqual) {
			stickyHeaderOffsetY = topBarHeight;
			tableConfig.stickyHeaderOffsetY = topBarHeight;
			$(table).bootstrapTable('refreshOptions', {
				...tableConfig,
			});
		}

		if (needInitMain || !areEqual) {
			const main = document.querySelector("main");
			main.style.setProperty("margin-top", `${topBarHeight}px`);
		}
	};

	const fixTableHeadHiding = () => {
		const maxScrollPosition = Math.max(document.body.scrollHeight,
			document.body.offsetHeight, 
			document.documentElement.clientHeight,
			document.documentElement.scrollHeight,
			document.documentElement.offsetHeight) - window.innerHeight;
		const offest = 1;
		const currentScrollPosition = window.scrollY;

		// If true, then need move scroll bar that to show table head.
		if (currentScrollPosition > 0) {
			if (currentScrollPosition > (maxScrollPosition - offest)) {
				// Move scrollbar up then to previous position.
				window.scrollTo({
					top: currentScrollPosition - offest,
					left: 0,
					behavior: "instant",
				});
				window.scrollTo({
					top: currentScrollPosition,
					left: 0,
					behavior: "instant",
				});
			} else {
				// Move scroll bar down then to previous position.
				window.scrollTo({
					top: currentScrollPosition + offest,
					left: 0,
					behavior: "instant",
				});
				window.scrollTo({
					top: currentScrollPosition,
					left: 0,
					behavior: "instant",
				});
			}
		}
	};

	const listenEvents = () => {
		// Update sticky header offset Y.
		window.onresize = () => initStickyHeaderOffsetY(false);

		// Fix Table Head hiding.
		// The <thead> is hiding when any column toggle is clicked
		// and browser scroll bar more then 0.
		// Note, the click event does not work for Bootstrap dropdown menu,
		// so we are using the "change" event.
		const dropdownMenu = document.querySelector(".columns .dropdown-menu");
		Array.from(dropdownMenu.getElementsByTagName("input")).forEach((inputCheckbox) => {
			inputCheckbox.addEventListener("change", fixTableHeadHiding);
		});
	};

	const finalActions = () => {
		initStickyHeaderOffsetY(true);
		listenEvents();
	};

	/**
	 * Main section.
	 */

	getData(localDataUrl)
		.then(mapDataToTable)
		.then(renderTable)
		.then(finalActions)
		.catch((error) => {
			console.error(error);
		});
})();
