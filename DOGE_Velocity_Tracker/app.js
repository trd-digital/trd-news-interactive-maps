(() => {
  const modalDisplayFields = {
    title: {
      field: "Location",  // Use the 'Location' property for the title
      label: "Location",
    },
    content: [
      { field: "Main Agency", label: "Agency" },
      { field: "Sq Ft", label: "Total Sq Ft" },
      { field: "Annual Lease", label: "Total Annual Lease" },
      { field: "Saved", label: "Total Saved" }
    ],
  };

  // Function to detect if the user is on a mobile device
  const isMobileDevice = () => /Mobi|Android|iPhone/i.test(navigator.userAgent);

  // Set default map center coordinates
  let mapCenterLat = 39.8283; // Default latitude (center of the US)
  let mapCenterLng = -98.5795; // Default longitude (center of the US)

  // Adjust map center for mobile devices
  if (isMobileDevice()) {
    mapCenterLat = 40.7128; // New York City latitude
    mapCenterLng = -74.0060; // New York City longitude
  }

  window.map = trdDataCommonMap({
    fetchDataFilterCallback: undefined,
    eventCategory: "beige-book",
    filePath: "data.geojson", // Ensure your GeoJSON file is hosted at this path
    mapElementId: "map",
    filterElementId: undefined,
    legendElementId: undefined,
    resultElementId: undefined,
    mapCenterLat: mapCenterLat,
    mapCenterLng: mapCenterLng,
    zoom: 4,
    minZoom: 3,
    modalDisplayFields,
    mapLayerPaint: {
      "circle-color": "#007cbf",
      "circle-radius": 8,
      "circle-stroke-width": 1,
      "circle-stroke-color": "#f1f1f1",
    },
  });
})();

function renderModalContent(contentArray, properties) {
  return contentArray.map(item => {
    if (item.field === "separator") {
      return item.format();
    } else {
      const label = item.label ? `<strong>${item.label}:</strong> ` : "";
      const value = properties[item.field] || "";
      return `<p>${label}${item.format ? item.format(value) : value}</p>`;
    }
  }).join('');
}
