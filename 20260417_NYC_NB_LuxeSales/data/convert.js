const fs = require('fs');

// read your JSON file
const data = JSON.parse(fs.readFileSync('data/nyc_nb.json', 'utf8'));

const neighborhoods = {
  type: "FeatureCollection",
  features: data.map(row => ({
    type: "Feature",
    id: row.neighborhood_id,
    geometry: JSON.parse(row.geom),
    properties: {
      neighborhood: row.name_
    }
  }))
};

// write new GeoJSON file
fs.writeFileSync(
  'nyc_neighborhoods.geojson',
  JSON.stringify(neighborhoods, null, 2)
);

console.log("GeoJSON file created!");