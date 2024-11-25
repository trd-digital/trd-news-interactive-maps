// Your Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";  

document.addEventListener('DOMContentLoaded', function() {
    var map = new mapboxgl.Map({
        container: 'map',
        style: "mapbox://styles/mapbox/streets-v11", // Map style
        zoom: 3,                                    // Initial zoom (overridden by fitBounds)
        minZoom: 3                                  // Minimum zoom
    });

    // Add zoom and rotation controls to the map
    map.addControl(new mapboxgl.NavigationControl());

    // Define coordinates for NYC, Miami, and Chicago
    const nyc = [-74.006, 40.7128];
    const miami = [-80.1918, 25.7617];
    const chicago = [-87.6298, 41.8781];

    // Define bounds: [southwest, northeast]
    const bounds = [
        [chicago[0], miami[1]], // Southwest corner (Chicago's longitude, Miami's latitude)
        [nyc[0], nyc[1]]        // Northeast corner (NYC's longitude, NYC's latitude)
    ];

    map.on('load', function() {
        // Adjust the map to fit the defined bounds
        map.fitBounds(bounds, {
            padding: 50,         // Add padding around the edges
            maxZoom: 3,          // Maximum zoom level after fitting
            linear: true         // Use linear easing for a smooth transition
        });

        // Load the GeoJSON data
        fetch('map_data.geojson')
            .then(response => response.json())
            .then(geojsonData => {
                // Add the GeoJSON data as a source with clustering enabled
                map.addSource('properties', {
                    type: 'geojson',
                    data: geojsonData,
                    cluster: true,               // Enable clustering
                    clusterMaxZoom: 14,          // Max zoom to cluster points
                    clusterRadius: 50            // Radius of each cluster when clustering points
                });

                // Add a layer for clusters
                map.addLayer({
                    id: 'clusters',
                    type: 'circle',
                    source: 'properties',
                    filter: ['has', 'point_count'],
                    paint: {
                        'circle-color': [
                            'step',
                            ['get', 'point_count'],
                            '#51bbd6', 10,
                            '#f1f075', 30,
                            '#f28cb1'
                        ],
                        'circle-radius': [
                            'step',
                            ['get', 'point_count'],
                            15, 10,
                            20, 30,
                            25
                        ]
                    }
                });

                // Add cluster count labels
                map.addLayer({
                    id: 'cluster-count',
                    type: 'symbol',
                    source: 'properties',
                    filter: ['has', 'point_count'],
                    layout: {
                        'text-field': '{point_count_abbreviated}',
                        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                        'text-size': 12
                    }
                });

                // Add a layer for unclustered points
                map.addLayer({
                    id: 'unclustered-point',
                    type: 'circle',
                    source: 'properties',
                    filter: ['!', ['has', 'point_count']],
                    paint: {
                        'circle-color': '#00FF00',  // Green for individual points
                        'circle-radius': 10,
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#000000'
                    }
                });

                // Add popup interaction for unclustered points
                map.on('click', 'unclustered-point', (e) => {
                    const properties = e.features[0].properties;

                    // Build the popup content
                    let popupContent = `<div class="popup-content">`;
                    
                    // Add 'Address' field
                    if (properties['full_address']) {
                        popupContent += `<div class="popup-field"><h3><strong> ${properties['full_address']}</h3></strong></div>`;
                    }
                    
                    // Add 'description' value only (no label)
                    if (properties['description']) {
                        popupContent += `<div class="popup-field">${properties['description_link']}</div>`;
                    }

                    popupContent += `</div>`;

                    // Display the popup
                    new mapboxgl.Popup()
                        .setLngLat(e.lngLat)
                        .setHTML(popupContent)
                        .addTo(map);
                });

                // Zoom into clusters when clicked
                map.on('click', 'clusters', (e) => {
                    const features = map.queryRenderedFeatures(e.point, {
                        layers: ['clusters']
                    });
                    const clusterId = features[0].properties.cluster_id;

                    // Get the expansion zoom level for the clicked cluster
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
                map.on('mouseenter', 'clusters', function() {
                    map.getCanvas().style.cursor = 'pointer';
                });
                map.on('mouseleave', 'unclustered-point', function() {
                    map.getCanvas().style.cursor = '';
                });
                map.on('mouseleave', 'clusters', function() {
                    map.getCanvas().style.cursor = '';
                });
            })
            .catch(error => {
                console.error('Error loading GeoJSON data:', error);
                alert('Failed to load map data. Please try again later.');
            });
    });
});