// Your Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ"; 

const centerNYC = [-74.0060, 40.7128]; // NYC's longitude and latitude
const longitudeSpan = 1.5;
const latitudeSpan = 0.75;

const bounds = [
    [centerNYC[0] - longitudeSpan, centerNYC[1] - latitudeSpan], // [westLongitude, southLatitude]
    [centerNYC[0] + longitudeSpan, centerNYC[1] + latitudeSpan]  // [eastLongitude, northLatitude]
];

document.addEventListener('DOMContentLoaded', function() {
    var map = new mapboxgl.Map({
        container: 'map',
        style: "mapbox://styles/trddata/clrax4la3005701qogu72fl71",
        center: centerNYC,
        zoom: 10,
        maxBounds: bounds
    });

    // Add zoom and rotation controls to the map.
    map.addControl(new mapboxgl.NavigationControl());

    // Position the info box

    map.on('load', function() {
        // Load the GeoJSON data
        fetch('data.geojson')
            .then(response => response.json())
            .then(geojsonData => {
                // Add the GeoJSON data as a source
                map.addSource('properties', {
                    type: 'geojson',
                    data: geojsonData
                });

                // Add a layer to display the GeoJSON data
                map.addLayer({
                    id: 'properties_layer',
                    type: 'circle',
                    source: 'properties',
                    paint: {
                        'circle-radius': 10,
                        'circle-color': '#FFFFFF',
                        'circle-stroke-color': '#000000',
                        'circle-stroke-width': 1
                    }
                });
            })
            .catch(error => {
                console.error('Error loading GeoJSON data:', error);
            });

        // Disable the default scroll zoom behavior
        map.scrollZoom.disable();

        // Function to handle enabling/disabling scroll zoom
        function handleScrollZoom(event) {
            if (event.ctrlKey || event.metaKey) {
                map.scrollZoom.enable();
            } else {
                map.scrollZoom.disable();
            }
        }

        // Add event listeners for scroll zoom control
        window.addEventListener('keydown', handleScrollZoom);
        window.addEventListener('keyup', handleScrollZoom);

        // Fields to exclude from the popup
        const excludeFields = ['Address','Neighborhood', 'full_address', 'geocoded',
       'lat', 'lon', 'geometry'];

        // Click event handler for displaying popups
        map.on('click', 'properties_layer', (e) => {
            const properties = e.features[0].properties;
            
            // Replace 'Details' with the address if available
            const address = properties['Address'] || 'Details';  // Use 'Details' as fallback if no address
            
            let popupContent = `<div class="popup-content"><h3>${address}</h3>`;  // Dynamic heading
            
            for (const key in properties) {
                if (properties[key] !== 'nan' && !excludeFields.includes(key)) {
                    // Convert key to title case
                    const titleCaseKey = key.replace(/\b\w/g, char => char.toUpperCase());
        
                    // Check if this is the Description key and has a hyperlink
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
        

        // Enhance interactivity on hover
        map.on('mouseenter', 'properties_layer', function() {
            map.getCanvas().style.cursor = 'pointer';
            map.setPaintProperty('properties_layer', 'circle-stroke-width', 3); // Thicker stroke on hover
        });

        map.on('mouseleave', 'properties_layer', function() {
            map.getCanvas().style.cursor = '';
            map.setPaintProperty('properties_layer', 'circle-stroke-width', 1); // Reset stroke width
        });
    });
});
