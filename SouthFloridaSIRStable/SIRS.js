const initTable = async () => {
  try {
    const response = await fetch('SIRS.csv');
    const csvText = await response.text();
    const data = parseCSV(csvText);

    $('#sirs-table').DataTable({
      data: data,
      columns: [
        { data: 'Project Type' },
        { data: 'Project Name' },
        { data: 'Association Name' },
        { data: 'City' },
        { data: 'Zip' },
        { data: 'County' },
        { data: 'ID' }
      ],
      pageLength: 25,
      order: [[3, 'asc']], // Sort by City by default
      responsive: true,
      dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>rtip',
      language: {
        search: 'Search:',
        lengthMenu: 'Show _MENU_ entries',
        info: 'Showing _START_ to _END_ of _TOTAL_ entries'
      }
    });
  } catch (error) {
    console.error('Error loading data:', error);
  }
};

const parseCSV = (csvText) => {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  return lines.slice(1)
    .map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    })
    .filter(row => row['Project Type']); // Remove empty rows
};

// Initialize table when document is ready
$(document).ready(() => {
  initTable();
});