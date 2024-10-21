class MapboxGLButtonControl {
  constructor({ className = "", title = "", eventHandler = evtHndlr }) {
    this._className = className;
    this._title = title;
    this._eventHandler = eventHandler;
  }

  onAdd(map) {
    this._icon = document.createElement("span");
    this._icon.className = "mapboxgl-ctrl-icon";
    this._icon.ariaHidden = true;
    this._icon.title = this._title;

    this._btn = document.createElement("button");
    this._btn.className = this._className;
    this._btn.type = "button";
    this._btn.title = this._title;
    this._btn.onclick = this._eventHandler;
    this._btn.appendChild(this._icon);

    this._container = document.createElement("div");
    this._container.className = "mapboxgl-ctrl-group mapboxgl-ctrl";
    this._container.appendChild(this._btn);

    return this._container;
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

const trdMap = () => {
  const geojsonFilePath =
    "https://static.therealdeal.com/interactive-maps/map_data.geojson";

  mapboxgl.accessToken =
    "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";

  let mapObj;
  let mapData;

  const userTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

  const filterEl = document.querySelector("#map-filters");

  const mapConfig = {
    container: "map", // container ID
    style: `mapbox://styles/mapbox/${userTheme}-v10`, // style URL
    center: {
      lng: -80.38513016032842,
      lat: 26.380126753919782,
    },
    zoom: 8, // starting zoom
    minZoom: 8,
    attributionControl: false,
    scrollZoom: {
      requireCtrl: true,
    },
    cooperativeGestures: window.self !== window.top, // this is set to true when page is loaded in an iframe
  };

  const legendMap = [
    {
      value: 5_000_000,
      color: {
        light: "#90CAF9",
        dark: "#90CAF9",
      },
      text: "< $5M",
      default: false,
    },
    {
      value: 10_000_000,
      color: {
        light: "#42A5F5",
        dark: "#42A5F5",
      },
      text: "$5M - $10M",
      default: false,
    },
    {
      value: 20_000_000,
      color: {
        light: "#1E88E5",
        dark: "#1E88E5",
      },
      text: "$10M - $20M",
      default: false,
    },
    {
      value: 50_000_000,
      color: {
        light: "#1565C0",
        dark: "#1565C0",
      },
      text: "$20M - $50M",
      default: false,
    },
    {
      value: 100_000_000,
      color: {
        light: "#0D47A1",
        dark: "#0D47A1",
      },
      text: "> $50M",
      default: true,
    },
  ];

  const tooltipDisplayFields = {
    title: {
      field: "Physical Address",
      label: "Address",
    },
    content: [
      {
        field: "Sale Price",
        label: "Sale Price",
        format: (value) => helpers.formatPrice(value),
      },
      {
        field: "Use Code Description",
        label: "Use Code",
      },
      {
        field: "pointType",
        label: "Party",
        format: (value) => value.charAt(0).toUpperCase() + value.slice(1),
      },
    ],
  };

  const modalDisplayFields = {
    title: {
      field: "Physical Address",
      label: "Address",
    },
    content: [
      { field: "Doc Type", label: "Doc Type" },
      { field: "Instrument_Num", label: "Instrument Number" },
      { field: "Record Date", label: "Record Date" },
      { field: "Seller", label: "Seller" },
      { field: "Buyer", label: "Buyer" },
      {
        field: "Sale Price",
        label: "Sale Price",
        format: (value) => helpers.formatPrice(value),
      },
      { field: "Folio", label: "Folio" },
      { field: "Use Code Description", label: "Use Code Description" },
      { field: "Building Sq. Ft", label: "Building Sq. Ft" },
      { field: "Lot Size", label: "Lot Size" },
      { field: "Date of Previous Sale", label: "Date of Previous Sale" },
      { field: "Previous Owner Name", label: "Previous Owner Name" },
      {
        field: "Previous Sale Price",
        label: "Previous Sale Price",
      },
      { field: "Physical Address", label: "Address" },
      { field: "Mailing Address", label: "Mailing Address" },
      {
        field: "First Party Registered Agent Name & Address",
        label: "First Party Registered Agent Name & Address",
      },
      { field: "First Party Status", label: "First Party Status" },
      {
        field: "First Party Document Number",
        label: "First Party Document Number",
      },
      {
        field: "First Party FEI/EIN Number",
        label: "First Party FEI/EIN Number",
      },
      {
        field: "First Party Mailing Address",
        label: "First Party Mailing Address",
      },
      {
        field: "First Party Principal Address",
        label: "First Party Principal Address",
      },
      { field: "First Party State", label: "First Party State" },
      { field: "First Party Date Filed", label: "First Party Date Filed" },
      {
        field: "Second Party Registered Agent Name & Address",
        label: "Second Party Registered Agent Name & Address",
      },
      { field: "Second Party Status", label: "Second Party Status" },
      {
        field: "Second Party Document Number",
        label: "Second Party Document Number",
      },
      {
        field: "Second Party FEI/EIN Number",
        label: "Second Party FEI/EIN Number",
      },
      {
        field: "Second Party Mailing Address",
        label: "Second Party Mailing Address",
      },
      {
        field: "Second Party Principal Address",
        label: "Second Party Principal Address",
      },
      { field: "Second Party State", label: "Second Party State" },
      { field: "Second Party Date Filed", label: "Second Party Date Filed" },
      {
        field: "Lender",
        label: "Lender",
      },
      {
        field: "Loan Amount",
        label: "Loan Amount",
        format: (value) => helpers.formatPrice(value),
      },
    ],
  };

  const filterFields = [
    {
      title: "Days",
      name: "days",
      dataField: "Record Date",
      fieldType: "radio",
      fieldLayoutClass: "radio-group",
      multiSelect: false,
      defaultValue: "30",
      options: [
        {
          label: "7 Days",
          value: "7",
        },
        {
          label: "15 Days",
          value: "15",
        },
        {
          label: "30 Days",
          value: "30",
        },
      ],
    },
    {
      title: "Property Type",
      name: "property_type",
      dataField: "Use Code Description",
      fieldType: "checkbox",
      fieldLayoutClass: "checkbox-list",
      multiSelect: true,
      options: [
        {
          label: "Single Family Home",
          value: "SINGLE FAMILY",
        },
        {
          label: "Multi-Family Dwelling",
          value: "CONDOMINIUM",
        },
        {
          label: "Commercial",
          value: "COMMERCIAL",
        },
        {
          label: "Vacant Land",
          value: "VACANT LAND",
        },
        {
          label: "Office Building",
          value: "OFFICE BUILDING",
        },
      ],
    },
  ];

  const fn = {
    init: async () => {
      fn.setUserTheme();
      fn.checkForIframe();
      fn.createLegend();
      fn.collapseLegend();
      fn.createFilters();
      map.init();
    },

    setUserTheme: () => {
      document.querySelector("body").setAttribute("data-bs-theme", userTheme);
    },

    createLegend: () => {
      const parent = document.querySelector("#legend-content ul");
      legendMap.forEach((item) => {
        const li = document.createElement("li");
        const color = helpers.pickThemeColor(item.color.light, item.color.dark);
        li.innerHTML = `<span class="legend-icon" style="background-color: ${color}"></span>${item.text}`;
        parent.appendChild(li);
      });
    },

    checkForIframe: () => {
      if (helpers.isIframe()) {
        document.querySelector("body").classList.add("iframe");
      }
    },

    collapseLegend: () => {
      setTimeout(() => {
        const legendBtn = document.querySelector("#legend .accordion-button");
        legendBtn.click();
      }, 5000);
    },

    createFilters: () => {
      filters.init();
    },

    toggleTheme: () => {
      const theme = document
        .querySelector("body")
        .getAttribute("data-bs-theme");
      const newTheme = theme === "light" ? "dark" : "light";
      mapObj.setStyle(`mapbox://styles/mapbox/${newTheme}-v10`);
      document.querySelector("body").setAttribute("data-bs-theme", newTheme);
      helpers.trackEvent("theme", newTheme);
      map.load(mapData);
    },

    getTheme: () => {
      return document.querySelector("body").getAttribute("data-bs-theme");
    },
  };

  const helpers = {
    isIframe: () => {
      return window.self !== window.top;
    },

    pickThemeColor: (lightColor, darkColor) => {
      return fn.getTheme() === "dark" ? darkColor : lightColor;
    },

    getPointsColor: () => {
      const colors = ["step", ["to-number", ["get", "Sale Price"], 0]];

      legendMap.forEach((item) => {
        colors.push(helpers.pickThemeColor(item.color.light, item.color.dark));

        if (!item.default) {
          colors.push(item.value);
        }
      });

      return colors;
    },

    formatPrice: (value) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0, // No decimal places
        maximumFractionDigits: 0, // No decimal places
      }).format(value);
    },

    cleanValue: (value) => {
      if (typeof value !== "string") {
        return value;
      }

      if (value === "" || value === null || value === undefined) {
        return "";
      }

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
      ];

      if (excludeValue.includes(value.toLowerCase())) {
        return "";
      }
      return value;
    },

    fixCoordinates: (feature) => {
      const fields = [
        "physical_address_lat",
        "physical_address_lng",
        "latitude",
        "longitude",
      ];

      fields.forEach((field) => {
        if (feature.properties[field]) {
          feature.properties[field] = helpers.convertToFloat(
            feature.properties[field],
            7
          );
        }
      });

      feature.geometry.coordinates = [
        helpers.convertToFloat(feature.geometry.coordinates[0], 7),
        helpers.convertToFloat(feature.geometry.coordinates[1], 7),
      ];
    },

    convertToFloat: (value, round = 7) => parseFloat(value.toFixed(round)),

    isCoordinatesValid: (coordinates) => {
      return (
        coordinates[0] !== 0 &&
        coordinates[1] !== 0 &&
        !isNaN(coordinates[0]) &&
        !isNaN(coordinates[1])
      );
    },

    trackEvent: (action, label) => {
      if (window.dataLayer) {
        window.dataLayer.push({
          event: "event_tracking",
          trd: {
            category: "south-florida-transactions-map",
            action: `map_${action}`,
            label: label,
          },
        });
      }
    },
  };

  const filters = {
    close: () => {
      filterEl.classList.remove("active");
      document.querySelector("button.map-filters").classList.remove("active");
    },
    onToggle: () => {
      if (!filterEl || !filterFields?.length) return;

      const isActive = filterEl.classList.contains("active");

      filterEl.classList.toggle("active");
      document.querySelector("button.map-filters").classList.toggle("active");
      helpers.trackEvent("filters", isActive ? "close" : "open");
    },

    onClose: () => {
      filters.close();
      helpers.trackEvent("filters", "close");
    },

    onSubmit: (e) => {
      e.preventDefault();

      const formData = new FormData(filterEl);
      const filters = {};

      formData.forEach((value, key) => {
        if (!filters[key]) {
          filters[key] = [];
        }

        filters[key].push(value);
      });

      let filterData = mapData.geoData.features;
      let filterApplied = false;

      if (filters["days"]) {
        const days = filters["days"][0];
        const date = new Date();
        date.setDate(date.getDate() - days);
        filterData = mapData.geoData.features.filter((feature) => {
          const recordDate = new Date(feature.properties["Record Date"]);
          return recordDate >= date;
        });
        filterApplied = true;
      }

      if (filters["property_type"]) {
        const propertyTypes = filters["property_type"];
        filterData = filterData.filter((feature) => {
          return propertyTypes.some((type) =>
            feature.properties["Use Code Description"].includes(type)
          );
        });
        filterApplied = true;
      }

      mapObj.getSource("transactions").setData({
        type: "FeatureCollection",
        features: filterData,
      });

      if (filterApplied) {
        document.querySelector("button.map-filters").classList.add("applied");
      } else {
        document
          .querySelector("button.map-filters")
          .classList.remove("applied");
      }
      filters.close();
      helpers.trackEvent("filters", "submit");
    },

    onReset: () => {
      mapObj.getSource("transactions").setData(mapData.geoData);
      document.querySelector("button.map-filters").classList.remove("applied");
      helpers.trackEvent("filters", "reset");
    },

    eventListeners: () => {
      if (!filterEl || !filterFields?.length) return;

      const closeButtonEl = filterEl.querySelector(".map-filters-close");

      if (closeButtonEl) {
        closeButtonEl.addEventListener("click", filters.onClose);
      }

      filterEl.addEventListener("submit", filters.onSubmit);
      filterEl.addEventListener("reset", filters.onReset);
    },

    init: () => {
      if (!filterEl || !filterFields?.length) {
        return;
      }

      filters.eventListeners();

      const filterBodyEl = filterEl.querySelector(".map-filters-body");

      if (!filterBodyEl) {
        return;
      }

      filterFields.forEach((filterField) => {
        const wrapper = document.createElement("div");
        wrapper.classList.add("filter-field-container");

        filters.createHeader(filterField.title, wrapper);
        filters.createFilterField(filterField, wrapper);

        filterBodyEl.appendChild(wrapper);
      });
    },

    createHeader: (text, parent) => {
      const wrapper = document.createElement("div");
      wrapper.classList.add("filter-field-header");

      const heading = document.createElement("h5");
      heading.classList.add("filter-field-title");
      heading.innerText = text;

      wrapper.appendChild(heading);

      parent.appendChild(wrapper);
    },

    createFilterField: (filterField, parent) => {
      const wrapper = document.createElement("div");
      wrapper.classList.add("filter-field-body");

      const field = document.createElement("div");
      field.classList.add(filterField.fieldLayoutClass);

      filterField.options.forEach((option) => {
        const forId = `${filterField.name}_${option.value}`;
        const fieldWrapper = document.createElement("div");
        fieldWrapper.classList.add("filter-option-container");

        const input = document.createElement("input");
        input.id = forId;
        input.type = filterField.fieldType;
        input.name = filterField.name;
        input.value = option.value;
        if (option.value === filterField.defaultValue) {
          input.checked = true;
          input.setAttribute("checked", "checked");
        }

        fieldWrapper.appendChild(input);

        const label = document.createElement("label");
        label.classList.add("filter-option");
        label.setAttribute("for", forId);
        label.innerHTML += option.label;

        fieldWrapper.appendChild(label);

        field.appendChild(fieldWrapper);
      });

      wrapper.appendChild(field);
      parent.appendChild(wrapper);
    },
  };

  const map = {
    currentZoom: mapConfig.zoom,
    init: () => {
      mapObj = new mapboxgl.Map(mapConfig);
      mapObj.addControl(
        new mapboxgl.NavigationControl({
          showCompass: false,
        }),
        "top-right"
      );

      mapObj.addControl(
        new MapboxGLButtonControl({
          className: "map-filters",
          title: "Filters",
          eventHandler: filters.onToggle,
        }),
        "top-right"
      );

      mapObj.addControl(
        new MapboxGLButtonControl({
          className: "map-theme",
          title: "Theme",
          eventHandler: fn.toggleTheme,
        }),
        "top-right"
      );

      if (helpers.isIframe()) {
        mapObj.addControl(
          new mapboxgl.FullscreenControl({
            container: document.querySelector("body"),
          })
        );
      }

      map.eventListeners();
    },

    load: (data) => {
      const sourceId = "transactions";
      map.loadSalesDataOnMap(sourceId, data.geoData);
      map.tooltip(sourceId);
      map.modal(sourceId);
    },

    eventListeners: () => {
      mapObj.on("load", async () => {
        mapData = await map.getData();
        map.load(mapData);
      });

      mapObj.on("style.load", () => {
        if (mapData) map.load(mapData);
      });

      mapObj.on("zoomend", (e) => {
        const newZoom = e.target.getZoom();
        const method = newZoom > map.currentZoom ? "zoom-in" : "zoom-out";
        helpers.trackEvent("zoom", `${method} ${newZoom}`);
        map.currentZoom = newZoom;
      });
    },

    getGeoJsonData: async () => {
      const response = await fetch(geojsonFilePath);
      const data = await response.json();

      data.features.map((feature) => {
        if (feature.properties["physical_address_lon"]) {
          feature.properties["physical_address_lng"] =
            feature.properties["physical_address_lon"];
        }
        helpers.fixCoordinates(feature);
      });
      data.features.filter(
        (feature) =>
          feature.properties["physical_address_lat"] !== 0 &&
          feature.properties["physical_address_lng"] !== 0
      );
      return data;
    },

    getData: async () => {
      const promises = [map.getGeoJsonData()];

      const [geoData] = await Promise.all(promises);

      return {
        geoData,
      };
    },

    loadSalesDataOnMap: (id, data) => {
      if (!mapObj.getSource(id)) {
        mapObj.addSource(id, {
          type: "geojson",
          data: data,
        });
      }

      if (!mapObj.getLayer(id)) {
        mapObj.addLayer({
          type: "circle",
          id: id,
          source: id,
          filter: ["==", ["get", "Doc Type"], "DEED"], // Only show entries where Doc Type is DEED

          paint: {
            "circle-radius": {
              base: 1.75,
              stops: [
                [8, 4],
                [12, 6],
                [15, 8],
                [20, 16],
              ],
            },
            "circle-color": helpers.getPointsColor(),
            "circle-pitch-alignment": "map",
            "circle-stroke-color":
              fn.getTheme() === "dark" ? "#FB8C00" : "#FFCC80",
            "circle-stroke-width": [
              "case",
              [">", ["get", "Loan Amount"], 0],
              3,
              0,
            ],
          },
        });
      }
    },

    tooltip: (id) => {
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
      });

      mapObj.on("mouseenter", id, (e) => {
        mapObj.getCanvas().style.cursor = "pointer";

        const coordinates = e.features[0].geometry.coordinates.slice();

        const address =
          e.features[0].properties[tooltipDisplayFields.title.field] ||
          `Unknown ${tooltipDisplayFields.title.label}`;

        const tooltipDisplayFieldsContent = tooltipDisplayFields.content;

        let content = "";

        tooltipDisplayFieldsContent.forEach((item) => {
          const value = helpers.cleanValue(
            e.features[0].properties[item.field]
          );
          if (value) {
            content += `<p><span>${item.label}:</span> <span>${
              item.format ? item.format(value) : value
            }</span></p>`;
          }
        });

        const html = `
                <div class="popup-tooltip">
                    <h4 class="popup-title">${address}</h4>
                    ${content}
                </div>
            `;

        popup.setLngLat(coordinates).setHTML(html).addTo(mapObj);
      });

      mapObj.on("mouseleave", id, (e) => {
        mapObj.getCanvas().style.cursor = "";
        popup.remove();
      });
    },

    modal: (id) => {
      mapObj.on("click", id, (e) => {
        const modal = document.querySelector("#modal");
        const modalTitle = document.querySelector("#modal .modal-title");
        const modalContent = document.querySelector("#modal .modal-body");

        const address =
          e.features[0].properties[modalDisplayFields.title.field] ||
          `Unknown ${modalDisplayFields.title.label}`;
        modalTitle.innerHTML = address;

        let html = "";

        modalDisplayFields.content.forEach((item) => {
          const value = helpers.cleanValue(
            e.features[0].properties[item.field]
          );
          if (value) {
            html += `<p class="detail-item"><span class="detail-label">${
              item.label
            }:</span> <span class="detail-value">${
              item.format ? item.format(value) : value
            }</span></p>`;
          }
        });

        modalContent.innerHTML = html;
        modalContent.scrollTop = 0;
        modal.style.display = "block";
        helpers.trackEvent("detail_view", address.toLowerCase());
      });

      const close = document.querySelector("#modal .btn-close");
      close.addEventListener("click", () => {
        modal.style.display = "none";
      });
    },
  };

  fn.init();

  return mapObj;
};

window.map = trdMap();
