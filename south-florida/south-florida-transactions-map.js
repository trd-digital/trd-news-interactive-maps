const trdMap = () => {
  mapboxgl.accessToken =
    "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";

  const mapConfig = {
    container: "map", // container ID
    style: "mapbox://styles/mapbox/light-v10", // style URL
    center: {
      lng: -80.38513016032842,
      lat: 26.380126753919782,
    },
    zoom: 8, // starting zoom
    attributionControl: false,
  };

  const legendMap = [
    {
      value: 5_000_000,
      color: "#BBDEFB",
      text: "<$5M",
      default: false,
    },
    {
      value: 10_000_000,
      color: "#64B5F6",
      text: "$5M - $10M",
      default: false,
    },
    {
      value: 20_000_000,
      color: "#2196F3",
      text: "$10M - $20M",
      default: false,
    },
    {
      value: 50_000_000,
      color: "#1976D2",
      text: "$20M - $50M",
      default: false,
    },
    {
      value: 100_000_000,
      color: "#0D47A1",
      text: ">$1B",
      default: true,
    },
  ];

  let mapObj;

  const fn = {
    init: async () => {
      fn.createLegend();
      map.init();
    },

    createLegend: () => {
      const parent = document.querySelector("#legend-content ul");
      legendMap.forEach((item) => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="legend-icon" style="background-color: ${item.color}"></span>${item.text}`;
        parent.appendChild(li);
      });
    },
  };

  const helpers = {
    getPointsColor: () => {
      const colors = ["step", ["to-number", ["get", "Sale Price"], 0]];

      legendMap.forEach((item) => {
        colors.push(item.color);

        if (!item.default) {
          colors.push(item.value);
        }
      });

      return colors;
    },
  };

  const map = {
    init: async () => {
      mapObj = new mapboxgl.Map(mapConfig);
      mapObj.addControl(
        new mapboxgl.NavigationControl({
          showCompass: false,
        }),
        "top-right"
      );
      const sourceId = "south-florida-transactions";
      const data = await map.getData();

      map.addSource(sourceId, data.geoData);
      map.addLayer(sourceId);
    },

    getGeoJsonData: async () => {
      const url =
        "https://static.therealdeal.com/interactive-maps/map_data.geojson";
      const response = await fetch(url);
      const data = await response.json();
      return data;
    },

    getMaxSalePriceData: async () => {
      const url =
        "https://static.therealdeal.com/interactive-maps/max_sale_price.json";
      const response = await fetch(url);
      const data = await response.json();
      return data;
    },

    getData: async () => {
      const promises = [map.getGeoJsonData(), map.getMaxSalePriceData()];

      const [geoData, maxSalePriceData] = await Promise.all(promises);

      return {
        geoData,
        maxSalePrice: maxSalePriceData.max_sale_price || 0,
      };
    },

    addSource: (id, data) => {
      mapObj.on("load", () => {
        mapObj.addSource(id, {
          type: "geojson",
          data: data,
        });
      });
    },

    addLayer: (id) => {
      mapObj.on("load", () => {
        mapObj.addLayer({
          type: "circle",
          id: id,
          source: id,
          filter: ["==", ["get", "Doc Type"], "DEED"], // Only show entries where Doc Type is DEED

          paint: {
            "circle-radius": 8,
            "circle-color": helpers.getPointsColor(),
            "circle-pitch-alignment": "map",
          },
        });
      });
    },
  };

  fn.init();

  return mapObj;
};

window.map = trdMap();
