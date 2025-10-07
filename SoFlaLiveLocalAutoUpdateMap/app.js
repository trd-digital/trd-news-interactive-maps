(() => {
  // Title = Developers; body shows Address, ital. Description (no label), and Story link
  const modalDisplayFields = {
    title: { field: "Developers", label: "Developers" },
    content: [
      { field: "Address", label: "Address" },
      { field: "DescriptionDisplay", label: "" },  // italic, prefixed with line break + em dash
      { field: "Story", label: "Story" },
    ],
  };

  // Treat blanks/None-ish as empty so fields are hidden
  const isEmpty = (v) => {
    if (v == null) return true;
    const s = String(v).trim();
    if (!s) return true;
    const lower = s.toLowerCase();
    return ["none", "null", "n/a", "na", "—", "-"].includes(lower);
  };
  const cleanOrEmpty = (v) => (isEmpty(v) ? "" : String(v).trim());

  window.map = trdDataCommonMap({
    filePath: "live_local.geojson",

    fetchDataFilterCallback: (data) => {
      return {
        ...data,
        features: (data.features || []).map((feature) => {
          const props = { ...(feature.properties || {}) };

          // Normalize fields we care about
          const address = cleanOrEmpty(props.Address);
          const devs = cleanOrEmpty(props.Developers);
          const desc = cleanOrEmpty(props.Description);
          const landing = cleanOrEmpty(props["Landing Page"]);

          // Assign normalized values back
          props.Address = address;                 // now in the body
          props.Developers = devs;                 // now the title

          // Build Story from Landing Page (only if present)
          props.Story = landing
            ? `<a href="${landing}" target="_blank" rel="noopener">Open story</a>`
            : "";

          // Description: italicized w/ a preceding line break and em dash; no label
          props.DescriptionDisplay = desc ? `<em><br>&mdash; ${desc}</em>` : "";

          feature.properties = props;
          return feature;
        }),
      };
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
    zoom: 7,
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
        default: { radius: 8, color: { light: "#007cbf", dark: "#007cbf" } },
        hover: { radius: 10, color: { light: "#007cbf", dark: "#007cbf" } },
        active: { radius: 12, color: { light: "black", dark: "white" } },
      },
    },
  });
})();
