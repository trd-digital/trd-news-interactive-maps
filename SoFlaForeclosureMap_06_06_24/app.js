// Your Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";

const centerMiami = [-79.9918, 26.1617]; // Miami's longitude and latitude
const longitudeSpan = 1.5;
const latitudeSpan = 0.75;

const bounds = [
    [centerMiami[0] - longitudeSpan, centerMiami[1] - latitudeSpan], // [westLongitude, southLatitude]
    [centerMiami[0] + longitudeSpan, centerMiami[1] + latitudeSpan]  // [eastLongitude, northLatitude]
];


document.addEventListener('DOMContentLoaded', function() {
    var map = new mapboxgl.Map({
        container: 'map',
        style: "mapbox://styles/trddata/clwiavdh402fr01qlf2g413ja",
        center: centerMiami,
        zoom: 6,
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
    fetch('SoFlaForeclosureMap.csv').then(response => response.text()).then(csvText => {
        const data = d3.csvParse(csvText, d => {
            const coords = d['Map coordinates'].split(',').map(Number);
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
                    <h3>A view of some of this year's foreclosures</h3>
                    <div style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2px dashed #ccc;">
                        <strong>Landlord/Developer:</strong> ${properties['Landlord/Developer']}
                    </div>
                    <div style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2px dashed #ccc;">
                        <strong>Date filed:</strong> ${properties['Exact dates']}
                    </div>
                    <div>
                        ${properties['Caption for map']}
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
