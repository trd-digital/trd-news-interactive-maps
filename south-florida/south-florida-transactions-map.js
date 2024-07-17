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
      {
        field: "pointType",
        label: "Party",
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
      fn.collapseLegend();
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

    collapseLegend: () => {
      setTimeout(() => {
        const legendBtn = document.querySelector("#legend .accordion-button");
        legendBtn.click();
      }, 5000);
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

    fixCoordinates: (feature) => {
      const fields = [
        "seller_mailing_address_lat",
        "seller_mailing_address_lng",
        "buyer_mailing_address_lat",
        "buyer_mailing_address_lng",
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

      map.loadMailingDataOnMap(sourceId + "Mailing", data.geoData);
      map.tooltip(sourceId + "Mailing");
      map.modal(sourceId + "Mailing");
      map.loadSalesDataOnMap(sourceId, data.geoData);
      map.tooltip(sourceId);
      map.modal(sourceId);
      map.loadLinkDataOnMap(sourceId + "Link");
    },

    getGeoJsonData: async () => {
      const url =
        "https://static.therealdeal.com/interactive-maps/map_data.geojson";
      const response = await fetch(url);
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
            "circle-stroke-color": "#ffcc80",
            "circle-stroke-width": [
              "case",
              [">", ["get", "Loan Amount"], 0],
              3,
              0,
            ],
          },
        });
      });
    },

    getSellerMailingData: (features) => {
      return features
        .filter(
          (feature) =>
            feature.properties["seller_mailing_address_lat"] !== 0 &&
            feature.properties["seller_mailing_address_lng"] !== 0 &&
            helpers.convertToFloat(
              feature.properties["seller_mailing_address_lat"]
            ) !==
              helpers.convertToFloat(
                feature.properties["physical_address_lat"]
              ) &&
            helpers.convertToFloat(
              feature.properties["seller_mailing_address_lng"]
            ) !==
              helpers.convertToFloat(
                feature.properties["physical_address_lng"]
              ) &&
            helpers.convertToFloat(
              feature.properties["seller_mailing_address_lat"]
            ) !==
              helpers.convertToFloat(
                feature.properties["buyer_mailing_address_lat"]
              ) &&
            helpers.convertToFloat(
              feature.properties["seller_mailing_address_lng"]
            ) !==
              helpers.convertToFloat(
                feature.properties["buyer_mailing_address_lng"]
              )
        )
        .map((feature) => {
          return {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [
                helpers.convertToFloat(
                  feature.properties["seller_mailing_address_lng"]
                ),
                helpers.convertToFloat(
                  feature.properties["seller_mailing_address_lat"]
                ),
              ],
            },
            properties: {
              ...feature.properties,
              pointType: "seller",
            },
          };
        });
    },

    getBuyerMailingData: (features) => {
      return features
        .filter(
          (feature) =>
            feature.properties["buyer_mailing_address_lat"] !== 0 &&
            feature.properties["buyer_mailing_address_lng"] !== 0 &&
            helpers.convertToFloat(
              feature.properties["buyer_mailing_address_lat"]
            ) !==
              helpers.convertToFloat(
                feature.properties["physical_address_lat"]
              ) &&
            helpers.convertToFloat(
              feature.properties["buyer_mailing_address_lng"]
            ) !==
              helpers.convertToFloat(feature.properties["physical_address_lng"])
        )
        .map((feature) => {
          return {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [
                helpers.convertToFloat(
                  feature.properties["buyer_mailing_address_lng"]
                ),
                helpers.convertToFloat(
                  feature.properties["buyer_mailing_address_lat"]
                ),
              ],
            },
            properties: {
              ...feature.properties,
              pointType: "buyer",
            },
          };
        });
    },

    loadMailingDataOnMap: (id, data) => {
      const features = [
        ...map.getSellerMailingData(data.features),
        ...map.getBuyerMailingData(data.features),
      ];
      mapObj.on("load", () => {
        mapObj.addSource(id, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: features,
          },
        });
        mapObj.addLayer({
          type: "circle",
          id: id,
          source: id,
          paint: {
            "circle-radius": 8,
            "circle-color": [
              "case",
              ["==", ["get", "pointType"], "seller"],
              "#81C784", // seller
              "#388e3c", // buyer
            ],
            "circle-pitch-alignment": "map",
          },
        });
      });
    },

    loadLinkDataOnMap: (id) => {
      mapObj.on("load", () => {
        mapObj.addSource(id, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });
        mapObj.addLayer({
          type: "line",
          id: id,
          source: id,
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#000000",
            "line-width": 2,
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

        map.linkData(e.features[0], "hover");

        const address =
          e.features[0].properties[tooltipDisplayFields.title.field] ||
          `Unknown ${tooltipDisplayFields.title.label}`;

        const tooltipDisplayFieldsContent = [...tooltipDisplayFields.content];
        if (e.features[0].properties["Loan Amount"] > 0) {
          tooltipDisplayFieldsContent.push({
            field: "Loan Amount",
            label: "Loan Amount",
            format: (value) => helpers.formatPrice(value),
          });
        }

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
        map.unLinkData("hover");
        popup.remove();
      });
    },

    modal: (id) => {
      mapObj.on("click", id, (e) => {
        const modal = document.querySelector("#modal");
        const modalTitle = document.querySelector("#modal .modal-title");
        const modalContent = document.querySelector("#modal .modal-body");

        map.linkData(e.features[0], "click");

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
          map.unLinkData("click");
          modal.style.display = "none";
        });
      });
    },

    linkData: (feature, eventType) => {
      const propertyCoords = [
        feature.properties["physical_address_lng"],
        feature.properties["physical_address_lat"],
      ];

      const sellerCoords = [
        feature.properties["seller_mailing_address_lng"],
        feature.properties["seller_mailing_address_lat"],
      ];

      const buyerCoords = [
        feature.properties["buyer_mailing_address_lng"],
        feature.properties["buyer_mailing_address_lat"],
      ];

      const features =
        eventType === "click"
          ? []
          : mapObj.getSource("transactionsLink")._data.features;
      if (
        helpers.isCoordinatesValid(propertyCoords) &&
        helpers.isCoordinatesValid(sellerCoords) &&
        helpers.isCoordinatesValid(buyerCoords)
      ) {
        features.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [propertyCoords, sellerCoords, buyerCoords],
          },
          properties: {
            eventType,
          },
        });
      }

      mapObj.getSource("transactionsLink").setData({
        type: "FeatureCollection",
        features: features,
      });
    },

    unLinkData: (eventType) => {
      if (eventType === "click") {
        return mapObj.getSource("transactionsLink").setData({
          type: "FeatureCollection",
          features: [],
        });
      }
      const features = mapObj
        .getSource("transactionsLink")
        ._data.features.filter(
          (feature) => feature.properties.eventType === "click"
        );

      mapObj.getSource("transactionsLink").setData({
        type: "FeatureCollection",
        features: features,
      });
    },
  };

  fn.init();

  return mapObj;
};

window.map = trdMap();
