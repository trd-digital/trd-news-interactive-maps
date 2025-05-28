const tracking = {
  eventCategory: "unknown-map",
  trackEvent: (action, label) => {
    if (window.dataLayer) {
      window.dataLayer.push({
        event: "event_tracking",
        trd: {
          category: tracking.eventCategory,
          action: `table_${action}`,
          label: label,
        },
      });
    }
  },
};

const TrdDataCommonTable = (options) => {
  const defaultOptions = {
    filePath: "",
    filePaths: [],
    fileAddKeyValues: [],
    tableElementId: "table",
    displayColumns: [],
    eventCategory: "unknown-table",
    fetchDataFilterCallback: undefined,
    tableConfig: {},
    columnConfig: {
      sortable: true,
      formatter: TrdFormatters.formatterValue,
    },
  };
  const settings = { ...defaultOptions, ...options };

  const table = document.querySelector(`#${settings.tableElementId}`);
  const trdTheme = TrdTheme({
    updateCallback: (theme) => tracking.trackEvent("theme", theme),
  });

  const handlers = {
    mapDetailRow: (displayColumn, row, i) => {
      const key = TrdFormatters.getFieldName(displayColumn.dataField);
      const value = row[key];
      if (TrdFormatters.isEmptyValue(value)) {
        return "";
      }

      const formattedValue = displayColumn.formatter
        ? displayColumn.formatter(value)
        : TrdFormatters.formatterValue(value);

      return `<div class="row my-2 pb-2 border-bottom">
      <div class="text-capitalize col-4">
        <strong>
        ${displayColumn.name}:
        </strong>
      </div>
      <div class="col-8">
        ${formattedValue}
      </div>
    </div>`;
    },

    detailFormatter: (index, row) => {
      const displayRows = settings.displayColumns.filter(
        (field) =>
          !TrdFormatters.isEmptyValue(
            row[TrdFormatters.getFieldName(field.dataField)]
          )
      );

      tracking.trackEvent(
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
                  .map((displayColumn, i) =>
                    handlers.mapDetailRow(displayColumn, row, i)
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
          <div class="col-12 col-md-6">
            <table class="table table-sm">
              <tbody>
                ${displayRows
                  .slice(Math.ceil(displayRows.length / 2))
                  .map((displayColumn, i) =>
                    handlers.mapDetailRow(displayColumn, row, i)
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    },
  };

  const fn = {
    init: () => {
      if (!table) {
        console.error(
          `Table element with ID ${settings.tableElementId} not found.`
        );
        return;
      }

      trdTheme.init();

      fn.getData()
        .then(fn.mapDataToTable)
        .then(fn.renderTable)
        .catch((error) => {
          console.error("Error initializing table:", error);
        });
    },

    // Support fetching and merging data from multiple files
    fetchFile: (filePath) => {
      return fetch(filePath)
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Error fetching data: ${response.status} ${response.statusText}`
            );
          }
          return response.json();
        })
        .then((data) => {
          if (settings.fetchDataFilterCallback) {
            return settings.fetchDataFilterCallback(data);
          }
          return data;
        });
    },

    getData: async () => {
      // Use filePaths if provided, otherwise fallback to filePath
      const filePaths = settings.filePaths.length
        ? settings.filePaths
        : settings.filePath
        ? [settings.filePath]
        : [];

      if (!filePaths.length) {
        console.error("No file paths provided for data fetching.");
        return [];
      }

      return Promise.all(filePaths.map(fn.fetchFile))
        .then((results) => {
          // Merge all features into a single FeatureCollection
          const merged = results.reduce((acc, data, cIndex) => {
            if (!data) {
              return acc;
            }

            if (
              settings.fileAddKeyValues &&
              settings.fileAddKeyValues[cIndex]
            ) {
              data = data.map((row) => {
                return {
                  ...row,
                  ...settings.fileAddKeyValues[cIndex],
                };
              });
            }
            acc.push(...data);
            return acc;
          }, []);

          return merged;
        })
        .catch((error) => {
          console.error("Error fetching data:", error);
          throw error;
        });
    },

    mapDataToTable: (data) => {
      const rows = fn.getMapRows(data);
      const columns = fn.getMapColumns(data);

      return {
        columns,
        rows,
      };
    },

    getMapRows: (data) => {
      const rows = data.map((item) => {
        const row = {};

        // only add the fields that are in displayColumns
        settings.displayColumns.forEach((field) => {
          const newKey = TrdFormatters.getFieldName(field.dataField);
          row[newKey] = item[field.dataField];
        });

        return row;
      });

      return rows;
    },

    getMapColumns: (data) => {
      if (!data || data.length === 0) {
        console.error("No data available to map columns.");
        return [];
      }
      const columns = Object.keys(data[0])
        .sort((a, b) => {
          // sort it by displayColumns order
          const aIndex = settings.displayColumns.findIndex(
            (column) => column.dataField === a
          );
          const bIndex = settings.displayColumns.findIndex(
            (column) => column.dataField === b
          );
          if (aIndex === -1 && bIndex !== -1) return 1;
          if (aIndex !== -1 && bIndex === -1) return -1;
          if (aIndex === -1 && bIndex === -1) return 0;

          return aIndex - bIndex;
        })
        .map((property) => {
          const displayColumn = settings.displayColumns.find(
            (column) => column.dataField === property
          );

          if (!displayColumn) {
            return null;
          }

          return {
            ...settings.columnConfig,
            ...displayColumn,
            visible: displayColumn.visible ? true : false,
            field: TrdFormatters.getFieldName(property),
            title: displayColumn.name || property,
          };
        })
        .filter((column) => column);

      return columns;
    },

    renderTable: (data) => {
      const tableConfig = {
        sortable: true,
        search: true,
        searchHighlight: true,
        sortName: "record_date",
        sortEmptyLast: true,
        sortOrder: "desc",
        sortEmptylast: true,
        pagination: true,
        paginationVAlign: "both",
        pageList: [10, 50, 100],
        pageSize: 10,
        classes: "table table-responsive",
        theadClasses: "header-style",
        detailView: true,
        detailFormatter: handlers.detailFormatter,
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
          document
            .querySelectorAll(".header-style .sorted")
            .forEach((header) => {
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
        ...settings.tableConfig,
      };

      $(table).bootstrapTable({
        ...tableConfig,
        columns: data.columns,
        data: data.rows,
      });
    },
  };

  fn.init();

  return {};
};
