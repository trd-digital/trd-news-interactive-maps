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
        style: "mapbox://styles/trddata/clrax4la3005701qogu72fl71",
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
        // Load the first GeoJSON data directly
        fetch('output_sales_new_listings.geojson').then(response => response.json()).then(geojsonData => {
            // Add the first GeoJSON data as a source
            map.addSource('sales_new_listings', {
                type: 'geojson',
                data: geojsonData
            });
    
            // Add a layer to display the first GeoJSON data
            map.addLayer({
                id: 'sales_new_listings_layer',
                type: 'circle',
                source: 'sales_new_listings',
                paint: {
                    'circle-radius': 10,
                    'circle-color': [
                        'match',
                        ['get', 'color'], // Assumes 'color' is the property name in your GeoJSON
                        'yellow', '#FFFF00',
                        'red', '#FF0000',
                        'cyan', '#00FFFF',
                        'green', '#00FF00',
                        'white', '#FFFFFF',
                        '#000000'
                    ],
                    'circle-stroke-color': '#000000',
                    'circle-stroke-width': 1
                }
            });
        });
    
        // Load the second GeoJSON data directly
        fetch('output_foreclosures_refinances.geojson').then(response => response.json()).then(geojsonData2 => {
            // Add the second GeoJSON data as a source
            map.addSource('foreclosures_refinances', {
                type: 'geojson',
                data: geojsonData2
            });
    
            // Add a layer to display the second GeoJSON data
            map.addLayer({
                id: 'foreclosures_refinances_layer',
                type: 'circle',
                source: 'foreclosures_refinances',
                paint: {
                    'circle-radius': 10,
                    'circle-color': [
                        'match',
                        ['get', 'type'], // Assumes 'type' is the property name in your GeoJSON
                        'Refinance', '#FFFF00', // Yellow for Refinance
                        'Foreclosure', '#FF0000', // Red for Foreclosure
                        '#000000' // Default color if neither match
                    ],
                    'circle-stroke-color': '#000000',
                    'circle-stroke-width': 1
                }
            });

        // Show the legend
        document.getElementById('legend').style.display = 'block';
    });
    

    });
    
        const excludeFields = ['full_address', 'geocoded','lat','lon','type','color','story_link','loan_int','loan_sh','type']; // Add your field names to this array

        map.on('click', 'sales_new_listings_layer', (e) => {
            const properties = e.features[0].properties;
            let popupContent = '<div class="popup-content"><h3>Details</h3>';
            
            for (const key in properties) {
                if (properties[key] !== 'nan' && !excludeFields.includes(key)) {
                    // Convert key to title case
                    const titleCaseKey = key.replace(/\b\w/g, char => char.toUpperCase());
                    popupContent += `<div class="popup-field"><span class="popup-key">${titleCaseKey}:</span> <span class="popup-value">${properties[key]}</span></div>`;
                }
            }
            
            popupContent += '</div>';
    
            new mapboxgl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(popupContent)
                .addTo(map);
        });

        map.on('click', 'foreclosures_refinances_layer', (e) => {
            const properties = e.features[0].properties;
            let popupContent = '<div class="popup-content"><h3>Details</h3>';
            
            for (const key in properties) {
                if (properties[key] !== 'nan' && !excludeFields.includes(key)) {
                    // Convert key to title case
                    const titleCaseKey = key.replace(/\b\w/g, char => char.toUpperCase());
                    popupContent += `<div class="popup-field"><span class="popup-key">${titleCaseKey}:</span> <span class="popup-value">${properties[key]}</span></div>`;
                }
            }
            
            popupContent += '</div>';
    
            new mapboxgl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(popupContent)
                .addTo(map);
        });
    
        // Enhance interactivity on hover
        map.on('mouseenter', 'sales_new_listings_layer', function() {
            map.getCanvas().style.cursor = 'pointer';
            map.setPaintProperty('sales_new_listings_layer', 'circle-stroke-width', 3); // Thicker stroke on hover
        });
    
        map.on('mouseleave', 'sales_new_listings_layer', function() {
            map.getCanvas().style.cursor = '';
            map.setPaintProperty('sales_new_listings_layer', 'circle-stroke-width', 1); // Reset stroke width
        });

        map.on('mouseenter', 'foreclosures_refinances_layer', function() {
            map.getCanvas().style.cursor = 'pointer';
            map.setPaintProperty('foreclosures_refinances_layer', 'circle-stroke-width', 3); // Thicker stroke on hover
        });
    
        map.on('mouseleave', 'foreclosures_refinances_layer', function() {
            map.getCanvas().style.cursor = '';
            map.setPaintProperty('foreclosures_refinances_layer', 'circle-stroke-width', 1); // Reset stroke width
        });

    });
