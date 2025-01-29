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
          default: false,
          color: {
            light: "#BF360C",
            dark: "#BF360C",
          },
        },
        {
          text: "Other",
          value: "",
          default: true,
          color: {
            light: "#000000",
            dark: "#ffffff",
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
      { field: "Building Name", label: "Building Name" },
      {
        field: "Website",
        label: "Website",
        format: (value) => `<a href="${value}" target="_blank">Website</a>`,
      },
      { field: "Plan ID", label: "Plan ID" },
      { field: "Instrument Status", label: "Instrument Status" },
      {
        field: "Submitted Date",
        label: "Submitted Date",
        format: "formatDate",
      },
      { field: "Accepted Date", label: "Accepted Date", format: "formatDate" },
      { field: "Reviewed Date", label: "Reviewed Date", format: "formatDate" },
      {
        field: "Effective Date",
        label: "Effective Date",
        format: "formatDate",
      },
      { field: "Rejected Date", label: "Rejected Date", format: "formatDate" },
      {
        field: "Withdrawn Date",
        label: "Withdrawn Date",
        format: "formatDate",
      },
      {
        field: "Abandoned Date",
        label: "Abandoned Date",
        format: "formatDate",
      },
      { field: "Project Name", label: "Project Name" },
      {
        field: "Boro ID",
        label: "Boro ID",
        format: (value) => {
          return value === "1"
            ? "Manhattan"
            : value === "2"
            ? "Bronx"
            : value === "3"
            ? "Brooklyn"
            : value === "4"
            ? "Queens"
            : value === "5"
            ? "Staten Island"
            : value;
        },
      },
      {
        field: "group",
        label: "Address",
        fields: [
          { field: "Address", label: "Address" },
          { field: "Address2", label: "Address2" },
        ],
      },
      { field: "Plan Type", label: "Plan Type" },
      { field: "Type of Offering", label: "Type of Offering" },
      { field: "Construction Type", label: "Construction Type" },
      { field: "Sponsor", label: "Sponsor" },
      { field: "Sponsor Address", label: "Sponsor Address" },
      { field: "Principal Name", label: "Principal Name" },
      { field: "Title Function", label: "Title Function" },
      {
        field: "Number of Residential Units",
        label: "Number of Residential Units",
        format: "formatInteger",
      },
      {
        field: "Total Number of Units",
        label: "Total Number of Units",
        format: "formatInteger",
      },
      { field: "Inital Price", label: "Inital Price", format: "formatPrice" },
      { field: "Current Price", label: "Current Price", format: "formatPrice" },
      { field: "BBLs", label: "BBLs" },
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
