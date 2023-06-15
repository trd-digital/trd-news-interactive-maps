// Function to load and parse the CSV file
function loadCSV(file) {
    Papa.parse(file, {
      header: true,
      download: true,
      complete: function (results) {
        // Extract the data from the parsed CSV
        var data = results.data;
  
        // Create table headers
        var headers = Object.keys(data[0]);
        var headerRow = "";
        headers.forEach(function (header) {
          headerRow += "<th>" + header + "</th>";
        });
        $("#csv-table thead tr").html(headerRow);
  
        // Create table rows
        var tableBody = "";
        data.forEach(function (row) {
          var rowData = Object.values(row);
          var rowHtml = "<tr>";
          rowData.forEach(function (value) {
            rowHtml += "<td>" + value + "</td>";
          });
          rowHtml += "</tr>";
          tableBody += rowHtml;
        });
        $("#csv-table tbody").html(tableBody);
  
        // Initialize DataTables plugin for the table
        $("#csv-table").DataTable();
      }
    });
  }
  
  // Call the loadCSV function with the CSV file URL or path
  loadCSV("data/2023 Top General Contractor Ranking - Chicago - Results.csv");
  