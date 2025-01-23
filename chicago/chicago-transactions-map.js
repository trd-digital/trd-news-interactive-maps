(() => {
  const minimumSalePrice = 0;

  const legendKeys = [
    {
      title: "Sales",
      options: [
        {
          value: 250_000,
          color: {
            light: "#90CAF9",
            dark: "#90CAF9",
          },
          text: "< $250K",
          default: false,
        },
        {
          value: 500_000,
          color: {
            light: "#42A5F5",
            dark: "#42A5F5",
          },
          text: "$250K - $500K",
          default: false,
        },
        {
          value: 750_000,
          color: {
            light: "#1E88E5",
            dark: "#1E88E5",
          },
          text: "$500K - $750K",
          default: false,
        },
        {
          value: 2_000_000,
          color: {
            light: "#1565C0",
            dark: "#1565C0",
          },
          text: "$750K - $2M",
          default: false,
        },
        {
          value: 100_000_000,
          color: {
            light: "#0D47A1",
            dark: "#0D47A1",
          },
          text: "> $2M",
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
      field: "Full Address",
      label: "Address",
    },
    content: [
      { field: "Doc Type", label: "Doc Type" },
      {
        field: "Recorded Date",
        label: "Recorded Date",
        format: "formatDate",
      },
      { field: "Seller", label: "Seller" },
      { field: "Buyer", label: "Buyer" },
      {
        field: "Sale Price",
        label: "Sale Price",
        format: "formatPrice",
      },
      { field: "Folio", label: "Folio" },
      { field: "Instrument Number", label: "Instrument Number" },
      { field: "Use Code Description", label: "Use Code Description" },
      {
        field: "Doc Date",
        label: "Doc Date",
        format: "formatDate",
      },
      { field: "Assoc. Doc#", label: "Assoc. Doc#" },
      {
        field: "Mortgage Instrument Number",
        label: "Mortgage Instrument Number",
      },
      { field: "Borrower", label: "Borrower" },
      { field: "Lender", label: "Lender" },
      { field: "Loan Amount", label: "Loan Amount" },
      {
        field: "Doc URL",
        label: "Doc URL",
        format: (value) =>
          `<a href="${value}" target="_blank" rel="noopener noreferrer">View Property</a>`,
      },
      {
        field: "Mortgage URL",
        label: "Mortgage URL",
        format: (value) =>
          `<a href="${value}" target="_blank" rel="noopener noreferrer">View Mortgage</a>`,
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
      defaultValue: "60",
      callback: (values, item) => {
        const days = values[0];
        const date = new Date();
        date.setDate(date.getDate() - days);
        const recordDate = new Date(item.properties["Recorded Date"]);
        return recordDate >= date;
      },
      options: [
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
      ],
    },
    {
      title: "Property Type",
      name: "property_type",
      dataField: "Short Desc",
      fieldType: "checkbox",
      fieldLayoutClass: "checkbox-list",
      multiSelect: true,
      callback: (values, item) => {
        return values.some((value) =>
          item.properties["Short Desc"].includes(value)
        );
      },
      options: [
        {
          label: "Commercial",
          value: "Commercial",
        },
        {
          label: "Industrial",
          value: "Industrial",
        },
        {
          label: "Multi-Family",
          value: "Multi-Family",
        },
        {
          label: "Not-For-Profit",
          value: "Not-For-Profit",
        },
        {
          label: "Residential",
          value: "Residential",
        },
        {
          label: "Vacant",
          value: "Vacant",
        },
      ],
    },
  ];

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
    zoom: 8,
    minZoom: 9,
    legendKeys,
    dataPointKeys: legendKeys[0].options,
    tooltipDisplayFields,
    modalDisplayFields,
    filterFields,
    mapLayerPaint: {
      "circle-radius": {
        base: 1.75,
        stops: [
          [1, 1],
          [10, 4],
          [12, 8],
          [15, 10],
          [20, 16],
        ],
      },
    },
  });
})();
