mapboxgl.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjbDZoMTNpNDYwMW1lM2NyeG0wdm80OWFzIn0.aOdBF7K4eHzAelsBIy52lQ';
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/trddata/cl6h00632006t14o08g2ppqvj',
    zoom: 8.5,
    center: [-80.2, 25.75]
});

// const search = new MapboxSearchBox();
// search.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjbDZoMTNpNDYwMW1lM2NyeG0wdm80OWFzIn0.aOdBF7K4eHzAelsBIy52lQ';
// map.addControl(search);

map.on('load', function () {
    let layers = map.getStyle().layers;
    let firstSymbolId;
  
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].type === 'symbol') {
        firstSymbolId = layers[i].id;
        break;
      }
    }
  
    map.addSource('agri_data_source', {
      type: 'geojson',
      data: 'data/MD_agri.geojson'
    });
  
    map.addLayer({
      id: 'agri_data',
      type: 'fill',
      source: 'agri_data_source',
      paint: {
        'fill-color': '#FF0000',
        'fill-outline-color': '#00FFFF',
        'fill-opacity': 0.7
      }
    }, firstSymbolId);

  // Add event listener to the search button
  document.getElementById('search-button').addEventListener('click', function () {
    var address = document.getElementById('search-input').value;

    // Use the Mapbox Geocoding API to geocode the address
    var geocodeUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' + encodeURIComponent(address) + '.json?access_token=pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjbGM3c2NkaW40ZXhyM3Fwbm90NTNhMDVpIn0.pUxun7fhoJsjW9BUNB8UkQ';

    fetch(geocodeUrl)
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (data.features.length > 0) {
          // Retrieve the coordinates of the first result
          var coordinates = data.features[0].geometry.coordinates;

          // Zoom the map to the entered address
          map.flyTo({
            center: coordinates,
            zoom: 14
          });
        } else {
          console.log('No results found');
        }
      })
      .catch(function (error) {
        console.log('Error:', error);
      });
  });

// Add event listener to the search input
document.getElementById('search-input').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent form submission
  
      var address = document.getElementById('search-input').value;
  
      // Use the Mapbox Geocoding API to geocode the address
      var geocodeUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' + encodeURIComponent(address) + '.json?access_token=pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjbGM3c2NkaW40ZXhyM3Fwbm90NTNhMDVpIn0.pUxun7fhoJsjW9BUNB8UkQ';
  
      fetch(geocodeUrl)
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          if (data.features.length > 0) {
            // Retrieve the coordinates of the first result
            var coordinates = data.features[0].geometry.coordinates;
  
            // Zoom the map to the entered address
            map.flyTo({
              center: coordinates,
              zoom: 12
            });
          } else {
            console.log('No results found');
          }
        })
        .catch(function (error) {
          console.log('Error:', error);
        });
    }
  });
  });
  
  // Create the popup
  map.on('click', 'agri_data', function (e) {
    let address = e.features[0].properties.TRUE_SITE_ADDR;
    let folio = e.features[0].properties.FOLIO;
    let zone = e.features[0].properties.DOR_DESC;
  
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML('<h2>' + address + '</h2>'
        + '<strong>folio:</strong> ' + folio + '<br>'
        + '<strong>Zone Description:</strong> ' + zone)
      .addTo(map);
  });
  
  // Change the cursor to a pointer when the mouse is over the arch_data layer.
  map.on('mouseenter', 'agri_data', function () {
    map.getCanvas().style.cursor = 'pointer';
  });
  
  // Change it back to the default cursor when it leaves.
  map.on('mouseleave', 'agri_data', function () {
    map.getCanvas().style.cursor = '';
  });