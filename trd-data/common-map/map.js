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

const userTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";

const tracking = {
  eventCategory: "unknown-map",
  trackEvent: (action, label) => {
    if (window.dataLayer) {
      window.dataLayer.push({
        event: "event_tracking",
        trd: {
          category: tracking.eventCategory,
          action: `map_${action}`,
          label: label,
        },
      });
    }
  },
};

const trdTheme = {
  prefer: "system",
  init: () => {
    document.querySelector("body").setAttribute("data-bs-theme", userTheme);
    window.addEventListener("message", (e) => {
      if (e.data && e.data.theme) {
        const theme = e.data.theme === "dark" ? "dark" : "light";
        trdTheme.set(theme);
        trdTheme.prefer = "user";
        tracking.trackEvent("theme", theme);
        if (window.map) {
          window.map.setStyle(`mapbox://styles/mapbox/${theme}-v10`);
        }
      }
    });
  },

  get: () => {
    return document.querySelector("body").getAttribute("data-bs-theme");
  },

  isDark: () => trdTheme.get() === "dark",

  set: (theme) => {
    document.querySelector("body").setAttribute("data-bs-theme", theme);
  },

  onToggle: (_mapObj) => {
    const siteTheme = document
      .querySelector("body")
      .getAttribute("data-bs-theme");
    const newTheme = siteTheme === "light" ? "dark" : "light";
    _mapObj.setStyle(`mapbox://styles/mapbox/${newTheme}-v10`);
    trdTheme.set(newTheme);
    trdTheme.prefer = "user";
    tracking.trackEvent("theme", newTheme);
  },
};

const trdDataCommonMap = (options) => {
  const defaults = {
    filePath: "",
    mapElementId: "map",
    filterElementId: "map-filters",
    legendElementId: "legend",
    resultElementId: "result",
    mapCenterLat: 40.7128,
    mapCenterLng: -74.006,
    zoom: 11,
    minZoom: 10,
    legendKeys: [],
    dataPointKeys: [],
    tooltipDisplayFields: undefined, // object
    modalDisplayFields: undefined, // object
    filterFields: [],
    legendAutoCollapse: true,
    fetchDataFilterCallback: undefined,
    mapLayerFilter: [],
    mapLayerFieldKey: "Sale Price",
    mapLayerPaint: undefined, // object
    eventCategory: "unknown-map",
    paintCircleColorType: "step",
    sourceId: "dataPoints",
    defaultColors: {
      dark: "white",
      light: "black",
    },
  };

  const settings = Object.assign({}, defaults, options);

  mapboxgl.accessToken =
    "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";

  let mapObj;
  let mapData;

  const mapConfig = {
    container: settings.mapElementId, // container ID
    style: `mapbox://styles/mapbox/${userTheme}-v10`, // style URL
    center: {
      lat: settings.mapCenterLat,
      lng: settings.mapCenterLng,
    },
    zoom: settings.zoom,
    minZoom: settings.minZoom,
    attributionControl: false,
    scrollZoom: {
      requireCtrl: true,
    },
    cooperativeGestures: window.self !== window.top, // this is set to true when page is loaded in an iframe
  };

  const fn = {
    init: async () => {
      tracking.eventCategory = settings.eventCategory;
      trdTheme.init();
      legend.init();
      filters.init();
      map.init();
      fn.checkForIframe();
      fn.changeThemeOnSystemChange();
    },

    checkForIframe: () => {
      if (!helpers.isIframe()) return;
      document.querySelector("body").classList.add("iframe");
    },

    changeThemeOnSystemChange: () => {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", (e) => {
          if (trdTheme.prefer !== "system") return;
          const newTheme = e.matches ? "dark" : "light";
          trdTheme.set(newTheme);
          tracking.trackEvent("theme", newTheme);
          mapObj.setStyle(`mapbox://styles/mapbox/${newTheme}-v10`);
        });
    },
  };

  const helpers = {
    isIframe: () => {
      return window.self !== window.top;
    },

    pickThemeColor: (lightColor, darkColor) => {
      return trdTheme.isDark() ? darkColor : lightColor;
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
  };

  const formatters = {
    format: (value, type) => {
      if (typeof type === "function") {
        return type(value);
      }

      if (typeof type === "string" && formatters[type]) {
        return formatters[type](value);
      }

      return value;
    },

    formatInteger: (value) => {
      return parseInt(value, 10);
    },

    formatNumber: (value) => {
      return new Intl.NumberFormat("en-US", {
        style: "decimal",
      }).format(value);
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

    formatUrl: (value) => {
      return `<a href="${value}" target="_blank" rel="noopener noreferrer">${value}</a>`;
    },
  };

  const legend = {
    init: () => {
      if (!settings?.legendKeys?.length || !settings?.legendElementId) {
        return;
      }

      legend.createLegend();

      if (settings.legendAutoCollapse) {
        legend.collapseLegend();
      }
    },

    getElement: () => {
      const el = document.getElementById(settings.legendElementId);
      return el ? el : legend.createLegendElement();
    },

    createLegendElement: () => {
      const mapEl = document.getElementById(settings.mapElementId);
      mapEl.insertAdjacentHTML(
        "afterend",
        `<section id="${settings.legendElementId}" class="accordion legend">
        <div class="accordion-item">
          <div class="accordion-header">
            <button
              class="accordion-button"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#${settings.legendElementId}-content"
              aria-expanded="true"
              aria-controls="${settings.legendElementId}-content"
            >
              Legend
            </button>
          </div>
          <div id="${settings.legendElementId}-content" class="accordion-collapse collapse show">
            <div class="accordion-body"><ul></ul></div>
          </div>
        </div>
      </section>`
      );

      return document.getElementById(settings.legendElementId);
    },

    createLegend: () => {
      const legendEl = legend.getElement();
      const parent = legendEl.querySelector(".accordion-body ul");
      if (!parent) return;

      const keys = Object.keys(settings.legendKeys);
      for (let i = 0; i < keys.length; i++) {
        const item = settings.legendKeys[keys[i]];
        const li = document.createElement("li");
        li.innerHTML = `<strong>${item.title}</strong>`;
        parent.appendChild(li);

        item.options.forEach((item) => {
          const li = document.createElement("li");
          const color = helpers.pickThemeColor(
            item.color.light,
            item.color.dark
          );
          li.innerHTML = `<span class="legend-icon" style="background-color: ${color}"></span>${item.text}`;
          parent.appendChild(li);
        });
      }
    },

    collapseLegend: () => {
      const legendEl = legend.getElement();
      const legendBtn = legendEl.querySelector(".accordion-button");
      if (!legendBtn) return;

      setTimeout(() => {
        legendBtn.click();
      }, 5000);
    },
  };

  const filters = {
    init: () => {
      if (!settings?.filterFields?.length || !settings?.filterElementId) return;

      filters.createFilter();
      filters.eventListeners();
    },

    getElement: () => {
      const el = document.getElementById(settings.filterElementId);
      return el ? el : filters.createFilterElement();
    },

    eventListeners: () => {
      const filterEl = filters.getElement();
      const closeButtonEl = filterEl.querySelector(".map-filters-close");

      closeButtonEl.addEventListener("click", filters.onClose);
      filterEl.addEventListener("submit", filters.onSubmit);
      filterEl.addEventListener("reset", filters.onReset);
    },

    createFilterElement: () => {
      const mapEl = document.getElementById(settings.mapElementId);
      mapEl.insertAdjacentHTML(
        "afterend",
        `<form id="${settings.filterElementId}" class="map-filters-container" method="dialog">
        <div class="map-filters-header">
          <h4 class="map-filters-title">Filters</h4>
          <button
            class="btn-close map-filters-close"
            type="button"
            data-bs-dismiss="map-filters"
            aria-label="Close"
          ></button>
        </div>
        <div class="map-filters-body"></div>
        <div class="map-filters-footer">
          <button type="reset" class="btn btn-secondary">Clear</button>
          <button type="submit" class="btn btn-primary">Apply</button>
        </div>
      </form>`
      );

      return document.getElementById(settings.filterElementId);
    },

    createFilter: () => {
      const filterEl = filters.getElement();
      const filterBodyEl = filterEl.querySelector(".map-filters-body");

      if (!filterBodyEl) return;
      settings.filterFields.forEach((filterField) => {
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

    close: () => {
      const filterEl = filters.getElement();
      filterEl.classList.remove("active");
      document.querySelector("button.map-filters").classList.remove("active");
    },

    onToggle: () => {
      if (!settings?.filterFields?.length) return;
      const filterEl = filters.getElement();
      const isActive = filterEl.classList.contains("active");

      filterEl.classList.toggle("active");
      document.querySelector("button.map-filters").classList.toggle("active");
      tracking.trackEvent("filters", isActive ? "close" : "open");
    },

    onClose: () => {
      if (!settings?.filterFields?.length) return;
      filters.close();
      tracking.trackEvent("filters", "close");
    },

    onSubmit: (e) => {
      if (!settings?.filterFields?.length) return;

      e.preventDefault();

      const filterData = filters.getFilterFeatures();
      const filterApplied = filterData.length !== mapData.features.length;

      mapObj.getSource(settings.sourceId).setData({
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
      tracking.trackEvent("filters", "submit");
    },

    onReset: () => {
      if (!settings?.filterFields?.length) return;

      const filterData = filters.getFilterFeatures(mapData);
      mapObj.getSource(settings.sourceId).setData({
        type: "FeatureCollection",
        features: filterData,
      });
      document.querySelector("button.map-filters").classList.remove("applied");
      tracking.trackEvent("filters", "reset");
    },

    getFilterFeatures: (data) => {
      const filterEl = filters.getElement();
      const formData = new FormData(filterEl);
      const filterData = {};

      formData.forEach((value, key) => {
        if (!filterData[key]) {
          filterData[key] = [];
        }

        filterData[key].push(value);
      });

      let features = data && data.length ? data : mapData.features;

      for (const field in filterData) {
        if (!filterData[field].length) continue;

        const filterField = settings.filterFields.find(
          (item) => item.name === field
        );

        if (!filterField) continue;

        features = features.filter((feature) => {
          return filterField.callback(filterData[field], feature);
        });
      }

      return features;
    },
  };

  const paintCircleColorTypes = {
    step: () => {
      const colors = [
        "step",
        ["to-number", ["get", settings.mapLayerFieldKey], 0],
      ];

      if (!settings?.dataPointKeys?.length) {
        return colors;
      }

      settings.dataPointKeys.forEach((item) => {
        colors.push(helpers.pickThemeColor(item.color.light, item.color.dark));

        if (!item.default) {
          colors.push(item.value);
        }
      });

      return colors;
    },
    case: () => {
      if (!settings?.dataPointKeys?.length) {
        return ["circle-color", "black"];
      }

      const colors = ["case"];

      settings.dataPointKeys
        .filter((item) => !item.default)
        .forEach((item) => {
          const groupValue = item.value.split("|");
          for (const value of groupValue) {
            colors.push(["==", ["get", settings.mapLayerFieldKey], value]);
            colors.push(
              helpers.pickThemeColor(item.color.light, item.color.dark)
            );
          }
        });

      settings.dataPointKeys
        .filter((item) => item.default)
        .forEach((item) => {
          colors.push(
            helpers.pickThemeColor(item.color.light, item.color.dark)
          );
        });

      return colors;
    },
  };

  const map = {
    currentZoom: mapConfig.zoom,
    init: () => {
      mapObj = new mapboxgl.Map(mapConfig);
      map.addControls();
      map.eventListeners();
    },

    addControls: () => {
      mapObj.addControl(
        new mapboxgl.NavigationControl({
          showCompass: false,
        }),
        "top-right"
      );

      if (settings?.filterFields?.length && settings?.filterElementId) {
        mapObj.addControl(
          new MapboxGLButtonControl({
            className: "map-filters",
            title: "Filters",
            eventHandler: filters.onToggle,
          }),
          "top-right"
        );
      }

      mapObj.addControl(
        new MapboxGLButtonControl({
          className: "map-theme",
          title: "Theme",
          eventHandler: () => trdTheme.onToggle(mapObj),
        }),
        "top-right"
      );

      if (helpers.isIframe()) {
        mapObj.addControl(
          new mapboxgl.FullscreenControl({
            container: document.querySelector("body"),
          }),
          "top-right"
        );
      }
    },

    load: (data) => {
      if (!data) return;

      map.loadSalesDataOnMap(settings.sourceId, {
        ...data,
        features: filters.getFilterFeatures(data),
      });
      map.tooltip(settings.sourceId);
      map.modal(settings.sourceId);
    },

    eventListeners: () => {
      mapObj.on("load", () => {
        if (!settings?.filePath) return;

        fetch(settings.filePath)
          .then((response) => {
            return response.json();
          })
          .then((data) => {
            if (settings.fetchDataFilterCallback) {
              mapData = {
                ...data,
                features: data.features.filter(
                  settings.fetchDataFilterCallback
                ),
              };
            } else {
              mapData = data;
            }

            map.load(mapData);
          });
      });

      mapObj.on("style.load", () => {
        if (mapData) map.load(mapData);
      });

      mapObj.on("zoomend", (e) => {
        const newZoom = e.target.getZoom();
        const method = newZoom > map.currentZoom ? "zoom-in" : "zoom-out";
        tracking.trackEvent("zoom", `${method} ${newZoom}`);
        map.currentZoom = newZoom;
      });
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
          filters: settings.mapLayerFilter ? settings.mapLayerFilter : [],
          paint: {
            "circle-pitch-alignment": "map",
            "circle-color":
              settings.paintCircleColorType &&
              Object.keys(paintCircleColorTypes).includes(
                settings.paintCircleColorType
              )
                ? paintCircleColorTypes[settings.paintCircleColorType]()
                : helpers.pickThemeColor(
                    settings.defaultColors.light
                      ? settings.defaultColors.light
                      : "black",
                    settings.defaultColors.dark
                      ? settings.defaultColors.dark
                      : "white"
                  ),
            ...(settings.mapLayerPaint ? settings.mapLayerPaint : {}),
          },
        });
      }
    },

    tooltip: (id) => {
      mapObj.on("mouseenter", id, (e) => {
        mapObj.getCanvas().style.cursor = "pointer";
      });
      mapObj.on("mouseleave", id, (e) => {
        mapObj.getCanvas().style.cursor = "";
      });

      if (!settings?.tooltipDisplayFields) return;

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
      });

      mapObj.on("mouseenter", id, (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();

        const address =
          e.features[0].properties[settings.tooltipDisplayFields.title.field] ||
          `Unknown ${settings.tooltipDisplayFields.title.label}`;

        const tooltipDisplayFieldsContent =
          settings.tooltipDisplayFields.content;

        let content = "";

        tooltipDisplayFieldsContent.forEach((item) => {
          let value = helpers.cleanValue(e.features[0].properties[item.field]);

          if (
            item.filter &&
            typeof item.filter === "function" &&
            !item.filter(value)
          ) {
            value = "";
          }

          if (value) {
            content += `<p><span>${
              item.label
            }:</span> <span>${formatters.format(
              value,
              item.format
            )}</span></p>`;
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
        popup.remove();
      });
    },

    modal: (id) => {
      if (!settings?.modalDisplayFields) return;

      mapObj.on("click", id, (e) => {
        const modal = document.querySelector("#modal");
        const modalTitle = document.querySelector("#modal .modal-title");
        const modalContent = document.querySelector("#modal .modal-body");

        const address =
          e.features[0].properties[settings.modalDisplayFields.title.field] ||
          `Unknown ${settings.modalDisplayFields.title.label}`;
        modalTitle.innerHTML = address;

        let html = "";

        settings.modalDisplayFields.content.forEach((item) => {
          let value = helpers.cleanValue(e.features[0].properties[item.field]);
          if (item.field === "group") {
            if (!item.fields || !item.fields.length) {
              return;
            }

            const fieldValues = [];
            item.fields.forEach((subField) => {
              let subValue = helpers.cleanValue(
                e.features[0].properties[subField.field]
              );
              if (
                subField.filter &&
                typeof subField.filter === "function" &&
                !subField.filter(subValue)
              ) {
                subValue = "";
              }

              if (subValue) {
                subValue = formatters.format(subValue, subField.format);
                if (
                  subField.field.endsWith("Zip") ||
                  subField.field.endsWith("Line 2") ||
                  subField.field.endsWith("Line 3") ||
                  subField.field.endsWith("Address2")
                ) {
                  fieldValues.push(" " + subValue);
                } else if (
                  subField.field.endsWith("City") ||
                  subField.field.endsWith("State")
                ) {
                  fieldValues.push(", " + subValue);
                } else {
                  fieldValues.push(
                    formatters.format(subValue, subField.format)
                  );
                }
              }
            });
            value = fieldValues.join("");
          }

          if (
            item.filter &&
            typeof item.filter === "function" &&
            !item.filter(value)
          ) {
            value = "";
          }

          if (value) {
            html += `<p class="detail-item">`;
            if (item.label) {
              html += `<span class="detail-label">${item.label}:</span>`;
            }
            html += `<span class="detail-value">${formatters.format(
              value,
              item.format
            )}</span>`;
            html += `</p>`;
          }
        });

        modalContent.innerHTML = html;
        modalContent.scrollTop = 0;
        modal.style.display = "block";
        tracking.trackEvent("detail_view", address.toLowerCase());
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
