

const centerMiamiBeach = [-80.13019060990487, 25.818871912698164]; // Miami Beach's longitude and latitude
const longitudeSpan = 1.5;
const latitudeSpan = 0.75; 

const bounds = [
    [centerMiamiBeach[0] - longitudeSpan, centerMiamiBeach[1] - latitudeSpan], // [westLongitude, southLatitude]
    [centerMiamiBeach[0] + longitudeSpan, centerMiamiBeach[1] + latitudeSpan]  // [eastLongitude, northLatitude]
];

document.addEventListener('DOMContentLoaded', function() {
    mapboxgl.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ'; // Replace with your actual access token

    // Initialize the map
    var map = new mapboxgl.Map({
        container: 'map',
        style: "mapbox://styles/trddata/clrax4la3005701qogu72fl71", // Confirm this style URL is correct
        center: [-80.13019060990487, 25.788871912698164], // Coordinates for Miami Beach
        zoom: 12,
        maxBounds: bounds
    });

    // Add zoom and rotation controls to the map.
    map.addControl(new mapboxgl.NavigationControl());

    map.on('load', function() {
        // Load GeoJSON data directly
        fetch('miami_beach_office_projects.geojson')
            .then(response => response.json())
            .then(geojsonData => {
                map.addSource('miami_beach_new_office_projects', {
                    type: 'geojson',
                    data: geojsonData
                });

                map.addLayer({
                    id: 'miami_beach_new_office_projects',
                    type: 'circle',
                    source: 'miami_beach_new_office_projects',
                    paint: {
                        'circle-color': '#39FF14',
                        'circle-radius': 10,
                        'circle-stroke-color': '#000000',
                        'circle-stroke-width': 1
                    }
                });
            })
            .catch(error => console.error('Failed to load GeoJSON data:', error));

        // Show the legend
        document.getElementById('legend').style.display = 'block';

        // Disable default scroll zoom and add control for it
        map.scrollZoom.disable();
        function handleScrollZoom(event) {
            if (event.ctrlKey || event.metaKey) {
                map.scrollZoom.enable();
            } else {
                map.scrollZoom.disable();
            }
        }
        window.addEventListener('keydown', handleScrollZoom);
        window.addEventListener('keyup', handleScrollZoom);
        window.addEventListener('mousemove', handleScrollZoom);
    });

    // Interactivity for map features
    map.on('click', 'miami_beach_new_office_projects', (e) => {
        const properties = e.features[0].properties;
        let popupContent = '<div class="popup-content"><h3>Details</h3>';
        
        const excludeFields = ['Name of Project','Developer','Status','coordinates', 'Link ','geometry'];
        for (const key in properties) {
            if (properties[key] !== 'nan' && !excludeFields.includes(key)) {
                const titleCaseKey = key.replace(/\b\w/g, char => char.toUpperCase());
                popupContent += `<div class="popup-field">${properties[key]}</span></div>`;
            }
        }
        
        popupContent += '</div>';
        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(popupContent)
            .addTo(map);
    });

    map.on('mouseenter', 'miami_beach_new_office_projects', function() {
        map.getCanvas().style.cursor = 'pointer';
        map.setPaintProperty('miami_beach_new_office_projects', 'circle-stroke-width', 3);
    });

    map.on('mouseleave', 'miami_beach_new_office_projects', function() {
        map.getCanvas().style.cursor = '';
        map.setPaintProperty('miami_beach_new_office_projects', 'circle-stroke-width', 1);
    });
});
