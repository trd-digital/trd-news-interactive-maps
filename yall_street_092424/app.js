mapboxgl.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ';

const excludedKeys = ['Renderings', 'Rendering URL', 'full_address', 'geocoded', 'lat', 'lon'];

const minCost = 65000000; // 65 million
const maxCost = 500000000; // 500 million

const offsets = {
    1: [10, -20],
    2: [-10, 20],
    3: [20, -10],
    4: [-20, 10],
    5: [0, 20],
    6: [20, 0],
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

    // Load a custom marker image (adjust the path if necessary)
    map.loadImage('marker-15.png', (error, image) => {
        if (error) throw error;
        map.addImage('custom-marker', image);

        // Add the layer after the image is loaded
        map.addLayer({
            id: 'project-pins',
            type: 'symbol',
            source: 'projects',
            layout: {
                'icon-image': 'custom-marker',
                'icon-size': 1.5,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-offset': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10,
                    [
                        'match',
                        ['get', 'offsetIndex'],
                        1, offsets[1],
                        2, offsets[2],
                        3, offsets[3],
                        4, offsets[4],
                        5, offsets[5],
                        6, offsets[6],
                        [0, 0] // Default offset
                    ],
                    12,
                    [0, 0]
                ]
            },
            paint: {
                'icon-halo-color': '#000',
                'icon-halo-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 2,
                    12, 0
                ]
            }
        });
    });
});

// Click event for project pins
map.on('click', 'project-pins', (e) => {
    const properties = e.features[0].properties;
    let popupContent = '<div>';

    // Add the title
    const title = properties['Project Name'] || 'Project Details';
    popupContent += `<div class="popup-title">${title}</div>`;

    // Include the rendering image within a container
    const renderingURL = properties['renderingURL'];
    if (renderingURL && renderingURL !== 'None') {
        popupContent += `<div class="popup-image-container"><img src="${renderingURL}" alt="Rendering" class="popup-image"/></div>`;
    }

    // Highlight the Cost Estimate
    const costEstimate = properties['Cost Estimate'];
    if (costEstimate && costEstimate !== 'None') {
        const formattedCost = `$${parseInt(costEstimate).toLocaleString()}`;
        popupContent += `<p><strong>Cost Estimate:</strong> ${formattedCost}</p>`;
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
            key !== 'offsetIndex'
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

// Change the cursor to a pointer when over project pins
map.on('mouseenter', 'project-pins', () => {
    map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'project-pins', () => {
    map.getCanvas().style.cursor = '';
});

