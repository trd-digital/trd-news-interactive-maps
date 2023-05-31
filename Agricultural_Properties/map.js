document.addEventListener('DOMContentLoaded', function () {
    mapboxgl.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjbDZoMTNpNDYwMW1lM2NyeG0wdm80OWFzIn0.aOdBF7K4eHzAelsBIy52lQ';
    var map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/trddata/cl6h00632006t14o08g2ppqvj',
        zoom: 8.5,
        center: [-80.2, 25.75]
    });

    function toggleLayer(layerId) {
        var visibility = map.getLayoutProperty(layerId, 'visibility');
      
        if (visibility === 'visible') {
          map.setLayoutProperty(layerId, 'visibility', 'none');
        } else {
          map.setLayoutProperty(layerId, 'visibility', 'visible');
        }
      }

    var marker = null; // Declare the marker variable

    map.on('load', function () {
        // Buffered polygons source and layer
        map.addSource('So_Fla_buffered_polygon', {
            type: 'geojson',
            data: 'data/outer_polygon.geojson'
        });

        map.addLayer({
            id: 'buffered_polygon',
            type: 'fill',
            source: 'So_Fla_buffered_polygon',
            paint: {
                'fill-color': '#FFD580', // light orange
                'fill-outline-color': '#8B4000', // dark orange
                'fill-opacity': 0.7
            }
        });
        // Add the geojson source and layer
        map.addSource('SoFla_agri_data_source', {
            type: 'geojson',
            data: 'data/SoFla_agri.geojson'
        });

        map.addLayer({
            id: 'SoFla_agri_data',
            type: 'fill',
            source: 'SoFla_agri_data_source',
            paint: {
                'fill-color': '#FF0000',
                'fill-outline-color': '#FF0000',
                'fill-opacity': 0.7
            }
        });

        // Restricted Properties source and layer
        map.addSource('restricted_export_data', {
            type: 'geojson',
            data: 'data/restricted_export.geojson'
        });

        map.addLayer({
            id: 'restricted_properties',
            type: 'fill',
            source: 'restricted_export_data',
            paint: {
                'fill-color': '#A020F0', // purple
                'fill-outline-color': '#9F2B68', // purple
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

    // Change the cursor to a pointer when the mouse is over the SoFla_agri_data layer.
    map.on('mouseenter', 'SoFla_agri_data', function () {
        map.getCanvas().style.cursor = 'pointer';
    });

    // Change it back to the default cursor when it leaves.
    map.on('mouseleave', 'SoFla_agri_data', function () {
        map.getCanvas().style.cursor = '';
    });

    // Change the cursor to a pointer when the mouse is over the SoFla_agri_data layer.
    map.on('mouseenter', 'restricted_properties', function () {
        map.getCanvas().style.cursor = 'pointer';
    });

    // Change it back to the default cursor when it leaves.
    map.on('mouseleave', 'restricted_properties', function () {
        map.getCanvas().style.cursor = '';
    });

    // Create the popup
    map.on('click', 'SoFla_agri_data', function (e) {
        let address = e.features[0].properties.PHY_ADDR1;
        let city = e.features[0].properties.PHY_CITY;
        let folio = e.features[0].properties.PARCEL_ID;
        let zone = e.features[0].properties.DOR_UC;

        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML('<h2>' + address + ' ' + city + '</h2>'
                + '<strong>Folio:</strong> ' + folio + '<br>'
                + '<strong>Zone Description:</strong> ' + zone)
            .addTo(map);
    });

    // Create the popup
    map.on('click', 'restricted_properties', function (e) {
        let address = e.features[0].properties.PHY_ADDR1;
        let city = e.features[0].properties.PHY_CITY;
        let folio = e.features[0].properties.PARCEL_ID;
        let zone = e.features[0].properties.DOR_UC;

        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML('<h2>' + address + ' ' + city + '</h2>'
                + '<strong>Folio:</strong> ' + folio + '<br>'
                + '<strong>Zone Description:</strong> ' + zone)
            .addTo(map);
    });
});
