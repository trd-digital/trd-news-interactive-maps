mapboxgl.accessToken = 'pk.eyJ1Ijoiam9zZXBoanVuZ2VybWFubjEwIiwiYSI6ImNtbzMxNjlxbDExdTgyd285eXY0YzBydzUifQ.Mnyu8AkCjlG4iCAY39JwKA';

// --------------------------------------------
// 1. MAP SETUP
// --------------------------------------------

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-73.88415958341855, 40.68450921866696],
  zoom: 10.1
});

map.addControl(
  new mapboxgl.NavigationControl(),
  'top-right'
);


// --------------------------------------------
// 2. LOAD DATA AND ADD MAP LAYERS
// --------------------------------------------

map.on('load', () => {
  map.addSource('cannabis-stores', {
    type: 'geojson',
    data: 'data/cannabis_retail_historical_analysis.geojson'
  });

  map.addLayer({
    id: 'cannabis-store-points',
    type: 'circle',
    source: 'cannabis-stores',

    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        9, 3,
        12, 5,
        15, 8
      ],

      'circle-color': '#2f7d59',
      'circle-opacity': 0.85,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1
    }
  });
});


// --------------------------------------------
// 3. POPUP
// --------------------------------------------

const popup = new mapboxgl.Popup({
  closeButton: true,
  closeOnClick: true,
  maxWidth: '320px',
  offset: 10
});

map.on('click', 'cannabis-store-points', event => {
  const feature = event.features[0];
  const properties = feature.properties;
  const coordinates = feature.geometry.coordinates.slice();

  const cannabisStartDate = formatMonthYear(
    properties.cannabis_start_date
  );

  const previousCategory =
  (properties.previous_category || '').trim() || 'N/A';

const previousTenantEnd =
  formatMonthYear(properties.previous_tenant_end) || 'N/A';

  const popupHtml = `
    <div class="tenant-popup">

    <div class="popup-row">
        <span class="popup-label">Dispensary:</span>
        <span class="popup-value">${escapeHtml(properties.cannabis_store_name)}</span>
    </div>

    <div class="popup-row">
        <span class="popup-label">Address:</span>
        <span class="popup-value">${escapeHtml(properties.address)}</span>
    </div>

    <div class="popup-row">
        <span class="popup-label">Neighborhood:</span>
        <span class="popup-value">${escapeHtml(properties.neighborhood)}</span>
    </div>

    <div class="popup-row">
        <span class="popup-label">Operation start date:</span>
        <span class="popup-value">${cannabisStartDate}</span>
    </div>

    <hr>

    <div class="popup-row">
        <span class="popup-label">Previous tenant:</span>
        <span class="popup-value">${escapeHtml(properties.previous_tenant_name)}</span>
    </div>

    <div class="popup-row">
        <span class="popup-label">Category:</span>
        <span class="popup-value">${escapeHtml(previousCategory)}</span>
    </div>

    <div class="popup-row">
        <span class="popup-label">Last recorded date:</span>
        <span class="popup-value">${previousTenantEnd}</span>
    </div>
    </div>
  `;

  popup
    .setLngLat(coordinates)
    .setHTML(popupHtml)
    .addTo(map);
});


// --------------------------------------------
// 4. CURSOR INTERACTIONS
// --------------------------------------------

map.on('mouseenter', 'cannabis-store-points', () => {
  map.getCanvas().style.cursor = 'pointer';
});

map.on('mouseleave', 'cannabis-store-points', () => {
  map.getCanvas().style.cursor = '';
});


// --------------------------------------------
// 5. HELPER FUNCTIONS
// --------------------------------------------

function formatMonthYear(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}