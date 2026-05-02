mapboxgl.accessToken = 'pk.eyJ1Ijoiam9zZXBoanVuZ2VybWFubjEwIiwiYSI6ImNtbzMxNjlxbDExdTgyd285eXY0YzBydzUifQ.Mnyu8AkCjlG4iCAY39JwKA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-73.96672791115087, 40.78112598100184],
  zoom: 10.8
});

Promise.all([
  fetch('data/nb_names.json').then(res => res.json()),
  fetch('data/brokerage_nb_market_share.csv').then(res => res.text())
])
.then(([geojson, csvText]) => {

// Navicat exported the GeoJSON as a string inside [{ geojson: "..." }]
if (Array.isArray(geojson) && geojson[0]?.geojson) {
  geojson = JSON.parse(geojson[0].geojson);
} else if (typeof geojson.geojson === "string") {
  geojson = JSON.parse(geojson.geojson);
} else if (geojson.geojson) {
  geojson = geojson.geojson;
}

  const rows = csvText.trim().split('\n').slice(1);
  const dataMap = new Map();

  rows.forEach(row => {
    const cols = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
    if (!cols) return;

    const neighborhood = cols[0]?.replaceAll('"', '').trim();
    const firm = cols[1]?.replaceAll('"', '').trim();
    const totalSalesVolume = cols[2]?.replaceAll('"', '').trim();
    const numberOfDeals = cols[3]?.replaceAll('"', '').trim();
    const marketShare = parseFloat(
    cols[4]?.replaceAll('"', '').replace('%', '').trim()
) / 100;

    if (neighborhood && firm && !isNaN(marketShare)) {
        dataMap.set(neighborhood, {
            dominant_firm: firm,
            total_sales_volume: totalSalesVolume,
            number_of_deals: numberOfDeals,
            market_share: marketShare
        });
    }
  });

  geojson.features = geojson.features
    .filter(f => dataMap.has(f.properties.neighborhood.trim()))
    .map(f => {
      const name = f.properties.neighborhood.trim();
      const match = dataMap.get(name);

      f.properties = {
        ...f.properties,
        ...match
      };

      return f;
    });

  map.on('load', () => {
  map.addSource('neighborhoods', {
    type: 'geojson',
    data: geojson
  });

  map.addLayer({
    id: 'neighborhood-fill',
    type: 'fill',
    source: 'neighborhoods',
    paint: {
      'fill-color': [
        'match',
        ['get', 'dominant_firm'],
        'Compass', '#2084FE',
        'Corcoran Group', '#F58220',
        'Douglas Elliman', '#1FA187',
        "Sotheby's International Realty", '#D93A49',
        'Brown Harris Stevens', '#E3B505',
        '#e6e6e6'
      ],
      'fill-opacity': [
        'interpolate',
        ['linear'],
        ['get', 'market_share'],
        0.2, 0.25,
        0.3, 0.45,
        0.4, 0.65,
        0.5, 0.85,
        0.6, 1
      ]
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
  filter: ['==', 'neighborhood', '']
});
});

const firms = [
  { name:'Compass'},
  { name:'Corcoran Group'},
  { name:'Douglas Elliman'},
  { name:"Sotheby's International Realty"},
  { name:'Brown Harris Stevens'}
];

let selectedFirms = firms.map(f => f.name);

const legend = document.getElementById('legend');

firms.forEach(firm => {
  const item = document.createElement('div');
  item.className = 'legend-item';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = true;
  checkbox.value = firm.name;

  checkbox.addEventListener('change', () => {
    selectedFirms = Array.from(
      legend.querySelectorAll('input:checked')
    ).map(el => el.value);

    map.setFilter('neighborhood-fill', [
      'in',
      ['get', 'dominant_firm'],
      ['literal', selectedFirms]
    ]);
  });

  const colorBox = document.createElement('div');
  colorBox.className = 'legend-color';
  colorBox.style.backgroundColor = firm.color;

  const label = document.createElement('label');
  label.textContent = firm.name;

  item.appendChild(checkbox);
  item.appendChild(colorBox);
  item.appendChild(label);

  legend.appendChild(item);
});

const popup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false
});

map.on('mousemove', 'neighborhood-fill', (e) => {
  map.getCanvas().style.cursor = 'pointer';

  const props = e.features[0].properties;

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
        Brokerage: <strong>${props.dominant_firm}</strong><br/>
        Total sales volume: <strong>${props.total_sales_volume}</strong><br/>
        Number of deals: <strong>${props.number_of_deals}</strong><br/>
        Market share: <strong>${(Number(props.market_share) * 100).toFixed(1)}%</strong>
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

});
