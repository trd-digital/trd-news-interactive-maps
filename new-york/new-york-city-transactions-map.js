(() => {
  const minimumSalePrice = 250_000;

  const legendKeys = [
    {
      title: "Sales",
      options: [
        {
          value: 750_000,
          color: {
            light: "#90CAF9",
            dark: "#90CAF9",
          },
          text: "< $750K",
          default: false,
        },
        {
          value: 1_000_000,
          color: {
            light: "#42A5F5",
            dark: "#42A5F5",
          },
          text: "$750K - $1M",
          default: false,
        },
        {
          value: 3_000_000,
          color: {
            light: "#1E88E5",
            dark: "#1E88E5",
          },
          text: "$1M - $3M",
          default: false,
        },
        {
          value: 4_000_000,
          color: {
            light: "#1565C0",
            dark: "#1565C0",
          },
          text: "$3M - $4M",
          default: false,
        },
        {
          value: 300_000_000,
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
      field: "Physical Address",
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
      dataField: "Record Date",
      fieldType: "radio",
      fieldLayoutClass: "radio-group",
      multiSelect: false,
      defaultValue: "30",
      callback: (values, item) => {
        const days = values[0];
        const date = new Date();
        date.setDate(date.getDate() - days);
        const recordDate = new Date(item.properties["Record Date"]);
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
      ],
    },
    {
      title: "Property",
      name: "property",
      dataField: "Use Code Description",
      fieldType: "checkbox",
      fieldLayoutClass: "checkbox-group",
      multiSelect: true,
      callback: (values, item) => {
        return values.some((value) =>
          item.properties["Use Code Description"].includes(value)
        );
      },
      options: [
        {
          label: "Residential",
          value: "Residential",
        },
        {
          label: "Commercial",
          value: "Commercial",
        },
      ],
    },
    {
      title: "Property Type",
      name: "property_type",
      dataField: "Use Code Description",
      fieldType: "checkbox",
      fieldLayoutClass: "checkbox-list",
      multiSelect: true,
      callback: (values, item) => {
        return values.some((value) =>
          item.properties["Use Code Description"].includes(value)
        );
      },
      options: [
        {
          label: "Single Family Home",
          value: "Single-Family Home",
        },
        {
          label: "Multi-Family Dwelling",
          value: "Multi-Family Dwelling",
        },
        {
          label: "Co-op",
          value: "Co-op",
        },
        {
          label: "Condo",
          value: "Condo",
        },
        {
          label: "Land",
          value: "Land",
        },
        {
          label: "Other",
          value: "Other",
        },
      ],
    },
  ];

  const fetchDataFilterCallback = (data) => {
    return {
      ...data,
      features: data.features.filter((feature) => {
        return parseInt(feature.properties["Sale Price"]) > minimumSalePrice;
      }),
    };
  };

  window.map = trdDataCommonMap({
    filePath:
      "https://static.therealdeal.com/interactive-maps/new-york-city-transactions-map.geojson",
    eventCategory: "new-york-transactions-map",
    mapElementId: "map",
    filterElementId: "map-filters",
    legendElementId: "legend",
    resultElementId: "result",
    mapCenterLat: 40.755327020390325,
    mapCenterLng: -73.95044562100685,
    zoom: 11,
    minZoom: 10,
    legendKeys,
    dataPointKeys: legendKeys[0].options,
    tooltipDisplayFields,
    modalDisplayFields,
    filterFields,
    fetchDataFilterCallback,
    loadingEnabled: true,
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
