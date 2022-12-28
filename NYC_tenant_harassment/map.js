mapboxgl.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjbDZoMTNpNDYwMW1lM2NyeG0wdm80OWFzIn0.aOdBF7K4eHzAelsBIy52lQ';
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/trddata/cl6h00632006t14o08g2ppqvj',
    zoom: 8,
    center: [-74.01887863602701,40.69156622470473]
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
                ['get','FindingOfHarassment'],
                'N/A', 
                '#FFA500', // orange
                'No Harassment', 
                '#0000FF', // blue
                'After Inquest', 
                '#FFFF00', // yellow
                'After Trial', 
                '#A020F0', // purple
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
    'N/A',
    'No Harassment',
    'After Inquest',
    'After Trial'
    ];
    const colors = [
    '#FFA500',
    '#0000FF',
    '#FFFF00',
    '#A020F0'
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

    // load map layers
    map.on("load", function () {
    mapDetailsFunction("N/A", "visible", "data/NYC_tenant_harassment_NA.geojson");
        map.addLayer(mapDetails);
    mapDetailsFunction("No Harassment", "visible", "data/NYC_tenant_harassment_NH.geojson");
        map.addLayer(mapDetails);
    mapDetailsFunction("After Inquest", "visible", "data/NYC_tenant_harassment_AI.geojson");
        map.addLayer(mapDetails);
    mapDetailsFunction("After Trial", "visible", "data/NYC_tenant_harassment_AT.geojson");
        map.addLayer(mapDetails);
    });

                // radio button control
                document.getElementById('legend').addEventListener('change', (event) => {
                    const type = event.target.value;
                    // update the map filter
                    if (type === 'all') {
                        map.setLayoutProperty('N/A','visibility','visible');
                        map.setLayoutProperty('No Harassment','visibility','visible');
                        map.setLayoutProperty('After Inquest','visibility','visible');
                        map.setLayoutProperty('After Trial','visibility','visible');
                    } else if (type === 'N/A') {
                        map.setLayoutProperty('N/A','visibility','visible');
                        map.setLayoutProperty('No Harassment','visibility','none');
                        map.setLayoutProperty('After Inquest','visibility','none');
                        map.setLayoutProperty('After Trial','visibility','none');
                    } else if (type === 'No Harassment') {
                        map.setLayoutProperty('N/A','visibility','none');
                        map.setLayoutProperty('No Harassment','visibility','visible');
                        map.setLayoutProperty('After Inquest','visibility','none');
                        map.setLayoutProperty('After Trial','visibility','none');
                    } else if (type === 'After Inquest') {
                        map.setLayoutProperty('N/A','visibility','none');
                        map.setLayoutProperty('No Harassment','visibility','none');
                        map.setLayoutProperty('After Inquest','visibility','visible');
                        map.setLayoutProperty('After Trial','visibility','none');
                    } else if (type === 'After Trial') {
                        map.setLayoutProperty('N/A','visibility','none');
                        map.setLayoutProperty('No Harassment','visibility','none');
                        map.setLayoutProperty('After Inquest','visibility','none');
                        map.setLayoutProperty('After Trial','visibility','visible');
                }});

        // Create the popup - N/A
        map.on('click', 'N/A', function (e) {
            let StreetName = e.features[0].properties.StreetName;
            let FindingOfHarassment = e.features[0].properties.FindingOfHarassment;
            let Respondent = e.features[0].properties.Respondent;
            let Penalty = e.features[0].properties.Penalty;
            let DateFiled = e.features[0].properties.CaseOpenDate;
            new mapboxgl.Popup()
                .setLngLat(e.lngLat)
                .setHTML('<h2>' + StreetName + '</h2>' 
                + '<strong>Result: ' + FindingOfHarassment + '</strong> '
                + '<p>Respondent: ' + Respondent + '</p>'
                + '<u><p> Penalty: ' + Penalty + '</u></p>'
                + '<p> Case Opened Date: ' + DateFiled + '</p>')
                .addTo(map);
        });
        // Change the cursor to a pointer when the mouse is over the turnstileData layer.
        map.on('mouseenter', 'N/A', function () {
            map.getCanvas().style.cursor = 'pointer';
        });
        // Change it back to a pointer when it leaves.
        map.on('mouseleave', 'N/A', function () {
            map.getCanvas().style.cursor = '';
        });

        // Create the popup - No Harassment
        map.on('click', 'No Harassment', function (e) {
            let StreetName = e.features[0].properties.StreetName;
            let FindingOfHarassment = e.features[0].properties.FindingOfHarassment;
            let Respondent = e.features[0].properties.Respondent;
            let Penalty = e.features[0].properties.Penalty;
            let DateFiled = e.features[0].properties.CaseOpenDate;
            new mapboxgl.Popup()
                .setLngLat(e.lngLat)
                .setHTML('<h2>' + StreetName + '</h2>' 
                + '<strong>Result: ' + FindingOfHarassment + '</strong> '
                + '<p>Respondent: ' + Respondent + '</p>'
                + '<u><p> Penalty: ' + Penalty + '</u></p>'
                + '<p> Case Opened Date: ' + DateFiled + '</p>')
                .addTo(map);
        });
        // Change the cursor to a pointer when the mouse is over the turnstileData layer.
        map.on('mouseenter', 'No Harassment', function () {
            map.getCanvas().style.cursor = 'pointer';
        });
        // Change it back to a pointer when it leaves.
        map.on('mouseleave', 'No Harassment', function () {
            map.getCanvas().style.cursor = '';
        });

        // Create the popup - After Inquest
        map.on('click', 'After Inquest', function (e) {
            let StreetName = e.features[0].properties.StreetName;
            let FindingOfHarassment = e.features[0].properties.FindingOfHarassment;
            let Respondent = e.features[0].properties.Respondent;
            let Penalty = e.features[0].properties.Penalty;
            let DateFiled = e.features[0].properties.CaseOpenDate;
            new mapboxgl.Popup()
                .setLngLat(e.lngLat)
                .setHTML('<h2>' + StreetName + '</h2>' 
                + '<strong>Result: ' + FindingOfHarassment + '</strong> '
                + '<p>Respondent: ' + Respondent + '</p>'
                + '<u><p> Penalty: ' + Penalty + '</u></p>'
                + '<p> Case Opened Date: ' + DateFiled + '</p>')
                .addTo(map);
        });
        // Change the cursor to a pointer when the mouse is over the turnstileData layer.
        map.on('mouseenter', 'After Inquest', function () {
            map.getCanvas().style.cursor = 'pointer';
        });
        // Change it back to a pointer when it leaves.
        map.on('mouseleave', 'After Inquest', function () {
            map.getCanvas().style.cursor = '';
        });

        // Create the popup - 2021
        map.on('click', 'After Trial', function (e) {
            let StreetName = e.features[0].properties.StreetName;
            let FindingOfHarassment = e.features[0].properties.FindingOfHarassment;
            let Respondent = e.features[0].properties.Respondent;
            let Penalty = e.features[0].properties.Penalty;
            let DateFiled = e.features[0].properties.CaseOpenDate;
            new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML('<h2>' + StreetName + '</h2>' 
            + '<strong>Result: ' + FindingOfHarassment + '</strong> '
            + '<p>Respondent: ' + Respondent + '</p>'
            + '<u><p> Penalty: ' + Penalty + '</u></p>'
            + '<p> Case Opened Date: ' + DateFiled + '</p>')
            .addTo(map);
    });
        // Change the cursor to a pointer when the mouse is over the turnstileData layer.
        map.on('mouseenter', 'After Trial', function () {
            map.getCanvas().style.cursor = 'pointer';
        });
        // Change it back to a pointer when it leaves.
        map.on('mouseleave', 'After Trial', function () {
            map.getCanvas().style.cursor = '';
        });

        this.map.once('load', () => {
        this.map.resize();
        });