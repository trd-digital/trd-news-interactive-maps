(() => {
  const tooltipDisplayFields = {
    image: {
      field: "image",
    },
    title: {
      field: "Title",
      label: "Title",
    },
    content: [
      {
        field: "Subject Address",
        label: "Address",
        className: "tooltip-block",
      },
      {
        field: "Sale Price (text)",
        label: "Sale Price",
        className: "tooltip-block",
      },
    ],
  };

  const modalDisplayFields = {
    title: {
      field: "Title",
      label: "Title",
    },
    content: [
      {
        field: "Subhead",
        label: "Subhead",
      },
      {
        field: "Authors",
        label: "Authors",
      },
      {
        field: "Published Date",
        label: "Published Date",
        format: "formatDate",
      },
      {
        field: "Sale Price (text)",
        label: "Sale Price",
      },
      {
        field: "Subject Address",
        label: "Address",
      },
      {
        field: "Geographic Market",
        label: "Market",
      },
      {
        field: "URL",
        label: "Source",
        format: (value) => `<a href="${value}" target="_blank">Read more</a>`,
      },
      {
        field: "Content",
        label: "Content",
      },
    ],
  };

  const filterFields = [];

  window.map = trdDataCommonMap({
    filePath:
      "https://static.therealdeal.com/interactive-maps/celebrity_sales.geojson",
    eventCategory: "national-celebrity-map",
    mapElementId: "map",
    filterElementId: "map-filters",
    legendElementId: "legend",
    resultElementId: "result",
    mapCenterLat: 39.8283,
    mapCenterLng: -98.5795,
    zoom: 4,
    minZoom: 3,
    tooltipDisplayFields,
    modalDisplayFields,
    filterFields,
    defaultColors: {
      light: "#D84315",
      dark: "#D84315",
    },
    paintCircleColorType: "",
    loadingEnabled: true,
    mapLayerPaint: {
      "circle-radius": {
        base: 2,
        stops: [
          [1, 10],
          [8, 4],
          [12, 6],
          [15, 8],
          [20, 16],
        ],
      },
    },
  });
})();
