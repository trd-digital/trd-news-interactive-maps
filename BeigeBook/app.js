(() => {
  const modalDisplayFields = {
    title: {
      field: "City",
      label: "City",
    },
    content: [
      {
        label: "Summary",
        field: "User Generated Real Estate Summary",
        format: (value, properties) => {
          const userSummary = (typeof value === "string") ? value.trim() : "";

          // Use the user-generated summary if it's non-empty
          if (userSummary) {
            return userSummary;
          }

          // If no user-generated summary, fallback to AI summaries
          const residentialSummary = properties["AI Residential Summary"] && properties["AI Residential Summary"].trim();
          const residentialLink = properties["AI Resi Link"] && properties["AI Resi Link"].trim();
          const commercialSummary = properties["AI Commercial Summary"] && properties["AI Commercial Summary"].trim();
          const commercialLink = properties["AI Commercial Link"] && properties["AI Commercial Link"].trim();

          let html = "";

          if (residentialSummary) {
            html += `<div><strong>Residential:</strong> ${residentialSummary}`;
            if (residentialLink) {
              html += ` (<a href="${residentialLink}" target="_blank">Source</a>)`;
            }
            html += `</div>`;
          }

          if (commercialSummary) {
            html += `<div><strong>Commercial:</strong> ${commercialSummary}`;
            if (commercialLink) {
              html += ` (<a href="${commercialLink}" target="_blank">Source</a>)`;
            }
            html += `</div>`;
          }

          // If neither summary is available
          if (!html) {
            html = "No summary available";
          }

          return html;
        },
      },
    ],
  };

  // Detect mobile
  const isMobileDevice = () => /Mobi|Android|iPhone/i.test(navigator.userAgent);

  // Default map center
  let mapCenterLat = 39.8283; 
  let mapCenterLng = -98.5795; 

  // Adjust for mobile
  if (isMobileDevice()) {
    mapCenterLat = 40.7128;
    mapCenterLng = -74.0060;
  }

  window.map = trdDataCommonMap({
    fetchDataFilterCallback: undefined,
    eventCategory: "beige-book",
    filePath: "data.geojson",
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
})();



// (() => {
//   const modalDisplayFields = {
//     title: {
//       field: "City",
//       label: "City",
//     },
//     content: [
//       { field: "Real Estate Summary", label: "Summary" },
//       {
//         field: "Link",
//         label: "",
//         format: (value) => `<a href="${value}" target="_blank">Source</a>`,
//       },
//     ],
//   };

//   // Function to detect if the user is on a mobile device
//   const isMobileDevice = () => {
//     return /Mobi|Android|iPhone/i.test(navigator.userAgent);
//   };

//   // Set default map center coordinates
//   let mapCenterLat = 39.8283; // Default latitude (center of the US)
//   let mapCenterLng = -98.5795; // Default longitude (center of the US)

//   // Adjust map center for mobile devices
//   if (isMobileDevice()) {
//     mapCenterLat = 40.7128; // New York City latitude
//     mapCenterLng = -74.0060; // New York City longitude
//   }

//   window.map = trdDataCommonMap({
//     fetchDataFilterCallback: undefined,
//     eventCategory: "beige-book",
//     filePath: "data.geojson",
//     mapElementId: "map",
//     filterElementId: undefined,
//     legendElementId: undefined,
//     resultElementId: undefined,
//     mapCenterLat: mapCenterLat,
//     mapCenterLng: mapCenterLng,
//     zoom: 4,
//     minZoom: 3,
//     modalDisplayFields,
//     mapLayerPaint: {
//       "circle-color": "#007cbf",
//       "circle-radius": 8,
//       "circle-stroke-width": 1,
//       "circle-stroke-color": "#f1f1f1",
//     },
//   });
// })();
