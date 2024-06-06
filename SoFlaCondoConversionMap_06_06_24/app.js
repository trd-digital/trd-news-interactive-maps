// Your Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";

const centerMiami = [-80.1918, 25.7617]; // Miami's longitude and latitude
const longitudeSpan = 1.5;
const latitudeSpan = 0.75;

const bounds = [
    [centerMiami[0] - longitudeSpan, centerMiami[1] - latitudeSpan], // [westLongitude, southLatitude]
    [centerMiami[0] + longitudeSpan, centerMiami[1] + latitudeSpan]  // [eastLongitude, northLatitude]
];

document.addEventListener('DOMContentLoaded', function() {
    var map = new mapboxgl.Map({
        container: 'map',
        style: "mapbox://styles/trddata/clcjj6iyv009a15qs5sv5wc5z",
        center: centerMiami,
        zoom: 8,
        maxBounds: bounds
    });

    // Disable map dragging
    map.dragPan.disable();



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
        fetch('SoFlaCondoconversions_06_06_24.geojson').then(response => response.json()).then(geojsonData => {
            // Assuming you want to add the loaded GeoJSON data to the map as a source
            map.addSource('conversions', {
                type: 'geojson',
                data: geojsonData
            });
    
            // Then you can add a layer to display this data
            map.addLayer({
                id: 'conversions-layer',
                type: 'circle', // or 'symbol' or another appropriate type depending on your data
                source: 'conversions',
                paint: {
                    // Specify paint properties here depending on the type of layer
                    'circle-radius': 10,
                    'circle-color': '#f890e7',
                    'circle-stroke-width':1
                }
            });
        });
    });
    
        // Listen for the 'click' event on the conversions-layer layer
        map.on('click', 'conversions-layer', function(e) {
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
                    <h3>Multifamily to condo conversions in South Florida</h3>
                    <div style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2px dashed #ccc;">
                        <strong>Project: ${properties['project name']}</strong> 
                    </div>
                    <div style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2px dashed #ccc;">
                        <strong>Developers: ${properties['developers']}</strong>
                    </div>
                    <div>
                        ${properties['description_link']}
                    </div>`;
                infoBox.style.display = 'block';
            } else {
                console.error('Info box element not found');
            }
        }

        
    
        // Enhance interactivity on hover
        map.on('mouseenter', 'conversions-layer', function() {
            map.getCanvas().style.cursor = 'pointer';
            map.setPaintProperty('conversions-layer', 'circle-stroke-width', 3); // Thicker stroke on hover
        });
    
        map.on('mouseleave', 'conversions-layer', function() {
            map.getCanvas().style.cursor = '';
            map.setPaintProperty('conversions-layer', 'circle-stroke-width', 1); // Reset stroke width
        });
    });
