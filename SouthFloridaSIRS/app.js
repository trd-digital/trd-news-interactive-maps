(() => {
  /**
   * South Florida SIRS Interactive
   * Loads data from data.csv, converts to GeoJSON and initializes map with search & modal.
   * Mirrors functionality & style of sample.js.
   */

  // --- CSV to GeoJSON conversion ---
  function parseCSV(text) {
    // Simple CSV parser handling quoted fields with commas.
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const header = lines[0].split(',');
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cols = splitCSVLine(line);
      if (!cols.length) continue;
      const obj = {};
      header.forEach((h, idx) => { obj[h.trim()] = (cols[idx] || '').replace(/^"|"$/g, '').trim(); });
      rows.push(obj);
    }
    return rows;
  }

  function splitCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i+1] === '"') { // escaped quote
          cur += '"';
          i++; // skip next
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  }

  function rowsToGeoJSON(rows) {
    const features = [];
    rows.forEach(r => {
      const lat = parseFloat(r.__lat);
      const lon = parseFloat(r.__lon);
      if (isNaN(lat) || isNaN(lon)) return; // skip invalid
      const props = { ...r };
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: props
      });
    });
    return { type: 'FeatureCollection', features };
  }

  function isBlank(v) {
    if (v == null) return true;
    const s = String(v).trim();
    if (!s) return true;
    const lower = s.toLowerCase();
    return ['none', 'null', 'n/a', 'na', '—', '-'].includes(lower);
  }
  const clean = v => isBlank(v) ? '' : String(v).trim();

  // --- Modal display configuration ---
  const modalDisplayFields = {
    title: { field: 'Project Name', label: 'Project Name' },
    content: [
      { field: 'Association Name', label: 'Association' },
      { field: 'Project Type', label: 'Type' },
      { field: 'Address', label: 'Address' },
      { field: 'City', label: 'City' },
      { field: 'County', label: 'County' },
      { field: 'Zip', label: 'Zip' },
    ],
  };

  // --- Search configuration ---
  const suggestionFields = ['Project Name', 'Association Name', 'Address', 'City', 'County'];
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

  // --- Fetch CSV, build GeoJSON, create object URL and init map ---
  function init() {
    fetch('data.csv')
      .then(r => r.text())
      .then(text => {
        const rows = parseCSV(text);
        const geo = rowsToGeoJSON(rows);

        // Build object URL so library can fetch like a normal file
        const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(geo)], { type: 'application/json' }));

        window.map = trdDataCommonMap({
          filePath: blobUrl,
          fetchDataFilterCallback: (data) => {
            // Clean in callback to keep contract similar to sample.js
            if (data && data.features) {
              data.features.forEach(f => {
                const p = f.properties;
                p['Project Name'] = clean(p['Project Name']);
                p['Association Name'] = clean(p['Association Name']);
                p['Address'] = clean(p['Address']);
                p['City'] = clean(p['City']);
                p['County'] = clean(p['County']);
                p['Project Type'] = clean(p['Project Type']);
              });
            }
            return data;
          },
          eventCategory: 'south-florida-sirs',
          mapElementId: 'map',
          modalDisplayFields,
          mapCenterLat: 26.1,
          mapCenterLng: -80.2,
          zoom: 7,
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
      .catch(err => { console.error('Failed to load CSV', err); });
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
