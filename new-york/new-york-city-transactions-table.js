(function () {
  const dataUrl =
    "https://static.therealdeal.com/interactive-maps/new-york-city-transactions-map.geojson";

  const table = document.querySelector("#luxury-sales-table");

  const displayColumns = [
    { dataField: "Physical Address", name: "Physical Address" },
    { dataField: "Sale Price", name: "Sale Price" },
    {
      dataField: "Record Date",
      name: "Record Date",
      sorterCallback: (a, b) => {
        if (isEmptyValue(a) || isEmptyValue(b)) {
          return 0;
        }
        return new Date(a).getTime() - new Date(b).getTime();
      },
    },
    { dataField: "Use Code Description", name: "Use Code Description" },
    { dataField: "Sellers", name: "Sellers" },
    { dataField: "Buyers", name: "Buyers" },
    { dataField: "Property Sq. Ft", name: "Sq. Ft" },
  ];

  const displayFields = [
    "Doc Type",
    "Record Date",
    "Sellers",
    "Buyers",
    "Sale Price",
    "Use Code Description",
    "Property Sq. Ft",
    "Previous Owner Name",
    "Previous Sale Price",
    "Physical Address",
    "Instrument_Num",
    "BBL",
    "Building BBL",
    "Recorded Date of Previous Sale",
    "Doc Date of Previous Sale",
    "Neighborhood",
    "County",
    "Municipality",
    "PropAppraiserURL",
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
          category: "new-york-transactions-table",
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

    trackEvent(
      "detail_open",
      row.physical_address ? row.physical_address : "Unknown Address"
    );

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
    sortName: "record_date",
    sortEmptyLast: true,
    sortOrder: "desc",
    sortEmptylast: true,
    pagination: true,
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

  const isEmptyValue = (value) => {
    if (!value) return true;
    if (value === "") return true;
    if (typeof value === "string") {
      if (value.trim() === "") return true;
      if (excludeValue.includes(value.toLowerCase())) return true;
    }
    return false;
  };

  const formatter = (value, row, index, field) => {
    if (isEmptyValue(value)) {
      return '<span class="text-muted">N/A</span>';
    }

    if (field === "property_sq_ft") {
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

    if (
      field === "record_date" ||
      field === "recorded_date_of_previous_sale" ||
      field === "doc_date_of_previous_sale"
    ) {
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
    return value.toLowerCase().replace(/ /g, "_").replace(/\./g, "");
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
    const columns = Object.keys(data.features[0].properties)
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
      .map((property) => {
        if (!displayFields.includes(property)) {
          return null;
        }
        const displayColumn = displayColumns.find(
          (column) => column.dataField === property
        );

        const sorter =
          displayColumn && typeof displayColumn.sorterCallback === "function"
            ? displayColumn.sorterCallback
            : undefined;

        return {
          ...columnConfig,
          field: getFieldName(property),
          title: (displayColumn && displayColumn.name) || property,
          sorter,
          visible: displayColumn ? true : false,
        };
      })
      .filter((column) => column);

    const rows = data.features.map((feature) => {
      const properties = feature.properties;
      const row = {};

      displayFields.forEach((field) => {
        row[getFieldName(field)] = properties[field];
      });

      return row;
    });

    return {
      columns,
      rows,
    };
  };

  const renderTable = (data) => {
    $(table).bootstrapTable({
      ...tableConfig,
      columns: data.columns,
      data: data.rows,
    });
  };

  const trdTheme = TrdTheme();
  trdTheme.init((theme) => trackEvent("theme", theme));

  getData(dataUrl)
    .then(mapDataToTable)
    .then(renderTable)
    .catch((error) => {
      console.error(error);
    });
})();
