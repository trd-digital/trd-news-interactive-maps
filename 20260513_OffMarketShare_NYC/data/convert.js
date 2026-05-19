const fs = require('fs');

let data;
try {
  const fileContent = fs.readFileSync('data/nyc_nb.json', 'utf8');
  data = JSON.parse(fileContent);
} catch (error) {
  console.error('Error reading or parsing data/nyc_nb.json:', error);
  process.exit(1); // Exit with an error code
}

const neighborhoods = {
  type: "FeatureCollection",
  features: data
    .map(row => {
      try {
        return {
          type: "Feature",
          id: row.neighborhood_id,
          geometry: JSON.parse(row.geom),
          properties: {
            neighborhood: row.name_
          }
        };
      } catch (e) {
        console.warn(
          `Skipping row with invalid geometry: neighborhood_id ${row.neighborhood_id}`
        );

        return null;
      }
    })
    .filter(Boolean) // Remove null entries from failed parses
};

// write new GeoJSON file
fs.writeFileSync(
  'nyc_neighborhoods.geojson',
  JSON.stringify(neighborhoods, null, 2)
);

console.log("GeoJSON file created!");
