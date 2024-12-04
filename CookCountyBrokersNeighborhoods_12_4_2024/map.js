// Initialize the map
mapboxgl.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ'; 

var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [-87.65, 41.85],
    zoom: 9.5
});

// Fetch the GeoJSON data and calculate min/max prices
fetch('final_merge.geojson')
    .then(response => response.json())
    .then(data => {
        // Calculate min and max of 'community_price' from GeoJSON data
        let minPrice = Infinity;
        let maxPrice = -Infinity;

        data.features.forEach(feature => {
            const price = feature.properties.community_price;
            if (price < minPrice) minPrice = price;
            if (price > maxPrice) maxPrice = price;
        });

        // Add the GeoJSON source with fetched data
        map.addSource('salesData', {
            type: 'geojson',
            data: data  // Set the data from the fetched GeoJSON object
        });

        // Add fill layer with dynamic color gradient
        map.addLayer({
            id: 'sales-fill-layer',
            type: 'fill',
            source: 'salesData',
            paint: {
                'fill-color': [
                    'interpolate',
                    ['linear'],
                    ['get', 'community_price'],
                    minPrice, '#f7fbff',          // Lightest color at minimum value
                    minPrice + (maxPrice - minPrice) * 0.2, '#deebf7',
                    minPrice + (maxPrice - minPrice) * 0.4, '#c6dbef',
                    minPrice + (maxPrice - minPrice) * 0.6, '#9ecae1',
                    minPrice + (maxPrice - minPrice) * 0.8, '#3182bd',
                    maxPrice, '#08519c'           // Darkest color at maximum value
                ],
                'fill-opacity': 0.7
            }
        });

        // Add boundary layer
        map.addLayer({
            id: 'boundary-layer',
            type: 'line',
            source: 'salesData',
            paint: {
                'line-color': '#333333',
                'line-width': 1.5
            }
        });

        // Popup on click for sales fill layer
        map.on('click', 'sales-fill-layer', (e) => {
            const properties = e.features[0].properties;

            const formattedTotalDollarVolume = properties.community_price
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(properties.community_price)
                : 'N/A';

            const formattedTopAgentDollarVolume = properties.agent_price
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(properties.agent_price)
                : 'N/A';

            const formattedTotalSalesVolume = properties.community_count
                ? new Intl.NumberFormat('en-US').format(properties.community_count)
                : 'N/A';

            const description = `
                <div style="font-family: Arial, sans-serif; max-width: 250px; line-height: 1.6; border: 1px solid #ccc; border-radius: 8px; padding: 10px; background: #f9f9f9; box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.2);">
                    <h3 style="margin: 0 0 10px; font-size: 20px; color: #333; text-align: center;">${properties.community || 'Unknown'}</h3>
                    <hr style="border: 0; border-top: 1px solid #ddd;">
                    <p><strong>Total Sales Volume:</strong> ${formattedTotalSalesVolume}</p>
                    <p><strong>Total Dollar Volume:</strong> ${formattedTotalDollarVolume}</p>
                    <p><strong>Top Agent/Team:</strong> ${properties.final_agent_team || 'N/A'}</p>
                    <p><strong>Top Agent/Team Number of Sales:</strong> ${properties.agent_count || 'N/A'}</p>
                    <p><strong>Top Agent/Team Dollar Volume:</strong> ${formattedTopAgentDollarVolume}</p>
                </div>
            `;

            new mapboxgl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(description)
                .addTo(map);
        });

        // Change cursor on hover over fill layer
        map.on('mouseenter', 'sales-fill-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'sales-fill-layer', () => {
            map.getCanvas().style.cursor = '';
        });
    })
    .catch(error => console.error('Error loading GeoJSON data:', error));