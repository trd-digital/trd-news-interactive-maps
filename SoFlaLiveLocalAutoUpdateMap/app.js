(() => {
  // Title = Developers; body shows existing fields (only if present)
  const modalDisplayFields = {
    title: { field: "Developers", label: "Developers" },
    content: [
      { field: "Address", label: "Address" },
      { field: "Status", label: "Status" },
      { field: "Live Local Units", label: "Live Local Units" },
      { field: "Total Units", label: "Total Units" },
      { field: "Percent Live Local", label: "Percent Live Local" },
      { field: "DescriptionDisplay", label: "" }, // italic line with <br>— prefix
      { field: "Story", label: "Story" },         // hyperlink from Recent Coverage
    ],
  };

  const isBlank = (v) => {
    if (v == null) return true;
    const s = String(v).trim();
    if (!s) return true;
    const lower = s.toLowerCase();
    return ["none", "null", "n/a", "na", "—", "-"].includes(lower);
  };

  const clean = (v) => (isBlank(v) ? "" : String(v).trim());

  window.map = trdDataCommonMap({
    filePath: "live_local.geojson",

    fetchDataFilterCallback: (data) => {
      return {
        ...data,
        features: (data.features || []).map((feature, i) => {
          const props = { ...(feature.properties || {}) };

          // Keep the raw values (Status/Units/etc.) exactly as in the GeoJSON
          // Only build two presentational fields:
          const desc = clean(props.Description);
          props.DescriptionDisplay = desc ? `<em>${desc}</em>` : "";

          const story = clean(props["Recent Coverage"]);
          props.Story = story ? `<a href="${story}" target="_blank" rel="noopener">Open story</a>` : "";

          // Normalize title key the modal reads
          props.Developers = clean(props.Developers) || clean(props.Developer) || clean(props["Developer(s)"]) || "";

          // Ensure Address stays as-is so it shows up under the label "Address"
          props.Address = clean(props.Address);

          feature.properties = props;

          // (Optional) One-time console check:
          // if (i === 0) console.log("Sample props:", feature.properties);

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
        hover:   { radius: 10, color: { light: "#007cbf", dark: "#007cbf" } },
        active:  { radius: 12, color: { light: "black",  dark: "white" } },
      },
    },
  });
})();
