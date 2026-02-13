gsap.registerPlugin(ScrollTrigger);

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const panels = new Map(
  Array.from(document.querySelectorAll(".panel")).map(p => [p.dataset.panel, p])
);

const brokerData = [
  { name: "Sheila Hall", value: 186.9, firm: "Summit Sotheby’s International Realty" },
  { name: "Paul Benson", value: 155.4, firm: "Engel & Völkers Park City" },
  { name: "Mark Sletten", value: 147.8, firm: "Engel & Völkers Park City" },
  { name: "Garrett Noel", value: 136.4, firm: "Berkshire Hathaway Homeservices Utah Properties" },
  { name: "Kelly Horn", value: 111.0, firm: "Berkshire Hathaway Homeservices Utah Properties" },
];

function formatMoney(n) {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function setActivePanel(key) {
  for (const p of panels.values()) p.classList.remove("is-active");
  (panels.get(key) ?? panels.get("hero")).classList.add("is-active");
}

function animateCounters() {
  document.querySelectorAll("[data-count-to]").forEach(el => {
    const to = Number(el.dataset.countTo);
    const prefix = el.dataset.prefix ?? "";
    const suffix = el.dataset.suffix ?? "";
    const obj = { v: 0 };

    gsap.to(obj, {
      v: to,
      duration: prefersReduced ? 0 : 1.2,
      ease: "power2.out",
      onUpdate: () => {
        const v = to >= 1000 ? Math.round(obj.v / 10) * 10 : Math.round(obj.v);
        el.textContent = `${prefix}${formatMoney(prefix ? v : v).replace("$", "")}${suffix}`;
        // If prefix already "$", we custom format:
        if (prefix === "$") el.textContent = `${formatMoney(v)}${suffix}`;
        if (prefix === "") el.textContent = `${v.toLocaleString()}${suffix}`;
      }
    });
  });
}

function renderBrokers() {
  const ol = document.getElementById("brokerList");
  if (!ol || ol.dataset.ready) return;
  ol.dataset.ready = "true";
  ol.innerHTML = brokerData.map(d =>
    `<li><strong>${d.name}</strong> — $${d.value.toFixed(1)}M <span style="opacity:.7">(${d.firm})</span></li>`
  ).join("");
}

function animateRoute() {
  const route = document.getElementById("route");
  if (!route) return;
  const length = route.getTotalLength();
  route.style.strokeDasharray = `${length}`;
  route.style.strokeDashoffset = `${length}`;
  gsap.to(route, {
    strokeDashoffset: 0,
    duration: prefersReduced ? 0 : 1.2,
    ease: "power2.out",
  });
}

function setCard(mode) {
  const eyebrow = document.getElementById("cardEyebrow");
  const value = document.getElementById("cardValue");
  const meta = document.getElementById("cardMeta");
  const img = document.querySelector(".card-img");
  if (!eyebrow || !value || !meta || !img) return;

  const config = {
    condo: { eyebrow: "Record condo sale", value: "$18.9M", meta: "Montage Deer Valley Penthouse", img: "./assets/condo.webp" },
    home: { eyebrow: "Record home sale", value: ">$50M", meta: "3566 West Crestwood Court", img: "./assets/home.webp" },
    listing: { eyebrow: "Most expensive listing", value: "$60M", meta: "253 White Pine Road", img: "./assets/listing.webp" },
  }[mode] ?? config.condo;

  eyebrow.textContent = config.eyebrow;
  value.textContent = config.value;
  meta.textContent = config.meta;
  img.src = config.img;
  if (!prefersReduced) gsap.fromTo(".card", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 });
}

// Step wiring
document.querySelectorAll(".step").forEach(step => {
  ScrollTrigger.create({
    trigger: step,
    start: "top 60%",
    end: "bottom 40%",
    onEnter: () => handleStep(step.dataset.step),
    onEnterBack: () => handleStep(step.dataset.step),
  });
});

function handleStep(stepKey) {
  switch (stepKey) {
    case "hero":
      setActivePanel("hero");
      break;
    case "metrics":
      setActivePanel("metrics");
      animateCounters();
      break;
    case "condo":
      setActivePanel("card");
      setCard("condo");
      break;
    case "home":
      setActivePanel("card");
      setCard("home");
      break;
    case "listing":
      setActivePanel("card");
      setCard("listing");
      break;
    case "brokers":
      setActivePanel("brokers");
      renderBrokers();
      if (!prefersReduced) gsap.fromTo("#brokerList li", { y: 10, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.45 });
      break;
    case "map":
      setActivePanel("map");
      animateRoute();
      break;
    case "controversy":
      setActivePanel("controversy");
      if (!prefersReduced) gsap.fromTo(".stamp", { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35 });
      break;
    case "outro":
      setActivePanel("outro");
      break;
    default:
      setActivePanel("hero");
  }
}

// Init
setActivePanel("hero");
