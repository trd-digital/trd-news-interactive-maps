mapboxgl.accessToken = 'pk.eyJ1Ijoiam9zZXBoanVuZ2VybWFubjEwIiwiYSI6ImNtbzMxNjlxbDExdTgyd285eXY0YzBydzUifQ.Mnyu8AkCjlG4iCAY39JwKA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-118.27776668111892, 34.06267082399771],
  zoom: 8.6
});

// Exact names must match leading_firm in your GeoJSON.
const firms = [
  { name: 'COMPASS', label: 'Compass', color: '#2084FE' },
  { name: 'THE AGENCY', label: 'The Agency', color: '#D66B4D' },
  {
    name: 'REMAX PREMIER PROP ARCADIA',
    label: 'RE/MAX Premier Prop Arcadia',
    color: '#8266A8'
  },
  {
    name: 'ESTATE PROPERTIES',
    label: 'Estate Properties',
    color: '#398C80'
  },
  {
    name: "VISTA SOTHEBY'S INTERNATIONAL REALTY",
    label: "Vista Sotheby's International Realty",
    color: '#C5A246'
  },
  {
    name: 'CAROLWOOD ESTATES',
    label: 'Carolwood Estates',
    color: '#B85C7C'
  }
];

const neighborhoodNames = [
  'Sherman Oaks',
  'Pacific Palisades',
  'Encino',
  'Woodland Hills',
  'Studio City',
  'Venice'
];

const firmLabels = Object.fromEntries(
  firms.map(firm => [firm.name, firm.label])
);

const fillColorExpression = [
  'match',
  ['get', 'leading_firm'],
  ...firms.flatMap(firm => [firm.name, firm.color]),
  '#BDBDBD' // Missing or unrecognized firm
];

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      })
    : 'N/A';
}

function renderLegend() {
  const legend = document.getElementById('legend');

  legend.innerHTML = `
    <div class="legend-title">Leading brokerage by sales volume</div>

    ${firms.map(firm => `
      <div class="legend-item">
        <div
          class="legend-color"
          style="background:${firm.color}"
        ></div>
        <span>${escapeHTML(firm.label)}</span>
      </div>
    `).join('')}
  `;
}

const popup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false
});

map.on('load', () => {
  map.addSource('cities', {
    type: 'geojson',
    data: 'data/la_county_cities_and_neighborhoods.geojson?v=2'
  });

  map.addLayer({
    id: 'city-fill',
    type: 'fill',
    source: 'cities',
    layout: {
      // Draw neighborhoods above the city polygons.
      'fill-sort-key': [
        'match',
        ['get', 'city'],
        neighborhoodNames,
        1,
        0
      ]
    },
    paint: {
      'fill-color': fillColorExpression,
      'fill-opacity': 0.85
    }
  });

  map.addLayer({
    id: 'city-outline',
    type: 'line',
    source: 'cities',
    paint: {
      'line-color': '#ffffff',
      'line-width': 1
    }
  });

  map.addLayer({
    id: 'city-hover-outline',
    type: 'line',
    source: 'cities',
    paint: {
      'line-color': '#111111',
      'line-width': 2.5
    },
    filter: ['==', ['get', 'city'], '']
  });

  renderLegend();

  map.on('mousemove', 'city-fill', e => {
    if (!e.features?.length) return;

    map.getCanvas().style.cursor = 'pointer';

    // Prefer the neighborhood when it overlaps Los Angeles.
    const feature = e.features.find(feature =>
      neighborhoodNames.includes(feature.properties.city)
    ) || e.features[0];

    const props = feature.properties;
    const firmLabel =
      firmLabels[props.leading_firm] || props.leading_firm || 'N/A';

    map.setFilter('city-hover-outline', [
      '==',
      ['get', 'city'],
      props.city
    ]);

    popup
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="tooltip">
          <strong>${escapeHTML(props.city)}</strong><br/>
          Leading brokerage:
          <strong>${escapeHTML(firmLabel)}</strong><br/>
          Brokerage volume:
          <strong>${formatMoney(props.volume_firm)}</strong><br/>
          Total area volume:
          <strong>${formatMoney(props.volume_city)}</strong><br/>
          Brokerage market share:
          <strong>${escapeHTML(props.percent_share || 'N/A')}</strong>
        </div>
      `)
      .addTo(map);
  });

  map.on('mouseleave', 'city-fill', () => {
    map.getCanvas().style.cursor = '';
    popup.remove();

    map.setFilter('city-hover-outline', [
      '==',
      ['get', 'city'],
      ''
    ]);
  });
});