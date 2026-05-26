mapboxgl.accessToken = 'pk.eyJ1Ijoiam9zZXBoanVuZ2VybWFubjEwIiwiYSI6ImNtbzMxNjlxbDExdTgyd285eXY0YzBydzUifQ.Mnyu8AkCjlG4iCAY39JwKA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-73.97907357245502, 40.735209372386926],
  zoom: 10.1
});

let geojsonData;

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const delimiter = lines[0].includes('\t') ? '\t' : ',';

  const headers = lines[0].split(delimiter).map(h => h.trim());

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
      permits: Number(row['No. of permits']?.replaceAll(',', '')) || 0,
      added_units: Number(row['No. of added dwelling units']?.replaceAll(',', '')) || 0,
      units_per_permit: Math.round(Number(row['Dwellings added per permit']) * 10) / 10 || 0
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
            geometry: {
              type: 'Point',
              coordinates: getCentroid(geometry)
            },
            properties: {
              neighborhood_id: n.neighborhood_id,
              neighborhood: name,
              ...metrics
            }
          };
        } catch (e) {
          console.warn(`Could not parse geometry for neighborhood: ${name}`);
          return null;
        }
      })
      .filter(Boolean)
  };
}

function getCentroid(geometry) {
  let coords = [];

  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0];
  }

  if (geometry.type === 'MultiPolygon') {
    coords = geometry.coordinates.flat(2);
  }

  const lng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
  const lat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;

  return [lng, lat];
}

function renderBubbleLegend() {
  const legend = document.getElementById('legend');

  legend.innerHTML = `
    <div class="legend-title">Added dwelling units</div>

    <svg width="190" height="105" viewBox="0 0 190 105">
      <circle cx="48" cy="58" r="40" fill="rgba(32,132,254,0.25)" stroke="#999" stroke-width="1.5"></circle>
      <circle cx="48" cy="72" r="26" fill="rgba(32,132,254,0.25)" stroke="#999" stroke-width="1.5"></circle>
      <circle cx="48" cy="84" r="14" fill="rgba(32,132,254,0.25)" stroke="#999" stroke-width="1.5"></circle>

      <line x1="88" y1="18" x2="122" y2="18" stroke="#999" stroke-width="1" stroke-dasharray="3 3"></line>
      <line x1="74" y1="46" x2="122" y2="46" stroke="#999" stroke-width="1" stroke-dasharray="3 3"></line>
      <line x1="62" y1="70" x2="122" y2="70" stroke="#999" stroke-width="1" stroke-dasharray="3 3"></line>

      <text x="130" y="22" font-size="13" fill="#333">3,300</text>
      <text x="130" y="50" font-size="13" fill="#333">1,000</text>
      <text x="130" y="74" font-size="13" fill="#333">200</text>
    </svg>
  `;
}

Promise.all([
  fetch('data/all_nabes.json').then(res => res.json()),
  fetch('data/NYC_redev_neighborhoods.csv').then(res => res.text())
])
.then(([rawNeighborhoods, csvText]) => {
  const csvRows = parseCSV(csvText);
  geojsonData = buildGeoJSON(rawNeighborhoods, csvRows);

  console.log('Bubble features:', geojsonData.features.length, geojsonData.features);

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
        'fill-color': '#d9d9d9',
        'fill-opacity': 0.25
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
      id: 'redevelopment-bubbles',
      type: 'circle',
      source: 'neighborhoods',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'added_units'],
          0, 3,
          50, 8,
          200, 16,
          1000, 28,
          3300, 45
        ],
        'circle-color': '#2084FE',
        'circle-opacity': 0.65,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5
      }
    });
  });

  renderBubbleLegend();

  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
  });

  map.on('mousemove', 'redevelopment-bubbles', e => {
    map.getCanvas().style.cursor = 'pointer';

    const props = e.features[0].properties;

    popup
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="tooltip">
          <strong>${props.neighborhood}</strong><br/>
          Added dwelling units: <strong>${Number(props.added_units).toLocaleString()}</strong><br/>
          Permits: <strong>${Number(props.permits).toLocaleString()}</strong><br/>
          Dwellings per permit: <strong>${props.units_per_permit}</strong>
        </div>
      `)
      .addTo(map);
  });

  map.on('mouseleave', 'redevelopment-bubbles', () => {
    map.getCanvas().style.cursor = '';
    popup.remove();
  });
})
.catch(error => console.error('Error loading map data:', error));