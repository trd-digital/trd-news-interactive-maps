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
        'id':'data',
        'type':'circle',
        'source': {
            'type': 'geojson',
            'data':'data/Chicago.geojson'
        },
        'paint': {
            'circle-color': [
                'match',
                ['get','PUB_YEAR'],
                2017,
                '#4B0082', // indigo
                2018, 
                '#FFA500', // orange
                2019, 
                '#0000FF', // blue
                2020, 
                '#FFFF00', // yellow
                2021, 
                '#00FF00', // green
                2022, 
                '#FF0000', // red
                '#ccc'],
            'circle-stroke-color': '#000000',
            'circle-stroke-width': 0.5,
            'circle-radius': 6
        }
    }, firstSymbolId);
});
// Create the popup
map.on('click', 'data', function (e) {
    let HED = e.features[0].properties.HED;
    let DEK = e.features[0].properties.DEK;
    let description_link = e.features[0].properties.description_link;
    let PUB_YEAR = e.features[0].properties.PUB_YEAR
    new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML('<h2>' + HED + '</h2>' 
        + '<strong>' + DEK + '</strong> '
        + '<p>' + description_link + '</p>'
        + '<u><p> Published: ' + PUB_YEAR + '</u></p>')
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