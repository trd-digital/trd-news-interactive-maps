const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";
const GEOJSON_PATH = "Extell_Assemblage_geocoded.geojson";
const PARCELS_PATH = "Extell_Assemblage_parcels.geojson";

const storyEl = document.getElementById("story");
const stepTemplate = document.getElementById("stepTemplate");
const tokenWarningEl = document.getElementById("tokenWarning");
const mapLegendEl = document.getElementById("mapLegend");
const legendToggleEl = document.getElementById("legendToggle");

const MOBILE_MEDIA = window.matchMedia("(max-width: 820px)");
const REDUCED_MOTION_MEDIA = window.matchMedia("(prefers-reduced-motion: reduce)");
const isMobileViewport = () => MOBILE_MEDIA.matches;
const prefersReducedMotion = () => REDUCED_MOTION_MEDIA.matches;

const GROUP_PALETTES = {
  light: {
    Prospect: "#eaa31a",
    Land: "#0b4cb8",
    Office: "#0fa073",
    Other: "#4a5160",
    "Multi-Family Dwelling": "#7a4fc7",
  },
  dark: {
    Prospect: "#f5b13a",
    Land: "#5a8fe6",
    Office: "#22b886",
    Other: "#a3acbf",
    "Multi-Family Dwelling": "#a17be0",
  },
};

const GROUP_FALLBACKS = {
  light: "#7f8ba0",
  dark: "#aab3c4",
};

const GROUP_LABELS = {
  "Multi-Family Dwelling": "Multi-Family",
};

const GROUP_ORDER = ["Prospect", "Land", "Office", "Other", "Multi-Family Dwelling"];

function getActivePalette() {
  return GROUP_PALETTES[STATE.theme] || GROUP_PALETTES.light;
}

function getActiveFallbackColor() {
  return GROUP_FALLBACKS[STATE.theme] || GROUP_FALLBACKS.light;
}

function groupColorMatchExpression(getter) {
  const palette = getActivePalette();
  const stops = [];
  Object.entries(palette).forEach(([group, color]) => {
    stops.push(group, color);
  });
  return ["match", getter, ...stops, getActiveFallbackColor()];
}

const STATE = {
  map: null,
  mapLoaded: false,
  features: [],
  steps: [],
  activeStepId: null,
  theme: "light",
  embedMode: false,
  queryTheme: null,
};

const THEME_STORAGE_KEY = "extell-assemblage-theme";
const MAPBOX_STYLES = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
};

const PARENT_MESSAGE_TYPES = {
  RESIZE: "extell-map:resize",
  SET_THEME: "extell-map:set-theme",
  REQUEST_RESIZE: "extell-map:request-resize",
  READY: "extell-map:ready",
  LOADED: "extell-map:loaded",
};

function readEmbedConfig() {
  let params = null;
  try {
    params = new URLSearchParams(window.location.search);
  } catch (e) {
    /* malformed location.search */
  }
  const queryTheme = params && params.get("theme");
  const queryLayout = params && params.get("layout");
  let framed = false;
  try {
    framed = window.self !== window.top;
  } catch (e) {
    framed = true; // cross-origin parent: assume embedded
  }
  STATE.embedMode = queryLayout === "embed" || framed;
  STATE.queryTheme = queryTheme === "dark" || queryTheme === "light" ? queryTheme : null;
}

function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch (e) {
    /* localStorage may be unavailable (private mode, etc.) */
  }
  return null;
}

function getSystemTheme() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getInitialTheme() {
  // Query-string takes precedence so an embedding page can force a theme.
  if (STATE.queryTheme) return STATE.queryTheme;
  // The inline boot script in <head> has already applied the right theme,
  // so trust that attribute as the source of truth for first paint.
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return getStoredTheme() || getSystemTheme();
}

function syncThemeToggleButton(theme) {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  const isDark = theme === "dark";
  btn.setAttribute("aria-pressed", String(isDark));
  const icon = btn.querySelector(".theme-toggle-icon");
  const label = btn.querySelector(".theme-toggle-label");
  // When in dark mode, the button switches you back to light, and vice versa.
  if (icon) icon.textContent = isDark ? "☀" : "☾";
  if (label) label.textContent = isDark ? "Light" : "Dark";
}

function applyTheme(theme, { persist = true, updateMap = true } = {}) {
  STATE.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  syncThemeToggleButton(theme);
  // Never write to localStorage from inside an embedded iframe; the host
  // page owns the user's theme preference there.
  if (persist && !STATE.embedMode) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      /* ignore */
    }
  }
  if (STATE.features && STATE.features.length) {
    buildLegend(STATE.features);
  }
  if (updateMap && STATE.map) {
    STATE.map.setStyle(MAPBOX_STYLES[theme]);
  }
  postParentResize();
}

function setupThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (btn && STATE.embedMode) {
    // The host page (e.g. TRD's footer switcher) owns the theme; remove
    // our control so users only see one source of truth.
    btn.remove();
  } else if (btn) {
    btn.addEventListener("click", () => {
      applyTheme(STATE.theme === "dark" ? "light" : "dark");
    });
  }
  // Follow OS-level changes as long as the user has not explicitly chosen,
  // and as long as we're not embedded (the host controls theme then).
  if (window.matchMedia && !STATE.embedMode) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event) => {
      if (getStoredTheme()) return;
      applyTheme(event.matches ? "dark" : "light", { persist: false });
    };
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);
  }
}

// ---------------------------------------------------------------------------
// Parent-frame messaging: lets the host page (a) push a theme into the iframe
// and (b) auto-size the iframe to the embedded map's content height.
// ---------------------------------------------------------------------------

function postParentResize() {
  if (!STATE.embedMode || !window.parent || window.parent === window) return;
  if (postParentResize._scheduled) return;
  postParentResize._scheduled = true;
  requestAnimationFrame(() => {
    postParentResize._scheduled = false;
    // Use body.scrollHeight only: documentElement.scrollHeight returns the
    // VIEWPORT (iframe) height when content is smaller, which would peg the
    // reported height at the current iframe size and stop the parent from
    // ever shrinking us back down (the fixed-height overlay layout needs to
    // shrink from the initial iframe height down to .layout's 560px).
    const height = document.body ? document.body.scrollHeight : 0;
    if (!height) return;
    // Suppress no-op / sub-pixel reports to avoid feedback loops with parents
    // that size the iframe back from our reported height.
    if (Math.abs(height - (postParentResize._lastHeight || 0)) < 2) return;
    postParentResize._lastHeight = height;
    try {
      window.parent.postMessage(
        { type: PARENT_MESSAGE_TYPES.RESIZE, height },
        "*"
      );
    } catch (e) {
      /* parent unreachable */
    }
  });
}

function postParentLoaded() {
  if (!STATE.embedMode || !window.parent || window.parent === window) return;
  if (postParentLoaded._sent) return;
  postParentLoaded._sent = true;
  try {
    window.parent.postMessage({ type: PARENT_MESSAGE_TYPES.LOADED }, "*");
  } catch (e) {
    /* parent unreachable */
  }
}

function setupParentMessaging() {
  if (!STATE.embedMode) return;

  window.addEventListener("message", (event) => {
    const data = event && event.data;
    if (!data || typeof data !== "object") return;
    if (data.type === PARENT_MESSAGE_TYPES.SET_THEME) {
      if (data.value === "dark" || data.value === "light") {
        applyTheme(data.value, { persist: false });
      }
    } else if (data.type === PARENT_MESSAGE_TYPES.REQUEST_RESIZE) {
      postParentResize();
    }
  });

  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(() => postParentResize());
    if (document.body) ro.observe(document.body);
  } else {
    window.addEventListener("resize", postParentResize);
  }

  try {
    window.parent.postMessage({ type: PARENT_MESSAGE_TYPES.READY }, "*");
  } catch (e) {
    /* parent unreachable */
  }
  postParentResize();
}

function parseAmount(amountText) {
  if (!amountText) return 0;
  const cleaned = String(amountText).replace(/[^\d.-]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function parseDate(dateText) {
  if (!dateText) return null;
  const d = new Date(dateText);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(dateText) {
  const d = parseDate(dateText);
  if (!d) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function formatHeadlineFromUrl(urlText) {
  if (!urlText) return null;

  try {
    const url = new URL(urlText);
    const segments = url.pathname.split("/").filter(Boolean);
    const slug = segments[segments.length - 1] || "";
    if (!slug) return null;

    return slug
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  } catch {
    return null;
  }
}

function getPropertyGroupColor(group) {
  const palette = getActivePalette();
  return palette[group] || getActiveFallbackColor();
}

function getPropertyGroupLabel(group) {
  return GROUP_LABELS[group] || group || "Uncategorized";
}

function buildLegend(features) {
  if (!mapLegendEl) return;

  const legendBody = mapLegendEl.querySelector(".legend-body") || mapLegendEl;
  legendBody.querySelectorAll(".legend-row").forEach((row) => row.remove());
  const groups = [...new Set(features.map((feature) => feature.propertyGroup || "Uncategorized"))];

  groups.sort((a, b) => {
    const indexA = GROUP_ORDER.indexOf(a);
    const indexB = GROUP_ORDER.indexOf(b);
    const rankA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
    const rankB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
    if (rankA !== rankB) return rankA - rankB;
    return getPropertyGroupLabel(a).localeCompare(getPropertyGroupLabel(b));
  });

  groups.forEach((group) => {
    const row = document.createElement("p");
    row.className = "legend-row";

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = getPropertyGroupColor(group);

    row.appendChild(swatch);
    row.append(document.createTextNode(getPropertyGroupLabel(group)));
    legendBody.appendChild(row);
  });
}

function formatAddress(rawAddress) {
  if (!rawAddress) return "";
  // Strip a trailing city/state suffix (", NEW YORK, NY", ", NY", etc.) and
  // title-case all-caps addresses so cards read like prose rather than ACRIS labels.
  let cleaned = String(rawAddress)
    .replace(/,\s*new york\s*,\s*ny\s*$/i, "")
    .replace(/,\s*new york\s*$/i, "")
    .replace(/,\s*ny\s*$/i, "")
    .trim();
  if (cleaned === cleaned.toUpperCase()) {
    cleaned = cleaned.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return cleaned;
}

function normalizeFeatures(rawFeatures) {
  const idCounts = {};
  return rawFeatures
    .filter((f) => f && f.geometry && Array.isArray(f.geometry.coordinates))
    .map((feature, idx) => {
      const props = feature.properties || {};
      const recordedDate = props.recorded_date || "";
      const recordedDateValue = parseDate(recordedDate)?.getTime() || 0;
      const recordStatus =
        (props.record_status || "").toLowerCase() === "prospect" ||
        (props.source_doc_id || "").toLowerCase() === "future prospect"
          ? "prospect"
          : "confirmed";
      const baseId = props.source_doc_id || `record-${idx}`;
      idCounts[baseId] = (idCounts[baseId] || 0) + 1;
      const id = idCounts[baseId] > 1 ? `${baseId}-${idCounts[baseId]}` : baseId;
      return {
        id,
        sourceDocId: baseId,
        title: formatAddress(props.address) || "Address unavailable",        storyUrl: props.Clip_Notes || "",
        storyTitle: formatHeadlineFromUrl(props.Clip_Notes || "") || "",
        amountText: props.doc_amount || "Amount undisclosed",
        amountValue: parseAmount(props.doc_amount),
        recordedDate,
        recordedDateValue,
        recordStatus,
        borough: props.borough || "",
        neighborhood: props.neighborhood || "",
        classification: props.classification || "",
        propertyGroup: props.property_group || (recordStatus === "prospect" ? "Prospect" : "Other"),
        docType: props.doc_type || "",
        sourceUrl: props.link_url || "",
        clipNotes: props.Clip_Notes || "",
        coordinates: feature.geometry.coordinates,
      };
    })
    .sort((a, b) => {
      if (a.recordStatus !== b.recordStatus) {
        return a.recordStatus === "confirmed" ? -1 : 1;
      }
      if (a.recordStatus === "prospect") {
        return a.title.localeCompare(b.title);
      }
      // Push confirmed records that lack both a recorded date and an amount
      // to the end of the confirmed group so the timeline doesn't open on them.
      const aHasData = a.recordedDateValue > 0 || a.amountValue > 0;
      const bHasData = b.recordedDateValue > 0 || b.amountValue > 0;
      if (aHasData !== bHasData) return aHasData ? -1 : 1;
      return a.recordedDateValue - b.recordedDateValue;
    });
}

function buildSteps(features) {
  const steps = [];
  features.forEach((feature, index) => {
    steps.push({
      kind: "record",
      id: `record-${feature.id}`,
      feature,
      statsIndex: index,
    });
  });

  return steps;
}

function buildStoryCards(steps) {
  storyEl.innerHTML = "";

  steps.forEach((step) => {
    const feature = step.feature;
    const fragment = stepTemplate.content.cloneNode(true);
    const article = fragment.querySelector(".step");

    article.dataset.stepId = step.id;
    article.setAttribute("role", "listitem");
    article.setAttribute("tabindex", "0");
    article.setAttribute("aria-current", "false");

    fragment.querySelector(".step-kicker").textContent =
      feature.recordStatus === "prospect"
        ? "Future prospect"
        : `Deal ${step.statsIndex + 1} of ${STATE.features.length}`;

    const titleEl = fragment.querySelector(".step-title");
    const addressTitle = feature.title;
    if (feature.storyUrl) {
      const storyLink = document.createElement("a");
      storyLink.dataset.href = feature.storyUrl;
      storyLink.target = "_blank";
      storyLink.rel = "noopener noreferrer";
      storyLink.className = "step-title-link";
      storyLink.textContent = addressTitle;
      titleEl.replaceChildren(storyLink);
    } else {
      titleEl.textContent = addressTitle;
    }

    fragment.querySelector(".step-meta").textContent =
      feature.recordStatus === "prospect"
        ? "Future prospect, date unknown"
        : formatDate(feature.recordedDate);

    fragment.querySelector(".step-amount").textContent =
      feature.recordStatus === "prospect"
        ? "Price: Undisclosed"
        : `Price: ${feature.amountText}`;

    const link = fragment.querySelector(".step-link");
    if (feature.sourceUrl) {
      link.dataset.href = feature.sourceUrl;
    } else {
      link.remove();
    }

    article.addEventListener("click", (event) => {
      // Let active, real links keep their native behavior so users can
      // open the source document or story.
      if (event.target.closest("a, button")) return;
      activateStep(step.id, { scrollIntoView: true });
    });

    article.addEventListener("keydown", (event) => {
      if (event.target !== article) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activateStep(step.id, { scrollIntoView: true });
      }
    });

    storyEl.appendChild(fragment);
  });
}

function getStepById(stepId) {
  return STATE.steps.find((step) => step.id === stepId) || null;
}

function getVisibleFeatures(statsIndex) {
  if (statsIndex < 0) return [];
  return STATE.features.slice(0, statsIndex + 1);
}

function getVisibleConfirmedFeatures(statsIndex) {
  return getVisibleFeatures(statsIndex).filter((feature) => feature.recordStatus === "confirmed");
}

function flyToRecord(feature) {
  if (!STATE.map) return;

  const mobile = isMobileViewport();
  const cameraOptions = {
    center: feature.coordinates,
    zoom: mobile ? 16.4 : 17,
    pitch: mobile ? 0 : 38,
    bearing: mobile ? 0 : -15,
  };

  // In the wide-embed overlay layout, the card column floats over the right
  // edge of the map. Tell Mapbox to keep the active feature visible in the
  // remaining left area so the pin isn't permanently obscured by a card.
  const overlayWidth = getOverlayPadding();
  if (overlayWidth > 0) {
    cameraOptions.padding = { top: 0, bottom: 0, left: 0, right: overlayWidth };
  }

  if (prefersReducedMotion()) {
    STATE.map.jumpTo(cameraOptions);
    return;
  }

  // Use easeTo for short hops between Midtown pins — keeps zoom level constant,
  // glides instead of the flyTo zoom-out-and-back-in. Shorter duration in embed.
  STATE.map.easeTo({
    ...cameraOptions,
    duration: STATE.embedMode ? 700 : 900,
    easing: (t) => 1 - Math.pow(1 - t, 3),
    essential: true,
  });
}

// Returns the right-edge padding (in CSS pixels) the camera should reserve
// for the overlay card column. Matches the @media (min-width: 780px) embed
// rule that pins .story-wrap to a 380px-wide column on the right.
function getOverlayPadding() {
  if (!STATE.embedMode) return 0;
  if (document.documentElement.clientWidth < 780) return 0;
  return 380;
}

function updateActivePoint(feature) {
  if (!STATE.map || !STATE.mapLoaded) return;
  const source = STATE.map.getSource("active-point");
  if (!source) return;

  source.setData({
    type: "FeatureCollection",
    features: feature
      ? [
          {
            type: "Feature",
            properties: {
              title: feature.title,
              amount: feature.amountText,
              date: formatDate(feature.recordedDate),
              propertyGroup: feature.propertyGroup,
            },
            geometry: {
              type: "Point",
              coordinates: feature.coordinates,
            },
          },
        ]
      : [],
  });
}

function updateActiveParcel(feature) {
  if (!STATE.map || !STATE.mapLoaded) return;
  const sourceDocId = feature && feature.sourceDocId;
  const filter = sourceDocId
    ? ["==", ["get", "source_doc_id"], sourceDocId]
    : ["==", ["get", "source_doc_id"], "__none__"];
  if (STATE.map.getLayer("parcels-fill-active")) {
    STATE.map.setFilter("parcels-fill-active", filter);
  }
  if (STATE.map.getLayer("parcels-outline-active")) {
    STATE.map.setFilter("parcels-outline-active", filter);
  }
}

function activateStep(stepId, options = {}) {
  const { updateHash = true, scrollIntoView = false, force = false } = options;
  const step = getStepById(stepId);
  if (!step || (!force && stepId === STATE.activeStepId)) {
    return;
  }

  STATE.activeStepId = stepId;

  document.querySelectorAll(".step").forEach((el) => {
    const isActive = el.dataset.stepId === stepId;
    el.classList.toggle("active", isActive);
    el.setAttribute("aria-current", isActive ? "true" : "false");
    el.querySelectorAll("a[data-href]").forEach((a) => {
      if (isActive) {
        a.setAttribute("href", a.dataset.href);
        a.removeAttribute("tabindex");
        a.removeAttribute("aria-disabled");
      } else {
        a.removeAttribute("href");
        a.setAttribute("tabindex", "-1");
        a.setAttribute("aria-disabled", "true");
      }
    });
    if (isActive && scrollIntoView) {
      // "nearest" only scrolls when the card is outside the visible scroll
      // area; when the user clicks a card that's already on-screen, the
      // panel's scroll position is preserved (no jump). On mobile this
      // also prevents the page from re-centering an already-visible card
      // under the sticky map.
      el.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "nearest",
      });
    }
  });

  const feature = step.feature;
  flyToRecord(feature);
  updateActivePoint(feature);
  updateActiveParcel(feature);
  announceActiveStep(step);

  if (updateHash) {
    history.replaceState(null, "", `#step=${encodeURIComponent(step.id)}`);
  }
}

function announceActiveStep(step) {
  const region = document.getElementById("liveRegion");
  if (!region || !step || !step.feature) return;
  const f = step.feature;
  const kicker =
    f.recordStatus === "prospect"
      ? "Future prospect"
      : `Deal ${step.statsIndex + 1} of ${STATE.features.length}`;
  const date =
    f.recordStatus === "prospect" ? "date unknown" : formatDate(f.recordedDate);
  const price =
    f.recordStatus === "prospect" ? "price undisclosed" : f.amountText;
  region.textContent = `${kicker}: ${f.title}. ${date}. ${price}.`;
}

function syncMobileMapHeightVar() {
  if (!isMobileViewport()) {
    document.documentElement.style.removeProperty("--map-height");
    return 0;
  }
  const mapEl = document.querySelector(".map-wrap");
  if (!mapEl) return 0;
  const height = Math.round(mapEl.getBoundingClientRect().height);
  if (height > 0) {
    document.documentElement.style.setProperty("--map-height", `${height}px`);
  }
  return height;
}

function updateAllPointsSource() {
  if (!STATE.map || !STATE.mapLoaded) return;
  const source = STATE.map.getSource("all-points");
  if (!source) return;

  source.setData({
    type: "FeatureCollection",
    features: STATE.features.map((f) => ({
      type: "Feature",
      properties: {
        id: f.id,
        amount: f.amountText,
        amountValue: f.amountValue,
        title: f.title,
        propertyGroup: f.propertyGroup,
      },
      geometry: {
        type: "Point",
        coordinates: f.coordinates,
      },
    })),
  });
}

function getStepIdFromHash() {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw.startsWith("step=")) return null;
  return decodeURIComponent(raw.slice(5));
}

function setupStoryEvents() {
  window.addEventListener("hashchange", () => {
    const stepId = getStepIdFromHash();
    if (stepId && getStepById(stepId)) {
      activateStep(stepId, { updateHash: false, scrollIntoView: true });
    }
  });
}

function setupOverlayToggles() {
  if (!legendToggleEl || !mapLegendEl) return;
  legendToggleEl.addEventListener("click", () => {
    const open = mapLegendEl.classList.toggle("is-open");
    legendToggleEl.setAttribute("aria-expanded", String(open));
  });
}

function setupResponsiveRefresh() {
  let pending = null;
  const refresh = () => {
    pending = null;
    syncMobileMapHeightVar();
    if (STATE.map) STATE.map.resize();
  };
  const schedule = () => {
    if (pending) return;
    pending = window.requestAnimationFrame(refresh);
  };
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  if (typeof MOBILE_MEDIA.addEventListener === "function") {
    MOBILE_MEDIA.addEventListener("change", schedule);
  } else if (typeof MOBILE_MEDIA.addListener === "function") {
    MOBILE_MEDIA.addListener(schedule);
  }
}

function showTokenWarning() {
  tokenWarningEl.hidden = false;
}

// Mapbox light-v11 / dark-v11 ship with restaurant, transit and POI labels
// that fight the editorial aesthetic and add visual noise around the
// assemblage parcels. Hide them once the style is ready, preserving roads,
// water, parks and neighbourhood/place labels for orientation. At narrow
// embed widths (<500px), also strip road and minor place labels so the
// short sticky map reads cleanly.
function declutterBasemap(map) {
  const style = map.getStyle && map.getStyle();
  if (!style || !Array.isArray(style.layers)) return;
  const isNarrowEmbed =
    STATE.embedMode && document.documentElement.clientWidth < 500;
  const noisePattern = isNarrowEmbed
    ? /^(poi|transit|road-label|natural-line-label|natural-point-label|water-point-label)(-|$)/i
    : /^(poi|transit)(-|$)/i;
  style.layers.forEach((layer) => {
    if (!layer || !layer.id || !noisePattern.test(layer.id)) return;
    try {
      map.setLayoutProperty(layer.id, "visibility", "none");
    } catch (e) {
      /* layer may have been removed mid-iteration */
    }
  });
}

function addMapDataLayers(map) {
  // The style (and therefore any sources we add now) is ready as soon as
  // style.load fires — flip the flag here so updateActivePoint /
  // updateActiveParcel don't early-return when activateStep is replayed
  // below for the initial card.
  STATE.mapLoaded = true;

  declutterBasemap(map);

  if (!map.getSource("parcels")) {
    map.addSource("parcels", {
      type: "geojson",
      data: STATE.parcels || { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getLayer("parcels-fill")) {
    map.addLayer({
      id: "parcels-fill",
      type: "fill",
      source: "parcels",
      paint: {
        "fill-color": groupColorMatchExpression(["get", "property_group"]),
        "fill-opacity": 0.2,
      },
    });
  }

  if (!map.getLayer("parcels-outline")) {
    map.addLayer({
      id: "parcels-outline",
      type: "line",
      source: "parcels",
      paint: {
        "line-color": groupColorMatchExpression(["get", "property_group"]),
        "line-width": 1,
        "line-opacity": 0.6,
      },
    });
  }

  if (!map.getLayer("parcels-fill-active")) {
    map.addLayer({
      id: "parcels-fill-active",
      type: "fill",
      source: "parcels",
      filter: ["==", ["get", "source_doc_id"], "__none__"],
      paint: {
        "fill-color": groupColorMatchExpression(["get", "property_group"]),
        "fill-opacity": 0.45,
      },
    });
  }

  if (!map.getLayer("parcels-outline-active")) {
    map.addLayer({
      id: "parcels-outline-active",
      type: "line",
      source: "parcels",
      filter: ["==", ["get", "source_doc_id"], "__none__"],
      paint: {
        "line-color": groupColorMatchExpression(["get", "property_group"]),
        "line-width": 2.4,
        "line-opacity": 0.95,
      },
    });
  }

  if (!map.getSource("all-points")) {
    map.addSource("all-points", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getLayer("all-points-layer")) {
    map.addLayer({
      id: "all-points-layer",
      type: "circle",
      source: "all-points",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "amountValue"],
          0,
          4,
          10000000,
          7,
          100000000,
          11,
          500000000,
          15,
          1000000000,
          18,
        ],
        "circle-color": groupColorMatchExpression(["get", "propertyGroup"]),
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.3,
        "circle-opacity": 0.5,
      },
    });
  }

  if (!map.getSource("active-point")) {
    map.addSource("active-point", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getLayer("active-point-glow")) {
    map.addLayer({
      id: "active-point-glow",
      type: "circle",
      source: "active-point",
      paint: {
        "circle-radius": 22,
        "circle-color": groupColorMatchExpression(["get", "propertyGroup"]),
        "circle-opacity": 0.22,
      },
    });
  }

  if (!map.getLayer("active-point-core")) {
    map.addLayer({
      id: "active-point-core",
      type: "circle",
      source: "active-point",
      paint: {
        "circle-radius": 10,
        "circle-color": groupColorMatchExpression(["get", "propertyGroup"]),
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
    });
  }

  updateAllPointsSource();
  if (STATE.activeStepId) {
    activateStep(STATE.activeStepId, { updateHash: false, force: true });
  }
}

// Touch-device opt-in: shows a "Tap to interact" veil over the map. One tap
// re-enables drag/pinch handlers for the rest of the session and fades the
// veil out. Mouse/trackpad users never see it (the map already has the +/-
// zoom buttons + clickable pins for them).
function initMapTapVeil(map) {
  const veil = document.getElementById("mapTapVeil");
  if (!veil) return;

  const isTouchOnly =
    window.matchMedia &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  if (!isTouchOnly) return;

  veil.hidden = false;

  const unlock = () => {
    veil.classList.add("is-hidden");
    map.dragPan.enable();
    map.doubleClickZoom.enable();
    if (map.touchZoomRotate) {
      map.touchZoomRotate.enable();
      // Keep rotation locked so two-finger gestures only pan/zoom.
      map.touchZoomRotate.disableRotation();
    }
    // Remove from the layout once the fade is done so it can't intercept
    // taps on pins or the legend.
    setTimeout(() => {
      veil.hidden = true;
    }, 260);
  };

  veil.addEventListener("click", unlock, { once: true });
}

function initMap() {
  const firstFeature = STATE.features[0];
  const [startLng, startLat] = firstFeature.coordinates;
  const mobile = isMobileViewport();

  const map = new mapboxgl.Map({
    container: "map",
    style: MAPBOX_STYLES[STATE.theme] || MAPBOX_STYLES.light,
    center: [startLng, startLat],
    zoom: mobile ? 10.8 : 11.5,
    pitch: mobile ? 0 : 34,
    bearing: mobile ? 0 : -15,
    antialias: true,
    interactive: true,
  });

  STATE.map = map;

  // In embed mode the right edge of the map is covered by the overlay card
  // column, so put the zoom controls at top-left where they stay tappable.
  map.addControl(
    new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }),
    STATE.embedMode ? "top-left" : "top-right"
  );

  // The map is a presentation surface, not an exploration tool: lock it
  // down on every viewport. On mobile this is critical — if dragPan/touch
  // gestures stay enabled, a finger trying to scroll the article past the
  // sticky map ends up panning the map instead, trapping the reader.
  // Pin/parcel taps and the +/- nav buttons still work. Touch users can
  // re-enable gestures by tapping the "Tap to interact" veil (see
  // initMapTapVeil) — a per-session opt-in that mirrors the Google Maps
  // embed pattern.
  map.scrollZoom.disable();
  map.boxZoom.disable();
  map.dragPan.disable();
  map.dragRotate.disable();
  map.keyboard.disable();
  map.doubleClickZoom.disable();
  if (map.touchPitch) map.touchPitch.disable();
  if (map.touchZoomRotate) map.touchZoomRotate.disable();

  initMapTapVeil(map);

  map.on("style.load", () => {
    // Fires on the initial style load and every time setStyle() finishes,
    // so the parcels/points layers get re-added whenever the basemap swaps.
    addMapDataLayers(map);
  });

  map.on("load", () => {
    STATE.mapLoaded = true;

    // Belt-and-suspenders: if the container's height settled after Mapbox
    // measured it (e.g. svh recalculation, late font load), force a resize
    // so the canvas fills the visible map area.
    map.resize();
    requestAnimationFrame(() => map.resize());

    map.once("idle", () => postParentLoaded());

    const activateFromMapFeature = (mapFeature) => {
      if (!mapFeature) return;
      const props = mapFeature.properties || {};
      let step = null;
      if (props.id) {
        step = STATE.steps.find((s) => s.feature.id === props.id);
      }
      if (!step && props.source_doc_id) {
        step = STATE.steps.find((s) => s.feature.sourceDocId === props.source_doc_id);
      }
      if (step) activateStep(step.id, { scrollIntoView: true });
    };

    const clickableLayers = ["all-points-layer", "parcels-fill"];
    clickableLayers.forEach((layerId) => {
      map.on("click", layerId, (e) => {
        activateFromMapFeature(e.features && e.features[0]);
      });
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
      });
    });
  });
}

// Defer Mapbox construction until the #map container is about to enter the
// viewport. Article pages (especially TRD's) load a lot of below-the-fold
// content; spinning up a WebGL map immediately wastes CPU and hurts LCP for
// users who never scroll to the embed.
function initMapWhenVisible() {
  const container = document.getElementById("map");
  if (!container || typeof IntersectionObserver !== "function") {
    initMap();
    return;
  }

  const rect = container.getBoundingClientRect();
  const alreadyVisible =
    rect.top < window.innerHeight && rect.bottom > 0 && rect.width > 0;
  if (alreadyVisible) {
    initMap();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          observer.disconnect();
          initMap();
          break;
        }
      }
    },
    { rootMargin: "200px" }
  );
  observer.observe(container);
}

async function init() {
  // Detect ?layout=embed / ?theme= and whether we're inside an iframe before
  // any UI wiring so theme + chrome decisions can read STATE.embedMode.
  readEmbedConfig();

  // Pick the initial theme before anything else paints map chrome, then wire
  // the toggle so it works whether or not the map ever loads.
  applyTheme(getInitialTheme(), { persist: false, updateMap: false });
  setupThemeToggle();
  setupParentMessaging();

  const token = (MAPBOX_ACCESS_TOKEN || "").trim();
  const isPlaceholder = token.includes("YOUR_MAPBOX_ACCESS_TOKEN");
  const isPublicToken = token.startsWith("pk.");

  if (!token || isPlaceholder || !isPublicToken) {
    showTokenWarning();
    return;
  }

  mapboxgl.accessToken = token;

  let data;
  try {
    const response = await fetch(GEOJSON_PATH);
    if (!response.ok) {
      throw new Error(`Failed to fetch GeoJSON (${response.status})`);
    }
    data = await response.json();
  } catch (err) {
    console.error("Could not load GeoJSON. Serve this folder with a local web server.", err);
    return;
  }

  const rawFeatures = Array.isArray(data.features) ? data.features : [];
  const features = normalizeFeatures(rawFeatures);
  if (!features.length) {
    console.error("No valid map points found in GeoJSON.");
    return;
  }

  let parcelsData = { type: "FeatureCollection", features: [] };
  try {
    const parcelsResponse = await fetch(PARCELS_PATH);
    if (parcelsResponse.ok) {
      parcelsData = await parcelsResponse.json();
    }
  } catch (err) {
    console.warn("Parcel overlay unavailable", err);
  }

  STATE.features = features;
  STATE.parcels = parcelsData;
  STATE.steps = buildSteps(features);

  buildLegend(STATE.features);
  buildStoryCards(STATE.steps);
  setupStoryEvents();
  setupOverlayToggles();
  setupResponsiveRefresh();
  syncMobileMapHeightVar();

  if (!STATE.steps.length) {
    console.error("No steps available to render.");
    return;
  }

  if (window.location.hash) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  activateStep(STATE.steps[0].id, { updateHash: false });

  initMapWhenVisible();
}

init();
