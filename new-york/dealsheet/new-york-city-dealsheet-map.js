(() => {
  const getDealTypeFromUrl = () => {
    const pathname = window.location.pathname;
    if (pathname.includes("-buy-")) {
      return "Buy";
    }
    if (pathname.includes("-financing-")) {
      return "Financing";
    }
    if (pathname.includes("-office-leasing-")) {
      return "Office Leasing";
    }
    if (pathname.includes("-retail-leasing-")) {
      return "Retail Leasing";
    }
    return "Buy"; // Default case
  };

  const dealType = getDealTypeFromUrl();

  const buyLegendKeys = [
    {
      title: dealType === "Buy" ? "Sales" : "Finance",
      options: [
        {
          value: 10_000_000,
          color: {
            light: "#DEED97",
            dark: "#DEED97",
          },
          text: "< $10M",
          default: false,
        },
        {
          value: 20_500_000,
          color: {
            light: "#FAE096",
            dark: "#FAE096",
          },
          text: "$10M - $20.5M",
          default: false,
        },
        {
          value: 50_000_000,
          color: {
            light: "#F3AF6F",
            dark: "#F3AF6F",
          },
          text: "$20.5M - $50M",
          default: false,
        },
        {
          value: 70_500_000,
          color: {
            light: "#E4734F",
            dark: "#E4734F",
          },
          text: "$50M - $70.5M",
          default: false,
        },
        {
          value: 300_000_000,
          color: {
            light: "#C74032",
            dark: "#C74032",
          },
          text: "> $70.5M",
          default: true,
        },
      ],
    },
  ];

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
        format: "formatPrice",
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
        format: "formatPrice",
      },
      {
        field: "DEAL TYPE",
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
        field: "FULL ADDRESS",
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
    return {
      ...data,
      features: data.features
        .filter((feature) => {
          return feature.properties["DEAL TYPE"] === dealType;
        })
        .map((feature) => {
          // Convert SALE PRICE/LOAN AMOUNT to a number for comparison
          feature.properties["SALE PRICE/LOAN AMOUNT"] =
            TrdFormatters.getNumberValue(
              feature.properties["SALE PRICE/LOAN AMOUNT"]
            );
          return feature;
        }),
    };
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
      "https://static.therealdeal.com/interactive-maps/nyc-deal-sheet-map.geojson",
    mapElementId: "map",
    filterElementId: "map-filters",
    legendElementId: "legend",
    resultElementId: "result",
    mapCenterLat: 40.755327020390325,
    mapCenterLng: -73.95044562100685,
    zoom: 11,
    minZoom: 10,
    legendKeys:
      dealType === "Buy" || dealType === "Financing" ? buyLegendKeys : [],
    dataPointKeys:
      dealType === "Buy" || dealType === "Financing"
        ? buyLegendKeys[0].options
        : [],
    tooltipDisplayFields,
    modalDisplayFields,
    filterFields,
    loadingEnabled: true,
    pointSettings: {
      clickToCenter: true,
      clickToZoom: true,
      colorType:
        dealType === "Buy" || dealType === "Financing" ? "step" : "case",
      radiusType: "ratio",
      colorTypeDataKey: "SALE PRICE/LOAN AMOUNT",
      paintSettings: {
        default: {
          color: getDefaultColors(dealType),
        },
        hover: {
          color: { light: "#FF9800", dark: "#F57C00" },
        },
        active: {
          color: { light: "#FF5722", dark: "#D84315" },
        },
      },
    },
  });
})();
