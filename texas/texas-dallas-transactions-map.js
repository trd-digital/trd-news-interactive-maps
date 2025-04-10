(() => {
  const tooltipDisplayFields = {
    title: {
      field: "Property Address",
      label: "Address",
    },
    content: [
      {
        field: "Recorded Date",
        label: "Recorded Date",
        format: "formatDate",
      },
      {
        field: "Town",
        label: "Town",
      },
      {
        field: "Doc Type",
        label: "Doc Type",
      },
    ],
  };

  const modalDisplayFields = {
    title: {
      field: "Property Address",
      label: "Address",
    },
    content: [
      { field: "Grantor", label: "Grantor" },
      { field: "Grantee", label: "Grantee" },
      { field: "Doc Type", label: "Doc Type" },
      { field: "Recorded Date", label: "Recorded Date", format: "formatDate" },
      { field: "Doc Number", label: "Doc Number" },
      { field: "Town", label: "Town" },
      { field: "Legal Description", label: "Legal Description" },
      {
        field: "Record Link",
        label: "Record Link",
        format: (value) => `<a href="${value}" target="_blank">View Record</a>`,
      },
      { field: "SubdivisionName", label: "SubdivisionName" },
      { field: "Lot", label: "Lot" },
      { field: "Block", label: "Block" },
      { field: "Township", label: "Township" },
      { field: "Reference", label: "Reference" },
      { field: "Account Number", label: "Account Number" },
      { field: "Appraisal Year", label: "Appraisal Year" },
      { field: "Division CD", label: "Division CD" },
      { field: "Owner Name1", label: "Owner Name1" },
      { field: "Owner Name2", label: "Owner Name2" },
      { field: "Owner Address Line1", label: "Owner Address Line1" },
      { field: "Owner Address Line2", label: "Owner Address Line2" },
      { field: "Owner Address Line3", label: "Owner Address Line3" },
      { field: "Owner Address Line4", label: "Owner Address Line4" },
      { field: "Owner City", label: "Owner City" },
      { field: "Owner State", label: "Owner State" },
      { field: "Owner ZipCode", label: "Owner ZipCode" },
      { field: "Owner Country", label: "Owner Country" },
      { field: "Property City", label: "Property City" },
      { field: "Property ZipCode", label: "Property ZipCode" },
      { field: "NBND CD", label: "NBND CD" },
      { field: "Legal1", label: "Legal1" },
      { field: "Legal2", label: "Legal2" },
      { field: "Legal3", label: "Legal3" },
      { field: "Deed TXFR Date", label: "Deed TXFR Date" },
      { field: "GIS Parcel ID", label: "GIS Parcel ID" },
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
      defaultValue: "30",
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
      ],
    },
  ];

  window.map = trdDataCommonMap({
    filePath:
      "https://static.therealdeal.com/interactive-maps/dallas-transactions-map.geojson",
    eventCategory: "texas-dallas-transactions-table",
    mapElementId: "map",
    filterElementId: "map-filters",
    legendElementId: "legend",
    resultElementId: "result",
    mapCenterLat: 32.8185041,
    mapCenterLng: -96.7320961,
    zoom: 10,
    minZoom: 8,
    tooltipDisplayFields,
    modalDisplayFields,
    filterFields,
    defaultColors: {
      light: "#1E88E5",
      dark: "#1E88E5",
    },
    paintCircleColorType: "",
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
