(() => {
  const minimumSalePrice = 10_000;

  const legendKeys = [
    {
      title: "Sales",
      options: [
        {
          value: 50_000,
          color: {
            light: "#90CAF9",
            dark: "#90CAF9",
          },
          text: "< $750K",
          default: false,
        },
        {
          value: 250_000,
          color: {
            light: "#42A5F5",
            dark: "#42A5F5",
          },
          text: "$750K - $1M",
          default: false,
        },
        {
          value: 500_000,
          color: {
            light: "#1E88E5",
            dark: "#1E88E5",
          },
          text: "$1M - $3M",
          default: false,
        },
        {
          value: 1_000_000,
          color: {
            light: "#1565C0",
            dark: "#1565C0",
          },
          text: "$3M - $4M",
          default: false,
        },
        {
          value: 100_000_000,
          color: {
            light: "#0D47A1",
            dark: "#0D47A1",
          },
          text: "> $5M",
          default: true,
        },
      ],
    },
  ];

  const tooltipDisplayFields = {
    title: {
      field: "Full Address",
      label: "Address",
    },
    content: [
      {
        field: "Sale Price",
        label: "Sale Price",
        format: "formatPrice",
      },
      {
        field: "Use Code Description",
        label: "Use Code",
      },
    ],
  };

  const modalDisplayFields = {
    title: {
      field: "Physical Address",
      label: "Address",
    },
    content: [
      { field: "Doc Type", label: "Doc Type" },
      {
        field: "Record Date",
        label: "Record Date",
        format: "formatDate",
      },
      { field: "Sellers", label: "Sellers" },
      { field: "Buyers", label: "Buyers" },
      {
        field: "Sale Price",
        label: "Sale Price",
        format: "formatPrice",
      },
      { field: "BBL", label: "BBL" },
      { field: "Building BBL", label: "Building BBL" },
      { field: "Use Code Description", label: "Use Code Description" },
      {
        field: "Property Sq. Ft",
        label: "Property Sq. Ft",
        format: "formatNumber",
      },
      {
        field: "Recorded Date of Previous Sale",
        label: "Recorded Date of Previous Sale",
        format: "formatDate",
      },
      {
        field: "Doc Date of Previous Sale",
        label: "Doc Date of Previous Sale",
        format: "formatDate",
      },
      { field: "Previous Owner Name", label: "Previous Owner Name" },
      {
        field: "Previous Sale Price",
        label: "Previous Sale Price",
        format: "formatPrice",
      },
      { field: "Physical Address", label: "Address" },
      { field: "Neighborhood", label: "Neighborhood" },
      { field: "County", label: "County" },
      { field: "Municipality", label: "Municipality" },
      {
        field: "PropAppraiserURL",
        label: "Property Appraiser URL",
        format: (value) =>
          `<a href="${value}" target="_blank" rel="noopener noreferrer">View Property</a>`,
      },
    ],
  };

  const filterFields = [
    {
      title: "Days",
      name: "days",
      dataField: "Recorded Date",
      fieldType: "radio",
      fieldLayoutClass: "radio-group",
      multiSelect: false,
      defaultValue: "90",
      callback: (values, item) => {
        const days = values[0];
        const date = new Date();
        date.setDate(date.getDate() - days);
        const recordDate = new Date(item.properties["Recorded Date"]);
        return recordDate >= date;
      },
      options: [
        {
          label: "7 Days",
          value: "7",
        },
        {
          label: "15 Days",
          value: "15",
        },
        {
          label: "30 Days",
          value: "30",
        },
        {
          label: "60 Days",
          value: "60",
        },
        {
          label: "90 Days",
          value: "90",
        },
      ],
    },
  ];

  const fetchDataFilterCallback = (data) => {
    return parseInt(data.properties["Sale Price"]) >= minimumSalePrice;
  };

  window.map = trdDataCommonMap({
    filePath:
      "https://teststatic.therealdeal.com/interactive-maps/cook_county_transaction_map_data.geojson",
    eventCategory: "chicago-transactions-map",
    mapElementId: "map",
    filterElementId: "map-filters",
    legendElementId: "legend",
    resultElementId: "result",
    mapCenterLat: 41.88458437713242,
    mapCenterLng: -87.64766953501464,
    zoom: 11,
    minZoom: 10,
    legendKeys,
    dataPointKeys: legendKeys[0].options,
    tooltipDisplayFields,
    modalDisplayFields,
    filterFields,
    fetchDataFilterCallback,
    mapLayerPaint: {
      "circle-radius": {
        base: 1.75,
        stops: [
          [1, 1],
          [10, 2],
          [12, 4],
          [15, 8],
          [20, 16],
        ],
      },
    },
  });
})();
