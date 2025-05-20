(() => {
  // 1️⃣ Tell the modal which feature‐properties to show:
  //    – title.field must match your GeoJSON “metro” property
  //    – content array must match your GeoJSON “summary” property
  const modalDisplayFields = {
    title: {
      field: "Metro",
      label: "Market",
    },
    content: [
      {
        field: "summary",
        label: "Overview",
        // no special formatting needed, it’s already valid HTML
      },
            {
        field: "Last Updated",
        label: "Last Updated",
        // no special formatting needed, it’s already valid HTML
      },      {
        field: "Last Updated By",
        label: "By",
        // no special formatting needed, it’s already valid HTML
      },
    ],
  };

  // 2️⃣ Initialize your map, pointing at your GeoJSON file:
  window.map = trdDataCommonMap({
    // path to the file you just generated
    filePath: "market_overviews.geojson",

    // leave these alone unless you want filters/legends/results
    fetchDataFilterCallback: undefined,
    eventCategory: "market-overviews",
    mapElementId: "map",
    filterElementId: undefined,
    legendElementId: undefined,
    resultElementId: undefined,

    // center & zoom
    mapCenterLat: 39.8283,
    mapCenterLng: -98.5795,
    zoom: 4,
    minZoom: 3,

    // swap in your modalDisplayFields
    modalDisplayFields,

    // optional: tweak the circle style
    mapLayerPaint: {
      "circle-color": "#007cbf",
      "circle-radius": 8,
      "circle-stroke-width": 1,
      "circle-stroke-color": "#f1f1f1",
    },
  });
})();
