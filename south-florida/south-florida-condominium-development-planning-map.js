(() => {
  const legendKeys = [
    {
      title: "Status",
      options: [
        {
          text: "Submitted",
          value: "Acknowledged",
          default: false,
          color: {
            light: "#FFAB91",
            dark: "#FFCCBC",
          },
        },
        {
          text: "Accepted",
          value: "Approved",
          default: false,
          color: {
            light: "#FF7043",
            dark: "#FF8A65",
          },
        },
        {
          text: "Other",
          value: "",
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
      field: "Condo Name",
      label: "Project Name",
    },
    content: [
      {
        field: "Primary Status",
        label: "Status",
      },
      {
        field: "Recorded Date",
        label: "Recorded Date",
        format: "formatDate",
      },
      {
        field: "Units",
        label: "# of Units",
        format: "formatInteger",
      },
    ],
  };

  const modalDisplayFields = {
    title: {
      field: "Condo Name",
      label: "Project Name",
    },
    content: [
      { field: "Project Number", label: "Project Number" },
      { field: "File Number", label: "File Number", format: "formatInteger" },
      { field: "Condo Name", label: "Condo Name" },
      { field: "County", label: "County" },
      { field: "Street City State Zip", label: "Address" },
      { field: "Units", label: "Units", format: "formatInteger" },
      { field: "Recorded Date", label: "Recorded Date", format: "formateDate" },
      { field: "Primary Status", label: "Primary Status" },
      { field: "Secondary Status", label: "Secondary Status" },
      { field: "Managing Entity Number", label: "Managing Entity Number" },
      { field: "Managing Entity Name", label: "Managing Entity Name" },
      { field: "Managing Entity Route", label: "Managing Entity Route" },
      { field: "Managing Entity Street", label: "Managing Entity Street" },
      { field: "Managing Entity City", label: "Managing Entity City" },
      { field: "Managing Entity State", label: "Managing Entity State" },
      {
        field: "Managing Entity Zip",
        label: "Managing Entity Zip",
        format: "formatInteger",
      },
      { field: "Developer Name", label: "Developer Name" },
      { field: "Mailing Street", label: "Mailing Street" },
      { field: "Mailing Address Line 2", label: "Mailing Address Line 2" },
      { field: "Mailing Address Line 3", label: "Mailing Address Line 3" },
      { field: "Mailing City", label: "Mailing City" },
      { field: "Mailing State", label: "Mailing State" },
      { field: "Mailing Zip", label: "Mailing Zip", format: "formatInteger" },
      { field: "Mailing County Name", label: "Mailing County Name" },
    ],
  };

  const filterFields = [
    {
      title: "County",
      name: "county",
      dataField: "County",
      fieldType: "checkbox",
      fieldLayoutClass: "checkbox-group",
      multiSelect: true,
      callback: (values, item) => {
        return values.some((value) => {
          if (value === "" || value.length === 0) {
            return item.properties["County"] === "";
          }
          const group = value.split("|");
          for (const v of group) {
            if (item.properties["County"].includes(v)) {
              return true;
            }
          }
        });
      },
      options: [
        {
          label: "Miami-Dade",
          value: "Dade",
        },
        {
          label: "Palm Beach",
          value: "Palm Beach",
        },
        {
          label: "Broward",
          value: "Broward",
        },
      ],
    },
    {
      title: "Status",
      name: "status",
      dataField: "Primary Status",
      fieldType: "checkbox",
      fieldLayoutClass: "checkbox-group",
      multiSelect: true,
      callback: (values, item) => {
        return values.some((value) => {
          if (value === "" || value.length === 0) {
            return item.properties["Primary Status"] === "";
          }
          const group = value.split("|");
          for (const v of group) {
            if (item.properties["Primary Status"].includes(v)) {
              return true;
            }
          }
        });
      },
      options: [
        {
          label: "Submitted",
          value: "Acknowledged",
        },
        {
          label: "Accepted",
          value: "Approved",
        },
        {
          label: "Other",
          value: "",
        },
      ],
    },
  ];

  const list = [];

  fetchDataFilterCallback = (item) => {
    if (!list.includes(item.properties["County"])) {
      list.push(item.properties["County"]);
    }
    return true;
  };

  window.list = list;

  window.map = trdDataCommonMap({
    fetchDataFilterCallback,
    eventCategory: "south-florida-condo-dev-planning-map",
    filePath:
      "https://static.therealdeal.com/interactive-maps/south-florida-condo-pipeline.geojson",
    mapElementId: "map",
    filterElementId: "map-filters",
    legendElementId: "legend",
    resultElementId: "result",
    mapCenterLat: 26.380126753919782,
    mapCenterLng: -80.38513016032842,
    zoom: 8,
    minZoom: 8,
    legendKeys,
    dataPointKeys: legendKeys[0].options,
    tooltipDisplayFields,
    modalDisplayFields,
    filterFields,
    mapLayerFieldKey: "Primary Status",
    paintCircleColorType: "case",
    mapLayerPaint: {
      "circle-radius": 6,
    },
  });
})();
