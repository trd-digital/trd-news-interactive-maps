// Your Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";

const centerBrickell = [-80.1930, 25.7617]; // Updated coordinates for Brickell

// Smaller span values for a more focused area
const longitudeSpan = 0.02;
const latitudeSpan = 0.01;

// Updated bounds based on the new center and smaller spans
const bounds = [
    [centerBrickell[0] - longitudeSpan, centerBrickell[1] - latitudeSpan], // [westLongitude, southLatitude]
    [centerBrickell[0] + longitudeSpan, centerBrickell[1] + latitudeSpan]  // [eastLongitude, northLatitude]
];

document.addEventListener('DOMContentLoaded', function() {
    var map = new mapboxgl.Map({
        container: 'map',
        style: "mapbox://styles/trddata/clwiavdh402fr01qlf2g413ja",
        center: centerBrickell,
        zoom: 13, // Increased zoom level for closer view
        maxBounds: bounds
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
    // Load and parse the CSV data
    fetch('Brickell Sites Hitting the Market  - Sheet1.csv').then(response => response.text()).then(csvText => {
        const data = d3.csvParse(csvText, d => {
            if (d['Story Link'] && d['Story Link'].trim() !== '') {
                d.Details += ` <a href="${d['Story Link']}" target="_blank">Read more</a>`;
            }
            const coords = d['Long/Lat Coordinates'].split(',').map(Number);
            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [coords[1], coords[0]]
                },
                properties: d
            };
        });

        map.addSource('points', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: data
            }
        });

        map.addLayer({
            id: 'points',
            type: 'circle',
            source: 'points',
            paint: {
                'circle-radius': 6,
                'circle-color': '#FF0000',
                'circle-stroke-width': 1
            }
        });
    
        // Listen for the 'click' event on the points layer
        map.on('click', 'points', function(e) {
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
                    <h3>Brickell Sites Hitting the Market</h3>
                    <div style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2px dashed #ccc;">
                        <strong>Address:</strong> ${properties['Address']}
                    </div>
                    <div style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2px dashed #ccc;">
                        <strong>Details:</strong> ${properties['Details']}
                    </div>`;
                infoBox.style.display = 'block';
            } else {
                console.error('Info box element not found');
            }
        }
        
    
        // Enhance interactivity on hover
        map.on('mouseenter', 'points', function() {
            map.getCanvas().style.cursor = 'pointer';
            map.setPaintProperty('points', 'circle-stroke-width', 3); // Thicker stroke on hover
        });
    
        map.on('mouseleave', 'points', function() {
            map.getCanvas().style.cursor = '';
            map.setPaintProperty('points', 'circle-stroke-width', 1); // Reset stroke width
        });
    });

});
});
