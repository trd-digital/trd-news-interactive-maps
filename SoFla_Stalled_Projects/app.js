// Your Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ"; 

const centerMiami = [-80.35430834436464,25.940768724223318]; // Miami's longitude and latitude
const longitudeSpan = 1.5;
const latitudeSpan = 0.75;

excludeFields = ['Project Name ', 'Address', 'Google coordinates for map', 'Developer',
                'Details on size','Details (when was it approved, why has it stalled, what is the plan)',
                'Reporter', 'Art for map', 'latitude','longitude', 'geometry']

const bounds = [
    [centerMiami[0] - longitudeSpan, centerMiami[1] - latitudeSpan], // [westLongitude, southLatitude]
    [centerMiami[0] + longitudeSpan, centerMiami[1] + latitudeSpan]  // [eastLongitude, northLatitude]
];

document.addEventListener('DOMContentLoaded', function() {
    var map = new mapboxgl.Map({
        container: 'map',
        style: "mapbox://styles/mapbox/streets-v11",
        center: centerMiami,
        zoom: 8,
        minZoom: 3,
        // maxBounds: bounds
    });

    // Force map to fit the entire world at the lowest possible zoom
    // map.fitBounds([[-90, -43], [90, 43]]);

    // Add zoom and rotation controls to the map.
    map.addControl(new mapboxgl.NavigationControl());

    // Position the info box

    map.on('load', function() {
        // Load the GeoJSON data
        fetch('data.geojson')
            .then(response => response.json())
            .then(geojsonData => {
                // Add the GeoJSON data as a source with clustering enabled
                map.addSource('properties', {
                    type: 'geojson',
                    data: geojsonData,
                    // cluster: true,               // Enable clustering
                    // clusterMaxZoom: 14,           // Max zoom to cluster points
                    // clusterRadius: 50             // Radius of each cluster when clustering points (adjust as needed)
                });
    
                // Add a layer for unclustered points with color coding by status
                map.addLayer({
                    id: 'unclustered-point',
                    type: 'circle',
                    source: 'properties',
                    filter: ['!', ['has', 'point_count']],  // Show only non-clustered points
                    paint: {
                        'circle-color': [
                            'match',
                            ['get', 'Status'],
                            'Revived', '#00FF00',       // Green for "Revived"
                            'Slow Moving', '#FFFF00',   // Yellow for "Slow Moving"
                            'Stalled', '#FF0000',       // Red for "Stalled"
                            '#11b4da'                   // Default color if status is not matched
                        ],
                        'circle-radius': 10,
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#000000'
                    }
                });
    
                map.on('click', 'unclustered-point', (e) => {
                    const properties = e.features[0].properties;
                
                    // Start building the popup content
                    let popupContent = `<div class="popup-content">`;
                
                    // Add the project name (only the value) - notice the exact match with trailing space
                    if (properties['Project Name']) {
                        popupContent += `<h3>${properties['Project Name']}</h3>`;
                    }
                
                    // Add the status (both key and value)
                    if (properties['Status']) {
                        popupContent += `<div class="popup-field"><span class="popup-key">Status: </span><span class="popup-value">${properties['Status']}</span></div>`;
                    }
                
                    // Add the details (only the value)
                    if (properties['Details']) {
                        popupContent += `<div class="popup-field">${properties['Details']}</div>`;
                    }
                
                    popupContent += `</div>`;
                
                    // Display the popup
                    new mapboxgl.Popup()
                        .setLngLat(e.lngLat)
                        .setHTML(popupContent)
                        .addTo(map);
                });                  
                                             
    
                // Enhance interactivity on hover
                map.on('mouseenter', 'unclustered-point', function() {
                    map.getCanvas().style.cursor = 'pointer';
                });
    
                map.on('mouseleave', 'unclustered-point', function() {
                    map.getCanvas().style.cursor = '';
                });
            })
            .catch(error => {
                console.error('Error loading GeoJSON data:', error);
            });
    });    
});
