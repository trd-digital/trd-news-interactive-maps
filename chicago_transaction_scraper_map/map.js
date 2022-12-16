mapboxgl.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjbDZoMTNpNDYwMW1lM2NyeG0wdm80OWFzIn0.aOdBF7K4eHzAelsBIy52lQ';
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/trddata/cl6h00632006t14o08g2ppqvj',
    zoom: 8.5,
    center: [-87.7, 41.83]
});

// function to define map layers information
function mapDetailsFunction(mapID, visibility, source) {
    mapDetails = {
        id: mapID,
        type: "circle",
        source: {
        type: "geojson",
        data: source,
        },
        layout: {
        'visibility': visibility
        },

        paint: {
            'circle-color': [
                'match',
                ['get','PUB_YEAR'],
                '2018', 
                '#FFA500', // orange
                '2019', 
                '#0000FF', // blue
                '2020', 
                '#FFFF00', // yellow
                '2021', 
                '#00FF00', // green
                '2022', 
                '#FF0000', // red
                '#ccc'],
            'circle-stroke-color': '#000000',
            'circle-stroke-width': 0.5,
            'circle-radius': 6
        }
    }
    return mapDetails;
    }

    // define legend
    // define layer names
    const layers = [
    '2018',
    '2019',
    '2020',
    '2021',
    '2022'
    ];
    const colors = [
    '#FFA500',
    '#0000FF',
    '#FFFF00',
    '#00FF00',
    '#FF0000'
    ];

    // // create legend
    // const legend = document.getElementById('legend-2');

    // layers.forEach((layer, i) => {
    // const color = colors[i];
    // const item = document.createElement('div');
    // const key = document.createElement('span');
    // key.className = 'legend-key';
    // key.style.backgroundColor = color;

    // const value = document.createElement('span');
    // value.innerHTML = `${layer}`;
    // item.appendChild(key);
    // item.appendChild(value);
    // legend.appendChild(item);
    // });

    // load my map layers
    map.on("load", function () {
    mapDetailsFunction("2018", "visible", "data/Chicago_2018.geojson");
        map.addLayer(mapDetails);
    mapDetailsFunction("2019", "visible", "data/Chicago_2019.geojson");
        map.addLayer(mapDetails);
    mapDetailsFunction("2020", "visible", "data/Chicago_2020.geojson");
        map.addLayer(mapDetails);
    mapDetailsFunction("2021", "visible", "data/Chicago_2021.geojson");
        map.addLayer(mapDetails);
    mapDetailsFunction("2022", "visible", "data/Chicago_2022.geojson");
        map.addLayer(mapDetails);
    });

                // radio button control
                document.getElementById('legend').addEventListener('change', (event) => {
                    const type = event.target.value;
                    // update the map filter
                    if (type === 'all') {
                        map.setLayoutProperty('2018','visibility','visible');
                        map.setLayoutProperty('2019','visibility','visible');
                        map.setLayoutProperty('2020','visibility','visible');
                        map.setLayoutProperty('2021','visibility','visible');
                        map.setLayoutProperty('2022','visibility','visible');
                    } else if (type === '2018') {
                        map.setLayoutProperty('2018','visibility','visible');
                        map.setLayoutProperty('2019','visibility','none');
                        map.setLayoutProperty('2020','visibility','none');
                        map.setLayoutProperty('2021','visibility','none');
                        map.setLayoutProperty('2022','visibility','none');
                    } else if (type === '2019') {
                        map.setLayoutProperty('2018','visibility','none');
                        map.setLayoutProperty('2019','visibility','visible');
                        map.setLayoutProperty('2020','visibility','none');
                        map.setLayoutProperty('2021','visibility','none');
                        map.setLayoutProperty('2022','visibility','none');
                    } else if (type === '2020') {
                        map.setLayoutProperty('2018','visibility','none');
                        map.setLayoutProperty('2019','visibility','none');
                        map.setLayoutProperty('2020','visibility','visible');
                        map.setLayoutProperty('2021','visibility','none');
                        map.setLayoutProperty('2022','visibility','none');
                    } else if (type === '2021') {
                        map.setLayoutProperty('2018','visibility','none');
                        map.setLayoutProperty('2019','visibility','none');
                        map.setLayoutProperty('2020','visibility','none');
                        map.setLayoutProperty('2021','visibility','visible');
                        map.setLayoutProperty('2022','visibility','none');
                    } else if (type === '2022') {
                        map.setLayoutProperty('2018','visibility','none');
                        map.setLayoutProperty('2019','visibility','none');
                        map.setLayoutProperty('2020','visibility','none');
                        map.setLayoutProperty('2021','visibility','none');
                        map.setLayoutProperty('2022','visibility','visible');
                    }
                });

        // Create the popup - 2018
        map.on('click', '2018', function (e) {
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
        map.on('mouseenter', '2018', function () {
            map.getCanvas().style.cursor = 'pointer';
        });
        // Change it back to a pointer when it leaves.
        map.on('mouseleave', '2018', function () {
            map.getCanvas().style.cursor = '';
        });

        // Create the popup - 2019
        map.on('click', '2019', function (e) {
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
        map.on('mouseenter', '2019', function () {
            map.getCanvas().style.cursor = 'pointer';
        });
        // Change it back to a pointer when it leaves.
        map.on('mouseleave', '2019', function () {
            map.getCanvas().style.cursor = '';
        });

        // Create the popup - 2019
        map.on('click', '2019', function (e) {
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
        map.on('mouseenter', '2019', function () {
            map.getCanvas().style.cursor = 'pointer';
        });
        // Change it back to a pointer when it leaves.
        map.on('mouseleave', '2019', function () {
            map.getCanvas().style.cursor = '';
        });

        // Create the popup - 2020
        map.on('click', '2020', function (e) {
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
        map.on('mouseenter', '2020', function () {
            map.getCanvas().style.cursor = 'pointer';
        });
        // Change it back to a pointer when it leaves.
        map.on('mouseleave', '2020', function () {
            map.getCanvas().style.cursor = '';
        });

        // Create the popup - 2021
        map.on('click', '2021', function (e) {
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
        map.on('mouseenter', '2021', function () {
            map.getCanvas().style.cursor = 'pointer';
        });
        // Change it back to a pointer when it leaves.
        map.on('mouseleave', '2021', function () {
            map.getCanvas().style.cursor = '';
        });

        // Create the popup - 2022
        map.on('click', '2022', function (e) {
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
        map.on('mouseenter', '2022', function () {
            map.getCanvas().style.cursor = 'pointer';
        });
        // Change it back to a pointer when it leaves.
        map.on('mouseleave', '2022', function () {
            map.getCanvas().style.cursor = '';
        });

        map.addControl(new mapboxgl.NavigationControl());

        this.map.once('load', () => {
        this.map.resize();
        });