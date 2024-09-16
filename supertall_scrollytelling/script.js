const svg = d3.select("#graphic");
const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

// Coordinates for the map's center (provided by you)
const mapCenterLngLat = [-80.1915385, 25.7645295];

// Add linear gradient for shadow effect
svg.append("defs")
    .append("linearGradient")
    .attr("id", "skyscraperGradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")  // Gradient from left to right
    .attr("y2", "0%")
    .html(`
        <stop offset="20%" style="stop-color:lightgray;stop-opacity:1" />
        <stop offset="100%" style="stop-color:darkgray;stop-opacity:1" />
    `);

// Add drop shadow filter
svg.append("defs")
    .append("filter")
    .attr("id", "skyscraperShadow")
    .html(`
        <feDropShadow dx="5" dy="5" stdDeviation="4" flood-color="black" flood-opacity="0.5" />
    `);

// Skyscraper base dimensions
const skyscraperWidth = 500;
const baseHeight = 100;  // Initial height
const maxHeight = 700;   // Final height at the last step

// Create a skyscraper rectangle with a starting base height
const skyscraper = svg.append("rect")
    .attr("x", width / 2 - skyscraperWidth / 2)  // Center the skyscraper
    .attr("y", height - baseHeight)              // Position at the bottom
    .attr("width", skyscraperWidth)
    .attr("height", baseHeight)
    .attr("fill", "url(#skyscraperGradient)")    // Apply the gradient to the skyscraper fill
    .attr("filter", "url(#skyscraperShadow)");   // Apply the shadow filter

// Add windows (small rectangles) to the skyscraper
const floors = 20;  // Number of floors (or windows)
const windowHeight = maxHeight / floors;  // Calculate the height of each "window"

const windows = [];
for (let i = 0; i < floors; i++) {
    const win = svg.append("rect")
        .attr("x", width / 2 - skyscraperWidth / 2 + 10)
        .attr("y", height - (i + 1) * windowHeight)
        .attr("width", skyscraperWidth - 20)
        .attr("height", windowHeight - 5)
        .attr("fill", "lightblue")  // Window color
        .attr("stroke", "black")    // Black stroke around the windows
        .attr("stroke-width", 2)    // Thickness of the black stroke
        .style("opacity", 0);  // Hide windows initially

    windows.push(win);  // Store windows to control their visibility later
}


// Initialize Scrollama
const scroller = scrollama();

let mapInitialized = false;

// Scrollama setup to detect each step
scroller
    .setup({
        step: ".step",   // Each step corresponds to a scroll point
        offset: 0.5,     // Trigger halfway through the viewport
        debug: false     // Set to true if you want visual markers for debugging
    })
    .onStepEnter(handleStepEnter);

// Function to handle each step trigger
function handleStepEnter(response) {
    const step = response.index;  // Get the current step index

    if (step === 4 && !mapInitialized) {
        // Condense the skyscraper to a red dot at the map center
        const centerX = width / 2;  // Center of the SVG container horizontally
        const centerY = height / 2; // Center of the SVG container vertically

        // First, condense the skyscraper
        skyscraper.transition()
            .duration(1000)  // Duration of transition to red dot
            .ease(d3.easeCubicInOut)  // Add cubic easing for smooth transition
            .attr("width", 20)
            .attr("height", 20)
            .attr("x", centerX - 10)  // Position the dot at the SVG center
            .attr("y", centerY - 10)  // Position the dot at the SVG center
            .attr("fill", "red");  // Change fill color to red during the transition

        // Fade out windows
        windows.forEach((win) => {
            win.transition().duration(1000).style("opacity", 0);
        });

        // Fade out the entire SVG (graphic)
        d3.select("#graphic").transition()
            .delay(1000)  // Wait for the skyscraper to condense first
            .duration(1000)  // Fade out over 1 second
            .style("opacity", 0)
            .on("end", () => {
                d3.select("#graphic").style("display", "none");  // Hide it after fading out
                initializeMapbox();  // Initialize the map after the SVG fades away
            });

    } else if (step < 4) {
        // Show skyscraper again when scrolling back to earlier steps
        d3.select("#graphic").style("display", "block").style("opacity", 1);  // Ensure it's fully visible again
        d3.select("#mapbox").style("display", "none");
        mapInitialized = false;

        // Restore the original width, height, position, and color of the skyscraper first
        skyscraper.transition()
            .duration(500)  // Restore width, height, and position over 500ms
            .ease(d3.easeCubicInOut)
            .attr("width", skyscraperWidth)  // Restore full width
            .attr("height", baseHeight)  // Reset to base height
            .attr("x", width / 2 - skyscraperWidth / 2)  // Re-center horizontally
            .attr("y", height - baseHeight)  // Position it back at the bottom
            .attr("fill", "url(#skyscraperGradient)")  // Restore the original gradient
            .on("end", () => {
                // After restoring the size and position, then handle further transitions
                const newHeight = baseHeight + (step / 3) * (maxHeight - baseHeight);  // 3 steps to full height

                // Update skyscraper height with a smooth transition
                skyscraper.transition()
                    .duration(500)
                    .ease(d3.easeCubicInOut)  // Smooth cubic easing for height transition
                    .attr("height", newHeight)
                    .attr("y", height - newHeight);  // Adjust y-position to keep it at the bottom

                // Show windows progressively as the skyscraper grows
                windows.forEach((win, index) => {
                    if (index < Math.floor(step / 3 * floors)) {
                        win.transition().duration(500).style("opacity", 1);  // Make windows visible again
                    } else {
                        win.transition().duration(500).style("opacity", 0);
                    }
                });
            });
    }
}

// Function to initialize the Mapbox map
function initializeMapbox() {
    mapInitialized = true;

    // Fade in the Mapbox map
    d3.select("#mapbox").style("display", "block").style("opacity", 0);  // Initially hidden
    d3.select("#mapbox").transition()
        .duration(1000)  // Fade in over 1 second
        .style("opacity", 1);  // Fade to full visibility

    // Add the Mapbox map
    mapboxgl.accessToken = 'pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ';
    const map = new mapboxgl.Map({
        container: 'mapbox',  // Use the #mapbox container
        style: 'mapbox://styles/trddata/clwiavdh402fr01qlf2g413ja',  // Mapbox style
        center: mapCenterLngLat,  // Use the provided center coordinates
        zoom: 14,
        interactive: false  // Disable map panning and zooming
    });

    // Load GeoJSON data
    map.on('load', function () {
        map.addSource('buildings', {
            type: 'geojson',
            data: 'SoFlaCondoMarketingNY.geojson'  // GeoJSON data with building locations
        });

        map.addLayer({
            id: 'buildings-layer',
            type: 'circle',
            source: 'buildings',
            paint: {
                'circle-radius': 10,
                'circle-color': '#ff0000',
                'circle-stroke-width': 1,            // Width of the circle stroke
                'circle-stroke-color': '#000000'     // Color of the stroke (black)
            }
        });


        // Change stroke width on hover (mouseenter)
        map.on('mouseenter', 'buildings-layer', function (e) {
            map.setPaintProperty('buildings-layer', 'circle-stroke-width', 4);  // Expand stroke on hover
            map.getCanvas().style.cursor = 'pointer';  // Change cursor to pointer
        });

        // Reset stroke width when the cursor leaves the point (mouseleave)
        map.on('mouseleave', 'buildings-layer', function () {
            map.setPaintProperty('buildings-layer', 'circle-stroke-width', 1);  // Contract stroke back
            map.getCanvas().style.cursor = '';  // Reset cursor to default
        });

        // Add a popup on click
        map.on('click', 'buildings-layer', function (e) {
            const coordinates = e.features[0].geometry.coordinates.slice();
            const description = e.features[0].properties['Address'];

            new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(description)
                .addTo(map);
        });

        // Change the cursor to a pointer when over the buildings layer
        map.on('mouseenter', 'buildings-layer', function () {
            map.getCanvas().style.cursor = 'pointer';
        });

        // Change it back when it leaves
        map.on('mouseleave', 'buildings-layer', function () {
            map.getCanvas().style.cursor = '';
        });
    });
}
