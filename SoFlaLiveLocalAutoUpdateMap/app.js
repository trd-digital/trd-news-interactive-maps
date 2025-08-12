(() => {
  // Show these fields from your GeoJSON properties
  const modalDisplayFields = {
    title: {
      field: "Address",
      label: "Address",
    },
    content: [
      { field: "Developers",  label: "Developers" },
      { field: "Description", label: "Description" },
      // We'll populate "Story" from "Landing Page" below
      { field: "Story",       label: "Story" },
    ],
  };

  window.map = trdDataCommonMap({
    // ✅ Your new file
    filePath: "live_local.geojson",

    // We’ll use this hook to normalize/augment feature props
    // (transform + keep all features)
    fetchDataFilterCallback: (feature) => {
      const props = feature?.properties || {};

      // Normalize text fields to avoid 'null' / 'None' strings
      const clean = (v) =>
        (typeof v === "string" ? v.trim() : v) || "—";

      props.Address     = clean(props.Address);
      props.Developers  = clean(props.Developers);
      props.Description = clean(props.Description);

      // Create a presentational "Story" field from "Landing Page"
      const link = (props["Landing Page"] || "").toString().trim();
      props.Story = link && link.toLowerCase() !== "none"
        ? `<a href="${link}" target="_blank" rel="noopener">Open story</a>`
        : "—";

      feature.properties = props;
      return true; // keep the feature
    },

    // Analytics + DOM targets
    eventCategory: "live-local",
    mapElementId: "map",
    filterElementId: undefined,
    legendElementId: undefined,
    resultElementId: undefined,

    // Map view
    mapCenterLat: 25.7617,
    mapCenterLng: -80.1918,
    zoom: 4,
    minZoom: 3,

    // Modal fields we defined above
    modalDisplayFields,

    // Circle styling
    mapLayerPaint: {
      "circle-stroke-width": 2,
      "circle-stroke-color": "#f1f1f1",
    },

    // Point interaction/paint
    pointSettings: {
      clickToCenter: true,
      clickToZoom: false,
      colorType: "case",
      radiusType: "radius",
      paintSettings: {
        default: {
          radius: 8,
          color: { light: "#007cbf", dark: "#007cbf" },
        },
        hover: {
          radius: 10,
          color: { light: "#007cbf", dark: "#007cbf" },
        },
        active: {
          radius: 12,
          color: { light: "black", dark: "white" },
        },
      },
    },
  });
})();
