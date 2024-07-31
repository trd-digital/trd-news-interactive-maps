// Your Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ"; 

const centerChicago = [-87.77729507856974, 41.87327638775195]; // Chicago's longitude and latitude
const longitudeSpan = 1.5;
const latitudeSpan = 0.75;

const bounds = [
    [centerChicago[0] - longitudeSpan, centerChicago[1] - latitudeSpan], // [westLongitude, southLatitude]
    [centerChicago[0] + longitudeSpan, centerChicago[1] + latitudeSpan]  // [eastLongitude, northLatitude]
];

document.addEventListener('DOMContentLoaded', function() {
    var map = new mapboxgl.Map({
        container: 'map',
        style: "mapbox://styles/trddata/cl6h00632006t14o08g2ppqvj",
        center: centerChicago,
        zoom: 9,
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
    
            // Then add a layer to display this data
            map.addLayer({
                id: 'count-layer',
                type: 'circle',
                source: 'conversions',
                paint: {
                    'circle-radius': 10,
                    'circle-color': [
                        'match',
                        ['get', 'color'], // Assumes 'type' is the property name in your GeoJSON
                        'yellow', '#FFFF00',
                        'red', '#FF0000',
                        'blue', '#0000FF',
                        'green','#00FF00',
                        '#000000'
                    ],
                    'circle-stroke-color': '#000000',
                    'circle-stroke-width': 1
                }
            });
        });
    // Show the legend
    document.getElementById('legend').style.display = 'block';

    });
    
        const excludeFields = ['full_address', 'geocoded','lat','lon','type','color','story_link']; // Add your field names to this array

        map.on('click', 'count-layer', (e) => {
            const properties = e.features[0].properties;
            let popupContent = '<div class="popup-content"><h3>Details</h3>';
            
            for (const key in properties) {
                if (properties[key] !== 'nan' && !excludeFields.includes(key)) {
                    popupContent += `<div class="popup-field"><span class="popup-key">${key}:</span> <span class="popup-value">${properties[key]}</span></div>`;
                }
            }
            popupContent += '</div>';
    
            new mapboxgl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(popupContent)
                .addTo(map);
        });
    
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
