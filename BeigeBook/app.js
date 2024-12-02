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

  window.map = trdDataCommonMap({
    fetchDataFilterCallback: undefined,
    eventCategory: "beige-book",
    filePath: "data.geojson",
    mapElementId: "map",
    filterElementId: undefined,
    legendElementId: undefined,
    resultElementId: undefined,
    mapCenterLat: 39.8283,
    mapCenterLng: -98.5795,
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
