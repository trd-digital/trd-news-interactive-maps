// Initialize the map
mapboxgl.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ'; 

var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [-87.65, 41.85],
    zoom: 9.5
});

map.on('load', () => {
    map.addSource('salesData', {
        type: 'geojson',
        data: 'final_merged_gdf.geojson'
    });

    map.addLayer({
        id: 'sales-fill-layer',
        type: 'fill',
        source: 'salesData',
        paint: {
            'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'Price'],
                640000, '#f7fbff',
                43000000, '#deebf7',
                64000000, '#c6dbef',
                85000000, '#9ecae1',
                106000000, '#6baed6',
                127000000, '#3182bd',
                148000000, '#08519c',
                169075379, '#08306b'
            ],
            'fill-opacity': 0.7
        }
    });

    map.addLayer({
        id: 'boundary-layer',
        type: 'line',
        source: 'salesData',
        paint: {
            'line-color': '#333333',
            'line-width': 1.5
        }
    });

    map.on('click', 'sales-fill-layer', (e) => {
        const properties = e.features[0].properties;

        const formattedTotalDollarVolume = properties.Price
            ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(properties.Price)
            : 'N/A';

        const formattedTopBrokerageDollarVolume = properties.brokerage_price
            ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(properties.brokerage_price)
            : 'N/A';

        const formattedTotalSalesVolume = properties.count
            ? new Intl.NumberFormat('en-US').format(properties.count)
            : 'N/A';

        const description = `
            <div style="font-family: Arial, sans-serif; max-width: 250px; line-height: 1.6; border: 1px solid #ccc; border-radius: 8px; padding: 10px; background: #f9f9f9; box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.2);">
                <h3 style="margin: 0 0 10px; font-size: 20px; color: #333; text-align: center;">${properties.community}</h3>
                <hr style="border: 0; border-top: 1px solid #ddd;">
                <p><strong>Total Sales Volume:</strong> ${formattedTotalSalesVolume}</p>
                <p><strong>Total Dollar Volume:</strong> ${formattedTotalDollarVolume}</p>
                <p><strong>Top Brokerage:</strong> ${properties.Final_Brokerage}</p>
                <p><strong>Top Brokerage Number of Sales:</strong> ${properties.brokerage_count}</p>
                <p><strong>Top Brokerage Dollar Volume:</strong> ${formattedTopBrokerageDollarVolume}</p>
            </div>
        `;

        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(description)
            .addTo(map);
    });

    map.on('mouseenter', 'sales-fill-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'sales-fill-layer', () => {
        map.getCanvas().style.cursor = '';
    });
});
