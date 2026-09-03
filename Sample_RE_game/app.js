const DATA_URL = "./data/properties.json";

/** @typedef {{
 *  id: string,
 *  title: string,
 *  location: string,
 *  image: string,
 *  facts: Record<string, string>,
 *  soldPrice: number
 * }} Property
 */

const el = {
  propertyImage: document.getElementById("propertyImage"),
  propertyTitle: document.getElementById("propertyTitle"),
  progressText: document.getElementById("progressText"),
  factsGrid: document.getElementById("factsGrid"),
  guessForm: document.getElementById("guessForm"),
  guessInput: document.getElementById("guessInput"),
  submitBtn: document.getElementById("submitBtn"),
  result: document.getElementById("result"),
  actualPrice: document.getElementById("actualPrice"),
  yourGuess: document.getElementById("yourGuess"),
  difference: document.getElementById("difference"),
  accuracy: document.getElementById("accuracy"),
  nextBtn: document.getElementById("nextBtn"),
  restartBtn: document.getElementById("restartBtn"),
  statsText: document.getElementById("statsText"),
  error: document.getElementById("error"),
};

/** @type {Property[]} */
let deck = [];
let index = 0;
/** @type {{played: number, totalAbsPctError: number}} */
let stats = { played: 0, totalAbsPctError: 0 };

function money(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseGuess(raw) {
  const cleaned = String(raw).replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function setError(message) {
  el.error.textContent = message;
  el.error.hidden = !message;
}

function setResultVisible(visible) {
  el.result.hidden = !visible;
}

function setFormDisabled(disabled) {
  el.guessInput.disabled = disabled;
  el.submitBtn.disabled = disabled;
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function factsToDl(facts) {
  el.factsGrid.innerHTML = "";
  for (const [k, v] of Object.entries(facts)) {
    const wrap = document.createElement("div");

    const dt = document.createElement("dt");
    dt.textContent = k;

    const dd = document.createElement("dd");
    dd.textContent = v;

    wrap.appendChild(dt);
    wrap.appendChild(dd);
    el.factsGrid.appendChild(wrap);
  }
}

function renderCard() {
  const property = deck[index];
  if (!property) return;

  setError("");
  setResultVisible(false);
  setFormDisabled(false);
  el.guessInput.value = "";
  el.guessInput.focus();

  el.propertyTitle.textContent = `${property.title} (${property.location})`;
  el.progressText.textContent = `${index + 1} of ${deck.length}`;

  factsToDl(property.facts);

  el.propertyImage.src = property.image;
  el.propertyImage.alt = `Photo of ${property.title}`;
}

function reveal(guessValue) {
  const property = deck[index];
  const actual = property.soldPrice;

  const diff = guessValue - actual;
  const absDiff = Math.abs(diff);
  const absPctError = absDiff / actual;

  stats.played += 1;
  stats.totalAbsPctError += absPctError;

  const accuracyPct = clamp((1 - absPctError) * 100, 0, 100);

  el.actualPrice.textContent = money(actual);
  el.yourGuess.textContent = money(guessValue);
  el.difference.textContent = `${diff >= 0 ? "+" : "-"}${money(absDiff)}`;
  el.accuracy.textContent = `${accuracyPct.toFixed(1)}%`;

  const avgAbsPctError = stats.totalAbsPctError / stats.played;
  const avgAccuracyPct = clamp((1 - avgAbsPctError) * 100, 0, 100);
  el.statsText.textContent = `${stats.played} revealed • Average accuracy ${avgAccuracyPct.toFixed(
    1
  )}%`;

  setFormDisabled(true);
  setResultVisible(true);
}

function next() {
  index += 1;
  if (index >= deck.length) {
    index = 0;
    deck = shuffle(deck);
  }
  renderCard();
}

function restart() {
  index = 0;
  stats = { played: 0, totalAbsPctError: 0 };
  deck = shuffle(deck);
  renderCard();
}

async function load() {
  setError("");
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
    const json = await res.json();

    if (!json || !Array.isArray(json.properties)) {
      throw new Error("Data file format is invalid: expected { properties: [...] }");
    }

    deck = json.properties;
    if (deck.length === 0) throw new Error("No properties in data file");

    // Basic validation so the UI doesn't break with bad input.
    for (const p of deck) {
      if (!p.id || !p.title || !p.location || !p.image) {
        throw new Error("Each property must include id/title/location/image");
      }
      if (!p.facts || typeof p.facts !== "object") {
        throw new Error("Each property must include facts as an object");
      }
      if (!Number.isFinite(p.soldPrice) || p.soldPrice <= 0) {
        throw new Error("Each property must include a positive soldPrice");
      }
    }

    deck = shuffle(deck);
    renderCard();
  } catch (e) {
    console.error(e);
    setError(
      "Could not load the game data. If you opened index.html directly, try running a local server (see README)."
    );
  }
}

el.guessForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setError("");

  const guessValue = parseGuess(el.guessInput.value);
  if (!guessValue) {
    setError("Enter a valid dollar amount (numbers only).");
    el.guessInput.focus();
    return;
  }

  reveal(guessValue);
});

el.nextBtn.addEventListener("click", () => next());
el.restartBtn.addEventListener("click", () => restart());

load();
