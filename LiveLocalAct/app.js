// Your Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ"; 
 
const centerMiami = [-80.20491634289706, 25.792276449550354]; // Miami's longitude and latitude
const longitudeSpan = 1.5;
const latitudeSpan = 0.75;

const bounds = [
    [centerMiami[0] - longitudeSpan, centerMiami[1] - latitudeSpan], // [westLongitude, southLatitude]
    [centerMiami[0] + longitudeSpan, centerMiami[1] + latitudeSpan]  // [eastLongitude, northLatitude]
];

document.addEventListener('DOMContentLoaded', function() {
    var map = new mapboxgl.Map({
        container: 'map',
        style: "mapbox://styles/trddata/clrax4la3005701qogu72fl71",
        center: centerMiami,
        zoom: 13,
        maxBounds: bounds
    });

    // Disable map dragging
    // map.dragPan.disable();

    // Add zoom and rotation controls to the map.
    map.addControl(new mapboxgl.NavigationControl());

    map.on('load', function() {
        // Load the GeoJSON data
        fetch('Live_local.geojson')
        .then(response => response.json())
        .then(geojsonData => {
            // Add GeoJSON data as a source
            map.addSource('live_local', {
                type: 'geojson',
                data: geojsonData
            });

            // Add a layer to display the GeoJSON data
            map.addLayer({
                id: 'live_local_interactive',
                type: 'circle',
                source: 'live_local',
                paint: {
                    'circle-radius': 10,
                    'circle-color': '#00FFFF',
                    'circle-stroke-color': '#000000',
                    'circle-stroke-width': 1
                }
            });

            // Add popup functionality on click
            map.on('click', 'live_local_interactive', (e) => {
                const properties = e.features[0].properties;
                let popupContent = '<div class="popup-content"><h3>Details</h3>';

                for (const key in properties) {
                    if (properties[key] !== 'nan' && !excludeFields.includes(key)) {
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

            // Add interactivity on hover
            map.on('mouseenter', 'live_local_interactive', function() {
                map.getCanvas().style.cursor = 'pointer';
                map.setPaintProperty('live_local_interactive', 'circle-stroke-width', 3); // Thicker stroke on hover
            });

            map.on('mouseleave', 'live_local_interactive', function() {
                map.getCanvas().style.cursor = '';
                map.setPaintProperty('live_local_interactive', 'circle-stroke-width', 1); // Reset stroke width
            });
        });
    });

    // Handle scroll zoom enable/disable
    // function handleScrollZoom(event) {
    //     if (event.ctrlKey || event.metaKey) {
    //         map.scrollZoom.enable();
    //     } else {
    //         map.scrollZoom.disable();
    //     }
    // }

    // Add event listeners for scroll zoom control
    window.addEventListener('keydown', handleScrollZoom);
    window.addEventListener('keyup', handleScrollZoom);
    window.addEventListener('mousemove', handleScrollZoom);
});

const excludeFields = ['full_address', 'geocoded','lat','lon','type','color','story_link','loan_int','loan_sh','type','Google Coordinates:']; // Add your field names to this array
