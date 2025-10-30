(() => {
  const dataUrl = 'SIRS.csv';
  const table = document.querySelector('#sirs-table');

  // Column configuration (preserves styling & bootstrap-table functionality)
  const columns = [
    { field: '', title: '#', visible: false }, // Leading empty column in CSV
    { field: 'Project Type', title: 'Project Type', sortable: true },
    { field: 'Project Name', title: 'Project Name', sortable: true },
    { field: 'Association Name', title: 'Association Name', sortable: true },
    { field: 'City', title: 'City', sortable: true },
    { field: 'Zip', title: 'ZIP Code', sortable: true },
    { field: 'County', title: 'County', sortable: true },
    { field: 'ID', title: 'ID', sortable: true }
  ];

  // Robust CSV parser supporting quoted fields with commas
  const parseCSV = (text) => {
    if (!text) return [];
    // Normalize line endings and trim BOM if present
    text = text.replace(/^\uFEFF/, '').replace(/\r\n?|\n/g, '\n');
    const lines = text.split('\n').filter(l => l.trim().length);
    if (!lines.length) return [];

    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') { // Escaped quote
            current += '"';
            i++; // Skip next quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map(v => v.replace(/^"(.+)"$/,'$1'));
    };

    const headers = parseLine(lines[0]);
    return lines.slice(1).map(line => parseLine(line)).filter(arr => arr.length).map(values => {
      return headers.reduce((row, header, i) => {
        row[header] = values[i] || '';
        return row;
      }, {});
    }).filter(row => row['Project Name']);
  };

  // Initialize bootstrap-table
  const initTable = (rows) => {
    $(table).bootstrapTable({
      data: rows,
      columns: columns,
      search: true,
      searchAlign: 'left',
      searchHighlight: true,
      pagination: true,
      pageSize: 25,
      pageList: [10,25,50,100],
      sortName: 'County',
      sortOrder: 'asc',
      showColumns: true,
      showToggle: true,
      stickyHeader: true,
      classes: 'table table-bordered table-striped',
      theadClasses: 'header-style'
    });
  };

  // Fetch and render
  fetch(dataUrl)
    .then(r => {
      if (!r.ok) throw new Error('Failed to fetch CSV');
      return r.text();
    })
    .then(text => initTable(parseCSV(text)))
    .catch(err => {
      console.error(err);
      table.innerHTML = '<div class="alert alert-danger m-3">Error loading data.</div>';
    });
})();