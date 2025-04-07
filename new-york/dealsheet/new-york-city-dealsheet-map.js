(() => {
  const map = document.getElementById("map");
  const dealType = map.getAttribute("data-deal-type");

  const tooltipDisplayFields = {
    title: {
      field: "ADDRESS",
      label: "Address",
    },
    content: [
      {
        field: "NEIGHBORHOOD",
        label: "Neighborhood",
      },
      {
        field: "BOROUGH",
        label: "Borough",
      },
      {
        field: "DEAL CLOSING DATE",
        label: "Deal Closing Date",
        format: "formatDate",
      },
      {
        field: "SALE PRICE/LOAN AMOUNT",
        label: dealType === "Buy" ? "Sale Price" : "Loan Amount",
      },
    ],
  };

  const modalDisplayFields = {
    title: {
      field: "ADDRESS",
      label: "Address",
    },
    content: [
      {
        field: "SALE PRICE/LOAN AMOUNT",
        label: dealType === "Buy" ? "Sale Price" : "Loan Amount",
      },
      {
        field: "Deal Type",
        label: "Deal Type",
      },
      {
        field: "DEAL CLOSING DATE",
        label: "Deal Closing Date",
        format: "formatDate",
      },
      {
        field: "DATE ENTERED",
        label: "Date Entered",
        format: "formatDate",
      },
      {
        field: "Full Address",
        label: "Full Address",
      },
      {
        field: "NEIGHBORHOOD",
        label: "Neighborhood",
      },
      {
        field: "BOROUGH",
        label: "Borough",
      },
      { field: "BBL", label: "BBL" },
      {
        field: "SQUARE FEET",
        label: "Square Feet",
      },
      {
        field: "LANDLORD SELLER/BORROWER",
        label: dealType === "Buy" ? "Seller" : "Borrower",
      },
      {
        field: "LANDLORD BROKER",
        label: dealType === "Buy" ? "Seller Broker" : "Borrower Broker",
      },
      {
        field: "LANDLORD BROKERAGE",
        label: dealType === "Buy" ? "Seller Brokerage" : "Borrower Brokerage",
      },
      {
        field: "LANDLORD TYPE",
        label: dealType === "Buy" ? "Seller Type" : "Borrower Type",
      },
      {
        field: "TENANT BUYER/LENDER",
        label: dealType === "Buy" ? "Buyer" : "Lender",
      },
      {
        field: "TENANT BROKER",
        label: dealType === "Buy" ? "Buyer Broker" : "Lender Broker",
      },
      {
        field: "TENANT BROKERAGE",
        label: dealType === "Buy" ? "Buyer Brokerage" : "Lender Brokerage",
      },
      {
        field: "TENANT TYPE",
        label: dealType === "Buy" ? "Buyer Type" : "Lender Type",
      },
      {
        field: "TENANT BUSINESS TYPE",
        label:
          dealType === "Buy" ? "Buyer Business Type" : "Lender Business Type",
      },
      {
        field: "SPECIAL CASES",
        label: "Special Cases",
      },
      {
        field: "YEARS OF LEASE",
        label: "Years of Lease",
      },
      {
        field: "CLEAN RENT/PRICE PER SQUARE FOOT",
        label:
          dealType === "Buy" || dealType === "Financing"
            ? "Price Per SqFt"
            : "Rent Per SqFt",
      },
      {
        field: "GENERAL DS NOTES",
        label: "General Notes",
      },
    ],
  };

  const filterFields = [
    {
      title: "Days",
      name: "days",
      dataField: "DEAL CLOSING DATE",
      fieldType: "radio",
      fieldLayoutClass: "radio-group",
      multiSelect: false,
      defaultValue: "730",
      callback: (values, item) => {
        const days = values[0];
        const date = new Date();
        date.setDate(date.getDate() - days);
        const recordDate = new Date(item.properties["DEAL CLOSING DATE"]);
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
  ];

  const fetchDataFilterCallback = (data) => {
    return data.properties["Deal Type"] === dealType;
  };

  const getDefaultColors = (dealType) => {
    switch (dealType) {
      case "Buy":
        return {
          light: "#1E88E5",
          dark: "#1E88E5",
        };
      case "Financing":
        return {
          light: "#FFB300",
          dark: "#FFB300",
        };
      case "Office Leasing":
        return {
          light: "#4CAF50",
          dark: "#4CAF50",
        };
      case "Retail Leasing":
      default:
        return {
          light: "#673AB7",
          dark: "#9575CD",
        };
    }
  };

  window.map = trdDataCommonMap({
    fetchDataFilterCallback,
    eventCategory: "new-york-city-deal-sheet-buy-map",
    filePath:
      "https://teststatic.therealdeal.com/interactive-maps/nyc_dealsheet.geojson",
    mapElementId: "map",
    filterElementId: "map-filters",
    legendElementId: "legend",
    resultElementId: "result",
    mapCenterLat: 40.755327020390325,
    mapCenterLng: -73.95044562100685,
    zoom: 11,
    minZoom: 10,
    legendKeys: [],
    dataPointKeys: [],
    tooltipDisplayFields,
    modalDisplayFields,
    filterFields,
    mapLayerFieldKey: "Deal Type",
    defaultColors: getDefaultColors(dealType),
    paintCircleColorType: "",
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
