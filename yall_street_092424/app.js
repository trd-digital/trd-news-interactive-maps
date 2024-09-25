mapboxgl.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ';

const excludedKeys = ['City_State','Renderings', 'Rendering URL', 'full_address', 'geocoded', 'lat', 'lon','offsetX','offsetY','offsetIndex'];

const minCost = 65000000; // 65 million
const maxCost = 500000000; // 500 million

const offsets = {
    1: [5, -10],    // Halved from [10, -20]
    2: [-5, 10],    // Halved from [-10, 20]
    3: [10, -5],    // Halved from [20, -10]
    4: [-10, 5],    // Halved from [-20, 10]
    5: [0, 10],     // Halved from [0, 20]
    6: [10, 0],     // Halved from [20, 0]
    // Add more as needed
};

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/trddata/cluuic7cm008m01pa4xhx5gnh', // Replace with your Mapbox style URL
    center: [-96.7970, 32.7767], // Center coordinates [longitude, latitude]
    zoom: 11
});

map.on('load', () => {
    map.addSource('projects', {
        type: 'geojson',
        data: 'data.geojson' // Replace with the path to your GeoJSON file
    });

    // ===== Low Zoom Layer (zoom < 12) =====
    map.addLayer({
        id: 'project-pins-lowzoom',
        type: 'symbol',
        source: 'projects',
        minzoom: 0,
        maxzoom: 12,
        layout: {
            'icon-image': 'custom-marker',
            'icon-size': 0.8, // Adjusted size for smaller icons
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-offset': [
                'match',
                ['get', 'offsetIndex'],
                1, ['literal', offsets[1]],
                2, ['literal', offsets[2]],
                3, ['literal', offsets[3]],
                4, ['literal', offsets[4]],
                5, ['literal', offsets[5]],
                6, ['literal', offsets[6]],
                ['literal', [0, 0]] // Default offset
            ]
        },
        paint: {
            'icon-halo-color': '#000', // Black stroke
            'icon-halo-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, 1, // Stroke width at zoom 10
                12, 2  // Stroke width at zoom 12
            ]
        }
    });

    // ===== High Zoom Layer (zoom >= 12) =====
    map.addLayer({
        id: 'project-pins-highzoom',
        type: 'symbol',
        source: 'projects',
        minzoom: 12,
        maxzoom: 24,
        layout: {
            'icon-image': 'custom-marker',
            'icon-size': 1.2, // Adjusted size for smaller icons
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-offset': ['literal', [0, 0]] // No offset at high zoom
        },
        paint: {
            'icon-halo-color': '#000', // Black stroke
            'icon-halo-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, 1,
                12, 2
            ]
        }
    });

    // ===== Custom Icon Setup =====
    map.loadImage('red_resized.png', (error, image) => { // Ensure the path is correct
        if (error) {
            console.error('Error loading marker image:', error);
            return;
        }
        map.addImage('custom-marker', image);

        // Update both layers to use 'custom-marker'
        map.setLayoutProperty('project-pins-lowzoom', 'icon-image', 'custom-marker');
        map.setLayoutProperty('project-pins-highzoom', 'icon-image', 'custom-marker');
    });
});

// ===== Click Event for Project Pins =====
map.on('click', ['project-pins-lowzoom', 'project-pins-highzoom'], (e) => {
    const properties = e.features[0].properties;
    let popupContent = '<div>';

    // Add the title
    const title = properties['Address'] || 'Project Details';
    popupContent += `<div class="popup-title">${title}</div>`;

    // Include the rendering image within a container
    const renderingURL = properties['Rendering URL'];
    if (renderingURL && renderingURL !== 'None') {
        popupContent += `<div class="popup-image-container"><img src="${renderingURL}" alt="Rendering" class="popup-image"/></div>`;
    }

    // Highlight the Cost Estimate
    const costEstimate = properties['Cost Estimate'];
    if (costEstimate && costEstimate !== 'None') {
        const formattedCost = `$${parseInt(costEstimate).toLocaleString()}`;
        popupContent += `<h3 class="popup-list"><u>Cost Est: ${formattedCost}</u></h3>`;
    }

    // List other properties
    popupContent += '<ul class="popup-list">';
    for (let key in properties) {
        if (
            properties.hasOwnProperty(key) &&
            !excludedKeys.includes(key) &&
            key !== 'Project Name' &&
            key !== 'renderingURL' &&
            key !== 'Cost Estimate' &&
            key !== 'offsetIndex' // Exclude internal properties
        ) {
            const value = properties[key];
            if (value && value !== 'None') {
                popupContent += `<li><strong>${key}:</strong> ${value}</li>`;
            }
        }
    }
    popupContent += '</ul></div>';

    const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true
    })
    .setLngLat(e.lngLat)
    .setHTML(popupContent)
    .addTo(map);

    // Add the fade-in class
    const popupContentElement = popup.getElement().querySelector('.mapboxgl-popup-content');
    popupContentElement.classList.add('fade-in');

    // Remove the popup with a fade-out effect
    popup.on('close', () => {
        popupContentElement.classList.remove('fade-in');
        popupContentElement.classList.add('fade-out');
        setTimeout(() => {
            popup.remove();
        }, 300); // Match the CSS transition duration
    });
});

// ===== Cursor Change on Hover =====
map.on('mouseenter', ['project-pins-lowzoom', 'project-pins-highzoom'], () => {
    map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', ['project-pins-lowzoom', 'project-pins-highzoom'], () => {
    map.getCanvas().style.cursor = '';
});