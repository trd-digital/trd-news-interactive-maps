(() => {
  const modalDisplayFields = {
    title: {
      field: "City",
      label: "City",
    },
    content: [
      { field: "Real Estate Summary", label: "Summary" },
      {
        field: "Link",
        label: "",
        format: (value) => `<a href="${value}" target="_blank">Source</a>`,
      },
    ],
  };

  // Function to detect if the user is on a mobile device
  const isMobileDevice = () => {
    return /Mobi|Android|iPhone/i.test(navigator.userAgent);
  };

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
    filePath: "data.geojson",
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
