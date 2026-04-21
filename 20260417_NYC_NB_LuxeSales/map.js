mapboxgl.accessToken = 'pk.eyJ1Ijoiam9zZXBoanVuZ2VybWFubjEwIiwiYSI6ImNtbzMxNjlxbDExdTgyd285eXY0YzBydzUifQ.Mnyu8AkCjlG4iCAY39JwKA';

const years = [2021, 2022, 2023, 2024, 2025];
let activeYear = 2021;

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-73.98289022051313, 40.75465704314868],
  zoom: 11.5
});

map.addControl(new mapboxgl.NavigationControl(), 'top-left');

function colorExpression(year) {
  const prop = `median_price_${year}`;

  return [
    'step',
    ['coalesce', ['get', prop], 0],
    '#f7fbff', 10000000,
    '#deebf7', 12000000,
    '#c6dbef', 14000000,
    '#9ecae1', 16000000,
    '#6baed6', 18000000,
    '#3182bd', 20000000,
    '#08519c'
  ];
}

map.on('load', () => {
  map.addSource('neighborhoods', {
    type: 'geojson',
    data: neighborhoods
  });

  map.addLayer({
    id: 'neighborhood-fills',
    type: 'fill',
    source: 'neighborhoods',
    paint: {
      'fill-color': colorExpression(activeYear),
      'fill-opacity': 0.8
    }
  });

  map.addLayer({
    id: 'neighborhood-borders',
    type: 'line',
    source: 'neighborhoods',
    paint: {
      'line-color': '#ffffff',
      'line-width': 1.5
    }
  });

  map.addLayer({
    id: 'neighborhood-fills',
    type: 'fill',
    source: 'neighborhoods',
    paint: {
      'fill-color': 'red',
      'fill-opacity': 0.8
    }
  });

  map.addLayer({
    id: 'neighborhood-hover',
    type: 'line',
    source: 'neighborhoods',
    paint: {
      'line-color': '#222',
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        3,
        0
      ]
    }
  });

  let hoveredId = null;

  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
  });

  map.on('mousemove', 'neighborhood-fills', (e) => {
    map.getCanvas().style.cursor = 'pointer';

    const feature = e.features[0];

    if (hoveredId !== null) {
      map.setFeatureState(
        { source: 'neighborhoods', id: hoveredId },
        { hover: false }
      );
    }

    hoveredId = feature.id;

    map.setFeatureState(
      { source: 'neighborhoods', id: hoveredId },
      { hover: true }
    );

    const value = feature.properties[`median_price_${activeYear}`];
    const formatted = value
      ? Number(value).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0
        })
      : 'No data';

    popup
      .setLngLat(e.lngLat)
      .setHTML(`
            <div class="popup-title">${feature.properties.neighborhood}</div>
            <div><strong>${activeYear} Median Price: ${formatted}</strong></div>
          `)
      .addTo(map);
  });

  map.on('mouseleave', 'neighborhood-fills', () => {
    map.getCanvas().style.cursor = '';

    if (hoveredId !== null) {
      map.setFeatureState(
        { source: 'neighborhoods', id: hoveredId },
        { hover: false }
      );
    }

    hoveredId = null;
    popup.remove();
  });

  const slider = document.getElementById('year-slider');
  //   const yearLabel = document.getElementById('year-label');

  slider.addEventListener('input', (e) => {
    activeYear = Number(e.target.value);
    // yearLabel.textContent = activeYear;

    map.setPaintProperty(
      'neighborhood-fills',
      'fill-color',
      colorExpression(activeYear)
    );
  });
});