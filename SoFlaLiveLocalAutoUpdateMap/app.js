(() => {
  /**
   * Live Local Map Script
  * Search & Autocomplete (2025-10-30):
  * - Top-centered box (#search-input) filters features by Developers, Address, Status.
  * - Autocomplete suggestions (listbox) appear after typing; keyboard nav (↑/↓/Enter/Esc) supported.
  * - Selection zooms to point and attempts to open detail modal.
  * - Directly fetches live_local.geojson for independent autocomplete dataset (removes polling race).
  * - ARIA attributes added for accessibility: role=listbox, role=option, aria-selected, aria-expanded.
  * - Count of visible features updated dynamically (#search-count).
  * - Map dataset updated via map.setData if available; fallback to mutate and redraw.
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
  let suggestionFeatures = []; // cache for quick lookup
  let activeSuggestionIndex = -1;
  const suggestionsEl = document.getElementById('search-suggestions');

  /** Autocomplete configuration */
  const suggestionFields = ['Developers', 'Address', 'Status'];
  const maxSuggestions = 30;

  // Fetch geojson directly for autocomplete to avoid timing issues
  fetch('live_local.geojson')
    .then(r => r.json())
    .then(json => {
      originalFeatures = (json.features || []).map(f => ({ ...f }));
      updateCount(originalFeatures.length, originalFeatures.length);
      // If user typed before data loaded, rebuild suggestions
      if (searchInput && searchInput.value.trim()) {
        applyFilter();
      }
    })
    .catch(err => console.error('Autocomplete data fetch failed', err));

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
    // Update map data if API available
    if (window.map && window.map.setData) {
      window.map.setData({ type: 'FeatureCollection', features: filtered });
    } else if (window.map && window.map.data && Array.isArray(window.map.data.features)) {
      window.map.data.features = filtered;
      if (typeof window.map.redraw === 'function') window.map.redraw();
    }

    buildSuggestions(query, filtered);
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyFilter);
    searchInput.addEventListener('focus', applyFilter);
    searchInput.addEventListener('keydown', handleKeyDown);
  }
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      applyFilter();
      searchInput && searchInput.focus();
    });
  }

  // --- Autocomplete Suggestions ---
  function buildSuggestions(rawQuery, filteredSet) {
    if (!suggestionsEl) return;
    const q = rawQuery.trim().toLowerCase();
    if (!q) {
      hideSuggestions();
      return;
    }

    // Collect unique suggestion strings tied to feature index
    const seen = new Set();
    const items = [];
    filteredSet.some((feature, idx) => {
      const props = feature.properties || {};
      suggestionFields.forEach(field => {
        const value = props[field];
        if (!value) return;
        const lower = String(value).toLowerCase();
        if (lower.includes(q) && !seen.has(lower)) {
          seen.add(lower);
          items.push({ label: String(value), featureIndex: originalFeatures.indexOf(feature) });
        }
      });
      return items.length >= maxSuggestions; // stop early if reached limit
    });

    if (!items.length) {
      suggestionsEl.innerHTML = `<li class="list-group-item text-muted small">No matches</li>`;
      suggestionsEl.style.display = 'block';
      activeSuggestionIndex = -1;
      suggestionFeatures = [];
      return;
    }

    suggestionFeatures = items;
    activeSuggestionIndex = -1;
    suggestionsEl.innerHTML = items
      .map((item, i) => `<li class="list-group-item list-group-item-action" role="option" aria-selected="${i===activeSuggestionIndex}" data-index="${i}">${highlightMatch(item.label, q)}</li>`)
      .join('');
    suggestionsEl.style.display = 'block';
    if (searchInput) searchInput.setAttribute('aria-expanded', 'true');
  }

  function highlightMatch(label, query) {
    const idx = label.toLowerCase().indexOf(query);
    if (idx === -1) return label;
    return label.substring(0, idx) + '<strong>' + label.substring(idx, idx + query.length) + '</strong>' + label.substring(idx + query.length);
  }

  function hideSuggestions() {
    if (suggestionsEl) {
      suggestionsEl.style.display = 'none';
      suggestionsEl.innerHTML = '';
    }
    activeSuggestionIndex = -1;
    suggestionFeatures = [];
    if (searchInput) searchInput.setAttribute('aria-expanded', 'false');
  }

  // Keyboard navigation for suggestions
  function handleKeyDown(e) {
    if (suggestionsEl.style.display !== 'block') return;
    const total = suggestionFeatures.length;
    if (!total) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex + 1) % total;
      updateActiveSuggestion();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex - 1 + total) % total;
      updateActiveSuggestion();
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0) {
        e.preventDefault();
        selectSuggestion(activeSuggestionIndex);
      }
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  }

  function updateActiveSuggestion() {
    const children = suggestionsEl.querySelectorAll('li');
    children.forEach((el, i) => {
      const isActive = i === activeSuggestionIndex;
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-selected', String(isActive));
      if (isActive) {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  // Click selection
  if (suggestionsEl) {
    suggestionsEl.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-index]');
      if (!li) return;
      const idx = parseInt(li.getAttribute('data-index'), 10);
      selectSuggestion(idx);
    });
  }

  function selectSuggestion(idx) {
    const item = suggestionFeatures[idx];
    if (!item) return;
    const feature = originalFeatures[item.featureIndex];
    if (!feature) return;

    // Set input value to selection and hide suggestions
    searchInput.value = item.label;
    hideSuggestions();
    applyFilter(); // narrow to selection
    zoomToFeature(feature);
    openFeatureDetail(feature);
    trackEvent && trackEvent('autocomplete_select', item.label);
  }

  function zoomToFeature(feature) {
    try {
      const coords = feature?.geometry?.coordinates;
      if (!coords || coords.length < 2) return;
      const [lng, lat] = coords;
      const mapbox = window.map?.map || window.mapboxglMap || window.mapboxMap;
      if (!mapbox || typeof mapbox.flyTo !== 'function') return;

      const doFly = () => {
        const targetZoom = Math.max((mapbox.getZoom && mapbox.getZoom()) || 7, 13);
        mapbox.flyTo({ center: [lng, lat], zoom: targetZoom, speed: 0.9, essential: true });
        trackEvent && trackEvent('zoom_to_feature', feature.properties?.Developers || 'unknown');
        highlightFeature(feature); // highlight after fly
      };

      // Wait until style is fully loaded if not yet
      if (mapbox.loaded && !mapbox.loaded()) {
        mapbox.once('load', doFly);
      } else {
        doFly();
      }
    } catch (e) {
      console.warn('zoomToFeature failed', e);
    }
  }

  function openFeatureDetail(feature) {
    // First try provided API
    if (window.map && typeof window.map.openModal === 'function') {
      window.map.openModal(feature);
      return;
    }

    // Manual Bootstrap modal fallback (targets #modal structure in HTML)
    const modalSection = document.getElementById('modal');
    if (!modalSection) return;
    const titleEl = modalSection.querySelector('.modal-title');
    const bodyEl = modalSection.querySelector('.modal-body');
    if (!titleEl || !bodyEl) return;

    const props = feature.properties || {};
    const fields = [
      ['Address', props.Address],
      ['Status', props.Status],
      ['Live Local Units', props['Live Local Units']],
      ['Total Units', props['Total Units']],
      ['Percent Live Local', props['Percent Live Local']],
    ];
    const metaRows = fields
      .filter(([, v]) => v)
      .map(([k, v]) => `<tr><th class="pe-2 text-nowrap">${k}</th><td>${v}</td></tr>`)
      .join('');
    const description = props.Description ? `<p class="mt-3"><em>${props.Description}</em></p>` : '';
    const coverage = props['Recent Coverage'] ? `<p class="mt-2"><a href="${props['Recent Coverage']}" target="_blank" rel="noopener">Recent coverage</a></p>` : '';

    titleEl.innerHTML = props.Developers || 'Project';
    bodyEl.innerHTML = `<table class="table table-sm mb-0"><tbody>${metaRows}</tbody></table>${description}${coverage}`;

    // Activate modal using Bootstrap if available
    try {
      const modalInstance = bootstrap?.Modal?.getOrCreateInstance(modalSection);
      modalInstance && modalInstance.show();
    } catch (e) {
      modalSection.style.display = 'block';
    }
  }

  // ---- Highlight Selected Feature Overlay ----
  function ensureHighlightLayer(mapbox) {
    if (!mapbox || !mapbox.getSource) return;
    if (!mapbox.getSource('selected-point')) {
      mapbox.addSource('selected-point', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }
    if (!mapbox.getLayer('selected-point-layer')) {
      mapbox.addLayer({
        id: 'selected-point-layer',
        type: 'circle',
        source: 'selected-point',
        paint: {
          'circle-radius': 14,
          'circle-color': '#ff6600',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff'
        }
      });
    }
  }

  function highlightFeature(feature) {
    try {
      const mapbox = window.map?.map || window.mapboxglMap || window.mapboxMap;
      if (!mapbox) return;
      ensureHighlightLayer(mapbox);
      const geo = { type: 'FeatureCollection', features: [feature] };
      const src = mapbox.getSource && mapbox.getSource('selected-point');
      if (src && src.setData) {
        src.setData(geo);
        trackEvent && trackEvent('highlight_feature', feature.properties?.Developers || 'unknown');
      }
    } catch (e) {
      console.warn('highlightFeature failed', e);
    }
  }

  // Hide suggestions if clicking outside
  document.addEventListener('click', (e) => {
    if (!suggestionsEl) return;
    if (e.target === searchInput || suggestionsEl.contains(e.target)) return;
    hideSuggestions();
  });
})();
