const trdMap = () => {
  mapboxgl.accessToken =
    "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";

  const mapConfig = {
    container: "map", // container ID
    style: "mapbox://styles/mapbox/light-v10", // style URL
    center: {
      lng: -80.38513016032842,
      lat: 26.380126753919782,
    },
    zoom: 8, // starting zoom
    attributionControl: false,
    scrollZoom: {
      requireCtrl: true,
    },
    cooperativeGestures: window.self !== window.top, // this is set to true when page is loaded in an iframe
  };

  const legendMap = [
    {
      value: 5_000_000,
      color: "#BBDEFB",
      text: "<$5M",
      default: false,
    },
    {
      value: 10_000_000,
      color: "#64B5F6",
      text: "$5M - $10M",
      default: false,
    },
    {
      value: 20_000_000,
      color: "#2196F3",
      text: "$10M - $20M",
      default: false,
    },
    {
      value: 50_000_000,
      color: "#1976D2",
      text: "$20M - $50M",
      default: false,
    },
    {
      value: 100_000_000,
      color: "#0D47A1",
      text: ">$50M",
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

  let mapObj;

  const fn = {
    init: async () => {
      fn.checkForIframe();
      fn.createLegend();
      map.init();
    },

    createLegend: () => {
      const parent = document.querySelector("#legend-content ul");
      legendMap.forEach((item) => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="legend-icon" style="background-color: ${item.color}"></span>${item.text}`;
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
  };

  const helpers = {
    getPointsColor: () => {
      const colors = ["step", ["to-number", ["get", "Sale Price"], 0]];

      legendMap.forEach((item) => {
        colors.push(item.color);

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
      if (
        typeof value !== "string" ||
        value === "" ||
        value === null ||
        value === undefined
      ) {
        return value;
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
  };

  const map = {
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
    },

    getGeoJsonData: async () => {
      const url =
        "https://static.therealdeal.com/interactive-maps/map_data.geojson";
      const response = await fetch(url);
      const data = await response.json();
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
      mapObj.on("load", () => {
        mapObj.addSource(id, {
          type: "geojson",
          data: data,
        });
        mapObj.addLayer({
          type: "circle",
          id: id,
          source: id,
          filter: ["==", ["get", "Doc Type"], "DEED"], // Only show entries where Doc Type is DEED

          paint: {
            "circle-radius": 6,
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

        let content = "";

        tooltipDisplayFields.content.forEach((item) => {
          const value = e.features[0].properties[item.field];
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

      mapObj.on("mouseleave", id, () => {
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
        modal.style.display = "block";

        const close = document.querySelector("#modal .btn-close");
        close.addEventListener("click", () => {
          modal.style.display = "none";
        });
      });
    },
  };

  fn.init();

  return mapObj;
};

window.map = trdMap();
