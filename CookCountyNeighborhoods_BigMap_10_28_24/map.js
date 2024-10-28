// Initialize the map
mapboxgl.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ'; // Replace with your actual Mapbox access token

var map = new mapboxgl.Map({
    container: 'map', // ID of the container in your HTML where the map will be rendered
    style: 'mapbox://styles/mapbox/streets-v11', // Base map style
    center: [-87.65, 41.85], // Initial center (longitude, latitude) - example coordinates (Miami, FL)
    zoom: 9.5 // Initial zoom level
});

map.on('load', () => {
    // Add your custom vector tile source from Mapbox
    map.addSource('myData', {
        type: 'vector',
        url: 'mapbox://trddata.4kor20qg' // Use this format
    });    

    // Add a layer to display the data (use type 'fill' for polygons, 'circle' for points, etc.)
    map.addLayer({
        id: 'layer',
        type: 'fill', // Adjust to 'circle', 'line', etc., based on your data
        source: 'myData',
        'source-layer': 'brokerage_community_data', // Ensure this matches the actual layer name in your Mapbox dataset
        paint: {
            'fill-color': '#ff6600', // Customize the color
            'fill-opacity': 0.5, // Customize opacity
            'fill-outline-color': '#333' // Customize outline color
        }
    });

    map.on('click', 'layer', (e) => {
        const properties = e.features[0].properties; // Access properties from the clicked feature
    
        // Format currency for median price if available
        const formattedMedianPrice = properties.Price
            ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(properties.Price)
            : 'N/A';
    
        // Parse `brokerage_info` to generate rows dynamically and sort by sales
        let brokerageRows = '';
        if (properties.brokerage_info) {
            const brokerages = properties.brokerage_info.split(', ').map(entry => {
                const [name, sales] = entry.split(' (');
                return {
                    name: name.trim(),
                    sales: sales ? parseInt(sales.replace(')', '').trim()) : 0 // Parse sales as integer for sorting
                };
            });

            // Sort brokerages by sales in descending order
            brokerages.sort((a, b) => b.sales - a.sales);

            // Generate table rows for the popup
            brokerageRows = brokerages.map(brokerage => `
                <tr><td>${brokerage.name}</td><td>${brokerage.sales}</td></tr>
            `).join('');
        } else {
            brokerageRows = `<tr><td colspan="2">No data available</td></tr>`;
        }

        // Construct the popup content
        const description = `
            <div style="max-height: 150px; overflow-y: auto;">
                <strong>Community:</strong> ${properties.community}<br>
                <strong>Median Price:</strong> ${formattedMedianPrice}<br>
                <strong>Brokerages (Number of Sales):</strong>
                <table style="width: 100%;">
                    <tr><th>Brokerage</th><th>Sales</th></tr>
                    ${brokerageRows}
                </table>
            </div>
        `;

        // Display the popup
        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(description)
            .addTo(map);
    }); // Closing the 'click' event listener

    // Change the cursor to a pointer when the mouse is over the layer
    map.on('mouseenter', 'layer', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'layer', () => {
        map.getCanvas().style.cursor = '';
    });
});
