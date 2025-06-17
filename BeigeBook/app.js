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
      },
      {
        field: "Last Updated",
        label: "Last Updated",
      },
      {
        field: "Last Updated By",
        label: "By",
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
      "circle-stroke-width": 2,
      "circle-stroke-color": "#f1f1f1",
    },

    // point paint settings
    pointSettings: {
      clickToCenter: true,
      clickToZoom: false,
      colorType: "case",
      radiusType: "radius",
      paintSettings: {
        default: {
          radius: 8,
          color: {
            light: "#007cbf",
            dark: "#007cbf",
          },
        },
        hover: {
          radius: 10,
          color: {
            light: "#007cbf",
            dark: "#007cbf",
          },
        },
        active: {
          radius: 12,
          color: {
            light: "black",
            dark: "white",
          },
        },
      },
    },
  });
})();
