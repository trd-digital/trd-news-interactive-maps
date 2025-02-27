(() => {
  // Configure the modal display fields with custom formatting functions.
  const modalDisplayFields = {
    title: {
      field: "Location", // Use the 'Location' property for the title
      label: "Location",
    },
    content: [
      { field: "Main Agency", label: "Agency" },
      { 
        field: "Sq Ft", 
        label: "Total Sq Ft", 
        format: (value) => Number(value).toLocaleString() 
      },
    // In modalDisplayFields:
    {
      field: "Annual Lease",
      label: "Total Annual Lease",
      format: (value) =>
        Number(value).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 })
    },
    {
      field: "Saved",
      label: "Total Saved",
      format: (value) =>
        Number(value).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 })
    }
    ],
  };

  // Function to detect if the user is on a mobile device.
  const isMobileDevice = () => /Mobi|Android|iPhone/i.test(navigator.userAgent);

  // Set default map center coordinates.
  let mapCenterLat = 39.8283; // Center of the US
  let mapCenterLng = -98.5795; // Center of the US

  // Adjust map center for mobile devices.
  if (isMobileDevice()) {
    mapCenterLat = 40.7128; // New York City latitude
    mapCenterLng = -74.0060; // New York City longitude
  }

  // Initialize your map using the trdDataCommonMap function.
  window.map = trdDataCommonMap({
    fetchDataFilterCallback: undefined,
    eventCategory: "beige-book",
    filePath: "data.geojson", // Ensure your GeoJSON file is hosted at this path.
    mapElementId: "map",
    filterElementId: undefined,
    legendElementId: undefined,
    resultElementId: undefined,
    mapCenterLat: mapCenterLat,
    mapCenterLng: mapCenterLng,
    zoom: 4,
    minZoom: 3,
    modalDisplayFields,
    mapLayerPaint: {
      "circle-color": "#007cbf",
      "circle-radius": 8,
      "circle-stroke-width": 1,
      "circle-stroke-color": "#f1f1f1",
    },
  });

  // Fetch the GeoJSON data to compute and display grand totals.
  fetch("data.geojson")
    .then((response) => response.json())
    .then((data) => {
      let totalSqFt = 0;
      let totalAnnualLease = 0;
      let totalSaved = 0;

      data.features.forEach((feature) => {
        const props = feature.properties;
        totalSqFt += Number(props["Sq Ft"]) || 0;
        totalAnnualLease += Number(props["Annual Lease"]) || 0;
        totalSaved += Number(props["Saved"]) || 0;
      });

      // Format the totals.
      const formattedTotalSqFt = totalSqFt.toLocaleString();
      const formattedTotalAnnualLease = totalAnnualLease.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      const formattedTotalSaved = totalSaved.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      

      // Update the totals box. Make sure an element with id 'totals-box' exists in your HTML.
      const totalsBox = document.getElementById("totals-box");
      if (totalsBox) {
        totalsBox.innerHTML = `
          <h3>Grand Totals</h3>
          <p>Total Sq Ft: ${formattedTotalSqFt}</p>
          <p>Total Annual Lease: ${formattedTotalAnnualLease}</p>
          <p>Total Saved: ${formattedTotalSaved}</p>
        `;
      }
    })
    .catch((error) => console.error("Error fetching GeoJSON data:", error));
})();

// This function is used by the modal/pop-up generation logic.
function renderModalContent(contentArray, properties) {
  return contentArray
    .map((item) => {
      if (item.field === "separator") {
        return item.format();
      } else {
        const label = item.label ? `<strong>${item.label}:</strong> ` : "";
        const value = properties[item.field] || "";
        return `<p>${label}${item.format ? item.format(value) : value}</p>`;
      }
    })
    .join("");
}
