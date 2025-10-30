(function () {
  const dataUrl = "live_local.geojson"; // local file
  const tableEl = document.querySelector("#live-local-table");

  // Columns we want visible by default (order matters)
  const displayColumns = [
    { dataField: "Developers", name: "Developers" },
    { dataField: "Address", name: "Address" },
    { dataField: "Status", name: "Status" },
    { dataField: "Live Local Units", name: "Live Local Units", sorterCallback: numericSorter },
    { dataField: "Total Units", name: "Total Units", sorterCallback: numericSorter },
    { dataField: "Percent Live Local", name: "% Live Local", sorterCallback: percentSorter },
    { dataField: "Recent Coverage", name: "Recent Coverage" }
  ];

  // All fields to show in detail view
  const displayFields = [
    "Developers",
    "Address",
    "Status",
    "Live Local Units",
    "Total Units",
    "Percent Live Local",
    "Description",
    "Recent Coverage"
  ];

  const excludeValue = [
    "null","undefined","n/a","na","none","not available","not applicable","no","0","false","unknown","data not found","nan","-" 
  ];

  function trackEvent(action, label) {
    if (window.dataLayer) {
      window.dataLayer.push({
        event: "event_tracking",
        trd: { category: "live-local-table", action: `table_${action}`, label }
      });
    }
  }

  function isEmptyValue(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === "string") {
      if (value.trim() === "") return true;
      if (excludeValue.includes(value.toLowerCase())) return true;
    }
    return false;
  }

  function getFieldName(value) {
    return value.toLowerCase().replace(/ /g, "_").replace(/%/g, "percent");
  }

  function numericSorter(a, b) {
    const na = parseNumber(a);
    const nb = parseNumber(b);
    if (isNaN(na) && isNaN(nb)) return 0;
    if (isNaN(na)) return 1;
    if (isNaN(nb)) return -1;
    return na - nb;
  }

  function percentSorter(a, b) {
    const na = parsePercent(a);
    const nb = parsePercent(b);
    if (isNaN(na) && isNaN(nb)) return 0;
    if (isNaN(na)) return 1;
    if (isNaN(nb)) return -1;
    return na - nb;
  }

  function parseNumber(val) {
    if (isEmptyValue(val)) return NaN;
    const num = parseFloat(String(val).replace(/,/g, ""));
    return num;
  }

  function parsePercent(val) {
    if (isEmptyValue(val)) return NaN;
    const num = parseFloat(String(val).replace(/%/g, ""));
    return num;
  }

  function formatValue(value, row, index, field) {
    if (isEmptyValue(value)) return '<span class="text-muted">N/A</span>';

    if (field === "live_local_units" || field === "total_units") {
      return new Intl.NumberFormat("en-US").format(parseNumber(value));
    }

    if (field === "percent_live_local") {
      const num = parsePercent(value);
      if (isNaN(num)) return value;
      return num + "%";
    }

    if (field === "recent_coverage" && String(value).startsWith("http")) {
      return `<a href="${value}" target="_blank" rel="noopener noreferrer">Article</a>`;
    }

    return value;
  }

  function formatterRowValue(value, row, index, field) {
    return formatValue(value, row, index, field);
  }

  function mapDetailRow(key, row, i) {
    const value = row[key];
    if (isEmptyValue(value)) return "";
    return `<tr><td class="text-capitalize">${key.replace(/_/g, " ")}</td><td>${formatValue(value, row, i, key)}</td></tr>`;
  }

  function detailFormatter(index, row) {
    const displayRows = displayFields.filter(f => !isEmptyValue(row[getFieldName(f)]));
    trackEvent("detail_open", row.address || "Unknown Address");
    return `<div class="container"><div class="row my-5"><div class="col-12 col-md-6"><table class="table table-sm"><tbody>${displayRows.slice(0, Math.ceil(displayRows.length/2)).map((key,i) => mapDetailRow(getFieldName(key), row, i)).join("")}</tbody></table></div><div class="col-12 col-md-6"><table class="table table-sm"><tbody>${displayRows.slice(Math.ceil(displayRows.length/2)).map((key,i) => mapDetailRow(getFieldName(key), row, i)).join("")}</tbody></table></div></div></div>`;
  }

  const columnConfig = { sortable: true, formatter: formatterRowValue };

  const tableConfig = {
    sortable: true,
    search: true,
    searchHighlight: true,
    sortEmptyLast: true,
    sortOrder: "asc",
    pagination: true,
    classes: "table table-responsive",
    theadClasses: "header-style",
    detailView: true,
    detailFormatter,
    icons: { detailOpen: "bi bi-chevron-down", detailClose: "bi bi-chevron-up" },
    showColumns: true,
    showColumnsToggleAll: true,
    minimumCountColumns: 2,
    stickyHeader: true,
    stickyHeaderOffsetY: 56,
    stickyHeaderOffsetLeft: parseInt($("body").css("padding-left"), 10),
    stickyHeaderOffsetRight: parseInt($("body").css("padding-right"), 10)
  };

  async function getData(url) {
    const response = await fetch(url);
    return response.json();
  }

  function mapDataToTable(data) {
    if (!data.features || !data.features.length) return { columns: [], rows: [] };

    const firstProps = data.features[0].properties;
    const columns = Object.keys(firstProps)
      .sort((a, b) => {
        const aIndex = displayColumns.findIndex(c => c.dataField === a);
        const bIndex = displayColumns.findIndex(c => c.dataField === b);
        if (aIndex === -1 && bIndex !== -1) return 1;
        if (aIndex !== -1 && bIndex === -1) return -1;
        if (aIndex === -1 && bIndex === -1) return 0;
        return aIndex - bIndex;
      })
      .map(property => {
        if (!displayFields.includes(property)) return null;
        const displayColumn = displayColumns.find(c => c.dataField === property);
        const sorter = displayColumn && typeof displayColumn.sorterCallback === "function" ? displayColumn.sorterCallback : undefined;
        return { ...columnConfig, field: getFieldName(property), title: (displayColumn && displayColumn.name) || property, sorter, visible: !!displayColumn };
      })
      .filter(Boolean);

    const rows = data.features.map(feature => {
      const props = feature.properties;
      const row = {};
      displayFields.forEach(field => { row[getFieldName(field)] = props[field]; });
      return row;
    });

    return { columns, rows };
  }

  function renderTable(tableData) {
    $(tableEl).bootstrapTable({ ...tableConfig, columns: tableData.columns, data: tableData.rows });
  }

  const trdTheme = typeof TrdTheme === "function" ? TrdTheme() : null;
  if (trdTheme) { trdTheme.init(theme => trackEvent("theme", theme)); }

  getData(dataUrl)
    .then(mapDataToTable)
    .then(renderTable)
    .catch(err => console.error("Failed to load Live Local data", err));
})();