// Your Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";

const centerNYC = [-74.0060, 40.7128]; // Miami's longitude and latitude
const longitudeSpan = 1.5;
const latitudeSpan = 0.75;

const bounds = [
    [centerNYC[0] - longitudeSpan, centerNYC[1] - latitudeSpan], // [westLongitude, southLatitude]
    [centerNYC[0] + longitudeSpan, centerNYC[1] + latitudeSpan]  // [eastLongitude, northLatitude]
];

document.addEventListener('DOMContentLoaded', function() {
    var map = new mapboxgl.Map({
        container: 'map',
        style: "mapbox://styles/trddata/clrax4la3005701qogu72fl71",
        center: centerNYC,
        zoom: 11,
        maxBounds: bounds
    });

    // Disable map dragging
    // map.dragPan.disable();

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
        fetch('output.geojson').then(response => response.json()).then(geojsonData => {
            // Assuming you want to add the loaded GeoJSON data to the map as a source
            map.addSource('conversions', {
                type: 'geojson',
                data: geojsonData
            });
    
            // Then you can add a layer to display this data
            map.addLayer({
                id: 'count-layer',
                type: 'circle', // or 'symbol' or another appropriate type depending on your data
                source: 'conversions',
                paint: {
                    // Use the "Count" property to set the radius of the circle
                    'circle-radius': [
                        'interpolate', ['linear'], ['get', 'Count'],
                        15, 9,   // If Count is 1, radius is 5
                        33, 20 // If Count is 100, radius is 20
                    ],
                    'circle-color': '#00FF00',
                    'circle-stroke-color': '#000000',
                    'circle-stroke-width': 1
                }
            });
            // Add a layer for the count text
            map.addLayer({
                id: 'text-layer',
                type: 'symbol',
                source: 'conversions',
                layout: {
                    'text-field': ['get', 'Count'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 12,
                    // Increase the offset to move the text further from the pin
                    // 'text-offset': [0, 1.2], // Adjust this value as needed
                    'text-anchor': 'center',
                    'visibility': 'none'
                },
                paint: {
                    'text-color': '#000000'
                }
            });
                // Add an event listener for zoom events
            map.on('zoom', function() {
                if (map.getZoom() >= 12) {
                    // Show the text layer when zoom level is 12 or above
                    map.setLayoutProperty('text-layer', 'visibility', 'visible');
                } else {
                    // Hide the text layer for zoom levels below 12
                    map.setLayoutProperty('text-layer', 'visibility', 'none');
                }
            });
        });
    });
    
        // Listen for the 'click' event on the count-layer layer
        map.on('click', 'count-layer', function(e) {
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
                    <div style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2px dashed #ccc;">
                        <strong>${properties['Address']}</strong> 
                    </div>
                        <strong>Owner Count: ${properties['Count']}</strong>
                    </div>`;
                infoBox.style.display = 'block';
            } else {
                console.error('Info box element not found');
            }
        }
    
        // Enhance interactivity on hover
        map.on('mouseenter', 'count-layer', function() {
            map.getCanvas().style.cursor = 'pointer';
            map.setPaintProperty('count-layer', 'circle-stroke-width', 3); // Thicker stroke on hover
        });
    
        map.on('mouseleave', 'count-layer', function() {
            map.getCanvas().style.cursor = '';
            map.setPaintProperty('count-layer', 'circle-stroke-width', 1); // Reset stroke width
        });
    });
