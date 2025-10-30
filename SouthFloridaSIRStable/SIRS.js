(() => {
  const dataUrl = 'SIRS.csv';
  const tableEl = document.querySelector('#sirs-table');

  // CSV parsing (supports quoted commas)
  const parseCSV = (text) => {
    text = text.replace(/^\uFEFF/, '').replace(/\r\n?|\n/g, '\n');
    const lines = text.split('\n').filter(l => l.trim().length);
    if (!lines.length) return [];

    const parseLine = (line) => {
      const out = [];
      let cur = '';
      let inQuotes = false;
      for (let i=0;i<line.length;i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          out.push(cur); cur='';
        } else { cur += ch; }
      }
      out.push(cur);
      return out.map(v => v.trim().replace(/^"(.+)"$/, '$1'));
    };

    const headers = parseLine(lines[0]);
    return lines.slice(1).map(parseLine).map(vals => {
      return headers.reduce((row,h,i) => { row[h] = vals[i] || ''; return row; }, {});
    }).filter(r => r['Project Name']);
  };

  // Columns for bootstrap-table
  const columns = [
    { field: '', title: '#', visible: false },
    { field: 'Project Type', title: 'Project Type', sortable: true },
    { field: 'Project Name', title: 'Project Name', sortable: true },
    { field: 'Association Name', title: 'Association Name', sortable: true },
    { field: 'City', title: 'City', sortable: true },
    { field: 'Zip', title: 'Zip', sortable: true },
    { field: 'County', title: 'County', sortable: true },
    { field: 'ID', title: 'ID', sortable: true }
  ];

  // Detail view shows all key/value pairs for the row
  const detailFormatter = (index, row) => {
    const keys = Object.keys(row).filter(k => row[k] && k !== '');
    const half = Math.ceil(keys.length / 2);
    const buildCol = (slice) => `<table class="table table-sm"><tbody>${slice.map(k => `<tr><td class="text-capitalize">${k}</td><td>${row[k] || '<span class="text-muted">N/A</span>'}</td></tr>`).join('')}</tbody></table>`;
    return `<div class="container"><div class="row my-3"><div class="col-12 col-md-6">${buildCol(keys.slice(0,half))}</div><div class="col-12 col-md-6">${buildCol(keys.slice(half))}</div></div></div>`;
  };

  // Initialize table
  const initTable = (rows) => {
    // Guard against double init
    if ($(tableEl).data('bootstrap.table')) {
      $(tableEl).bootstrapTable('load', rows);
      return;
    }
    $(tableEl).bootstrapTable({
      data: rows,
      columns,
      search: true,
      searchHighlight: true,
      pagination: true,
      pageSize: 25,
      pageList: [10,25,50,100],
      sortName: 'County',
      sortOrder: 'asc',
      showColumns: true,
      showColumnsToggleAll: true,
      detailView: true,
      detailFormatter,
      classes: 'table table-bordered table-striped',
      theadClasses: 'header-style',
      stickyHeader: true,
      stickyHeaderOffsetY: 56
    });
  };

  // Fetch CSV and render
  fetch(dataUrl)
    .then(r => { if (!r.ok) throw new Error('Failed to load CSV'); return r.text(); })
    .then(text => initTable(parseCSV(text)))
    .catch(err => {
      console.error(err);
      tableEl.innerHTML = '<div class="alert alert-danger m-3">Failed to load data.</div>';
    });
})();