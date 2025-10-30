(() => {
  /**
   * Live Local Map Script
   * Added Search (2025-10-30):
   * - Input #search-input filters features by Developers, Address, or Status (case-insensitive substring).
   * - Clear button resets to full dataset.
   * - Count shown vs total displayed in #search-count.
   * Implementation details:
   * - Caches original features once geojson loaded (polls until available).
   * - Assumes trdDataCommonMap exposes setData(newFC) OR redraw() to update.
   * - If neither present, it mutates window.map.data.features as fallback.
   */
  // Title = Developers; body shows existing fields (only if present)
  const modalDisplayFields = {
    title: { field: "Developers", label: "Developers" },
    content: [
      { field: "Address", label: "Address" },
      { field: "Status", label: "Status" },
      { field: "Live Local Units", label: "Live Local Units" },
      { field: "Total Units", label: "Total Units" },
      { field: "Percent Live Local", label: "Percent Live Local" },
      { field: "DescriptionDisplay", label: "" }, // italic line with <br>— prefix
      { field: "Story", label: "Recent Coverage" },         // hyperlink from Recent Coverage
    ],
  };

  const isBlank = (v) => {
    if (v == null) return true;
    const s = String(v).trim();
    if (!s) return true;
    const lower = s.toLowerCase();
    return ["none", "null", "n/a", "na", "—", "-"].includes(lower);
  };

  const clean = (v) => (isBlank(v) ? "" : String(v).trim());

  window.map = trdDataCommonMap({
    filePath: "live_local.geojson",

    fetchDataFilterCallback: (data) => {
      return {
        ...data,
        features: (data.features || []).map((feature, i) => {
          const props = { ...(feature.properties || {}) };

          // Keep the raw values (Status/Units/etc.) exactly as in the GeoJSON
          // Only build two presentational fields:
          const desc = clean(props.Description);
          props.DescriptionDisplay = desc ? `<em>${desc}</em>` : "";

          const story = clean(props["Recent Coverage"]);
          props.Story = story ? `<a href="${story}" target="_blank" rel="noopener">Open story</a>` : "";

          // Normalize title key the modal reads
          props.Developers = clean(props.Developers) || clean(props.Developer) || clean(props["Developer(s)"]) || "";

          // Ensure Address stays as-is so it shows up under the label "Address"
          props.Address = clean(props.Address);

          feature.properties = props;

          // (Optional) One-time console check:
          // if (i === 0) console.log("Sample props:", feature.properties);

          return feature;
        }),
      };
    },

    // Analytics + DOM targets
    eventCategory: "live-local",
    mapElementId: "map",
    filterElementId: undefined,
    legendElementId: undefined,
    resultElementId: undefined,

    // Map view
    mapCenterLat: 25.7617,
    mapCenterLng: -80.1918,
    zoom: 7,
    minZoom: 3,

    // Modal fields we defined above
    modalDisplayFields,

    // Circle styling
    mapLayerPaint: {
      "circle-stroke-width": 2,
      "circle-stroke-color": "#f1f1f1",
    },

    // Point interaction/paint
    pointSettings: {
      clickToCenter: true,
      clickToZoom: false,
      colorType: "case",
      radiusType: "radius",
      paintSettings: {
        default: { radius: 8, color: { light: "#007cbf", dark: "#007cbf" } },
        hover:   { radius: 10, color: { light: "#007cbf", dark: "#007cbf" } },
        active:  { radius: 12, color: { light: "black",  dark: "white" } },
      },
    },
  });

  // --- Live search implementation ---
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const searchCount = document.getElementById('search-count');

  let originalFeatures = [];

  // Wait for map data to be loaded; assume trdDataCommonMap exposes a promise or event
  // If not, we poll until features available on window.map.data
  function cacheOriginal() {
    try {
      if (window.map && window.map.data && window.map.data.features && window.map.data.features.length) {
        originalFeatures = window.map.data.features.slice();
        updateCount(originalFeatures.length, originalFeatures.length);
        return true;
      }
    } catch (e) {}
    return false;
  }

  function pollForData(retries = 40) {
    if (cacheOriginal()) return;
    if (retries <= 0) return;
    setTimeout(() => pollForData(retries - 1), 250);
  }
  pollForData();

  function normalize(str) {
    return (str || '').toLowerCase();
  }

  function featureMatches(feature, query) {
    if (!query) return true;
    const props = feature.properties || {};
    const haystack = [props.Developers, props.Address, props.Status]
      .filter(Boolean)
      .map(normalize)
      .join(' | ');
    return haystack.includes(query);
  }

  function filterFeatures(query) {
    const q = normalize(query.trim());
    if (!q) return originalFeatures.slice();
    return originalFeatures.filter(f => featureMatches(f, q));
  }

  function updateCount(shown, total) {
    if (searchCount) {
      searchCount.textContent = `${shown} / ${total} shown`;
    }
  }

  function applyFilter() {
    if (!originalFeatures.length) return;
    const query = searchInput ? searchInput.value : '';
    const filtered = filterFeatures(query);
    updateCount(filtered.length, originalFeatures.length);
    // Update map source data; assume underlying map uses window.map.data
    if (window.map && window.map.setData) {
      window.map.setData({ type: 'FeatureCollection', features: filtered });
    } else if (window.map) {
      // Fallback: mutate and trigger redraw if a redraw method exists
      window.map.data.features = filtered;
      if (typeof window.map.redraw === 'function') window.map.redraw();
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyFilter);
    searchInput.addEventListener('focus', applyFilter);
  }
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      applyFilter();
      searchInput && searchInput.focus();
    });
  }
})();
