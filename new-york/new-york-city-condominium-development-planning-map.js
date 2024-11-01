(() => {
  const legendKeys = [
    {
      title: "Application",
      options: [
        {
          text: "Submitted",
          value: "Application Submitted",
          default: false,
          color: {
            light: "#FFAB91",
            dark: "#FFCCBC",
          },
        },
        {
          text: "Accepted",
          value: "Application Accepted",
          default: false,
          color: {
            light: "#FF7043",
            dark: "#FF8A65",
          },
        },
        {
          text: "Effective",
          value: "Application Effective",
          default: false,
          color: {
            light: "#F4511E",
            dark: "#F4511E",
          },
        },
        {
          text: "Abandoned",
          value: "Application Abandoned",
          default: true,
          color: {
            light: "#BF360C",
            dark: "#BF360C",
          },
        },
      ],
    },
  ];

  const tooltipDisplayFields = {
    title: {
      field: "Project Name",
      label: "Project Name",
    },
    content: [
      {
        field: "Instrument Status",
        label: "Status",
      },
      {
        field: "Submitted Date",
        label: "Submitted Date",
        format: "formatDate",
      },
      {
        field: "Current Price",
        label: "Current Price",
        format: "formatPrice",
        filter: (value) => value > 0,
      },
      {
        field: "Total Number of Units",
        label: "Total Units",
        format: "formatInteger",
        filter: (value) => value > 0,
      },
    ],
  };

  const modalDisplayFields = {
    title: {
      field: "Project Name",
      label: "Project Name",
    },
    content: [
      { field: "Instrument Number", label: "Instrument Number" },
      { field: "Address", label: "Address" },
      { field: "borough", label: "borough" },
      {
        field: "Submitted Date",
        label: "Submitted Date",
        format: "formatDate",
      },
      { field: "Instrument Status", label: "Instrument Status" },
      { field: "Current Price", label: "Current Price", format: "formatPrice" },
      {
        field: "Number of Commercial Units",
        label: "Number of Commercial Units",
        format: "formatInteger",
      },
      {
        field: "Number of Residential Units",
        label: "Number of Residential Units",
        format: "formatInteger",
      },
      {
        field: "Total Number of Condo Units",
        label: "Total Number of Condo Units",
        format: "formatInteger",
      },
      {
        field: "Number of Regulated Units",
        label: "Number of Regulated Units",
        format: "formatInteger",
      },
      {
        field: "Number of NonRegulated Units",
        label: "Number of NonRegulated Units",
        format: "formatInteger",
      },
      {
        field: "Number of Resort Units",
        label: "Number of Resort Units",
        format: "formatInteger",
      },
      {
        field: "Number of Storage Units",
        label: "Number of Storage Units",
        format: "formatInteger",
      },
      {
        field: "Number of Parking Units",
        label: "Number of Parking Units",
        format: "formatInteger",
      },
      {
        field: "Number of Other Units",
        label: "Number of Other Units",
        format: "formatInteger",
      },
      {
        field: "Total Number of Units",
        label: "Total Number of Units",
        format: "formatInteger",
      },
      {
        field: "Number of Units Sold - NY AG",
        label: "Number of Units Sold",
        format: "formatInteger",
      },
      {
        field: "Total Number of Condo Units Sold",
        label: "Total Number of Condo Units Sold",
        format: "formatInteger",
      },
      {
        field: "Total Sold Dollar Amount",
        label: "Total Sold Dollar Amount",
        format: "formatPrice",
      },
    ],
  };

  const filterFields = [
    {
      title: "Days",
      name: "days",
      dataField: "Submitted Date",
      fieldType: "radio",
      fieldLayoutClass: "radio-group",
      multiSelect: false,
      defaultValue: "730",
      callback: (values, item) => {
        const days = values[0];
        const date = new Date();
        date.setDate(date.getDate() - days);
        const recordDate = new Date(item.properties["Submitted Date"]);
        return recordDate >= date;
      },
      options: [
        {
          label: "1 Month",
          value: "30",
        },
        {
          label: "3 Months",
          value: "90",
        },
        {
          label: "6 Months",
          value: "180",
        },
        {
          label: "1 Year",
          value: "365",
        },
        {
          label: "2 Years",
          value: "730",
        },
      ],
    },
    {
      title: "Status",
      name: "status",
      dataField: "Instrument Status",
      fieldType: "checkbox",
      fieldLayoutClass: "checkbox-group",
      multiSelect: true,
      callback: (values, item) => {
        return values.some((value) => {
          if (value === "" || value.length === 0) {
            return item.properties["Instrument Status"] === "";
          }

          const group = value.split("|");
          for (const v of group) {
            if (item.properties["Instrument Status"].includes(v)) {
              return true;
            }
          }
        });
      },
      options: [
        {
          label: "Submitted",
          value: "Application Submitted",
        },
        {
          label: "Accepted",
          value: "Application Accepted",
        },
        {
          label: "Effective",
          value: "Application Effective",
        },
        {
          label: "Abandoned",
          value: "Application Abandoned",
        },
      ],
    },
  ];

  // const list = [];

  // fetchDataFilterCallback = (item) => {
  //   if (!list.includes(item.properties["Instrument Status"])) {
  //     list.push(item.properties["Instrument Status"]);
  //   }
  //   return true;
  // };

  // window.list = list;

  window.map = trdDataCommonMap({
    fetchDataFilterCallback: undefined,
    eventCategory: "new-york-city-condo-dev-planning-map",
    filePath:
      "https://static.therealdeal.com/interactive-maps/new-york-ag-offering-plans-map.geojson",
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
    mapLayerFieldKey: "Instrument Status",
    paintCircleColorType: "case",
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
