(() => {
  const legendKeys = [];

  const tooltipDisplayFields = {
    title: {
      field: "Project Name",
      label: "Project name",
    },
    content: [
      {
        field: "Full Address",
        label: "Address",
      },
      { field: "Developer", label: "Developer" },
    ],
  };

  const modalDisplayFields = {
    title: {
      field: "Project Name",
      label: "Project name",
    },
    content: [
      {
        field: "Full Address",
        label: "Address",
      },
      { field: "Res Units", label: "Res. units" },
      { field: "Hotels Room", label: "Hotel rooms" },
      {
        field: "Office Sq. Ft.",
        label: "Office SqFt",
        format: "formatNumber",
      },
      {
        field: "Retail Sq. Ft.",
        label: "Retail SqFt",
        format: "formatNumber",
      },
      { field: "Estimated Completion", label: "Estimated completion" },
      { field: "Developer", label: "Developer" },
    ],
  };

  const filterFields = [];

  window.map = trdDataCommonMap({
    filePath:
      "https://static.therealdeal.com/interactive-maps/los_angeles_properties_under_construction.geojson",
    eventCategory: "los-angeles-properties-under-construction-map",
    mapElementId: "map",
    filterElementId: "map-filters",
    legendElementId: "legend",
    resultElementId: "result",
    mapCenterLat: 34.0521482,
    mapCenterLng: -118.2396273,
    zoom: 10,
    minZoom: 8,
    tooltipDisplayFields,
    modalDisplayFields,
    defaultColors: {
      light: "#FF7043",
      dark: "#FF8A65",
    },
    mapLayerFieldKey: "Project Name",
    paintCircleColorType: "",
    loadingEnabled: false,
    mapLayerPaint: {
      "circle-radius": {
        base: 1.75,
        stops: [
          [8, 4],
          [12, 6],
          [15, 8],
          [20, 16],
        ],
      },
    },
  });
})();
