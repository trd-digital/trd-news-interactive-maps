(() => {
  const legendKeys = [
    {
      title: "Sales",
      options: [
        {
          value: 1_000_000,
          color: {
            light: "#90CAF9",
            dark: "#90CAF9",
          },
          text: "< $1M",
          default: false,
        },
        {
          value: 5_000_000,
          color: {
            light: "#42A5F5",
            dark: "#42A5F5",
          },
          text: "$1M - $5M",
          default: false,
        },
        {
          value: 50_000_000,
          color: {
            light: "#1E88E5",
            dark: "#1E88E5",
          },
          text: "$5M - $50M",
          default: false,
        },
        {
          value: 100_000_000,
          color: {
            light: "#1565C0",
            dark: "#1565C0",
          },
          text: "$50M - $100M",
          default: false,
        },
        {
          value: 100_000_001,
          color: {
            light: "#0D47A1",
            dark: "#0D47A1",
          },
          text: "> $100M",
          default: true,
        },
      ],
    },
  ];

  const tooltipDisplayFields = {
    title: {
      field: "Address",
      label: "Address",
    },
    content: [
      {
        field: "Price",
        label: "Price",
        format: "formatPrice",
      },
      { field: "Property Use", label: "Property use" },
      { field: "Owner", label: "Owner" },
    ],
  };

  const modalDisplayFields = {
    title: {
      field: "Address",
      label: "Address",
    },
    content: [
      {
        field: "Assessor Identification Number",
        label: "Assessor ID",
      },
      { field: "Address", label: "Address" },
      { field: "Owner", label: "Owner" },
      { field: "Property Use", label: "Property use" },
      {
        field: "Clean Date",
        label: "Transfer date",
        format: "formatDate",
      },
      { field: "Built Year", label: "Year built" },
      { field: "Price", label: "Price", format: "formatPrice" },
      { field: "SqFt", label: "SqFt", format: "formatNumber" },
    ],
  };

  const filterFields = [
    {
      title: "Days",
      name: "days",
      dataField: "Clean Date",
      fieldType: "radio",
      fieldLayoutClass: "radio-group",
      multiSelect: false,
      defaultValue: "60",
      callback: (values, item) => {
        const days = values[0];
        const date = new Date();
        date.setDate(date.getDate() - days);
        const recordDate = new Date(item.properties["Clean Date"]);
        return recordDate >= date;
      },
      options: [
        {
          label: "2 Months",
          value: "60",
        },
        {
          label: "6 Months",
          value: "182",
        },
        {
          label: "12 Months",
          value: "365",
        },
        {
          label: "24 Months",
          value: "730",
        },
      ],
    },
    {
      title: "Price",
      name: "price",
      dataField: "Price",
      fieldType: "multi-range",
      minValue: 0,
      maxValue: 250_000_000,
      defaultValue: [0, 250_000_000],
      format: "formatCurrency",
      fieldLayoutClass: "range-slider-container",
      callback: (values, item) => {
        const price = item.properties["Price"];
        return price >= values[0] && price <= values[1];
      },
    },
    {
      title: "Year built",
      name: "year-built",
      dataField: "Built Year",
      fieldType: "multi-range",
      minValue: 1800,
      maxValue: new Date().getFullYear(),
      allowZero: true,
      defaultValue: [1800, new Date().getFullYear()],
      fieldLayoutClass: "range-slider-container",
      callback: (values, item) => {
        const yearBuild = parseInt(item.properties["Built Year"]);
        return yearBuild >= values[0] && yearBuild <= values[1];
      },
    },
    {
      title: "SqFt",
      name: "sqft",
      dataField: "SqFt",
      fieldType: "multi-range",
      minValue: 0,
      maxValue: 60_000,
      defaultValue: [0, 60_000],
      fieldLayoutClass: "range-slider-container",
      format: "formatNumber",
      callback: (values, item) => {
        const sqft = parseInt(item.properties["SqFt"]);
        return sqft >= values[0] && sqft <= values[1];
      },
    },
  ];

  fetchDataFilterCallback = (data) => {
    const features = data.features.map((item) => {
      const newItem = { ...item };
      const properties = { ...item.properties };
      const newProperties = {
        ...properties,
        SqFt: properties[" SqFt "] || 0,
        Price: TrdFormatters.getNumberValue(properties["Price"]) || 0,
      };
      delete newProperties[" SqFt "];
      delete newProperties["Public_Price"];
      newItem.properties = newProperties;
      return newItem;
    });
    return {
      ...data,
      features,
    };
  };

  window.map = trdDataCommonMap({
    filePath: "/data/los-angeles-transactions-map.geojson",
    eventCategory: "los-angeles-transactions-map",
    mapElementId: "map",
    filterElementId: "map-filters",
    legendElementId: "legend",
    resultElementId: "result",
    mapCenterLat: 34.258064,
    mapCenterLng: -118.1569318,
    zoom: 9,
    minZoom: 8,
    legendKeys,
    dataPointKeys: legendKeys[0].options,
    tooltipDisplayFields,
    modalDisplayFields,
    mapLayerFieldKey: "Price",
    filterFields,
    fetchDataFilterCallback,
    loadingEnabled: true,
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
