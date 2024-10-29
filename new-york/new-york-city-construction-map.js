(() => {
  const legendKeys = [
    {
      title: "Status",
      options: [
        {
          text: "Submitted",
          value: "Under Review|On Hold",
          default: false,
          color: {
            light: "#A5D6A7",
            dark: "#C8E6C9",
          },
        },
        {
          text: "Approved",
          value: "Approved|Issued",
          default: false,
          color: {
            light: "#43A047",
            dark: "#4CAF50",
          },
        },
        {
          text: "Other",
          value: "Other",
          default: true,
          color: {
            light: "#1B5E20",
            dark: "#1B5E20",
          },
        },
      ],
    },
  ];

  const tooltipDisplayFields = {
    title: {
      field: "Property Address",
      label: "Address",
    },
    content: [
      {
        field: "Instrument Status",
        label: "Status",
      },
      {
        field: "Instrument Type",
        label: "Type",
      },
    ],
  };

  const modalDisplayFields = {
    title: {
      field: "Property Address",
      label: "Address",
    },
    content: [
      { field: "Instrument Type", label: "Type" },
      {
        field: "Instrument Number",
        label: "Number",
      },
      { field: "BBL", label: "BBL", format: "formatNumber" },
      { field: "BIN", label: "BIN", format: "formatNumber" },
      {
        field: "Property Address",
        label: "Address",
      },
      {
        field: "Borough",
        label: "Borough",
      },
      {
        field: "Filing Date",
        label: "Filing Date",
        format: "formatDate",
      },
      { field: "Description", label: "Description" },
      {
        field: "Estimated Job Cost",
        label: "Estimated Job Cost",
        format: "formatPrice",
      },
      {
        field: "Total Construction Floor Area",
        label: "Total Construction Floor Area",
        format: "formatNumber",
      },
      {
        field: "Total Building Square Footage",
        label: "Total Building Square Footage",
        format: "formatNumber",
      },
      {
        field: "Proposed Additional Square Feet",
        label: "Proposed Additional Square Feet",
        format: "formatNumber",
      },
      {
        field: "Selected Proposed Square Feet",
        label: "Selected Proposed Square Feet",
        format: "formatNumber",
      },
      { field: "Proposed Dwelling units", label: "Proposed Dwelling units" },
      { field: "Existing Dwelling Units", label: "Existing Dwelling Units" },
      {
        field: "Proposed Number of Stories",
        label: "Proposed Number of Stories",
      },
      {
        field: "Existing Number of Stories",
        label: "Existing Number of Stories",
      },
      { field: "Instrument Status", label: "Instrument Status" },
      { field: "Instrument Status Date", label: "Instrument Status Date" },
      { field: "Architect/Engineer Firm", label: "Architect/Engineer Firm" },
      { field: "Propery Owner", label: "Property Owner" },
      {
        field: "PLUTO Total Residential Units",
        label: "Total Residential Units",
      },
      { field: "PLUTO Total Units", label: "Total Units" },
      { field: "PLUTO Lot Area", label: "Lot Area" },
      { field: "PLUTO Building Area", label: "Building Area" },
    ],
  };

  const filterFields = [
    {
      title: "Days",
      name: "days",
      dataField: "Filing Date",
      fieldType: "radio",
      fieldLayoutClass: "radio-group",
      multiSelect: false,
      defaultValue: "365",
      callback: (values, item) => {
        const days = values[0];
        const date = new Date();
        date.setDate(date.getDate() - days);
        const recordDate = new Date(item.properties["Filing Date"]);
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
        console.log("status", item.properties["Instrument Status"]);
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
          value: "Under Review|On Hold",
        },
        {
          label: "Approved",
          value: "Approved|Issued",
        },
      ],
    },
    {
      title: "Type",
      name: "type",
      dataField: "Instrument Type",
      fieldType: "checkbox",
      fieldLayoutClass: "checkbox-group",
      multiSelect: true,
      callback: (values, item) => {
        return values.some(
          (value) => item.properties["Instrument Type"] === value
        );
      },
      options: [
        {
          label: "Alteration",
          value: "Major Alteration",
        },
        {
          label: "New Building",
          value: "New Building",
        },
        {
          label: "Demolition",
          value: "Demolition",
        },
      ],
    },
  ];

  window.map = trdDataCommonMap({
    fetchDataFilterCallback: undefined,
    eventCategory: "new-york-city-construction-map",
    filePath:
      "https://static.therealdeal.com/interactive-maps/new-york-city-dob-now-job-filings-map.geojson",
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
