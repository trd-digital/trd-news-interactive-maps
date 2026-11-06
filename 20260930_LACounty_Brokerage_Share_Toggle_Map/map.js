mapboxgl.accessToken = 'pk.eyJ1Ijoiam9zZXBoanVuZ2VybWFubjEwIiwiYSI6ImNtbzMxNjlxbDExdTgyd285eXY0YzBydzUifQ.Mnyu8AkCjlG4iCAY39JwKA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-118.27776668111892, 34.06267082399771],
  zoom: 8.6
});

let selectedPeriod = '2025_26';

const periods = {
  '2024_25': {
    label: '2024/25',
    firms: [
      'COMPASS',
      'CAROLWOOD ESTATES',
      'THE AGENCY',
      'REMAX PREMIER ARCADIA',
      'ESTATE PROPERTIES',
      'COLDWELL BANKER REALTY',
      'VISTA SOTHEBYS INTERNATIONAL REALTY'
    ]
  },
  '2025_26': {
    label: '2025/26',
    firms: ['COMPASS NETWORK']
  }
};

const firms = [
  { name: 'COMPASS', label: 'Compass', color: '#72B0F5' },
  {
    name: 'COMPASS NETWORK',
    label: 'Compass Network',
    color: '#2084FE'
  },
  { name: 'THE AGENCY', label: 'The Agency', color: '#D66B4D' },
  {
    name: 'REMAX PREMIER ARCADIA',
    label: 'RE/MAX Premier Properties Arcadia',
    color: '#8266A8'
  },
  {
    name: 'ESTATE PROPERTIES',
    label: 'Estate Properties',
    color: '#398C80'
  },
  {
    name: 'VISTA SOTHEBYS INTERNATIONAL REALTY',
    label: "Vista Sotheby's International Realty",
    color: '#C5A246'
  },
  {
    name: 'CAROLWOOD ESTATES',
    label: 'Carolwood Estates',
    color: '#B85C7C'
  },
  {
    name: 'COLDWELL BANKER REALTY',
    label: 'Coldwell Banker Realty',
    color: '#79502D'
  }
];

// Accept the alternative spellings used in your earlier data.
const firmAliases = {
  'REMAX PREMIER PROP ARCADIA': 'REMAX PREMIER ARCADIA',
  "VISTA SOTHEBY'S INTERNATIONAL REALTY":
    'VISTA SOTHEBYS INTERNATIONAL REALTY'
};

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

function getFillColorExpression() {
  const colorMatches = firms.flatMap(firm => [
    firm.name,
    firm.color
  ]);

  for (const [alias, name] of Object.entries(firmAliases)) {
    colorMatches.push(
      alias,
      firms.find(firm => firm.name === name).color
    );
  }

  return [
    'match',
    ['get', `leading_firm_${selectedPeriod}`],
    ...colorMatches,
    '#BDBDBD'
  ];
}

const popup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false
});

function clearHover() {
  map.getCanvas().style.cursor = '';
  popup.remove();

  map.setFilter('city-hover-outline', [
    '==',
    ['get', 'city'],
    ''
  ]);
}

function setPeriod(period) {
  if (!periods[period]) return;

  selectedPeriod = period;

  map.setPaintProperty(
    'city-fill',
    'fill-color',
    getFillColorExpression()
  );

  // Remove the previous period's popup.
  clearHover();
  const legend = document.getElementById('legend');
  const hadLegendFocus = legend.contains(document.activeElement);
  renderLegend();
  if (hadLegendFocus) {
    legend.querySelector(`[data-period="${selectedPeriod}"]`).focus();
  }
}

function renderLegend() {
  const legend = document.getElementById('legend');
  const period = periods[selectedPeriod];

  const visibleFirms = period.firms.map(name =>
    firms.find(firm => firm.name === name)
  );

  legend.innerHTML = `
    <div class="period-toggle" role="group" aria-label="Sales period">
      ${Object.entries(periods).map(([key, value]) => `
        <button
          type="button"
          class="period-button ${key === selectedPeriod ? 'active' : ''}"
          data-period="${key}"
          aria-pressed="${key === selectedPeriod}"
        >
          ${value.label}
        </button>
      `).join('')}
    </div>

    <div class="legend-title">
      Leading brokerage by sales volume · ${period.label}
    </div>

    ${visibleFirms.map(firm => `
      <div class="legend-item">
        <div
          class="legend-color"
          style="background:${firm.color}"
        ></div>
        <span>${escapeHTML(firm.label)}</span>
      </div>
    `).join('')}
  `;

  legend.querySelectorAll('[data-period]').forEach(button => {
    button.addEventListener('click', () => {
      setPeriod(button.dataset.period);
    });
  });
}

map.on('load', () => {
  map.addSource('cities', {
    type: 'geojson',
    data: 'data/la_county_cities_and_neighborhoods.geojson?v=3'
  });

  map.addLayer({
    id: 'city-fill',
    type: 'fill',
    source: 'cities',
    layout: {
      'fill-sort-key': [
        'match',
        ['get', 'city'],
        neighborhoodNames,
        1,
        0
      ]
    },
    paint: {
      'fill-color': getFillColorExpression(),
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

    const feature = e.features.find(feature =>
      neighborhoodNames.includes(feature.properties.city)
    ) || e.features[0];

    const props = feature.properties;

    // Read the selected period's fields.
    const rawFirm = props[`leading_firm_${selectedPeriod}`];
    const firm = firmAliases[rawFirm] || rawFirm;
    const firmLabel = firmLabels[firm] || firm || 'N/A';

    const firmVolume = props[`volume_firm_${selectedPeriod}`];
    const cityVolume = props[`volume_city_${selectedPeriod}`];
    const percentShare = props[`percent_share_${selectedPeriod}`];

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
          Period:
          <strong>${periods[selectedPeriod].label}</strong><br/>
          Leading brokerage:
          <strong>${escapeHTML(firmLabel)}</strong><br/>
          Brokerage volume:
          <strong>${formatMoney(firmVolume)}</strong><br/>
          Total area volume:
          <strong>${formatMoney(cityVolume)}</strong><br/>
          Brokerage market share:
          <strong>${escapeHTML(percentShare || 'N/A')}</strong>
        </div>
      `)
      .addTo(map);
  });

  map.on('mouseleave', 'city-fill', clearHover);
});