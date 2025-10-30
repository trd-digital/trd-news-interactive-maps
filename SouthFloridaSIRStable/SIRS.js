(() => {
  const dataUrl = 'SIRS.csv';
  const table = document.querySelector('#sirs-table');

  // Define the table columns
  const columns = [
    {
      field: '',  // Empty first column from CSV
      title: '#',
      visible: false
    },
    {
      field: 'Project Type',
      title: 'Project Type',
      sortable: true
    },
    {
      field: 'Project Name',
      title: 'Project Name',
      sortable: true
    },
    {
      field: 'Association Name',
      title: 'Association',
      sortable: true
    },
    {
      field: 'City',
      title: 'City',
      sortable: true
    },
    {
      field: 'Zip',
      title: 'ZIP',
      sortable: true
    },
    {
      field: 'County',
      title: 'County',
      sortable: true
    },
    {
      field: 'ID',
      title: 'ID',
      sortable: true
    }
  ];

  const displayColumns = [
    { 
      field: 'Project Type',
      title: 'Project Type',
      sortable: true
    },
    { 
      field: 'Project Name',
      title: 'Project Name',
      sortable: true
    },
    { 
      field: 'Association Name',
      title: 'Association Name',
      sortable: true
    },
    { 
      field: 'City',
      title: 'City',
      sortable: true
    },
    { 
      field: 'Zip',
      title: 'ZIP Code',
      sortable: true
    },
    { 
      field: 'County',
      title: 'County',
      sortable: true
    },
    { 
      field: 'ID',
      title: 'ID',
      sortable: true
    }
  ];

  // Parse CSV data
  const parseCSV = (text) => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(header => header.trim().replace(/^"(.+)"$/, '$1'));
    
    return lines.slice(1)
      .filter(line => line.trim()) // Remove empty lines
      .map(line => {
        const values = line.split(',');
        const row = {};
        headers.forEach((header, i) => {
          row[header] = values[i] ? values[i].trim().replace(/^"(.+)"$/, '$1') : '';
        });
        return row;
      })
      .filter(row => row['Project Name'] && row['Project Name'].length > 0);
  };

  const trackEvent = (action, label) => {
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'event_tracking',
        trd: {
          category: 'south-florida-sirs-table',
          action: `table_${action}`,
          label: label,
        },
      });
    }
  };

  const initializeTable = (data) => {
    $(table).bootstrapTable({
      data: data,
      columns: displayColumns,
      search: true,
      searchAlign: 'left',
      pagination: true,
      pageSize: 25,
      pageList: [10, 25, 50, 100],
      sortName: 'County',
      sortOrder: 'asc',
      showColumns: true,
      showToggle: true,
      classes: 'table table-bordered table-striped',
      theadClasses: 'header-style',
      stickyHeader: true,
      onClickRow: (row) => {
        trackEvent('click', `${row['Project Name']} - ${row['City']}`);
      }
    });
  };

  fetch(dataUrl)
    .then(response => response.text())
    .then(text => {
      const data = parseCSV(text);
      initializeTable(data);
    })
    .catch(error => {
      console.error('Error loading SIRS data:', error);
      table.innerHTML = '<div class="alert alert-danger">Error loading data. Please try again later.</div>';
    });
})();
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
    sortName: "instrument_status_date",
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

    if (field === "instrument_status") {
      return value.split("|")[0];
    }

    if (
      field === "bbl" ||
      field === "bin" ||
      field === "proposed_dwelling_units" ||
      field === "existing_dwelling_units" ||
      field === "proposed_number_of_stories" ||
      field === "existing_number_of_stories"
    ) {
      return parseInt(value, 10);
    }

    if (
      field === "total_construction_floor_area" ||
      field === "selected_proposed_square_feet" ||
      field === "total_building_square_footage"
    ) {
      return new Intl.NumberFormat("en-US", {
        style: "decimal",
      }).format(value);
    }

    if (field === "estimated_job_cost") {
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

    if (field === "instrument_status_date" || field === "filing_date") {
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