(function () {
  const table = document.querySelector("#table");
  const dataUrl = table.getAttribute("data-json-url");

  const displayColumns = [
    { dataField: "LANDLORD SELLER BORROWER", name: "Sellers/Borrower" },
    { dataField: "TENANT BUYER LENDER", name: "Buyers/Lender" },
    {
      dataField: "DEAL CLOSING DATE",
      name: "Deal Closing Date",
      sorterCallback: (a, b) => {
        if (isEmptyValue(a) || isEmptyValue(b)) {
          return 0;
        }
        return new Date(a).getTime() - new Date(b).getTime();
      },
    },
    { dataField: "ADDRESS", name: "Address" },
    { dataField: "NEIGHBORHOOD", name: "Neighborhood" },
    { dataField: "BOROUGH", name: "Borough" },
    {
      dataField: "SQUARE FEET",
      name: "SqFt",
      sorterCallback: (a, b) => {
        if (isEmptyValue(a) || isEmptyValue(b)) {
          return 0;
        }
        return getNumberValue(a) - getNumberValue(b);
      },
    },
  ];

  const displayFields = [
    "DEAL TYPE",
    "DEAL CLOSING DATE",
    "ADDRESS",
    "BOROUGH",
    "BBL",
    "NEIGHBORHOOD",
    "SQUARE FEET",
    "LANDLORD SELLER BORROWER",
    "LANDLORD BROKER",
    "LANDLORD BROKERAGE",
    "TENANT BUYER LENDER",
    "TENANT BROKER",
    "TENANT BROKERAGE",
    "GENERAL DS NOTES",
    "CLEAN RENT/PRICE PER SQUARE FOOT",
    "DATE ENTERED",
  ];

  const excludeValue = [
    "null",
    "undefined",
    "n/a",
    "na",
    "none",
    "not available",
    "not applicable",
    "no",
    "0",
    "false",
    "unknown",
    "data not found",
    "nan",
    "-",
    "folio not found!",
    "folio not found",
  ];

  const trackEvent = (action, label) => {
    if (window.dataLayer) {
      window.dataLayer.push({
        event: "event_tracking",
        trd: {
          category: "new-york-dealsheet-table",
          action: `table_${action}`,
          label: label,
        },
      });
    }
  };

  const mapDetailRow = (key, row, i) => {
    const value = row[key];
    if (isEmptyValue(value)) {
      return "";
    }
    return `<tr>
      <td class="text-capitalize">
      ${key.replace(/_/g, " ")}
      </td>
      <td>${formatter(value, row, i, key)}</td>
    </tr>`;
  };

  const detailFormatter = (index, row) => {
    const displayRows = displayFields.filter(
      (field) => !isEmptyValue(row[getFieldName(field)])
    );

    trackEvent("detail_open", row.address ? row.address : "Unknown Address");

    return `
      <div class="container">
        <div class="row my-5">
          <div class="col-12 col-md-6">
            <table class="table table-sm">
              <tbody>
                ${displayRows
                  .slice(0, Math.ceil(displayRows.length / 2))
                  .map((key, i) => mapDetailRow(getFieldName(key), row, i))
                  .join("")}
              </tbody>
            </table>
          </div>
          <div class="col-12 col-md-6">
            <table class="table table-sm">
              <tbody>
                ${displayRows
                  .slice(Math.ceil(displayRows.length / 2))
                  .map((key, i) => mapDetailRow(getFieldName(key), row, i))
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  };

  const tableConfig = {
    sortable: true,
    search: true,
    searchHighlight: true,
    sortName: "deal_closing_date",
    sortEmptyLast: true,
    sortOrder: "desc",
    sortEmptylast: true,
    pagination: true,
    paginationVAlign: "top",
    pageList: [10, 50, 100],
    pageSize: 100,
    classes: "table table-responsive",
    theadClasses: "header-style",
    detailView: true,
    detailFormatter: detailFormatter,
    icons: {
      detailOpen: "bi bi-chevron-down",
      detailClose: "bi bi-chevron-up",
    },
    showColumns: true,
    showColumnsToggleAll: true,
    minimumCountColumns: 2,
    stickyHeader: true,
    stickyHeaderOffsetY: 56,
    stickyHeaderOffsetLeft: parseInt($("body").css("padding-left"), 10),
    stickyHeaderOffsetRight: parseInt($("body").css("padding-right"), 10),
    onSort: (name, order) => {
      document.querySelectorAll(".header-style .sorted").forEach((header) => {
        header.classList.remove("sorted");
      });
      const header = document.querySelector(`[data-field="${name}"]`);
      header.classList.add("sorted");
    },
    onPostHeader: () => {
      document
        .querySelectorAll(
          ".header-style .sortable.desc, .header-style .sortable.asc"
        )
        .forEach((header) => {
          header.parentNode.classList.add("sorted");
        });
    },
  };

  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.body.setAttribute("data-bs-theme", "dark");
  }

  const isEmptyValue = (value) => {
    if (!value) return true;
    if (value === "") return true;
    if (typeof value === "string") {
      if (value.trim() === "") return true;
      if (excludeValue.includes(value.toLowerCase())) return true;
    }
    return false;
  };

  const getNumberValue = (value) => {
    if (isEmptyValue(value)) {
      return 0;
    }
    if (typeof value === "string") {
      return parseFloat(value.replace(/[$,]/g, ""));
    }
    return value;
  };

  const formatter = (value, row, index, field) => {
    if (isEmptyValue(value)) {
      return '<span class="text-muted">N/A</span>';
    }

    if (field === "square_feet") {
      value = value.replace(/,/g, "");
      return new Intl.NumberFormat("en-US", {
        style: "decimal",
      }).format(value);
    }

    if (
      field === "sale_price" ||
      field === "loan_amount" ||
      field === "previous_sale_price"
    ) {
      try {
        const number =
          typeof value === "string"
            ? parseFloat(value.replace(/[$,]/g, ""))
            : value;

        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0, // No decimal places
          maximumFractionDigits: 0, // No decimal places
        }).format(number);
      } catch (e) {
        return value;
      }
    }

    if (field === "propappraiserurl" && value.includes("http")) {
      return `<a href="${value}" target="_blank" rel="noopener noreferrer">View Property</a>`;
    }

    if (field === "deal_closing_date") {
      return new Date(value).toLocaleDateString();
    }

    return value;
  };

  const formatterRowValue = (value, row, index, field) => {
    if (isEmptyValue(value)) {
      return '<span class="text-muted">N/A</span>';
    }

    if (field === "sellers" || field === "buyers") {
      // check the value is not link
      if (!value.includes("http") && value.length > 40) {
        return value.slice(0, 40) + "...";
      }
      return value;
    }

    return formatter(value, row, index, field);
  };

  const getFieldName = (value) => {
    return value
      .toLowerCase()
      .replace(/[ .-]/g, (char) => (char === "." ? "" : "_"));
  };

  const columnConfig = {
    sortable: true,
    formatter: formatterRowValue,
  };

  const getData = async (url) => {
    const response = await fetch(url);
    return response.json();
  };

  const mapDataToTable = (data) => {
    const columns = Object.keys(data[0])
      .sort((a, b) => {
        // sort it by displayColumns order
        const aIndex = displayColumns.findIndex(
          (column) => column.dataField === a
        );
        const bIndex = displayColumns.findIndex(
          (column) => column.dataField === b
        );
        if (aIndex === -1 && bIndex !== -1) return 1;
        if (aIndex !== -1 && bIndex === -1) return -1;
        if (aIndex === -1 && bIndex === -1) return 0;

        return aIndex - bIndex;
      })
      .map((item) => {
        if (!displayFields.includes(item)) {
          return null;
        }
        const displayColumn = displayColumns.find(
          (column) => column.dataField === item
        );

        const sorter =
          displayColumn && typeof displayColumn.sorterCallback === "function"
            ? displayColumn.sorterCallback
            : undefined;

        return {
          ...columnConfig,
          field: getFieldName(item),
          title: (displayColumn && displayColumn.name) || item,
          sorter,
          visible: displayColumn ? true : false,
        };
      })
      .filter((column) => column);

    const rows = data.map((item) => {
      const row = {};

      displayFields.forEach((field) => {
        row[getFieldName(field)] = item[field];
      });

      return row;
    });

    return {
      columns,
      rows,
    };
  };

  const filterData = (data) => {
    if (!dataUrl.includes("master")) {
      return data;
    }
    const params = new URLSearchParams(window.location.search);
    const dealType = params.get("deal_type");
    if (!dealType) {
      return data;
    }
    const filterData = data.filter((item) => {
      return item["DEAL TYPE"] === dealType;
    });
    console.log(filterData);
    return filterData;
  };

  const renderTable = (data) => {
    $(table).bootstrapTable({
      ...tableConfig,
      columns: data.columns,
      data: data.rows,
    });
  };

  if (dataUrl) {
    getData(dataUrl)
      .then(filterData)
      .then(mapDataToTable)
      .then(renderTable)
      .catch((error) => {
        console.error(error);
      });
  }
})();
