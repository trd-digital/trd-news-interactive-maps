// Your Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ"; 

const centerNYC = [-74.0060, 40.7128]; // NYC's longitude and latitude
const longitudeSpan = 1.5;
const latitudeSpan = 0.75;

excludeFields = ['Neighborhood', 'State', 'full_address',
       'geocoded', 'lat', 'lon', 'geometry']

const bounds = [
    [centerNYC[0] - longitudeSpan, centerNYC[1] - latitudeSpan], // [westLongitude, southLatitude]
    [centerNYC[0] + longitudeSpan, centerNYC[1] + latitudeSpan]  // [eastLongitude, northLatitude]
];

document.addEventListener('DOMContentLoaded', function() {
    var map = new mapboxgl.Map({
        container: 'map',
        style: "mapbox://styles/trddata/ck0e4y50i14as1cnx6qvtbxi6",
        center: centerNYC,
        zoom: 3,
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
                    cluster: true,               // Enable clustering
                    clusterMaxZoom: 14,           // Max zoom to cluster points
                    clusterRadius: 50             // Radius of each cluster when clustering points (adjust as needed)
                });
    
                // Add a layer for clustered circles
                map.addLayer({
                    id: 'clusters',
                    type: 'circle',
                    source: 'properties',
                    filter: ['has', 'point_count'],  // Only show cluster points
                    paint: {
                        'circle-color': [
                            'step',
                            ['get', 'point_count'],
                            '#51bbd6',   // Color for small clusters
                            100, '#f1f075', // Color for medium clusters
                            750, '#f28cb1'  // Color for large clusters
                        ],
                        'circle-radius': [
                            'step',
                            ['get', 'point_count'],
                            15, 100, 20, 750, 25  // Adjust sizes based on cluster size
                        ]
                    }
                });
    
                // Add a layer for the cluster count labels
                map.addLayer({
                    id: 'cluster-count',
                    type: 'symbol',
                    source: 'properties',
                    filter: ['has', 'point_count'],  // Only show counts on clusters
                    layout: {
                        'text-field': '{point_count_abbreviated}',  // Display cluster count
                        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                        'text-size': 12
                    }
                });
    
                // Add a layer for unclustered points
                map.addLayer({
                    id: 'unclustered-point',
                    type: 'circle',
                    source: 'properties',
                    filter: ['!', ['has', 'point_count']],  // Show only non-clustered points
                    paint: {
                        'circle-color': '#11b4da',
                        'circle-radius': 10,
                        'circle-stroke-width': 1,
                        'circle-stroke-color': '#fff'
                    }
                });
    
                // Event handler for popups on unclustered points
                map.on('click', 'unclustered-point', (e) => {
                    const properties = e.features[0].properties;
    
                    // Replace 'Details' with the address if available
                    const address = properties['Address'] || 'Details';  // Use 'Details' as fallback if no address
    
                    let popupContent = `<div class="popup-content"><h3>${address}</h3>`;
    
                    for (const key in properties) {
                        if (properties[key] !== 'nan' && !excludeFields.includes(key)) {
                            const titleCaseKey = key.replace(/\b\w/g, char => char.toUpperCase());
                            if (key === 'Description' && properties[key].includes('<a href=')) {
                                popupContent += `<div class="popup-field"><span class="popup-key"></span> ${properties[key]}</div>`;
                            } else {
                                popupContent += `<div class="popup-field"><span class="popup-key"></span> <span class="popup-value">${properties[key]}</span></div>`;
                            }
                        }
                    }
    
                    popupContent += '</div>';
    
                    new mapboxgl.Popup()
                        .setLngLat(e.lngLat)
                        .setHTML(popupContent)  // This will render the HTML
                        .addTo(map);
                });
    
                // Zoom in when clicking on clusters
                map.on('click', 'clusters', (e) => {
                    const features = map.queryRenderedFeatures(e.point, {
                        layers: ['clusters']
                    });
                    const clusterId = features[0].properties.cluster_id;
                    map.getSource('properties').getClusterExpansionZoom(
                        clusterId,
                        (err, zoom) => {
                            if (err) return;
    
                            map.easeTo({
                                center: features[0].geometry.coordinates,
                                zoom: zoom
                            });
                        }
                    );
                });
    
                // Enhance interactivity on hover
                map.on('mouseenter', 'unclustered-point', function() {
                    map.getCanvas().style.cursor = 'pointer';
                });
    
                map.on('mouseleave', 'unclustered-point', function() {
                    map.getCanvas().style.cursor = '';
                });
    
                map.on('mouseenter', 'clusters', function() {
                    map.getCanvas().style.cursor = 'pointer';
                });
    
                map.on('mouseleave', 'clusters', function() {
                    map.getCanvas().style.cursor = '';
                });
            })
            .catch(error => {
                console.error('Error loading GeoJSON data:', error);
            });
    });    
});
