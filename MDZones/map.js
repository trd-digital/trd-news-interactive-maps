mapboxgl.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjbDZoMTNpNDYwMW1lM2NyeG0wdm80OWFzIn0.aOdBF7K4eHzAelsBIy52lQ';
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/trddata/cl6h00632006t14o08g2ppqvj',
    zoom: 8.5,
    center: [-87.7, 41.83]
});

map.on('load', function () {

    let layers = map.getStyle().layers;
    let firstSymbolId;
    for (var i = 0; i < layers.length; i++) {
        if (layers[i].type === 'symbol') {
            firstSymbolId = layers[i].id;
            break;
        }
    }
    map.addLayer({
        'id':'arch_data',
        'type':'circle',
        'source': {
            'type': 'geojson',
            'data':'data/chi_archs.geojson'
        },
        'paint': {
            'circle-color': '#ff7f50',
            'circle-stroke-color': '#4d4d4d',
            'circle-stroke-width': 0.5,
            'circle-radius': 8
        }
    }, firstSymbolId);
});
// Create the popup
map.on('click', 'arch_data', function (e) {
    let full_address = e.features[0].properties.full_address;
    let name = e.features[0].properties.name;
    let work_desc = e.features[0].properties.work_desc;
    let year_start = e.features[0].properties.app_year_start;
    new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML('<h2>' + full_address + '</h2>' 
        + '<strong>Application year:</strong> ' + year_start + '<br>'
        + '<strong>Architect:</strong> ' + name + '<br><br>'
        + '<strong>Description:</strong> ' + work_desc)
        .addTo(map);
});
// Change the cursor to a pointer when the mouse is over the turnstileData layer.
map.on('mouseenter', 'arch_data', function () {
    map.getCanvas().style.cursor = 'pointer';
});
// Change it back to a pointer when it leaves.
map.on('mouseleave', 'arch_data', function () {
    map.getCanvas().style.cursor = '';
});