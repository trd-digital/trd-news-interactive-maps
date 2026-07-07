mapboxgl.accessToken = 'pk.eyJ1Ijoiam9zZXBoanVuZ2VybWFubjEwIiwiYSI6ImNtbzMxNjlxbDExdTgyd285eXY0YzBydzUifQ.Mnyu8AkCjlG4iCAY39JwKA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-122.15, 37.55],
  zoom: 8.6
});

let currentYear = '2025/26';

const volumeStops = [
  [18000000, '#dcebff'],
  [50000000, '#b8d7ff'],
  [100000000, '#8fc0ff'],
  [250000000, '#5fa5ff'],
  [500000000, '#2084FE'],
  [1000000000, '#005ed1']
];

function getFillColorExpression(year) {
  const prop = `volume_${year}`;

  return [
    'interpolate',
    ['linear'],
    ['coalesce', ['get', prop], 0],
    volumeStops[0][0], volumeStops[0][1],
    volumeStops[1][0], volumeStops[1][1],
    volumeStops[2][0], volumeStops[2][1],
    volumeStops[3][0], volumeStops[3][1],
    volumeStops[4][0], volumeStops[4][1],
    volumeStops[5][0], volumeStops[5][1]
  ];
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function formatAmount(value) {
  return value >= 1000000000
    ? `$${value / 1000000000}B`
    : `$${value / 1000000}M`;
}

function renderLegend() {
  const legend = document.getElementById('legend');

  legend.innerHTML = `
    <div class="legend-title">Off-Market Volume</div>

    <div class="year-toggle">
      <button class="${currentYear === '2024/25' ? 'active' : ''}" data-year="2024/25">2024/25</button>
      <button class="${currentYear === '2025/26' ? 'active' : ''}" data-year="2025/26">2025/26</button>
    </div>

    ${volumeStops.map(([value, color], i) => {
      const next = volumeStops[i + 1]?.[0];
      const label = next
        ? `${formatAmount(value)} – ${formatAmount(next)}`
        : `${formatAmount(value)}+`;

      return `
        <div class="legend-item">
          <div class="legend-color" style="background:${color}"></div>
          <span>${label}</span>
        </div>
      `;
    }).join('')}
  `;

  legend.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      currentYear = button.dataset.year;

      legend.querySelector('button.active').classList.remove('active');
      button.classList.add('active');

      map.setPaintProperty(
        'city-fill',
        'fill-color',
        getFillColorExpression(currentYear)
      );
    });
  });
}

map.on('load', () => {
  map.addSource('cities', {
  type: 'geojson',
  data: 'data/bay_area_cities.geojson?v=4'
});

  map.addLayer({
    id: 'city-fill',
    type: 'fill',
    source: 'cities',
    paint: {
      'fill-color': getFillColorExpression(currentYear),
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
});

const popup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false
});

map.on('mousemove', 'city-fill', e => {
  map.getCanvas().style.cursor = 'pointer';

  const props = e.features[0].properties;
  const volume = props[`volume_${currentYear}`];
  const deals = props[`deals_${currentYear}`];

  map.setFilter('city-hover-outline', [
    '==',
    ['get', 'city'],
    props.city
  ]);

  popup
    .setLngLat(e.lngLat)
    .setHTML(`
      <div class="tooltip">
        <strong>${props.city}</strong><br/>
        Year: <strong>${currentYear}</strong><br/>
        Off-market volume: <strong>${formatMoney(volume)}</strong><br/>
        Off-market deals: <strong>${Number(deals || 0).toLocaleString()}</strong><br/>
        YoY volume change: <strong>${props.yoy_change || 'N/A'}</strong>
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
