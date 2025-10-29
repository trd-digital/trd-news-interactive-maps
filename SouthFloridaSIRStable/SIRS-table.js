const trdTable = () => {
    let table;

    const fn = {
        init: async () => {
            fn.initViewToggle();
            await fn.initTable();
        },

        initViewToggle: () => {
            const buttons = document.querySelectorAll('.view-toggle button');
            const views = document.querySelectorAll('.view');

            buttons.forEach(button => {
                button.addEventListener('click', () => {
                    const viewType = button.getAttribute('data-view');
                    
                    // Update buttons
                    buttons.forEach(btn => btn.classList.toggle('btn-primary', btn === button));
                    buttons.forEach(btn => btn.classList.toggle('btn-secondary', btn !== button));
                    
                    // Update views
                    views.forEach(view => {
                        view.style.display = view.id.includes(viewType) ? 'block' : 'none';
                    });

                    // Trigger resize for map if showing map view
                    if (viewType === 'map' && window.map) {
                        window.map.resize();
                    }
                });
            });
        },

        initTable: async () => {
            const response = await fetch('SIRS.csv');
            const csvText = await response.text();
            const data = fn.parseCSV(csvText);

            table = new DataTable('#sirs-table', {
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
                dom: 'Bfrtip',
                responsive: true
            });
        },

        parseCSV: (csvText) => {
            const lines = csvText.split('\n');
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            
            return lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                return row;
            }).filter(row => row['Project Type']); // Remove empty rows
        }
    };

    fn.init();
    return table;
};

// Initialize table after map
window.addEventListener('load', () => {
    window.table = trdTable();
});
