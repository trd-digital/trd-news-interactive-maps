const trdMap = () => {
  mapboxgl.accessToken =
    "pk.eyJ1IjoidHJkZGF0YSIsImEiOiJjamc2bTc2YmUxY2F3MnZxZGh2amR2MTY5In0.QlOWqB-yQNrNlXD0KQ9IvQ";

  const mapConfig = {
    container: "map", // container ID
    style: "mapbox://styles/mapbox/light-v10", // style URL
    center: [-81.01876871961221, 26.351549067464248], // starting position [lng, lat]. Note that lat must be set between -90 and 90
    zoom: 8, // starting zoom
    attributionControl: false,
  };

  const legendMap = [
    {
      color: "#BBDEFB",
      text: "<$500K",
    },
    {
      color: "#64B5F6",
      text: "$500K - $1M",
    },
    {
      color: "#2196F3",
      text: "$1M - $2M",
    },
    {
      color: "#1976D2",
      text: "$2M - $5M",
    },
    {
      color: "#0D47A1",
      text: ">$5M",
    },
  ];

  let mapObj;

  const fn = {
    init: async () => {
      mapObj = new mapboxgl.Map(mapConfig);
      fn.createLegend();

      const data = await map.getData();

      const sourceId = "south-florida-transactions";

      map.addSource(sourceId, data.geoData);
      map.addLayer(sourceId, data);
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

  const map = {
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

    addLayer: (id, data) => {
      mapObj.on("load", () => {
        mapObj.addLayer({
          type: "circle",
          id: id,
          source: id,
          filter: ["==", ["get", "Doc Type"], "DEED"], // Only show entries where Doc Type is DEED
          paint: {
            "circle-radius": 10,
          },
        });
      });
    },
  };

  fn.init();

  return mapObj;
};

window.map = trdMap();
