// Your Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";

// const bounds = [
//     [-79.0, 39.5], // [westLongitude, southLatitude]
//     [-89.0, 43.5]  // [eastLongitude, northLatitude]
// ];


document.addEventListener('DOMContentLoaded', function() {
    var map = new mapboxgl.Map({
        container: 'map',
        style: "mapbox://styles/trddata/clwiavdh402fr01qlf2g413ja",
        center: [-87.67168443153632, 41.8546877490377],
        zoom: 10,
        // maxBounds: bounds
    });
    // Add zoom and rotation controls to the map.
    map.addControl(new mapboxgl.NavigationControl());

    document.addEventListener('DOMContentLoaded', function() {
        var infoBox = document.getElementById('info-box');
        positionInfoBox();
    
        window.onresize = positionInfoBox; // Adjust position on window resize
    
        function positionInfoBox() {
            var mapWidth = document.getElementById('map').offsetWidth;
            var mapHeight = document.getElementById('map').offsetHeight;
            infoBox.style.left = (mapWidth * 0.05) + 'px'; // 5% from the left of the map
            infoBox.style.top = (mapHeight * 0.05) + 'px'; // 5% from the top of the map
        }
    });
    
    map.on('load', function() {
        // Load the GeoJSON data directly
        fetch('top_west_assessments_06_06_24.geojson').then(response => response.json()).then(geojsonData => {
            // Assuming you want to add the loaded GeoJSON data to the map as a source
            map.addSource('assessments', {
                type: 'geojson',
                data: geojsonData
            });
    
            // Then you can add a layer to display this data
            map.addLayer({
                id: 'assessments-layer',
                type: 'circle', // or 'symbol' or another appropriate type depending on your data
                source: 'assessments',
                paint: {
                    // Specify paint properties here depending on the type of layer
                    'circle-radius': 7,
                    'circle-color': '#FF0000',
                    'circle-stroke-width':1
                }
            });
        });
    });
    
        // Listen for the 'click' event on the assessments-layer layer
        map.on('click', 'assessments-layer', function(e) {
            if (e.features.length > 0) {
                var feature = e.features[0];
                updateInfoBox(feature.properties);
            }
        });
    
        // Update the info box with properties of the clicked feature
        function updateInfoBox(properties) {
            var infoBox = document.getElementById('info-box');
            if (infoBox) {
                infoBox.innerHTML = `
                    <h3>Top West township assessments</h3>
                    <div style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2px dashed #ccc;">
                        <strong>${properties.address}</strong> 
                    </div>
                    <div style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2px dashed #ccc;">
                        <strong>Category:</strong> ${properties['category']}
                    </div>
                    <div style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2px dashed #ccc;">
                        <strong>2021 Value:</strong> ${properties['2021 value']}
                    </div>
                    <div style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2px dashed #ccc;">
                        <strong>2024 Value:</strong> ${properties['2024 value']}
                    </div>
                    <div>
                        <strong>Change:</strong> ${properties['percent change in initial assessment']}
                    </div>`;
                infoBox.style.display = 'block';
            } else {
                console.error('Info box element not found');
            }
        }
        
    
        // Enhance interactivity on hover
        map.on('mouseenter', 'assessments-layer', function() {
            map.getCanvas().style.cursor = 'pointer';
            map.setPaintProperty('assessments-layer', 'circle-stroke-width', 3); // Thicker stroke on hover
        });
    
        map.on('mouseleave', 'assessments-layer', function() {
            map.getCanvas().style.cursor = '';
            map.setPaintProperty('assessments-layer', 'circle-stroke-width', 1); // Reset stroke width
        });
    });
