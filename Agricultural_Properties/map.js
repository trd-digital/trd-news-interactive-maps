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

    var marker = null; // Declare marker variable

    map.on('load', function () {
        // Buffered polygons source and layer
        map.addSource('So_Fla_buffered_polygon', {
            type: 'geojson',
            data: 'data/outer_polygon_final.geojson'
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
            data: 'data/SoFla_agri_final.geojson'
        });

        map.addLayer({
            id: 'SoFla_agri_data',
            type: 'fill',
            source: 'SoFla_agri_data_source',
            paint: {
                'fill-color': '#62FF00', // Army green
                'fill-outline-color': '#013220', // Dark green
                'fill-opacity': 0.9
            }
        });

        // Critical Infrastructure Properties source and layer
        map.addSource('restricted_export_data', {
            type: 'geojson',
            data: 'data/restricted_export_final.geojson'
        });

        map.addLayer({
            id: 'restricted_properties',
            type: 'fill',
            source: 'restricted_export_data',
            paint: {
                'fill-color': '#9D00FF', // neon red
                'fill-outline-color': '#000000', // black
                'fill-opacity': 0.9
            }
        });
        // Airport source and layer
        map.addSource('airport_export_data', {
          type: 'geojson',
          data: 'data/airport_export_final.geojson'
        });

        map.addLayer({
            id: 'airport_properties',
            type: 'fill',
            source: 'airport_export_data',
            paint: {
                'fill-color': '#9D00FF', // neon red
                'fill-outline-color': '#000000', // black
                'fill-opacity': 0.9
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

    // Change the cursor to a pointer when the mouse is over the restricted layer.
    map.on('mouseenter', 'restricted_properties', function () {
        map.getCanvas().style.cursor = 'pointer';
    });

    // Change it back to the default cursor when it leaves.
    map.on('mouseleave', 'restricted_properties', function () {
        map.getCanvas().style.cursor = '';
    });

    // Change the cursor to a pointer when the mouse is over the restricted layer.
    map.on('mouseenter', 'airport_properties', function () {
      map.getCanvas().style.cursor = 'pointer';
    });

    // Change it back to the default cursor when it leaves.
    map.on('mouseleave', 'airport_properties', function () {
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
        let zone_desc = e.features[0].properties.DESC;

        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML('<h2>' + address + ' ' + city + '</h2>'
                + '<strong>Folio:</strong> ' + folio + '<br>'
                + '<strong>Zone Description:</strong> ' + zone + ': ' + zone_desc)
            .addTo(map);
    });
      // Create the popup
    map.on('click', 'airport_properties', function (e) {
      let address = e.features[0].properties.Address;
      let folio = e.features[0].properties.Folio;
      let airport = e.features[0].properties.Airport

      new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML('<h2>' + address + '</h2>'
              + '<strong>Folio:</strong> ' + folio + '<br>'
              + '<strong>Airport:</strong> ' + airport)
          .addTo(map);
    });
  
    document.getElementById('buffered_polygon').addEventListener('change', function () {
        const layerVisibility = this.checked ? 'visible' : 'none';
        map.setLayoutProperty('buffered_polygon', 'visibility', layerVisibility);
      });
      
      document.getElementById('SoFla_agri_data').addEventListener('change', function () {
        const layerVisibility = this.checked ? 'visible' : 'none';
        map.setLayoutProperty('SoFla_agri_data', 'visibility', layerVisibility);
      });
      
      document.getElementById('restricted_properties').addEventListener('change', function () {
        const layerVisibility = this.checked ? 'visible' : 'none';
        map.setLayoutProperty('restricted_properties', 'visibility', layerVisibility);
      }); 

      document.getElementById('airport_properties').addEventListener('change', function () {
        const layerVisibility = this.checked ? 'visible' : 'none';
        map.setLayoutProperty('airport_properties', 'visibility', layerVisibility);
      }); 
      
        // Set initial state of checkboxes and layers
    const checkboxes = document.querySelectorAll('.layer-toggle');
    checkboxes.forEach(checkbox => {
    checkbox.checked = true; // Set all checkboxes as checked

    // Trigger change event to update layer visibility
    checkbox.dispatchEvent(new Event('change'));
    });

    map.addControl(new mapboxgl.NavigationControl());

    document.getElementById('zoom-in').addEventListener('click', function () {
      map.zoomIn();
    });

    document.getElementById('zoom-out').addEventListener('click', function () {
      map.zoomOut();
    });

});
