const trdMap = () => {
  const geojsonFilePath =
    "https://static.therealdeal.com/interactive-maps/new-york-city-transactions-map.geojson";

  const minimumSalePrice = 250_000;

  mapboxgl.accessToken =
    "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";

  const userTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

  const mapConfig = {
    container: "map", // container ID
    style: `mapbox://styles/mapbox/${userTheme}-v10`, // style URL
    center: {
      lat: 40.755327020390325,
      lng: -73.95044562100685,
    },
    zoom: 11, // starting zoom
    minZoom: 10,
    maxZoom: 17,
    attributionControl: false,
    scrollZoom: {
      requireCtrl: true,
    },
    cooperativeGestures: window.self !== window.top, // this is set to true when page is loaded in an iframe
  };

  const legendMap = [
    {
      value: 750_000,
      color: {
        light: "#90CAF9",
        dark: "#90CAF9",
      },
      text: "< $750K",
      default: false,
    },
    {
      value: 1_000_000,
      color: {
        light: "#42A5F5",
        dark: "#42A5F5",
      },
      text: "$750K - $1M",
      default: false,
    },
    {
      value: 3_000_000,
      color: {
        light: "#1E88E5",
        dark: "#1E88E5",
      },
      text: "$1M - $3M",
      default: false,
    },
    {
      value: 4_000_000,
      color: {
        light: "#1565C0",
        dark: "#1565C0",
      },
      text: "$3M - $4M",
      default: false,
    },
    {
      value: 300_000_000,
      color: {
        light: "#0D47A1",
        dark: "#0D47A1",
      },
      text: "> $5M",
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
    ],
  };

  const modalDisplayFields = {
    title: {
      field: "Physical Address",
      label: "Address",
    },
    content: [
      { field: "Doc Type", label: "Doc Type" },
      {
        field: "Record Date",
        label: "Record Date",
        format: (value) => helpers.formatDate(value),
      },
      { field: "Sellers", label: "Sellers" },
      { field: "Buyers", label: "Buyers" },
      {
        field: "Sale Price",
        label: "Sale Price",
        format: (value) => helpers.formatPrice(value),
      },
      { field: "BBL", label: "BBL" },
      { field: "Building BBL", label: "Building BBL" },
      { field: "Use Code Description", label: "Use Code Description" },
      {
        field: "Property Sq. Ft",
        label: "Property Sq. Ft",
        format: (value) =>
          new Intl.NumberFormat("en-US", {
            style: "decimal",
          }).format(value),
      },
      {
        field: "Recorded Date of Previous Sale",
        label: "Recorded Date of Previous Sale",
        format: (value) => helpers.formatDate(value),
      },
      {
        field: "Doc Date of Previous Sale",
        label: "Doc Date of Previous Sale",
        format: (value) => helpers.formatDate(value),
      },
      { field: "Previous Owner Name", label: "Previous Owner Name" },
      {
        field: "Previous Sale Price",
        label: "Previous Sale Price",
        format: (value) => helpers.formatPrice(value),
      },
      { field: "Physical Address", label: "Address" },
      { field: "Neighborhood", label: "Neighborhood" },
      { field: "County", label: "County" },
      { field: "Municipality", label: "Municipality" },
      {
        field: "PropAppraiserURL",
        label: "Property Appraiser URL",
        format: (value) =>
          `<a href="${value}" target="_blank" rel="noopener noreferrer">View Property</a>`,
      },
    ],
  };

  let mapObj;

  const fn = {
    init: async () => {
      fn.setUserTheme();
      fn.checkForIframe();
      fn.createLegend();
      fn.collapseLegend();
      map.init();
    },

    setUserTheme: () => {
      document.querySelector("body").setAttribute("data-bs-theme", userTheme);
    },

    createLegend: () => {
      const parent = document.querySelector("#legend-content ul");
      legendMap.forEach((item) => {
        const li = document.createElement("li");
        const color = helpers.pickUserThemeColor(
          item.color.light,
          item.color.dark
        );
        li.innerHTML = `<span class="legend-icon" style="background-color: ${color}"></span>${item.text}`;
        parent.appendChild(li);
      });
    },

    checkForIframe: () => {
      if (fn.isIframe()) {
        document.querySelector("body").classList.add("iframe");
      }
    },

    isIframe: () => {
      return window.self !== window.top;
    },

    collapseLegend: () => {
      setTimeout(() => {
        const legendBtn = document.querySelector("#legend .accordion-button");
        legendBtn.click();
      }, 5000);
    },
  };

  const helpers = {
    pickUserThemeColor: (lightColor, darkColor) => {
      return userTheme === "dark" ? darkColor : lightColor;
    },

    getPointsColor: () => {
      const colors = ["step", ["to-number", ["get", "Sale Price"], 0]];

      legendMap.forEach((item) => {
        colors.push(
          helpers.pickUserThemeColor(item.color.light, item.color.dark)
        );

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

    formatDate: (value) => {
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(value));
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

    trackEvent: (action, label) => {
      if (window.dataLayer) {
        window.dataLayer.push({
          event: "event_tracking",
          trd: {
            category: "new-york-city-transactions-map",
            action: `map_${action}`,
            label: label,
          },
        });
      }
    },
  };

  const map = {
    currentZoom: mapConfig.zoom,
    init: async () => {
      mapObj = new mapboxgl.Map(mapConfig);
      mapObj.addControl(
        new mapboxgl.NavigationControl({
          showCompass: false,
        }),
        "top-right"
      );

      if (fn.isIframe()) {
        mapObj.addControl(
          new mapboxgl.FullscreenControl({
            container: document.querySelector("body"),
          })
        );
      }

      const sourceId = "transactions";
      const data = await map.getData();

      map.loadSalesDataOnMap(sourceId, data.geoData);
      map.tooltip(sourceId);
      map.modal(sourceId);
      map.eventListeners();
    },

    eventListeners: () => {
      mapObj.on("zoomend", (e) => {
        const newZoom = e.target.getZoom();
        const method = newZoom > map.currentZoom ? "zoom-in" : "zoom-out";
        helpers.trackEvent("zoom", `${method} ${newZoom}`);
        map.currentZoom = newZoom;
      });
    },

    getGeoJsonData: async () => {
      const response = await fetch(geojsonFilePath);
      return await response.json();
    },

    getData: async () => {
      const promises = [map.getGeoJsonData()];

      const [geoData] = await Promise.all(promises);

      const filtered = geoData.features.filter((feature) => {
        return parseInt(feature.properties["Sale Price"]) > minimumSalePrice;
      });

      return {
        geoData: {
          type: geoData.type,
          crs: geoData.crs,
          features: filtered,
        },
      };
    },

    loadSalesDataOnMap: (id, data) => {
      mapObj.on("load", () => {
        mapObj.addSource(id, {
          type: "geojson",
          data: data,
        });

        mapObj.addLayer({
          type: "circle",
          id: id,
          source: id,
          paint: {
            "circle-radius": {
              base: 1.75,
              stops: [
                [1, 1],
                [10, 2],
                [12, 4],
                [15, 8],
                [20, 16],
              ],
            },
            "circle-color": helpers.getPointsColor(),
            "circle-pitch-alignment": "map",
          },
        });
      });
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
