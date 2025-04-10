(() => {
  const trdTheme = TrdTheme();
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
          value: 2_500_000,
          color: {
            light: "#42A5F5",
            dark: "#42A5F5",
          },
          text: "$1M - $2.5M",
          default: false,
        },
        {
          value: 5_000_000,
          color: {
            light: "#1E88E5",
            dark: "#1E88E5",
          },
          text: "$2.5M - $5M",
          default: false,
        },
        {
          value: 10_000_000,
          color: {
            light: "#1565C0",
            dark: "#1565C0",
          },
          text: "$5M - $10M",
          default: false,
        },
        {
          value: 50_000_000,
          color: {
            light: "#0D47A1",
            dark: "#0D47A1",
          },
          text: "> $10M",
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
        field: "DTTT Amount",
        label: "Amount",
        format: "formatPrice",
      },
    ],
  };

  const modalDisplayFields = {
    title: {
      field: "Address",
      label: "Address",
    },
    content: [
      { field: "Doc Type", label: "Doc Type" },
      {
        field: "Assessor Identification Number",
        label: "Assessor ID",
      },
      { field: "Address", label: "Address" },
      { field: "First Owner", label: "First owner" },
      { field: "first owner tr", label: "First owner tr" },
      { field: "Use Definition", label: "Use definition" },
      {
        field: "Transfer Date",
        label: "Transfer date",
        format: "formatDate",
      },
      { field: "DTTT Amount", label: "Amount", format: "formatPrice" },
      { field: " BDL1 SQ FT ", label: " BDL1 SqFt " },
    ],
  };

  const filterFields = [
    {
      title: "Days",
      name: "days",
      dataField: "Transfer Date",
      fieldType: "radio",
      fieldLayoutClass: "radio-group",
      multiSelect: false,
      defaultValue: "365",
      callback: (values, item) => {
        const days = values[0];
        const date = new Date();
        date.setDate(date.getDate() - days);
        const recordDate = new Date(item.properties["Transfer Date"]);
        return recordDate >= date;
      },
      options: [
        {
          label: "12 Months",
          value: "365",
        },
        {
          label: "18 Months",
          value: "548",
        },
        {
          label: "24 Months",
          value: "730",
        },
      ],
    },
  ];

  const formatAddress = (row) => {
    if (
      TrdFormatters.isEmptyValue(row["House Number"]) ||
      TrdFormatters.isEmptyValue(row["Street Name"])
    ) {
      return "";
    }
    return `${row["House Number"]} ${row["Direction"]} ${row["Street Name"]}`;
  };

  const fetchDataFilterCallback = (data) => {
    const features = data.features.map((feature) => {
      const newProperties = {
        ...feature.properties,
        Address: formatAddress(feature.properties),
      };
      return {
        ...feature,
        properties: newProperties,
      };
    });
    return {
      ...data,
      features: features,
    };
  };

  window.map = trdDataCommonMap({
    filePath:
      "https://static.therealdeal.com/interactive-maps/los-angeles-transactions-map.geojson",
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
    mapLayerFieldKey: "DTTT Amount",
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
