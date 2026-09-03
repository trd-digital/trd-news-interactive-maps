mapboxgl.accessToken = 'pk.eyJ1Ijoiam9zZXBoanVuZ2VybWFubjEwIiwiYSI6ImNtbzMxNjlxbDExdTgyd285eXY0YzBydzUifQ.Mnyu8AkCjlG4iCAY39JwKA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-73.88415958341855, 40.68450921866696],
  zoom: 10.1
});

let currentYear = '2025';
let geojsonData;

const volumeStops = [
  [15000000, '#dcebff'],
  [50000000, '#b8d7ff'],
  [100000000, '#8fc0ff'],
  [200000000, '#5fa5ff'],
  [350000000, '#2084FE'],
  [550000000, '#005ed1']
];

function parseMoney(value) {
  return Number(
    String(value || '')
      .replaceAll('$', '')
      .replaceAll(',', '')
      .trim()
  ) || 0;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);

  const delimiter = lines[0].includes('\t') ? '\t' : ',';

  const headers = lines[0]
    .split(delimiter)
    .map(h => h.trim());

  return lines.slice(1).map(line => {
    const cols = delimiter === '\t'
      ? line.split('\t')
      : line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];

    const row = {};

    headers.forEach((header, i) => {
      row[header] = cols[i]?.replaceAll('"', '').trim();
    });

    return row;
  });
}

function buildGeoJSON(rawNeighborhoods, csvRows) {
  const dataMap = new Map();

  csvRows.forEach(row => {
    const name = row['Neighborhood']?.trim();

    if (!name) return;

    dataMap.set(name, {
      deals_2024: Number(row['No. of Off Market Deals 2024']) || 0,
      volume_2024: parseMoney(row['Off-Market Volume 2024']),
      deals_2025: Number(row['No. of Off Market Deals 2025']) || 0,
      volume_2025: parseMoney(row['Off-Market Volume 2025']),
      yoy_change: row['YoY % Change Off-Market Volume'] || ''
    });
  });

  return {
  type: 'FeatureCollection',
  features: rawNeighborhoods
    .filter(n => dataMap.has(n.name_?.trim()))
    .map(n => {
      const name = n.name_?.trim();

      try {
        const geometry = JSON.parse(n.geom);
        const metrics = dataMap.get(name);

        return {
          type: 'Feature',
          geometry,
          properties: {
            neighborhood_id: n.neighborhood_id,
            neighborhood: name,
            ...metrics
          }
        };
      } catch (e) {
        console.warn(
          `Could not parse geometry for neighborhood: ${name}`
        );

        return null;
      }
    })
    .filter(Boolean)
   } // remove nulls from failed parses
};

function getFillColorExpression(year) {
  const prop = `volume_${year}`;

  return [
    'interpolate',
    ['linear'],
    ['get', prop],
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

function renderLegend() {
  const legend = document.getElementById('legend');

  legend.innerHTML = `
  <div class="legend-title">Off-Market Volume</div>

  <div class="year-toggle">
    <button class="${currentYear === '2024' ? 'active' : ''}" data-year="2024">2024</button>
    <button class="${currentYear === '2025' ? 'active' : ''}" data-year="2025">2025</button>
  </div>

  ${volumeStops.map(([value, color], i) => {

    const next = volumeStops[i + 1]?.[0];

    let label;

    if (next) {
      label = `$${(value / 1000000).toFixed(0)}M – $${(next / 1000000).toFixed(0)}M`;
    } else {
      label = `$${(value / 1000000).toFixed(0)}M+`;
    }

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

    // Update active button
    legend
      .querySelector('button.active')
      .classList.remove('active');

    button.classList.add('active');

    // Update map
    map.setPaintProperty(
      'neighborhood-fill',
      'fill-color',
      getFillColorExpression(currentYear)
    );
  });
});
}

Promise.all([
  fetch('data/all_nabes.json').then(res => res.json()),
  fetch('data/nb_off_market_volume.csv').then(res => res.text())
])
.then(([rawNeighborhoods, csvText]) => {
  const csvRows = parseCSV(csvText);
  geojsonData = buildGeoJSON(rawNeighborhoods, csvRows);

  map.on('load', () => {
    map.addSource('neighborhoods', {
      type: 'geojson',
      data: geojsonData
    });

    map.addLayer({
      id: 'neighborhood-fill',
      type: 'fill',
      source: 'neighborhoods',
      paint: {
        'fill-color': getFillColorExpression(currentYear),
        'fill-opacity': 0.85
      }
    });

    map.addLayer({
      id: 'neighborhood-outline',
      type: 'line',
      source: 'neighborhoods',
      paint: {
        'line-color': '#ffffff',
        'line-width': 1
      }
    });

    map.addLayer({
      id: 'neighborhood-hover-outline',
      type: 'line',
      source: 'neighborhoods',
      paint: {
        'line-color': '#111111',
        'line-width': 2.5
      },
      filter: ['==', ['get', 'neighborhood'], '']
    });

    renderLegend();
  });

  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
  });

  map.on('mousemove', 'neighborhood-fill', e => {
    map.getCanvas().style.cursor = 'pointer';

    const props = e.features[0].properties;
    const volume = props[`volume_${currentYear}`];
    const deals = props[`deals_${currentYear}`];

    map.setFilter('neighborhood-hover-outline', [
      '==',
      ['get', 'neighborhood'],
      props.neighborhood
    ]);

    popup
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="tooltip">
          <strong>${props.neighborhood}</strong><br/>
          Year: <strong>${currentYear}</strong><br/>
          Off-market volume: <strong>${formatMoney(volume)}</strong><br/>
          Off-market deals: <strong>${Number(deals).toLocaleString()}</strong><br/>
          YoY volume change: <strong>${props.yoy_change}</strong>
        </div>
      `)
      .addTo(map);
  });

  map.on('mouseleave', 'neighborhood-fill', () => {
    map.getCanvas().style.cursor = '';
    popup.remove();

    map.setFilter('neighborhood-hover-outline', [
      '==',
      ['get', 'neighborhood'],
      ''
    ]);
  });
})
.catch(error => console.error('Error loading map data:', error));
