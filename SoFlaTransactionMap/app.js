(() => {
  /**
   * South Florida Transaction Map
   * Loads data from miami_dade_output.geojson and initializes map with search & modal.
   * Mirrors functionality & style of sample.js.
   */

  // --- Modal display configuration ---
  const modalDisplayFields = {
    title: { field: 'Physical Address', label: 'Address' },
    content: [
      { field: 'Seller', label: 'Seller' },
      { field: 'Buyer', label: 'Buyer' },
      { field: 'Sale Price', label: 'Sale Price' },
      { field: 'Description', label: 'Description' },
      { field: 'Doc Type', label: 'Document Type' },
      { field: 'Date of Previous Sale', label: 'Previous Sale Date' },
      { field: 'Previous Owner Name', label: 'Previous Owner' },
      { field: 'Previous Sale Price', label: 'Previous Sale Price' },
      { field: 'Mailing Address', label: 'Mailing Address' },
      { field: 'Folio', label: 'Folio Number' },
    ],
  };

  // --- Search configuration ---
  const suggestionFields = ['Physical Address', 'Seller', 'Buyer', 'Mailing Address'];

  const maxSuggestions = 30;

  let originalFeatures = [];
  let suggestionCache = [];
  let activeSuggestionIndex = -1;
  let mapReady = false; // becomes true once window.map.data populated

  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const searchCount = document.getElementById('search-count');
  const suggestionsEl = document.getElementById('search-suggestions');

  function updateCount(shown, total) {
    if (searchCount) searchCount.textContent = `${shown} / ${total} shown`;
  }

  function normalize(str) { return (str || '').toLowerCase(); }

  function featureMatches(feature, query) {
    if (!query) return true;
    const props = feature.properties || {};
    const haystack = suggestionFields.map(f => props[f]).filter(Boolean).map(normalize).join(' | ');
    return haystack.includes(query);
  }

  function filterFeatures(query) {
    const q = normalize(query.trim());
    if (!q) return originalFeatures.slice();
    return originalFeatures.filter(f => featureMatches(f, q));
  }

  function applyFilter() {
    // Guard until map fully initialized and data cached
    if (!mapReady || !originalFeatures.length) return;
    const query = searchInput ? searchInput.value : '';
    const filtered = filterFeatures(query);
    updateCount(filtered.length, originalFeatures.length);
    if (window.map && window.map.setData) {
      window.map.setData({ type: 'FeatureCollection', features: filtered });
    } else if (window.map && window.map.data && window.map.data.features) {
      window.map.data.features = filtered;
      if (typeof window.map.redraw === 'function') window.map.redraw();
    }
    buildSuggestions(query, filtered);
  }

  function buildSuggestions(rawQuery, filteredSet) {
    if (!suggestionsEl) return;
    const q = rawQuery.trim().toLowerCase();
    if (!q) { hideSuggestions(); return; }
    const seen = new Set();
    const items = [];
    filteredSet.some(feature => {
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
      return items.length >= maxSuggestions;
    });
    if (!items.length) {
      suggestionsEl.innerHTML = '<li class="list-group-item text-muted small">No matches</li>';
      suggestionsEl.style.display = 'block';
      activeSuggestionIndex = -1;
      suggestionCache = [];
      return;
    }
    suggestionCache = items;
    activeSuggestionIndex = -1;
    suggestionsEl.innerHTML = items.map((item,i)=>`<li class="list-group-item list-group-item-action" data-index="${i}">${highlightMatch(item.label,q)}</li>`).join('');
    suggestionsEl.style.display = 'block';
  }

  function highlightMatch(label, query) {
    const idx = label.toLowerCase().indexOf(query);
    if (idx === -1) return label;
    return label.substring(0,idx) + '<strong>' + label.substring(idx, idx+query.length) + '</strong>' + label.substring(idx+query.length);
  }

  function hideSuggestions() {
    if (suggestionsEl) { suggestionsEl.style.display = 'none'; suggestionsEl.innerHTML = ''; }
    activeSuggestionIndex = -1;
    suggestionCache = [];
  }

  function handleKeyDown(e) {
    if (suggestionsEl.style.display !== 'block') return;
    const total = suggestionCache.length;
    if (!total) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex + 1) % total; updateActiveSuggestion(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex - 1 + total) % total; updateActiveSuggestion(); }
    else if (e.key === 'Enter') { if (activeSuggestionIndex >= 0) { e.preventDefault(); selectSuggestion(activeSuggestionIndex); } }
    else if (e.key === 'Escape') { hideSuggestions(); }
  }

  function updateActiveSuggestion() {
    const children = suggestionsEl.querySelectorAll('li');
    children.forEach((el,i)=>{ if (i===activeSuggestionIndex){ el.classList.add('active'); el.scrollIntoView({block:'nearest'});} else { el.classList.remove('active'); }});
  }

  function selectSuggestion(idx) {
    const item = suggestionCache[idx];
    if (!item) return;
    const feature = originalFeatures[item.featureIndex];
    if (!feature) return;
    searchInput.value = item.label;
    hideSuggestions();
    applyFilter();
    zoomToFeature(feature);
    openFeatureDetail(feature);
  }

  function zoomToFeature(feature) {
    try {
      const coords = feature.geometry && feature.geometry.coordinates;
      if (!coords || coords.length < 2) return;
      const [lon,lat] = coords;
      if (window.map && window.map.map) window.map.map.flyTo({ center: [lon, lat], zoom: 12, speed: 0.8 });
    } catch(e){}
  }

  function openFeatureDetail(feature) {
    if (window.map && typeof window.map.openModal === 'function') {
      window.map.openModal(feature);
    } else { console.log('Feature detail', feature.properties); }
  }

  if (searchInput) { searchInput.addEventListener('input', applyFilter); searchInput.addEventListener('focus', applyFilter); searchInput.addEventListener('keydown', handleKeyDown); }
  if (searchClear) { searchClear.addEventListener('click', () => { if (searchInput) searchInput.value=''; applyFilter(); searchInput && searchInput.focus(); }); }
  document.addEventListener('click', (e)=>{ if (!suggestionsEl) return; if (e.target===searchInput || suggestionsEl.contains(e.target)) return; hideSuggestions(); });
  if (suggestionsEl) { suggestionsEl.addEventListener('click', (e)=>{ const li = e.target.closest('li[data-index]'); if(!li) return; selectSuggestion(parseInt(li.getAttribute('data-index'),10)); }); }

  // --- Fetch GeoJSON and init map ---
  function init() {
    fetch('miami_dade_output.geojson')
      .then(r => r.text())
      .then(text => {
        // Replace NaN values with null to make valid JSON
        const cleanedText = text.replace(/:\s*NaN/g, ': null');
        const geo = JSON.parse(cleanedText);
        
        if (!geo || !geo.features) {
          console.error('Invalid GeoJSON format');
          return;
        }

        // Filter out features with invalid coordinates
        const validFeatures = geo.features.filter(feature => {
          if (!feature.geometry || !feature.geometry.coordinates) return false;
          const [lon, lat] = feature.geometry.coordinates;
          return lon !== null && lat !== null &&
                 !isNaN(lon) && !isNaN(lat) && 
                 Math.abs(lon) <= 180 && Math.abs(lat) <= 90;
        });

        console.log(`Loaded ${validFeatures.length} valid features out of ${geo.features.length} total`);

        const cleanedGeo = {
          type: 'FeatureCollection',
          features: validFeatures
        };

        // Build object URL so library can fetch like a normal file
        const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(cleanedGeo)], { type: 'application/json' }));

        window.map = trdDataCommonMap({
          filePath: blobUrl,
          fetchDataFilterCallback: (data) => {
            // Optional: add any data cleaning here
            return data;
          },
          eventCategory: 'south-florida-transactions',
          mapElementId: 'map',
          modalDisplayFields,
          mapCenterLat: 25.7617,
          mapCenterLng: -80.1918,
          zoom: 9,
          minZoom: 4,
          mapLayerPaint: { 'circle-stroke-width': 1.5, 'circle-stroke-color': '#f1f1f1' },
          pointSettings: {
            clickToCenter: true,
            clickToZoom: false,
            colorType: 'case',
            radiusType: 'radius',
            paintSettings: {
              default: { radius: 7, color: { light: '#007cbf', dark: '#007cbf' } },
              hover:   { radius: 9, color: { light: '#007cbf', dark: '#007cbf' } },
              active:  { radius: 11, color: { light: 'black',  dark: 'white' } },
            },
          },
        });

        // Poll until library sets map.data
        waitForMapData();
      })
      .catch(err => { console.error('Failed to load GeoJSON', err); });
  }

  function waitForMapData(retries = 40) {
    if (window.map && window.map.data && window.map.data.features) {
      originalFeatures = window.map.data.features.slice();
      mapReady = true;
      updateCount(originalFeatures.length, originalFeatures.length);
      return;
    }
    if (retries <= 0) return;
    setTimeout(() => waitForMapData(retries - 1), 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
