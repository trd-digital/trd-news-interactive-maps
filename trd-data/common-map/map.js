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
  //--------------------------------------------------------------------------------------//
  //                                       Settings                                       //
  //--------------------------------------------------------------------------------------//
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
    mapLayerPaint: undefined, // object
    eventCategory: "unknown-map",
    sourceId: "data",
    loadingEnabled: false,
    // search settings
    searchSettings: {
      enable: false,
      elementId: "map-search-form",
      resultTitleField: undefined, // Field to use as title in search results
      resultDescriptionField: undefined, // Field to use as description in search results
      placeholderText: "Search...",
      minChars: 3,
      maxResults: 100,
      searchFields: [], // Fields to search in
    },
    // point settings
    pointSettings: {
      filter: [],
      clickToCenter: false, // Whether to center the map on the clicked point
      clickToZoom: false, // Whether to zoom in on the clicked point
      colorType: "step", // "step", "case"
      radiusType: "radius", // "radius" or "ratio"
      colorTypeDataKey: undefined, // Field to use for step color
      paintSettings: {
        default: {
          radius: 6, // Default radius for points
          ratio: 1, // Ratio for points in default state
          color: {
            light: "black", // Default color for points in light mode
            dark: "white", // Default color for points in dark mode
          },
        },
        hover: {
          radius: 8, // Radius when hovered
          ratio: 1.5, // Ratio for points when hovered
          color: {
            light: "black", // Color for points in light mode when hovered
            dark: "white", // Color for points in dark mode when hovered
          },
        },
        active: {
          radius: 10, // Radius when active
          ratio: 1.75, // Ratio for points when active
          color: {
            light: "black", // Color for points in light mode when active
            dark: "white", // Color for points in dark mode when active
          },
        },
      },
    },
    // cluster settings
    clusterSettings: {
      enable: false, // Whether to enable clustering
      maxZoom: 12, // Max zoom to cluster points on
      radius: 50, // Radius of each cluster when clustering points
      colorType: "case", // "case" // TODO: Add "step" support
      textSize: 16, // Size of the text in clusters
      paintSettings: {
        default: {
          color: {
            light: "black", // Default color for clusters in light mode
            dark: "white", // Default color for clusters in dark mode
          },
          textColor: {
            light: "white", // Default text color for clusters in light mode
            dark: "white", // Default text color for clusters in dark mode
          },
        },
      },
    },
    // shape settings
    shapeSettings: {
      enable: false,
      idPrefix: "shape-",
      filePaths: [],
      paintSettings: {
        fillOpacity: 0.4,
        fillColor: {
          light: "rgba(200, 100, 240, 0.4)",
          dark: "rgba(200, 100, 240, 0.4)",
        },
        outlineColor: {
          light: "rgba(200, 100, 240, 1)",
          dark: "rgba(200, 100, 240, 1)",
        },
      },
    },
  };

  const defaultColors = {
    default: {
      light: "black",
      dark: "white",
    },
    hover: {
      light: "black",
      dark: "white",
    },
    active: {
      light: "black",
      dark: "white",
    },
  };

  // TODO: Remove this when the paintCircleColorType is removed
  if (options.paintCircleColorType) {
    defaults.pointSettings.colorType = options.paintCircleColorType;
  }

  // TODO: Remove this when the mapLayerFieldKey is removed
  if (options.mapLayerFieldKey) {
    defaults.pointSettings.colorTypeDataKey = options.mapLayerFieldKey;
  }

  // Deep merge defaults and options for nested objects
  const mergeDeep = (target, source) => {
    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        if (!target[key] || typeof target[key] !== "object") {
          target[key] = {};
        }
        mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  };

  const settings = mergeDeep(structuredClone(defaults), options || {});

  if (settings.filePath && !settings.filePaths.includes(settings.filePath)) {
    settings.filePaths.push(settings.filePath);
  }

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

  const loading = settings.loadingEnabled
    ? TrdLoading({
        init: true,
        active: true,
      })
    : undefined;

  const fn = {
    init: async () => {
      tracking.eventCategory = settings.eventCategory;
      fn.createContainer();
      trdTheme.init();
      legend.init();
      filters.init();
      search.init();
      map.init();
      fn.checkForIframe();
    },

    createContainer: () => {
      if (document.querySelector(".map-container")) return;

      const container = document.createElement("main");
      container.className = "map-container";

      const mapEl = document.createElement("div");
      mapEl.id = settings.mapElementId;
      mapEl.className = "map";

      container.appendChild(mapEl);
      document.body.appendChild(container);
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

    pickColor: (colors, defaultColors) => {
      return helpers.pickThemeColor(
        colors.light || defaultColors.light,
        colors.dark || defaultColors.dark
      );
    },

    cleanValue: (value) => (TrdFormatters.isEmptyValue(value) ? "" : value),
  };

  const formatters = {
    format: (value, type) => {
      if (typeof type === "function") {
        return type(value);
      }

      if (typeof type === "string" && TrdFormatters[type]) {
        return TrdFormatters[type](value);
      }

      return value;
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
          defaults.pointSettings.colorType === "case"
            ? item.options.filter((opt) => !opt.default)
            : item.options;

        options.forEach((item) => {
          const li = document.createElement("li");
          const color = helpers.pickColor(item.color, defaultColors.default);
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

    isOpen: () => {
      const filterEl = filters.getElement();
      return filterEl.classList.contains("active");
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

  const search = {
    _inputTimeoutId: null,
    init: () => {
      if (!search.isEnabled()) return;

      search._createSearch();
      search._eventListeners();
    },

    _getFormElement: () => {
      if (!search.isEnabled()) return null;

      const el = document.getElementById(settings.searchSettings.elementId);
      return el ? el : search._createSearch();
    },

    _getInputElement: () => {
      if (!search.isEnabled()) return null;

      return document.getElementById(
        `${settings.searchSettings.elementId}-search`
      );
    },

    _getResultElement: () => {
      if (!search.isEnabled()) return null;

      return document.getElementById(
        `${settings.searchSettings.elementId}-results`
      );
    },

    _createSearch: () => {
      const mapEl = document.getElementById(settings.mapElementId);
      mapEl.insertAdjacentHTML(
        "afterend",
        `<form id="${settings.searchSettings.elementId}" class="map-filters-container map-search-form" method="dialog">
        <div class="map-filters-header">
          <h4 class="map-filters-title">Search</h4>
          <button
            class="btn-close map-search-close"
            type="button"
            data-bs-dismiss="map-filters"
            aria-label="Close"
          ></button>
        </div>
        <div class="map-filters-body">
          <input id="${settings.searchSettings.elementId}-search" class="map-search-input" name="search" type="search" placeholder="${settings.searchSettings.placeholderText}" />
          <ul id="${settings.searchSettings.elementId}-results" class="map-search-result-list"></ul>
        </div>
      </form>`
      );
    },

    _eventListeners: () => {
      const formEl = search._getFormElement();
      const searchInputEl = search._getInputElement();
      const closeButtonEl = formEl.querySelector(".map-search-close");

      closeButtonEl.addEventListener("click", search._onClose);
      formEl.addEventListener("submit", search._onSubmit);
      formEl.addEventListener("reset", search._onReset);
      searchInputEl.addEventListener("input", search._onInputSearch);
    },

    isEnabled: () => {
      return settings.searchSettings.enable;
    },

    isOpen: () => {
      if (!search.isEnabled()) return false;

      const formEl = search._getFormElement();
      return formEl.classList.contains("active");
    },

    close: () => {
      if (!search.isEnabled()) return null;

      const formEl = search._getFormElement();
      formEl.classList.remove("active");
      document
        .querySelector("button.map-search-btn")
        .classList.remove("active");
    },

    onToggle: () => {
      if (!search.isEnabled()) return null;

      const formEl = search._getFormElement();
      const isActive = formEl.classList.contains("active");

      formEl.classList.toggle("active");
      document
        .querySelector("button.map-search-btn")
        .classList.toggle("active");
      tracking.trackEvent("search", isActive ? "close" : "open");
    },

    _onClose: () => {
      search.close();
      tracking.trackEvent("search-form", "close");
    },

    _onSubmit: (e) => {
      e.preventDefault();
      const query = search._getInputElement().value;
      search._performSearch(query);
    },

    _onReset: () => {
      search._getInputElement().value = "";
      search._clearResults();
    },

    _onInputSearch: (e) => {
      clearTimeout(search._inputTimeoutId);
      search._inputTimeoutId = setTimeout(() => {
        search._performSearch(e.target.value);
      }, 300);
    },

    _performSearch: (query) => {
      // query too short
      if (query.length < settings.searchSettings.minChars) {
        search._clearResults();
        return;
      }

      // use the specified search fields or all fields if none specified
      const searchFields =
        settings.searchSettings.searchFields || mapData.features.length
          ? Object.keys(mapData.features[0].properties)
          : [];

      const results = mapData.features
        .filter((feature) => {
          const val = searchFields.some((key) => {
            const value = feature.properties[key];
            return (
              value &&
              value.toString().toLowerCase().startsWith(query.toLowerCase())
            );
          });
          return val;
        })
        .sort((a, b) => {
          // Sort results by the first matching the resultTitleField or resultDescriptionField
          const titleField = settings.searchSettings.resultTitleField;
          const descField = settings.searchSettings.resultDescriptionField;

          const aTitle = titleField ? a.properties[titleField] || "" : "";
          const bTitle = titleField ? b.properties[titleField] || "" : "";

          const aDesc = descField ? a.properties[descField] || "" : "";
          const bDesc = descField ? b.properties[descField] || "" : "";

          if (aTitle !== bTitle) {
            const v = aTitle.localeCompare(bTitle, "en", {
              sensitivity: "base",
            });
            return v;
          }
          return aDesc.localeCompare(bDesc);
        });

      search._showResults(results.slice(0, settings.searchSettings.maxResults));
    },

    _clearResults: () => {
      const resultEl = search._getResultElement();
      if (resultEl) {
        resultEl.innerHTML = "";
      }
    },

    _showResults: (results) => {
      const resultEl = search._getResultElement();
      if (!resultEl) return;

      if (!results.length) {
        resultEl.innerHTML =
          '<li class="map-search-result-item empty">No results found.</li>';
        return;
      }

      resultEl.innerHTML = "";
      results.forEach((feature) => {
        const li = document.createElement("li");
        li.classList.add("map-search-result-item");
        if (
          settings.searchSettings.resultTitleField &&
          settings.searchSettings.resultTitleField.length &&
          feature.properties[settings.searchSettings.resultTitleField]
        ) {
          li.innerHTML += `<div class="map-search-result-title">${
            feature.properties[settings.searchSettings.resultTitleField]
          }</div>`;
        }
        if (
          settings.searchSettings.resultDescriptionField &&
          settings.searchSettings.resultDescriptionField.length &&
          feature.properties[settings.searchSettings.resultDescriptionField]
        ) {
          li.innerHTML += `<div class="map-search-result-description">${
            feature.properties[
              settings.searchSettings.resultDescriptionField
            ] || ""
          }</div>`;
        }

        li.onclick = () => {
          modal.open(feature);
          search.close();
          search._getInputElement().value = "";
          search._clearResults();
        };

        resultEl.appendChild(li);
      });
    },
  };

  const map = {
    currentZoom: mapConfig.zoom,
    dataLoaded: false,
    mapboxLoaded: false,
    init: () => {
      map.getData();
      map.load();
      mapObj = new mapboxgl.Map(mapConfig);
      map.addControls();
      map.eventListeners();
    },

    addControls: () => {
      if (settings.searchSettings.enable) {
        mapObj.addControl(
          new MapboxGLButtonControl({
            className: "map-search-btn",
            title: "Search",
            eventHandler: () => {
              if (filters.isOpen()) {
                filters.close();
              }
              search.onToggle();
            },
          }),
          "top-right"
        );
      }

      if (settings?.filterFields?.length && settings?.filterElementId) {
        mapObj.addControl(
          new MapboxGLButtonControl({
            className: "map-filters",
            title: "Filters",
            eventHandler: () => {
              if (search.isOpen()) {
                search.onClose();
              }
              filters.onToggle();
            },
          }),
          "top-right"
        );
      }

      mapObj.addControl(
        new mapboxgl.NavigationControl({
          showCompass: false,
        }),
        "top-right"
      );

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

    load: () => {
      const timer = setInterval(() => {
        if (map.dataLoaded && map.mapboxLoaded) {
          clearInterval(timer);
          map.loadDataOnMap(settings.sourceId, {
            ...mapData,
            features: filters.getFilterFeatures(mapData),
          });
          modal.init(settings.sourceId);
        }
      }, 100);
    },

    getData: () => {
      if (!settings?.filePaths?.length) {
        map.dataLoaded = true;
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
                  data.features = data.features.map((feature, fIndex) => {
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

          merged.features = merged.features.map((feature, index) => {
            // Ensure each feature has a unique ID
            return {
              ...feature,
              id: feature.id || index,
            };
          });

          mapData = settings.fetchDataFilterCallback
            ? settings.fetchDataFilterCallback(merged)
            : merged;
        })
        .finally(() => {
          map.dataLoaded = true;
          if (settings.loadingEnabled) {
            loading.hide();
          }
        });
    },

    eventListeners: () => {
      mapObj.on("load", () => {
        map.mapboxLoaded = true;
      });

      mapObj.on("style.load", map.load);

      mapObj.on("zoomend", (e) => {
        const newZoom = e.target.getZoom();
        const method = newZoom > map.currentZoom ? "zoom-in" : "zoom-out";
        tracking.trackEvent("zoom", `${method} ${newZoom}`);
        map.currentZoom = newZoom;
      });
    },

    loadDataOnMap: (id, data) => {
      // add source data
      map.addSourceData(id, data);
      // load point data only
      mapPoint.init(id);
      // add cluster layer
      mapCluster.init(id);
      // add shape layers
      mapShapes.init();
    },

    addSourceData: (id, data) => {
      if (mapObj.getSource(id)) {
        return;
      }

      mapObj.addSource(id, {
        type: "geojson",
        data,
        generateId: false, // Generate unique IDs for features
        cluster:
          settings.clusterSettings.enable ?? defaults.clusterSettings.enable, // Whether to cluster points
        clusterMaxZoom:
          settings.clusterSettings.maxZoom ?? defaults.clusterSettings.maxZoom, // Max zoom to cluster points on
        clusterRadius:
          settings.clusterSettings.radius ?? defaults.clusterSettings.radius, // Radius of each cluster when clustering points
      });
    },
  };

  const mapPoint = {
    hoverFeatureId: null,
    activeFeatureId: null,

    init: (id) => {
      if (mapObj.getLayer(`${id}-points`)) {
        return;
      }

      let filters = settings.pointSettings.filter
        ? settings.pointSettings.filter
        : [];
      filters = settings.cluster
        ? ["!", ["has", "point_count"], ...filters]
        : filters;

      mapObj.addLayer({
        id: `${id}-points`,
        source: id,
        type: "circle",
        filters: filters,
        paint: {
          "circle-pitch-alignment": "map",
          "circle-color": mapPoint.getCircleColor(),
          "circle-radius": mapPoint.getCircleRadius(),
          ...(settings.mapLayerPaint ? settings.mapLayerPaint : {}),
        },
      });

      mapPoint.eventListeners(id);
    },

    getCircleColor: () => {
      const colorType = settings?.pointSettings?.colorType;
      return Object.keys(mapPoint._circleColor).includes(colorType)
        ? mapPoint._circleColor[colorType]()
        : mapPoint._circleColor.default();
    },

    getCircleRadius: () => {
      const radiusType = settings?.pointSettings?.radiusType;
      return Object.keys(mapPoint._circleRadius).includes(radiusType)
        ? mapPoint._circleRadius[radiusType]()
        : mapPoint._circleRadius.radius();
    },

    clearHoverState: () => {
      if (!mapPoint.hoverFeatureId) return;
      mapObj.removeFeatureState(
        {
          source: settings.sourceId,
          id: mapPoint.hoverFeatureId,
        },
        "hover"
      );
      mapPoint.hoverFeatureId = null;
    },

    setHoverState: (featureId) => {
      // clear previous hover state
      mapPoint.clearHoverState();

      // set new hover state
      mapPoint.hoverFeatureId = featureId;
      mapObj.setFeatureState(
        {
          source: settings.sourceId,
          id: mapPoint.hoverFeatureId,
        },
        {
          hover: true,
        }
      );
    },

    clearActiveState: () => {
      if (!mapPoint.activeFeatureId) return;
      mapObj.setFeatureState(
        {
          source: settings.sourceId,
          id: mapPoint.activeFeatureId,
        },
        { active: false }
      );
      mapPoint.activeFeatureId = null;
    },

    setActiveState: (featureId) => {
      // clear previous active state
      mapPoint.clearActiveState();

      // set new active state
      mapPoint.activeFeatureId = featureId;
      mapObj.setFeatureState(
        {
          source: settings.sourceId,
          id: featureId,
        },
        {
          active: true,
        }
      );
    },

    eventListeners: (id) => {
      const popup = settings?.tooltipDisplayFields
        ? new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
          })
        : null;

      mapObj.on("mouseleave", `${id}-points`, (e) => {
        mapObj.getCanvas().style.cursor = "";

        // remove the popup if it exists
        if (popup) popup.remove();

        // remove hover state
        mapPoint.clearHoverState();
      });

      mapObj.on("mouseenter", `${id}-points`, (e) => {
        mapObj.getCanvas().style.cursor = "pointer";

        // clear previous hover state
        mapPoint.clearHoverState();

        // check if we have a features
        if (e.features.length === 0) return;

        const feature = e.features[0];

        // check if the feature is a cluster
        const cluster = feature.properties.cluster;
        if (cluster) return;

        // set the hover state
        mapPoint.setHoverState(feature.id);

        if (!popup) return;
        // show the popup
        const coordinates = feature.geometry.coordinates.slice();
        const html = mapPoint.getTooltipHtml(feature);
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

    zoomToFeature: (feature) => {
      // zoom to the clicked point
      if (
        settings.pointSettings.clickToZoom ||
        settings.pointSettings.clickToCenter
      ) {
        mapObj.flyTo({
          center: settings.pointSettings.clickToCenter
            ? modal.offsetCenter(feature.geometry.coordinates)
            : mapObj.getCenter(),
          zoom: settings.pointSettings.clickToZoom ? 14 : mapObj.getZoom(),
        });
      }
    },

    _circleColor: {
      step: () => {
        if (!settings?.pointSettings?.colorTypeDataKey) {
          throw new Error("colorTypeDataKey is not defined in pointSettings");
        }
        const colors = [
          "step",
          ["to-number", ["get", settings?.pointSettings?.colorTypeDataKey], 0],
        ];

        if (!settings?.dataPointKeys?.length) {
          return colors;
        }

        settings.dataPointKeys.forEach((item) => {
          colors.push(
            helpers.pickColor(
              item.color,
              settings.pointSettings.paintSettings.default.color
            )
          );

          if (!item.default) {
            colors.push(item.value);
          }
        });

        return [
          "case",
          ["boolean", ["feature-state", "active"], false],
          helpers.pickColor(
            settings.pointSettings.paintSettings.active.color,
            defaultColors.active
          ),
          ["boolean", ["feature-state", "hover"], false],
          helpers.pickColor(
            settings.pointSettings.paintSettings.hover.color,
            defaultColors.hover
          ),
          colors,
        ];
      },
      case: () => {
        if (!settings?.dataPointKeys?.length) {
          return mapPoint._circleColor.default();
        }

        const colors = [
          "case",
          ["boolean", ["feature-state", "active"], false],
          helpers.pickColor(
            settings.pointSettings.paintSettings.active.color,
            defaultColors.active
          ),
          ["boolean", ["feature-state", "hover"], false],
          helpers.pickColor(
            settings.pointSettings.paintSettings.hover.color,
            defaultColors.hover
          ),
        ];

        settings.dataPointKeys
          .filter((item) => !item.default)
          .forEach((item) => {
            const groupValue = item.value.split("|");
            for (const value of groupValue) {
              colors.push([
                "==",
                ["get", settings?.pointSettings?.colorTypeDataKey],
                value,
              ]);
              colors.push(helpers.pickColor(item.color, defaultColors.default));
            }
          });

        settings.dataPointKeys
          .filter((item) => item.default)
          .forEach((item) => {
            colors.push(helpers.pickColor(item.color, defaultColors.default));
          });

        return colors;
      },
      default: () => {
        return [
          "case",
          ["boolean", ["feature-state", "active"], false],
          helpers.pickColor(
            settings.pointSettings.paintSettings.active.color,
            defaultColors.active
          ),
          ["boolean", ["feature-state", "hover"], false],
          helpers.pickColor(
            settings.pointSettings.paintSettings.hover.color,
            defaultColors.hover
          ),
          helpers.pickColor(
            settings.pointSettings.paintSettings.default.color,
            defaultColors.default
          ),
        ];
      },
    },

    _circleRadius: {
      radius: () => {
        return [
          "case",
          ["boolean", ["feature-state", "active"], false],
          settings.pointSettings.paintSettings.active.radius, // radius when active
          ["boolean", ["feature-state", "hover"], false],
          settings.pointSettings.paintSettings.hover.radius, // radius when hovered
          settings.pointSettings.paintSettings.default.radius, // default radius
        ];
      },

      ratio: () => {
        return [
          "interpolate",
          ["exponential", 2],
          ["zoom"],
          8,
          mapPoint._circleRadius._getActiveHoverRadius(2),
          10,
          mapPoint._circleRadius._getActiveHoverRadius(4),
          12,
          mapPoint._circleRadius._getActiveHoverRadius(6),
          14,
          mapPoint._circleRadius._getActiveHoverRadius(10),
        ];
      },

      _getActiveHoverRadius: (radius) => {
        const hoverRatio = settings.pointSettings.paintSettings.hover.ratio;
        const activeRatio = settings.pointSettings.paintSettings.active.ratio;
        const defaultRatio = settings.pointSettings.paintSettings.default.ratio;
        return [
          "case",
          ["boolean", ["feature-state", "active"], false],
          radius * activeRatio, // radius when active
          ["boolean", ["feature-state", "hover"], false],
          radius * hoverRatio, // radius when hovered
          radius * defaultRatio, // default radius
        ];
      },
    },
  };

  const mapCluster = {
    init: (id) => {
      if (!settings.clusterSettings.enable) {
        return;
      }

      // add cluster layer
      if (!mapObj.getLayer(`${id}-clusters`)) {
        mapObj.addLayer({
          id: `${id}-clusters`,
          source: id,
          type: "circle",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": mapCluster.getCircleColor(),
            "circle-radius": mapCluster.getCircleRadius(),
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
            "text-size": mapCluster.getTextSize(),
          },
          paint: {
            "text-color": mapCluster.getTextColor(),
          },
        });
      }

      mapCluster.eventListeners(id);
    },

    getCircleColor: () => {
      return helpers.pickColor(
        settings.clusterSettings.paintSettings.default.color,
        defaultColors.default
      );
    },

    getTextColor: () => {
      return helpers.pickColor(
        settings.clusterSettings.paintSettings.default.textColor,
        defaultColors.default
      );
    },

    getTextSize: () => {
      return settings.clusterSettings.textSize;
    },

    getCircleRadius: () => {
      return [
        "step",
        ["get", "point_count"],
        20, // circle radius
        50, // stop value
        30,
        75,
        40,
        100,
        50,
      ];
    },

    eventListeners: (id) => {
      if (!settings.clusterSettings.enable) return;

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
        mapObj.getSource(id).getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;

          mapObj.easeTo({
            center: features[0].geometry.coordinates,
            zoom: zoom,
          });
        });
      });
    },
  };

  const mapShapes = {
    init: () => {
      if (!settings?.shapeSettings?.enable) return;

      settings.shapeSettings.filePaths.forEach((shapeFilePath, index) => {
        const shapeSourceId = `${settings.shapeSettings.idPrefix}-source-${index}`;

        mapObj.addSource(shapeSourceId, {
          type: "geojson",
          data: shapeFilePath,
        });

        const shapeLayerId = `${settings.shapeSettings.idPrefix}-layer-${index}`;
        mapObj.addLayer({
          id: shapeLayerId,
          type: "fill",
          source: shapeSourceId,
          layout: {},
          paint: {
            "fill-color": helpers.pickColor(
              settings.shapeSettings.paintSettings.fillColor,
              defaultColors.default
            ),
            "fill-opacity": settings.shapeSettings.paintSettings.fillOpacity,
            "fill-outline-color": helpers.pickColor(
              settings.shapeSettings.paintSettings.outlineColor,
              defaultColors.default
            ),
          },
        });
      });
    },
  };

  const modal = {
    init: (id) => {
      if (!settings?.modalDisplayFields) return;
      modal.createModal();

      mapObj.on("click", `${id}-points`, (e) => {
        modal.open(e.features[0]);
      });

      const close = document.querySelector("#modal .btn-close");
      close.addEventListener("click", () => {
        modal.close();
        tracking.trackEvent("detail_view", "close");
        // map zoom out to the original zoom level
        if (settings.pointSettings.clickToZoom) {
          mapObj.flyTo({
            center: mapConfig.center,
            zoom: mapConfig.zoom,
          });
        }
      });
    },

    createModal: () => {
      if (document.querySelector("#modal")) {
        return; // modal already exists
      }
      const modal = document.createElement("section");
      modal.id = "modal";
      modal.className = "detail-modal modal";
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"></h5>
              <button
                type="button"
                class="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div class="modal-body"></div>
          </div>
        </div>
      `;
      document.querySelector(".map-container").appendChild(modal);
    },

    close: () => {
      document.querySelector("#modal").style.display = "none";
      mapPoint.clearActiveState();
    },

    open: (feature) => {
      if (feature.properties.cluster) {
        return;
      }

      mapPoint.zoomToFeature(feature); // zoom to the clicked point
      mapPoint.setActiveState(feature.id); // highlight the clicked point

      const modalEl = document.querySelector("#modal");
      const modalTitle = document.querySelector("#modal .modal-title");
      const modalContent = document.querySelector("#modal .modal-body");

      const address =
        feature.properties[settings.modalDisplayFields.title.field] ||
        `Unknown ${settings.modalDisplayFields.title.label}`;
      modalTitle.innerHTML = address;

      let html = "";

      settings.modalDisplayFields.content.forEach((item) => {
        let value = helpers.cleanValue(feature.properties[item.field]);
        if (item.field === "group") {
          if (!item.fields || !item.fields.length) {
            return;
          }

          const fieldValues = [];
          item.fields.forEach((subField) => {
            let subValue = helpers.cleanValue(
              feature.properties[subField.field]
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
                fieldValues.push(formatters.format(subValue, subField.format));
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
      modalEl.style.display = "block";
      tracking.trackEvent("detail_view", address.toLowerCase());
    },

    offsetCenter: (coordinates) => {
      // offset the center to right when model is open
      const offset = 0.009; // adjust this value to change the offset
      return [
        coordinates[0] - offset,
        coordinates[1], // keep the latitude the same
      ];
    },
  };

  fn.init();

  return mapObj;
};
