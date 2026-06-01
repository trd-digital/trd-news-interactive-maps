const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";
const GEOJSON_PATH = "Extell_Assemblage_geocoded.geojson";

const storyEl = document.getElementById("story");
const stepTemplate = document.getElementById("stepTemplate");
const totalSpendEl = document.getElementById("totalSpend");
const progressLabelEl = document.getElementById("progressLabel");
const largestSoFarEl = document.getElementById("largestSoFar");
const largestDealLabelEl = document.getElementById("largestDealLabel");
const tokenWarningEl = document.getElementById("tokenWarning");

const CHAPTERS = [
  {
    id: "chapter-2018-2019",
    label: "EARLY POSITIONING",
    title: "2018 to 2019: Building the Footprint",
    description:
      "Early deals cluster around retail-heavy corridors and Upper East Side parcels, establishing optionality.",
    years: [2018, 2019],
    camera: { center: [-73.9797, 40.7616], zoom: 11.8, pitch: 24, bearing: -8 },
  },
  {
    id: "chapter-2020-2023",
    label: "SITE CONSOLIDATION",
    title: "2020 to 2023: Strategic Assembles",
    description:
      "Fewer but more strategic purchases emphasize multi-parcel potential in key Manhattan submarkets.",
    years: [2020, 2021, 2022, 2023],
    camera: { center: [-73.975, 40.768], zoom: 11.4, pitch: 22, bearing: -12 },
  },
  {
    id: "chapter-2024-2026",
    label: "ACCELERATION",
    title: "2024 to 2026: Bigger Checks, Faster Pace",
    description:
      "Acquisition velocity and dollar volume ramp up sharply, concentrated in high-value Midtown and Park Avenue targets.",
    years: [2024, 2025, 2026],
    camera: { center: [-73.9736, 40.761], zoom: 12, pitch: 25, bearing: -15 },
  },
];

const STATE = {
  map: null,
  mapLoaded: false,
  features: [],
  steps: [],
  activeStepId: null,
  observer: null,
};

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

function normalizeFeatures(rawFeatures) {
  return rawFeatures
    .filter((f) => f && f.geometry && Array.isArray(f.geometry.coordinates))
    .map((feature, idx) => {
      const props = feature.properties || {};
      const recordedDate = props.recorded_date || "";
      const recordedDateValue = parseDate(recordedDate)?.getTime() || 0;
      const year = parseDate(recordedDate)?.getFullYear() || null;
      const chapter = CHAPTERS.find((item) => year && item.years.includes(year)) || CHAPTERS[0];
      return {
        id: props.source_doc_id || `record-${idx}`,
        title: props.address || "Address unavailable",
        amountText: props.doc_amount || "$0",
        amountValue: parseAmount(props.doc_amount),
        recordedDate,
        recordedDateValue,
        year,
        borough: props.borough || "",
        neighborhood: props.neighborhood || "",
        classification: props.classification || "",
        propertyGroup: props.property_group || "Other",
        docType: props.doc_type || "",
        sourceUrl: props.link_url || "",
        clipNotes: props.Clip_Notes || "",
        sourceConfidence: props.Clip_Notes ? "Record + reporting" : "Record only",
        chapterId: chapter.id,
        coordinates: feature.geometry.coordinates,
      };
    })
    .sort((a, b) => a.recordedDateValue - b.recordedDateValue);
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

    fragment.querySelector(".step-kicker").textContent = `Deal ${step.statsIndex + 1} of ${STATE.features.length}`;
    fragment.querySelector(".step-title").textContent = feature.title;

    const metaParts = [
      formatDate(feature.recordedDate),
      feature.borough,
      feature.neighborhood,
      feature.docType,
    ].filter(Boolean);
    fragment.querySelector(".step-meta").textContent = metaParts.join(" • ");

    fragment.querySelector(".step-amount").textContent = `Paid: ${feature.amountText}`;

    const detailParts = [
      `Property group: ${feature.propertyGroup}`,
      feature.classification,
      feature.clipNotes ? "Includes linked reporting context" : "No linked external reporting",
    ]
      .filter(Boolean)
      .join(" • ");
    fragment.querySelector(".step-detail").textContent = detailParts || "Acquisition record";

    const link = fragment.querySelector(".step-link");
    if (feature.sourceUrl) {
      link.href = feature.sourceUrl;
    } else {
      link.remove();
    }


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

function updateRunningMetrics(statsIndex) {
  const visibleFeatures = getVisibleFeatures(statsIndex);
  const runningTotal = visibleFeatures.reduce((sum, f) => sum + f.amountValue, 0);

  totalSpendEl.textContent = formatCurrency(runningTotal);

  if (!visibleFeatures.length) {
    largestSoFarEl.textContent = "$0";
    largestDealLabelEl.textContent = "Waiting for first step...";
  } else {
    const largest = visibleFeatures.reduce((max, feature) =>
      feature.amountValue > max.amountValue ? feature : max
    );
    largestSoFarEl.textContent = formatCurrency(largest.amountValue);
    largestDealLabelEl.textContent = largest.title;
  }
}

function flyToRecord(feature) {
  if (!STATE.map) return;

  STATE.map.flyTo({
    center: feature.coordinates,
    zoom: 14.8,
    pitch: 38,
    bearing: -15,
    speed: 0.72,
    curve: 1.15,
    essential: true,
  });
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
    if (isActive && scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  updateRunningMetrics(step.statsIndex);

  const feature = step.feature;
  progressLabelEl.textContent = `${step.statsIndex + 1} of ${STATE.features.length}: ${feature.amountText} at ${feature.title}`;
  flyToRecord(feature);
  updateActivePoint(feature);

  if (updateHash) {
    history.replaceState(null, "", `#step=${encodeURIComponent(step.id)}`);
  }
}

function setupScrollObserver() {
  if (STATE.observer) {
    STATE.observer.disconnect();
  }

  const options = {
    root: null,
    rootMargin: "-18% 0px -55% 0px",
    threshold: 0.01,
  };

  STATE.observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const stepId = entry.target.dataset.stepId;
      if (stepId) {
        activateStep(stepId);
      }
    });
  }, options);

  document.querySelectorAll(".step[data-step-id]").forEach((stepEl) => {
    STATE.observer.observe(stepEl);
  });
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

function showTokenWarning() {
  tokenWarningEl.hidden = false;
  progressLabelEl.textContent = "Map unavailable until token is set";
}

function initMap() {
  const firstFeature = STATE.features[0];
  const [startLng, startLat] = firstFeature.coordinates;

  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/light-v11",
    center: [startLng, startLat],
    zoom: 11.5,
    pitch: 34,
    bearing: -15,
    antialias: true,
    interactive: false,
  });

  STATE.map = map;

  map.on("load", () => {
    STATE.mapLoaded = true;

    map.addSource("all-points", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

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
        "circle-color": [
          "match",
          ["get", "propertyGroup"],
          "Land",
          "#124784",
          "Office",
          "#148a64",
          "Other",
          "#bf3f2f",
          "Multi-Family Dwelling",
          "#6b4ea2",
          "#7f8ba0",
        ],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.3,
        "circle-opacity": 0.5,
      },
    });

    map.addSource("active-point", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    map.addLayer({
      id: "active-point-glow",
      type: "circle",
      source: "active-point",
      paint: {
        "circle-radius": 19,
        "circle-color": "#bf3f2f",
        "circle-opacity": 0.22,
      },
    });

    map.addLayer({
      id: "active-point-core",
      type: "circle",
      source: "active-point",
      paint: {
        "circle-radius": 8,
        "circle-color": "#bf3f2f",
        "circle-stroke-color": "#fff6f0",
        "circle-stroke-width": 2.5,
      },
    });

    updateAllPointsSource();
    if (STATE.activeStepId) {
      activateStep(STATE.activeStepId, { updateHash: false, force: true });
    }
  });
}

async function init() {
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
    progressLabelEl.textContent = "Could not load GeoJSON. Serve this folder with a local web server.";
    console.error(err);
    return;
  }

  const rawFeatures = Array.isArray(data.features) ? data.features : [];
  const features = normalizeFeatures(rawFeatures);
  if (!features.length) {
    progressLabelEl.textContent = "No valid map points found in GeoJSON.";
    return;
  }

  STATE.features = features;
  STATE.steps = buildSteps(features);

  buildStoryCards(STATE.steps);
  setupScrollObserver();
  setupStoryEvents();

  if (!STATE.steps.length) {
    progressLabelEl.textContent = "No steps available to render.";
    return;
  }

  const hashStepId = getStepIdFromHash();
  const targetStepId = hashStepId && getStepById(hashStepId) ? hashStepId : STATE.steps[0].id;
  activateStep(targetStepId, { updateHash: !hashStepId });

  initMap();
}

init();
