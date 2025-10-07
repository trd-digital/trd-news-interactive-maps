(() => {
  // Title = Developer; body shows Address, italic Description (no label), and Story link
  const modalDisplayFields = {
    title: { field: "Developers", label: "Developers" }, // we normalize to "Developers" below
    content: [
      { field: "Address", label: "Address" },
      { field: "DescriptionDisplay", label: "" }, // italic, prefixed with line break + em dash
      { field: "Story", label: "Story" },
    ],
  };

  // Utilities
  const isEmpty = (v) => {
    if (v == null) return true;
    const s = String(v).trim();
    if (!s) return true;
    const lower = s.toLowerCase();
    return ["none", "null", "n/a", "na", "—", "-"].includes(lower);
  };
  const cleanOrEmpty = (v) => (isEmpty(v) ? "" : String(v).trim());
  const firstNonEmpty = (props, keys) => {
    for (const k of keys) {
      if (k in props && !isEmpty(props[k])) return String(props[k]).trim();
    }
    return "";
  };

  window.map = trdDataCommonMap({
    filePath: "live_local.geojson",

    fetchDataFilterCallback: (data) => {
      return {
        ...data,
        features: (data.features || []).map((feature) => {
          const raw = feature.properties || {};
          const props = { ...raw };

          // Normalize fields (be lenient about key variants)
          const developers = firstNonEmpty(props, ["Developer", "Developers", "Developer(s)"]);
          const address = firstNonEmpty(props, ["Address", "Address(es)"]);
          const description = firstNonEmpty(props, ["Description", "Desc"]);
          const storyLink = firstNonEmpty(props, ["Recent Coverage", "Landing Page", "Story URL", "URL"]);

          // Title: Developers (fallback to Address if developer truly missing)
          props.Developers = developers || address || "";

          // Body fields
          props.Address = address || "";
          props.Story = storyLink
            ? `<a href="${storyLink}" target="_blank" rel="noopener">Open story</a>`
            : "";

          // Description as italic with a line break + em dash; no label
          props.DescriptionDisplay = description ? `<em><br>&mdash; ${description}</em>` : "";

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
