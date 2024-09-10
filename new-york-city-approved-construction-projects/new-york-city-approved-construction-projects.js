const trdMap = () => {
  mapboxgl.accessToken =
    "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";

  const userTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

  const mapConfig = {
    container: "map", // container ID
    style: `mapbox://styles/mapbox/${userTheme}-v10`, // style URL
    center: {
      lng: -74.00597000,
      lat: 40.71427000,
    },
    zoom: 9, // starting zoom
    attributionControl: false,
    scrollZoom: {
      requireCtrl: true,
    },
    cooperativeGestures: window.self !== window.top, // this is set to true when page is loaded in an iframe
  };

  const legendMap = [
    {
      value: true,
      color: {
        light: "#89CFF0",
        dark: "#89CFF0",
      },
      text: ">= 0",
      default: false,
    },
    {
      value: false,
      color: {
        light: "#FFC0CB",
        dark: "#FFC0CB",
      },
      text: "< 0",
      default: false,
    },
  ];

  const tooltipDisplayFields = {
    title: {
      field: "address",
      label: "Address",
    },
    content: [
      {
        field: "job_filing_number",
        label: "Job Filing #",
      },
      {
        field: "Project Type",
        label: "trd_job_type",
      },
      {
        field: "approval_date",
        label: "Approved",
        //format: (value) => value.charAt(0).toUpperCase() + value.slice(1),
      },
    ],
  };

  const modalDisplayFields = {
    title: {
      field: "address",
      label: "Address",
    },
    content: [
      { field: "trd_job_type", label: "Project Type" },
      { field: "job_filing_number", label: "DOB Now Job Filing Number" },
      { field: "approval_date", label: "Approved" },
      { field: "approval_quarter", label: "Quarter" },
      { field: "bin", label: "BIN" },
      { field: "bbl", label: "BBL" },
      { field: "trd_job_type", label: "Project Type" },
      { field: "total_square_footage", label: "Total Building Sq. Ft" },
      { field: "proposed_dwelling_units", label: "Proposed Dwelling Units" },
      { field: "existing_dwelling_units", label: "Existing Dwelling Units" },
      { field: "proposed_no_of_stories", label: "Proposed No of Stories" },
      { field: "existing_no_of_stories", label: "Existing No of Stories" },
      { field: "job_description", "label": "Project Description" },
      { field: "address", label: "Address" },
      { field: "ntaname", label: "Neighborhood Tabulation Area" }
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
            category: "new-york-city-approved-construction-projects-map",
            action: `map_${action}`,
            label: label,
          },
        });
      }
    },
  };

  const map = {
    currentZoom: mapConfig.zoom,
    currentQuarter: "2024-Q1", // Default to Q1
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

      const sourceId = "projects";
      const data = await map.getData();

      // Initial load based on currentQuarter
      map.loadProjectDataOnMap(sourceId, data.geoData);
      map.tooltip(sourceId);
      map.modal(sourceId);
      map.eventListeners();

      // Initialize the slider functionality
      map.initializeSlider(data.geoData); // Pass data to slider function
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
      const url = "new-york-city-approved-construction-projects.geojson";
      const response = await fetch(url);
      const data = await response.json();

      data.features.map((feature) => {
        helpers.fixCoordinates(feature);
      });
      return data;
    },

    getData: async () => {
      const promises = [map.getGeoJsonData()];
      const [geoData] = await Promise.all(promises);
      return {
        geoData,
      };
    },

    loadProjectDataOnMap: (id, data) => {
      // Add source and layer to the map
      if (mapObj.getSource(id)) {
        mapObj.getSource(id).setData(data); // Update data for existing source
      } else {
        mapObj.addSource(id, {
          type: "geojson",
          data: data,
        });
        mapObj.addLayer({
          type: "circle",
          id: id,
          source: id,
          paint: {
            "circle-color": [
              "case",
              ["boolean", ["get", "is_change_positive"], false], "#89CFF0", // Pink if true
              "#FFC0CB" // Baby blue if false
            ],
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "abs_proposed_dwelling_unit_change"],
              0, 3,
              5, 6,
              10, 9,
              100, 12,
              200, 18,
              300, 24
            ],
            "circle-pitch-alignment": "map",
            "circle-stroke-color": userTheme === "dark" ? "#FB8C00" : "#FFCC80",
            "circle-opacity": 0.65,
          },
        });
      }
    },

    filterDataByQuarter: (data, quarter) => {
      const filteredFeatures = data.features.filter((feature) => {
        return feature.properties.approval_quarter == quarter;
      });
      return {
        type: "FeatureCollection",
        features: filteredFeatures,
      };
    },

    initializeSlider: (geoData) => {
      const slider = document.getElementById("quarterSlider");
      const label = document.getElementById("quarterLabel");

      slider.addEventListener("input", function () {
        const quarterMap = {
          1: "2023-Q4",
          2: "2024-Q1",
          3: "2024-Q2",
          4: "2024-Q3",
        };
        map.currentQuarter = quarterMap[this.value];
        label.innerHTML = map.currentQuarter; // Update the label

        // Update the map based on the new quarter
        map.updateMapForQuarter(geoData);
      });
    },

    updateMapForQuarter: (geoData) => {
      const sourceId = "projects";

      // Filter data for the selected quarter
      const filteredData = map.filterDataByQuarter(geoData, map.currentQuarter);

      // Update the map with the filtered data
      map.loadProjectDataOnMap(sourceId, filteredData);
    },

    // Tooltip and modal handling remains unchanged
    tooltip: (id) => {
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
      });

      mapObj.on("mouseenter", id, (e) => {
        mapObj.getCanvas().style.cursor = "pointer";

        const coordinates = e.features[0].geometry.coordinates.slice();
        const address = e.features[0].properties[tooltipDisplayFields.title.field] || `Unknown ${tooltipDisplayFields.title.label}`;

        let content = "";

        tooltipDisplayFields.content.forEach((item) => {
          const value = helpers.cleanValue(e.features[0].properties[item.field]);
          if (value) {
            content += `<p><span>${item.label}:</span> <span>${item.format ? item.format(value) : value}</span></p>`;
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

        const address = e.features[0].properties[modalDisplayFields.title.field] || `Unknown ${modalDisplayFields.title.label}`;
        modalTitle.innerHTML = address;

        let html = "";

        modalDisplayFields.content.forEach((item) => {
          const value = helpers.cleanValue(e.features[0].properties[item.field]);
          if (value) {
            html += `<p class="detail-item"><span class="detail-label">${item.label}:</span> <span class="detail-value">${item.format ? item.format(value) : value}</span></p>`;
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
