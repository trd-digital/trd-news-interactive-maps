(() => {
  // Modal fields: Address as title; everything else is built into ContentHTML
  const modalDisplayFields = {
    title: {
      field: "Address",
      label: "Address",
    },
    content: [
      // This will contain labeled rows for Developers/Story and
      // a special italic line for Description. Empty fields are skipped.
      { field: "ContentHTML", label: "" },
    ],
  };

  // Helper utils
  const isEmpty = (v) => {
    if (v == null) return true;
    const s = String(v).trim();
    if (!s) return true;
    // treat common placeholders as empty
    const lower = s.toLowerCase();
    return lower === "none" || lower === "null" || lower === "n/a" || lower === "na" || lower === "—";
  };

  const clean = (v) => {
    if (isEmpty(v)) return "";
    return String(v).trim();
  };

  // Build the inner HTML block shown in the modal
  const buildContentHTML = (props) => {
    const rows = [];

    // Developers (with label), only if present
    if (!isEmpty(props.Developers)) {
      rows.push(`<div><strong>Developers:</strong> ${clean(props.Developers)}</div>`);
    }

    // Story derived from "Landing Page" (with label), only if present
    const link = clean(props["Landing Page"]);
    if (link) {
      rows.push(
        `<div><strong>Story:</strong> <a href="${link}" target="_blank" rel="noopener">Open story</a></div>`
      );
    }

    // Description: italicized with a line break and an em dash
    // Only if present. No "Description:" label per your spec.
    if (!isEmpty(props.Description)) {
      const desc = clean(props.Description);
      rows.push(`<div><em><br>&mdash; ${desc}</em></div>`);
    }

    // If nothing to show, return an empty string (modal renderer should skip blank)
    return rows.join("") || "";
  };

  window.map = trdDataCommonMap({
    filePath: "live_local.geojson",

    // Normalize + compute presentational fields per feature
    fetchDataFilterCallback: (data) => {
      return {
        ...data,
        features: (data.features || []).map((feature) => {
          const props = { ...(feature.properties || {}) };

          // Normalize core fields
          props.Address = clean(props.Address);
          props.Developers = clean(props.Developers);
          props.Description = clean(props.Description);

          // Build ContentHTML containing only non-empty sections
          props.ContentHTML = buildContentHTML(props);

          // Keep original props (minus placeholders) on the feature
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
