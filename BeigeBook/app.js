// Your Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";  

document.addEventListener('DOMContentLoaded', function () {
    let currentStyle = "light-v10"; // Default style
    let activePopup = null; // Track the active popup
    let activeLngLat = null; // Track the popup's position

    // Initialize the map
    const map = new mapboxgl.Map({
        container: 'map',
        style: `mapbox://styles/mapbox/${currentStyle}`,
        center: [-98.5795, 39.8283], // Center on the USA
        zoom: 4,
        minZoom: 3
    });

    // Add zoom and rotation controls
    map.addControl(new mapboxgl.NavigationControl());

    // Create a style toggle button
    const toggleButton = document.createElement('button');
    toggleButton.innerHTML = "☀️";
    toggleButton.className = "mapboxgl-ctrl mapboxgl-ctrl-group";
    toggleButton.style.cursor = "pointer";
    toggleButton.style.fontSize = "18px";
    toggleButton.style.width = "30px";
    toggleButton.style.height = "30px";

    toggleButton.addEventListener('click', () => {
        currentStyle = currentStyle === "light-v10" ? "dark-v10" : "light-v10";
        toggleButton.innerHTML = currentStyle === "light-v10" ? "☀️" : "🌙";
        map.setStyle(`mapbox://styles/mapbox/${currentStyle}`);

        map.once('styledata', () => {
            addDataLayers();

            // Restore the active popup if it exists
            if (activePopup && activeLngLat) {
                activePopup = new mapboxgl.Popup()
                    .setLngLat(activeLngLat)
                    .setHTML(activePopup._content.innerHTML) // Restore popup content
                    .addTo(map);

                setTimeout(() => {
                    const popupElement = document.querySelector('.mapboxgl-popup-content');
                    if (popupElement) {
                        popupElement.scrollTop = 0; // Ensure the popup starts at the top
                    }
                }, 50);
            }
        });
    });

    // Add the toggle button to the map
    map.addControl({
        onAdd: () => {
            const container = document.createElement('div');
            container.className = "mapboxgl-ctrl mapboxgl-ctrl-group";
            container.appendChild(toggleButton);
            return container;
        },
        onRemove: () => {}
    }, 'top-right');

    // Add GeoJSON layers and data
    function addDataLayers() {
        if (!map.getSource('properties')) {
            map.addSource('properties', {
                type: 'geojson',
                data: 'data.geojson' // Replace with the path to your GeoJSON file
            });
        }

        if (!map.getLayer('unclustered-point')) {
            map.addLayer({
                id: 'unclustered-point',
                type: 'circle',
                source: 'properties',
                paint: {
                    'circle-color': '#007cbf',
                    'circle-radius': 10,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff'
                }
            });
        }

        map.on('click', 'unclustered-point', (e) => {
            const properties = e.features[0].properties;

            // Build the popup content
            const popupContent = `
                <div class="popup-content">
                    <h4>${properties.City || 'Unknown City'}</h4>
                    <p><em>From Fed Beige Book, October 2024</em></p>
                    <hr>
                    <p>${properties['Real Estate Summary'] || 'No summary available'}</p>
                    <a href="${properties.Link}" target="_blank">Source</a>
                </div>
            `;

            activeLngLat = e.lngLat; // Track the popup's position
            activePopup = new mapboxgl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(popupContent)
                .addTo(map);

            setTimeout(() => {
                const popupElement = document.querySelector('.mapboxgl-popup-content');
                if (popupElement) {
                    popupElement.scrollTop = 0; // Ensure the popup starts at the top
                }
            }, 50);
        });

        // Change cursor to pointer when hovering over points
        map.on('mouseenter', 'unclustered-point', () => {
            map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', 'unclustered-point', () => {
            map.getCanvas().style.cursor = '';
        });
    }

    // Load layers on map initialization
    map.on('load', () => {
        addDataLayers();
    });
});