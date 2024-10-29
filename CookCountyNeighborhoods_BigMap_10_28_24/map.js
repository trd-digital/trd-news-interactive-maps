// Initialize the map
mapboxgl.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ'; // Replace with your actual Mapbox access token

var map = new mapboxgl.Map({
    container: 'map', // ID of the container in your HTML where the map will be rendered
    style: 'mapbox://styles/mapbox/streets-v11', // Base map style
    center: [-87.65, 41.85], // Initial center (longitude, latitude) - example coordinates (Chicago)
    zoom: 9.5 // Initial zoom level
});

map.on('load', () => {
    // Add the sales count GeoJSON directly as a source
    map.addSource('salesData', {
        type: 'geojson',
        data: 'aggregated_sales_by_community.geojson' // Path to the local GeoJSON or URL if hosted
    });

    // Add a fill layer with color intensity based on sales count
    map.addLayer({
        id: 'sales-fill-layer',
        type: 'fill',
        source: 'salesData',
        paint: {
            // Set fill color based on 'total_sales' with a pronounced scale
            'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'total_sales'],
                0, '#f7fbff',     // Very light color for lowest values
                100, '#deebf7',
                500, '#c6dbef',
                1000, '#9ecae1',
                2000, '#6baed6',
                3000, '#3182bd',
                4000, '#08519c',   // Dark color for highest values
                5000, '#08306b'    // Even darker for potential high-end outliers
            ],
            'fill-opacity': 0.7
        }
    });
    

    // Optional: Add a line layer for boundaries if desired
    map.addLayer({
        id: 'boundary-layer',
        type: 'line',
        source: 'salesData',
        paint: {
            'line-color': '#333333', // Outline color
            'line-width': 1.5 // Line thickness
        }
    });

    // Click event for showing popups with sales data
    map.on('click', 'sales-fill-layer', (e) => {
        const properties = e.features[0].properties; // Access properties from clicked feature

        // Format and show only the top brokerage for each community
        const formattedMedianPrice = properties.Price
            ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(properties.Price)
            : 'N/A';

        let topBrokerage = 'No data available';
        let topSales = 0;
        if (properties.brokerage_info) {
            const brokerages = properties.brokerage_info.split(', ').map(entry => {
                const [name, sales] = entry.split(' (');
                return {
                    name: name.trim(),
                    sales: sales ? parseInt(sales.replace(')', '').trim()) : 0
                };
            });

            brokerages.sort((a, b) => b.sales - a.sales);
            if (brokerages.length > 0) {
                topBrokerage = brokerages[0].name;
                topSales = brokerages[0].sales;
            }
        }

        const description = `
            <div style="font-family: Arial, sans-serif; max-width: 250px; line-height: 1.5;">
                <h3 style="margin: 0; font-size: 18px; color: #333;">${properties.community}</h3>
                <p>---------------------------</p>
                <h2 style="margin: 0; font-size: 18px; color: #333;">Total Sales: ${properties.total_sales}</h2>
                <p>---------------------------</p>
                <p style="margin: 5px 0 0; font-size: 14px;"><strong>Median Price:</strong> ${formattedMedianPrice}</p>
                <p style="margin: 5px 0 0; font-size: 14px;">
                    <strong>Top Brokerage:</strong> ${topBrokerage}<br>
                    <strong>Number of Brokerage Sales:</strong> ${topSales}
                </p>
            </div>
        `;

        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(description)
            .addTo(map);
    });

    // Change the cursor to a pointer when the mouse is over the fill layer
    map.on('mouseenter', 'sales-fill-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'sales-fill-layer', () => {
        map.getCanvas().style.cursor = '';
    });
});
