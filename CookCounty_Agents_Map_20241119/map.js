// SETUP MAP
// Initialize map, set the view lat long and zoom 
var map = L.map('map').setView([41.95815447273359, -87.69218427463986], 10.6);

// Import map style tile layer from MapBox with api key
L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: 'Map created by Joseph Jungermann',
    // attribution: 'Map created by Joseph Jungermann | Data by <a href="https://www.openstreetmap.org/">OpenStreetMap</a> and <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox/dark-v9',
    tileSize: 512,
    zoomOffset: -1,
    accessToken: 'pk.eyJ1Ijoiam9zZXBoanVuZ2VybWFubiIsImEiOiJjazl5b3lldHUwMGF1M21wYWZxZGxtaXFrIn0.SIGcJf1ElkmPBC0Gs31ktw',
    scrollWheelZoom: false
}).addTo(map);

//SETUP AND CALL JS VARIABLES FOR DISPLAY IN POP-UP MENU
// Loop through the js data point to create markers for each transaction. 
// Variable from js storing all data including lat and lon is named "transactions"
transactions.features.forEach(function(feature) {
    // Get the coordinates and property details
    var lat = feature.Latitude;
    var lon = feature.Longitude;
    var address = feature.Address;
    var price = feature["Sale Price"];
    var listAgentOne = feature["Listing Agent/Team 1"];
    var listBrokerageOne = feature["Listing Brokerage 1"];
    var listAgentTwo = feature["Listing Agent/Team 2"];
    var listBrokerageTwo = feature["Listing Brokerage 2"];
    var buyAgentOne = feature["Buying Agent/Team 1"];
    var buyBrokerageOne = feature["Buying Brokerage 1"];
    var buyAgentTwo = feature["Buying Agent/Team 2"];
    var buyBrokerageTwo = feature["Buying Brokerage 2"];
    var mls = feature["MLS Number"]; 

//SETUP CIRCLE MARKERS THAT MARK EACH POINT AND SIZE BASE ON PRICE
// Function to convert price to a radius size
function getRadius(price) {
    // Remove the dollar sign and commas, then convert to a number
    var numericPrice = parseFloat(price.replace(/[^0-9.-]+/g, ''));
    // Adjust the scale factor to your preference for the marker size
    var scaleFactor = 0.002;
    return Math.sqrt(numericPrice) * scaleFactor;
}

    // Create a circle marker for each location with size based on price
    var circleMarker = L.circleMarker([lat, lon], {
        radius: getRadius(price),
        color: '#ffffff',
        weight: 1,
        fillColor: '#0000ff',
        fillOpacity: 0.5
    }).addTo(map);
 
//ADD INFORMATION TO POP-UP AND DISPLAY ON EACH MARKER
    //This pop-up is dynamic. 
    //If there is no value in a category, i.e. Listing Agent/Team 2 is blank, the category will not display for the pop-up
    var popupContent = `<h3>Transaction Details</h3>`;

    if (address) popupContent += `<b>Address:</b> ${address}<br>`;
    if (price) popupContent += `<b>Price:</b> ${price}<br>`;
    if (listAgentOne) popupContent += `<b>Listing Agent/Team 1:</b> ${listAgentOne}<br>`;
    if (listBrokerageOne) popupContent += `<b>Listing Brokerage 1:</b> ${listBrokerageOne}<br>`;
    if (listAgentTwo) popupContent += `<b>Listing Agent/Team 2:</b> ${listAgentTwo}<br>`;
    if (listBrokerageTwo) popupContent += `<b>Listing Brokerage 2:</b> ${listBrokerageTwo}<br>`;
    if (buyAgentOne) popupContent += `<b>Buying Agent/Team 1:</b> ${buyAgentOne}<br>`;
    if (buyBrokerageOne) popupContent += `<b>Buying Brokerage 1:</b> ${buyBrokerageOne}<br>`;
    if (buyAgentTwo) popupContent += `<b>Buying Agent/Team 2:</b> ${buyAgentTwo}<br>`;
    if (buyBrokerageTwo) popupContent += `<b>Buying Brokerage 2:</b> ${buyBrokerageTwo}<br>`;
    if (mls) popupContent += `<b>MLS Number:</b> ${mls}<br>`;

// Add the dynamically generated popup to the circle marker
circleMarker.bindPopup(popupContent);
});

