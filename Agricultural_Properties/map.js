document.addEventListener('DOMContentLoaded', function () {
    mapboxgl.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjbDZoMTNpNDYwMW1lM2NyeG0wdm80OWFzIn0.aOdBF7K4eHzAelsBIy52lQ';
    var map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/trddata/cl6h00632006t14o08g2ppqvj',
        zoom: 8.5,
        center: [-80.2, 25.75]
    });

    var marker = null; // Declare the marker variable

    map.on('load', function () {
        // Add the geojson source and layer
        map.addSource('MD_agri_data_source', {
            type: 'geojson',
            data: 'data/MD_agri.geojson'
        });

        map.addLayer({
            id: 'MD_agri_data',
            type: 'fill',
            source: 'MD_agri_data_source',
            paint: {
                'fill-color': '#FF0000',
                'fill-outline-color': '#00FFFF',
                'fill-opacity': 0.7
            }
        });

        map.addSource('PB_agri_data_source', {
            type: 'geojson',
            data: 'data/PB_agri.geojson'
        });

        map.addLayer({
            id: 'PB_agri_data',
            type: 'circle',
            source: 'PB_agri_data_source',
            paint: {
              'circle-color': '#FF0000',
              'circle-stroke-color': '#00FFFF',
              'circle-stroke-width': 1,
              'circle-opacity': 0.7
            }
        })

        map.addSource('BC_agri_data_source', {
            type: 'geojson',
            data: 'data/BC_agri.geojson'
        });

        map.addLayer({
            id: 'BC_agri_data',
            type: 'fill',
            source: 'BC_agri_data_source',
            paint: {
                'fill-color': '#FF0000',
                'fill-outline-color': '#00FFFF',
                'fill-opacity': 0.7
            }
        });
    });

  // Add event listener to the search form
  document.getElementById('search-form').addEventListener('submit', function (event) {
    event.preventDefault(); // Prevent form submission

    var address = document.getElementById('search-input').value;

    // Use the Mapbox Geocoding API to geocode the address
    var geocodeUrl =
      'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
      encodeURIComponent(address) +
      '.json?access_token=pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjbGM3c2NkaW40ZXhyM3Fwbm90NTNhMDVpIn0.pUxun7fhoJsjW9BUNB8UkQ' +
      '&bbox=-80.88,25.13,-79.80,27.285463566072305'; // Bounding box coordinates (lon, lat, lon, lat)
    //   '&proximity=-80.2,25.75'; // Proximity bias coordinates (lon, lat) 

    fetch(geocodeUrl)
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (data.features.length > 0) {
          var coordinates = data.features[0].geometry.coordinates;

        // Remove the previous marker if it exists
        if (marker) {
            marker.remove();
          }

        // Create a marker at the geocoded coordinates
        marker = new mapboxgl.Marker()
        .setLngLat(coordinates)
        .addTo(map);

          // Zoom the map to the entered address
          map.flyTo({
            center: coordinates,
            zoom: 17
          });
        } else {
          console.log('No results found');
        }
      })
      .catch(function (error) {
        console.log('Error:', error);
      });
  });

    // Add event listener to remove the marker when the map is clicked
    map.on('click', function () {
        if (marker) {
        marker.remove();
        }
    });

    // Change the cursor to a pointer when the mouse is over the MD_agri_data layer.
    map.on('mouseenter', 'MD_agri_data', function () {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseenter', 'PB_agri_data', function () {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseenter', 'BC_agri_data', function () {
        map.getCanvas().style.cursor = 'pointer';
    });

    // Change it back to the default cursor when it leaves.
    map.on('mouseleave', 'MD_agri_data', function () {
        map.getCanvas().style.cursor = '';
    });

    // Change it back to the default cursor when it leaves.
    map.on('mouseleave', 'PB_agri_data', function () {
        map.getCanvas().style.cursor = '';
    });

    // Change it back to the default cursor when it leaves.
    map.on('mouseleave', 'BC_agri_data', function () {
        map.getCanvas().style.cursor = '';
    });

    // Create the popup
    map.on('click', 'MD_agri_data', function (e) {
        let address = e.features[0].properties.TRUE_SITE_ADDR;
        let folio = e.features[0].properties.FOLIO;
        let zone = e.features[0].properties.DOR_DESC;

        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML('<h2>' + address + '</h2>'
                + '<strong>Folio:</strong> ' + folio + '<br>'
                + '<strong>Zone Description:</strong> ' + zone)
            .addTo(map);
    });

    // Create the PB popup
    map.on('click', 'PB_agri_data', function (e) {
        let address = e.features[0].properties.full_address;
        let folio = e.features[0].properties.PARCEL_NUMBER;
        let zone = e.features[0].properties.PROPERTY_USE;

        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML('<h2>' + address + '</h2>'
                + '<strong>Folio:</strong> ' + folio + '<br>'
                + '<strong>Zone Description:</strong> ' + zone)
            .addTo(map);
    });

    // Create the BC popup
    map.on('click', 'BC_agri_data', function (e) {
        let address = e.features[0].properties.PHY_ADDR1;
        let folio = e.features[0].properties.PARCEL_ID;
        let zone = e.features[0].properties.DOR_UC;

        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML('<h2>' + address + '</h2>'
                + '<strong>Folio:</strong> ' + folio + '<br>'
                + '<strong>Zone Description:</strong> ' + zone)
            .addTo(map);
    });

    // Change it back to the default cursor when it leaves.
    map.on('mouseleave', 'MD_agri_data', function () {
        map.getCanvas().style.cursor = '';
    });

    // Change it back to the default cursor when it leaves.
    map.on('mouseleave', 'PB_agri_data', function () {
        map.getCanvas().style.cursor = '';
    });

    // Change it back to the default cursor when it leaves.
    map.on('mouseleave', 'BC_agri_data', function () {
        map.getCanvas().style.cursor = '';
    });
});
