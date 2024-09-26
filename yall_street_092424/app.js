mapboxgl.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ';

// List of keys to exclude from the popup
const excludedKeys = [
    'City_State',
    'Renderings',
    'Rendering URL',
    'full_address',
    'geocoded',
    'lat',
    'lon',
    'offsetX',
    'offsetY',
    'offsetIndex'
];

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/trddata/cluuic7cm008m01pa4xhx5gnh', // Replace with your Mapbox style URL
    center: [-96.7970, 32.7767], // Center coordinates [longitude, latitude]
    zoom: 8
});

/**
 * Determines the optimal anchor position for the popup based on marker's screen position.
 * @param {mapboxgl.Map} map - The Mapbox GL JS map instance.
 * @param {mapboxgl.LngLatLike} coordinates - The geographical coordinates of the marker.
 * @returns {string} - The anchor position ('top', 'bottom', 'left', 'right', etc.).
 */
function determinePopupAnchor(map, coordinates) {
    // Project the coordinates to screen pixels
    const point = map.project(coordinates);

    // Get the map container's dimensions
    const mapCanvas = map.getCanvas();
    const mapRect = mapCanvas.getBoundingClientRect();
    const mapWidth = mapRect.width;
    const mapHeight = mapRect.height;

    // Define padding from the edges
    const padding = 100; // pixels

    // Define the popup's assumed dimensions
    const popupWidth = 300; // Adjust based on your popup's actual width
    const popupHeight = 200; // Adjust based on your popup's actual height

    // Determine horizontal anchor
    let horizontalAnchor = 'center';
    if (point.x < popupWidth / 2 + padding) {
        horizontalAnchor = 'right';
    } else if (point.x > mapWidth - popupWidth / 2 - padding) {
        horizontalAnchor = 'left';
    }

    // Determine vertical anchor
    let verticalAnchor = 'top';
    if (point.y < popupHeight + padding) {
        verticalAnchor = 'bottom';
    } else if (point.y > mapHeight - padding) {
        verticalAnchor = 'top';
    }

    // Combine horizontal and vertical anchors
    if (horizontalAnchor === 'center') {
        return verticalAnchor;
    } else {
        return `${verticalAnchor}-${horizontalAnchor}`;
    }
}

map.on('load', () => {
    // Add GeoJSON source with clustering enabled
    map.addSource('projects', {
        type: 'geojson',
        data: 'data.geojson', // Replace with the path to your GeoJSON file
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points on
        clusterRadius: 50 // Radius of each cluster when clustering points (defaults to 50)
    });

    // ===== Cluster Circles Layer =====
    map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'projects',
        filter: ['has', 'point_count'],
        paint: {
            // Use step expressions (clusters of different sizes)
            'circle-color': [
                'step',
                ['get', 'point_count'],
                '#51bbd6', // color for clusters with 0-100 points
                100, '#f1f075', // color for clusters with 100-750 points
                750, '#f28cb1' // color for clusters with 750+ points
            ],
            'circle-radius': [
                'step',
                ['get', 'point_count'],
                20, // radius for clusters with 0-100 points
                100, 30, // radius for clusters with 100-750 points
                750, 40 // radius for clusters with 750+ points
            ]
        }
    });

    // ===== Cluster Count Labels Layer =====
    map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'projects',
        filter: ['has', 'point_count'],
        layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
        },
        paint: {
            'text-color': '#ffffff'
        }
    });

    // ===== Add Custom SVG Icon =====
    // Fetch the SVG file
    fetch('images/spur_responsive.svg')
        .then(response => response.text())
        .then(svgContent => {
            // Encode the SVG content to be used in a data URL
            const encodedSVG = encodeURIComponent(svgContent)
                .replace(/'/g, '%27')
                .replace(/"/g, '%22');

            // Create a data URL for the SVG image
            const dataURL = `data:image/svg+xml;charset=UTF-8,${encodedSVG}`;

            // Create a new Image object
            const image = new Image();
            image.onload = () => {
                // Add the image to the map style
                if (!map.hasImage('cowboy-spur')) {
                    map.addImage('cowboy-spur', image);
                }

                // Now that the image is added, add the unclustered points layer
                addUnclusteredPointsLayer();
            };
            image.onerror = (error) => {
                console.error('Error loading SVG image:', error);
            };
            image.src = dataURL;
        })
        .catch(error => {
            console.error('Error fetching SVG file:', error);
        });

    // Function to add the unclustered points layer after the image is loaded
    function addUnclusteredPointsLayer() {
        // ===== Unclustered Points Layer =====
        map.addLayer({
            id: 'unclustered-point',
            type: 'symbol',
            source: 'projects',
            filter: ['!', ['has', 'point_count']],
            layout: {
                'icon-image': 'cowboy-spur', // Use your custom SVG
                'icon-size': 1.0, // Adjust size as needed
                'icon-allow-overlap': true,
                'icon-ignore-placement': true
            },
            paint: {
                // You can adjust paint properties here if needed
            }
        });
    }

    // ===== Add Custom Zoom Controls =====
    // Get references to the custom zoom buttons
    const zoomInButton = document.getElementById('zoom-in');
    const zoomOutButton = document.getElementById('zoom-out');

    // Attach event listeners
    zoomInButton.addEventListener('click', () => {
        map.zoomIn();
    });

    zoomOutButton.addEventListener('click', () => {
        map.zoomOut();
    });

    // ===== Click Event for Clusters =====
    map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
            layers: ['clusters']
        });
        const clusterId = features[0].properties.cluster_id;
        map.getSource('projects').getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;

            map.easeTo({
                center: features[0].geometry.coordinates,
                zoom: zoom
            });
        });
    });

    // ===== Click Event for Unclustered Points =====
    map.on('click', 'unclustered-point', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const properties = e.features[0].properties;

        // Handle if the map is zoomed out such that multiple copies of the feature are visible
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        // Determine the optimal popup anchor based on marker position
        const anchor = determinePopupAnchor(map, coordinates);

        // Construct popup content
        let popupContent = '<div>';

        // Add the title
        const title = properties['Address'] || 'Project Details';
        popupContent += `<div class="popup-title">${title}</div>`;

        // Include the rendering image within a container
        const renderingURL = properties['renderingURL']; // Ensure correct property name
        if (renderingURL && renderingURL !== 'None') {
            popupContent += `<div class="popup-image-container"><img src="${renderingURL}" alt="Rendering of ${title}" class="popup-image"/></div>`;
        }

        // Start the property list
        popupContent += '<ul class="popup-list">';

        // Highlight the Cost Estimate
        const costEstimate = properties['Cost Estimate'];
        if (costEstimate && costEstimate !== 'None') {
            const formattedCost = `$${parseInt(costEstimate).toLocaleString()}`;
            popupContent += `<li><strong>Cost Estimate:</strong> ${formattedCost}</li>`;
        }

        // List other properties
        for (let key in properties) {
            if (
                properties.hasOwnProperty(key) &&
                !excludedKeys.includes(key) &&
                key !== 'Address' &&
                key !== 'renderingURL' &&
                key !== 'Cost Estimate'
            ) {
                const value = properties[key];
                if (value && value !== 'None') {
                    popupContent += `<li><strong>${key}:</strong> ${value}</li>`;
                }
            }
        }

        // End the property list
        popupContent += '</ul></div>';

        // Create and add the popup with dynamic anchor
        const popup = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: true,
            anchor: anchor
        })
            .setLngLat(coordinates)
            .setHTML(popupContent)
            .addTo(map);

        // Add the 'fade-in' class to make the popup visible
        const popupContentElement = popup.getElement().querySelector('.mapboxgl-popup-content');
        if (popupContentElement) {
            popupContentElement.classList.add('fade-in');
        }

        // Optional: Add fade-out effect when popup is closed
        popup.on('close', () => {
            if (popupContentElement) {
                popupContentElement.classList.remove('fade-in');
                popupContentElement.classList.add('fade-out');
                setTimeout(() => {
                    popup.remove();
                }, 300); // Match the CSS transition duration
            }
        });
    });

    // ===== Change Cursor to Pointer on Hover =====
    map.on('mouseenter', 'clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'clusters', () => {
        map.getCanvas().style.cursor = '';
    });

    map.on('mouseenter', 'unclustered-point', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
    });
});