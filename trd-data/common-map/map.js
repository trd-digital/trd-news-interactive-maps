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

const trdTheme = TrdTheme({
  updateCallback: (theme) => {
    tracking.trackEvent("theme", theme);
    if (window.map) {
      window.map.setStyle(`mapbox://styles/mapbox/${theme}-v10`);
    }
  },
});

const trdDataCommonMap = (options) => {
  const defaults = {
    filePath: "",
    filePaths: [],
    fileAddKeyValues: {},
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
    sourceId: "data",
    defaultColors: {
      light: "black",
      dark: "white",
      pointTextColorLight: "white",
      pointTextColorDark: "white",
    },
    loadingEnabled: false,
    mapCluster: false,
    mapClusterMaxZoom: 12, // Max zoom to cluster points on
    mapClusterRadius: 50, // Radius of each cluster when clustering points (defaults to 50)
  };

  const settings = Object.assign({}, defaults, options);

  if (settings.filePath && !settings.filePaths.includes(settings.filePath)) {
    settings.filePaths.push(settings.filePath);
  }

  const loading = settings.loadingEnabled
    ? TrdLoading({
        init: true,
        active: true,
      })
    : undefined;

  mapboxgl.accessToken =
    "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";

  let mapObj;
  let mapData;

  const mapConfig = {
    container: settings.mapElementId, // container ID
    style: `mapbox://styles/mapbox/${trdTheme.getUserTheme()}-v10`, // style URL
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
    },

    checkForIframe: () => {
      if (!helpers.isIframe()) return;
      document.querySelector("body").classList.add("iframe");
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

      if (typeof type === "string" && TrdFormatters[type]) {
        return TrdFormatters[type](value);
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

        const options =
          settings.paintCircleColorType === "case"
            ? item.options.filter((opt) => !opt.default)
            : item.options;

        options.forEach((item) => {
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

      filters.createFilters();
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

    createFilters: () => {
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

      if (filterField.fieldType === "select") {
        const select = document.createElement("select");
        select.id = filterField.name;
        select.name = filterField.name;
        select.classList.add("form-select");

        filterField.options.forEach((option) => {
          const opt = document.createElement("option");
          opt.value = option.value;
          opt.innerText = option.label;

          if (option.value === filterField.defaultValue) {
            opt.selected = true;
            opt.setAttribute("selected", "selected");
          }

          select.appendChild(opt);
        });

        field.appendChild(select);
      } else if (filterField.fieldType === "multi-range") {
        filters.fieldRange(field, filterField);
      } else {
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
      }

      wrapper.appendChild(field);
      parent.appendChild(wrapper);
    },

    fieldRange: (field, filterField) => {
      const minInput = document.createElement("input");
      minInput.type = "number";
      minInput.name = `${filterField.name}`;
      minInput.id = `${filterField.name}-min`;
      minInput.value = filterField.defaultValue[0] || filterField.minValue;
      minInput.placeholder = `Min ${filterField.name}`;
      minInput.setAttribute("min", filterField.minValue);
      minInput.setAttribute("max", filterField.maxValue);
      minInput.classList.add("d-none");

      const maxInput = document.createElement("input");
      maxInput.type = "number";
      maxInput.name = `${filterField.name}`;
      maxInput.id = `${filterField.name}-max`;
      maxInput.value = filterField.defaultValue[1] || filterField.maxValue;
      maxInput.placeholder = `Max ${filterField.name}`;
      maxInput.setAttribute("min", filterField.minValue);
      maxInput.setAttribute("max", filterField.maxValue);
      maxInput.classList.add("d-none");

      const label = document.createElement("div");
      label.classList.add("range-slider-label");

      const progress = document.createElement("div");
      progress.classList.add("range-slider-progress");
      progress.style.left = `${
        ((minInput.value - filterField.minValue) /
          (filterField.maxValue - filterField.minValue)) *
        100
      }%`;
      progress.style.right = `${
        ((filterField.maxValue - maxInput.value) /
          (filterField.maxValue - filterField.minValue)) *
        100
      }%`;

      const minSlider = document.createElement("div");
      minSlider.classList.add("range-slider-min");
      minSlider.style.left = `${
        ((minInput.value - filterField.minValue) /
          (filterField.maxValue - filterField.minValue)) *
        100
      }%`;
      minSlider.onmousedown = (e) => {
        e.preventDefault();
        const mouseMoveHandler = (e) => {
          const rect = field.getBoundingClientRect();
          const offsetX = e.clientX - rect.left;

          const maxValue = maxInput.value || filterField.maxValue;
          const percentage = Math.min(Math.max(offsetX / rect.width, 0), 1);
          let minValue =
            filterField.allowZero && percentage == 0 ? 0 : filterField.minValue;
          const value = Math.round(
            percentage * (filterField.maxValue - minValue) + minValue
          );

          // don't allow to move the min slider beyond the max slider.
          const valueOffset = Math.round(
            (percentage + 0.2) * (filterField.maxValue - minValue) + minValue
          );
          if (valueOffset > maxValue) {
            return;
          }

          minInput.value = value;
          minSlider.style.left = `${percentage * 100}%`;
          progress.style.left = `${percentage * 100}%`;
          updateLabel();
          minInput.dispatchEvent(new Event("input"));
        };
        const mouseUpHandler = () => {
          document.removeEventListener("mousemove", mouseMoveHandler);
          document.removeEventListener("mouseup", mouseUpHandler);
        };
        document.addEventListener("mousemove", mouseMoveHandler);
        document.addEventListener("mouseup", mouseUpHandler);
      };

      const maxSlider = document.createElement("div");
      maxSlider.classList.add("range-slider-max");
      maxSlider.style.left = `${
        ((maxInput.value - filterField.minValue) /
          (filterField.maxValue - filterField.minValue)) *
          100 -
        7
      }%`;
      maxSlider.onmousedown = (e) => {
        e.preventDefault();
        const mouseMoveHandler = (e) => {
          const rect = field.getBoundingClientRect();
          const offsetX = e.clientX - rect.left;
          const minValue = minInput.value || filterField.minValue;
          const percentage = Math.min(Math.max(offsetX / rect.width, 0), 1);
          const value = Math.round(
            percentage * (filterField.maxValue - filterField.minValue) +
              filterField.minValue
          );

          // don't allow to move the min slider beyond the max slider.
          const valueOffset = Math.round(
            (percentage - 0.2) * (filterField.maxValue - filterField.minValue) +
              filterField.minValue
          );
          if (valueOffset < minValue) {
            return;
          }

          maxInput.value = value;
          maxSlider.style.left = `${percentage * 100 - 7}%`;
          progress.style.right = `${(1 - percentage) * 100}%`;
          updateLabel();
          maxInput.dispatchEvent(new Event("input"));
        };

        const mouseUpHandler = () => {
          document.removeEventListener("mousemove", mouseMoveHandler);
          document.removeEventListener("mouseup", mouseUpHandler);
        };
        document.addEventListener("mousemove", mouseMoveHandler);
        document.addEventListener("mouseup", mouseUpHandler);
      };

      const updateLabel = () => {
        const minValue = minInput.value || filterField.minValue;
        const maxValue = maxInput.value || filterField.maxValue;
        if (filterField.format && TrdFormatters[filterField.format]) {
          label.innerHTML = `<span>${TrdFormatters[filterField.format](
            minValue
          )}</span> - <span>${TrdFormatters[filterField.format](
            maxValue
          )}</span>`;
        } else {
          label.innerHTML = `<span>${minValue}</span> - <span>${maxValue}</span>`;
        }
      };

      updateLabel();

      const slider = document.createElement("div");
      slider.classList.add("range-slider");
      slider.appendChild(progress);
      slider.appendChild(minSlider);
      slider.appendChild(maxSlider);

      field.appendChild(label);
      field.appendChild(slider);
      field.appendChild(minInput);
      field.appendChild(maxInput);
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
          eventHandler: () => trdTheme.toggle(),
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
        if (!settings?.filePaths?.length) {
          return;
        }
        if (settings.loadingEnabled) {
          loading.show();
        }

        Promise.all(
          settings.filePaths.map((filePath) =>
            fetch(filePath).then((response) => response.json())
          )
        )
          .then((allData) => {
            // Merge all features into a single FeatureCollection
            const merged = allData.reduce(
              (acc, data, cIndex) => {
                if (data && data.features && Array.isArray(data.features)) {
                  if (
                    settings.fileAddKeyValues &&
                    settings.fileAddKeyValues[cIndex]
                  ) {
                    data.features = data.features.map((feature) => {
                      return {
                        ...feature,
                        properties: {
                          ...feature.properties,
                          ...settings.fileAddKeyValues[cIndex],
                        },
                      };
                    });
                  }
                  acc.features = acc.features.concat(data.features);
                }
                return acc;
              },
              { type: "FeatureCollection", features: [] }
            );
            mapData = settings.fetchDataFilterCallback
              ? settings.fetchDataFilterCallback(merged)
              : merged;
            map.load(mapData);
          })
          .finally(() => {
            if (settings.loadingEnabled) {
              loading.hide();
            }
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
      const circleColor =
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
            );

      let filters = settings.mapLayerFilter ? settings.mapLayerFilter : [];
      filters = settings.cluster
        ? ["!", ["has", "point_count"], ...filters]
        : filters;

      if (!mapObj.getSource(id)) {
        mapObj.addSource(id, {
          type: "geojson",
          data: data,
          cluster: settings.mapCluster,
          clusterMaxZoom: settings.mapClusterMaxZoom,
          clusterRadius: settings.mapClusterRadius,
        });
      }

      if (!mapObj.getLayer(`${id}-points`)) {
        mapObj.addLayer({
          id: `${id}-points`,
          source: id,
          type: "circle",
          filters: filters,
          paint: {
            "circle-pitch-alignment": "map",
            "circle-color": circleColor,
            ...(settings.mapLayerPaint ? settings.mapLayerPaint : {}),
          },
        });
      }

      if (settings.mapCluster) {
        // add cluster layer
        if (!mapObj.getLayer(`${id}-clusters`)) {
          mapObj.addLayer({
            id: `${id}-clusters`,
            source: id,
            type: "circle",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": circleColor,
              "circle-radius": [
                "step",
                ["get", "point_count"],
                20, // circle radius
                50, // stop value
                30,
                75,
                40,
                100,
                50,
              ],
            },
          });
        }

        // add cluster count layer
        if (!mapObj.getLayer(`${id}-cluster-count`)) {
          mapObj.addLayer({
            id: `${id}-cluster-count`,
            source: id,
            type: "symbol",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 16,
            },
            paint: {
              "text-color": helpers.pickThemeColor(
                settings.defaultColors.pointTextColorLight
                  ? settings.defaultColors.pointTextColorLight
                  : "black",
                settings.defaultColors.pointTextColorDark
                  ? settings.defaultColors.pointTextColorDark
                  : "white"
              ),
            },
          });
        }
      }
    },

    tooltip: (id) => {
      if (!settings?.tooltipDisplayFields) return;

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
      });

      if (settings.mapCluster) {
        mapObj.on("mouseleave", `${id}-clusters`, (e) => {
          mapObj.getCanvas().style.cursor = "";
        });
        mapObj.on("mouseenter", `${id}-clusters`, (e) => {
          mapObj.getCanvas().style.cursor = "pointer";
        });
        mapObj.on("click", `${id}-clusters`, (e) => {
          const features = mapObj.queryRenderedFeatures(e.point, {
            layers: [`${id}-clusters`],
          });
          if (!features.length) return;

          const clusterId = features[0].properties.cluster_id;
          mapObj
            .getSource(id)
            .getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err) return;

              mapObj.easeTo({
                center: features[0].geometry.coordinates,
                zoom: zoom,
              });
            });
        });
      }

      mapObj.on("mouseleave", `${id}-points`, (e) => {
        mapObj.getCanvas().style.cursor = "";
        popup.remove();
      });

      mapObj.on("mouseenter", `${id}-points`, (e) => {
        mapObj.getCanvas().style.cursor = "pointer";

        const cluster = e.features[0].properties.cluster;
        if (cluster) {
          return;
        }
        const coordinates = e.features[0].geometry.coordinates.slice();
        const html = map.getTooltipHtml(e.features[0]);
        popup.setLngLat(coordinates).setHTML(html).addTo(mapObj);
      });
    },

    getTooltipHtml: (feature) => {
      let image;
      if (
        settings.tooltipDisplayFields.image &&
        settings.tooltipDisplayFields.image.field
      ) {
        const image_url =
          feature.properties[settings.tooltipDisplayFields.image.field];

        if (image_url && image_url.startsWith("http")) {
          image = image_url;
        }
      }

      const address =
        feature.properties[settings.tooltipDisplayFields.title.field] ||
        `Unknown ${settings.tooltipDisplayFields.title.label}`;

      const tooltipDisplayFieldsContent = settings.tooltipDisplayFields.content;

      let content = "";

      tooltipDisplayFieldsContent.forEach((item) => {
        let value = helpers.cleanValue(feature.properties[item.field]);

        if (
          item.filter &&
          typeof item.filter === "function" &&
          !item.filter(value)
        ) {
          value = "";
        }

        const contentClass = item.className ? item.className : "";

        if (value) {
          content += `<p class="${contentClass}"><span>${
            item.label
          }:</span> <span>${formatters.format(value, item.format)}</span></p>`;
        }
      });

      return `
        <div class="popup-tooltip">
          ${
            image
              ? `<div class="popup-tooltip-image"><img src="${image}" alt="" width="100%" height="auto" /></div>`
              : ""
          }
          <div class="popup-tooltip-body">
              <h4 class="popup-tooltip-title">${address}</h4>
              ${content}
          </div>
        </div>
      `;
    },

    modal: (id) => {
      if (!settings?.modalDisplayFields) return;

      mapObj.on("click", `${id}-points`, (e) => {
        if (e.features[0].properties.cluster) {
          return;
        }

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
            html += `<div class="detail-item">`;
            if (item.label) {
              html += `<div class="detail-label">${item.label}:</div>`;
            }
            html += `<div class="detail-value">${formatters.format(
              value,
              item.format
            )}</div>`;
            html += `</div>`;
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
