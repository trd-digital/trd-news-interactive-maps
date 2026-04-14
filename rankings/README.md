# NYC's Top Broker Ranking - Animated Bump Chart

A professional static HTML/CSS/JS animated bump chart built with **ECharts** using **default ECharts styling**. Displays rankings changes over time with smooth animations and responsive design.

## Features

- 📊 **ECharts Bump Chart**: Clean, professional line chart for ranking visualization
- 🎨 **Smooth Animations**: Built-in cubic easing animations
- 📱 **Fully Responsive**: Adapts to all screen sizes (mobile, tablet, desktop)
- 🏷️ **Custom Title**: "NYC's Top Broker Ranking" prominently displayed
- 🎯 **Interactive**: Hover effects and interactive tooltips
- 🌈 **Default Theme**: Uses ECharts professional color scheme
- 💾 **Embeddable**: Can be embedded as an iframe
- 📏 **100% Width/Height**: Fills parent container completely
- ⚡ **No Build Tools**: Pure HTML/CSS/JS - just open in browser

## CSV Format

Your CSV file must follow this structure:

```
Person,2020,2021,2022,2023,2024
Alice,1,2,1,3,2
Bob,2,1,3,1,1
Charlie,3,3,2,2,3
```

**Requirements:**

- First column: Person names (any text)
- Remaining columns: Years/periods as headers (numeric values)
- Data cells: Rankings (numeric values, lower is better rank)
- No empty rows
- No special characters that break CSV parsing

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Generate Data

Place your raw CSV files in `raw_data_csv/` folder, then run the script from the `scripts/` folder:

```bash
cd scripts
python process_broker_data.py --num 10
cd ..
```

Or run from the root directory:

```bash
python scripts/process_broker_data.py --num 10
```

This creates `data/top_brokers_rank.csv` that the chart will use.

### 3. Open in Browser

Simply open `index.html` in your web browser - no build tools needed!

```bash
# macOS
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

### 4. Or Serve Locally (Recommended)

For a better experience, use a local server:

```bash
# Python 3
python -m http.server 8000

# Node.js (if installed)
npx http-server
```

Then open `http://localhost:8000` in your browser.

## Reusable Chart System

This project uses a **modular reusable system** that allows you to create multiple charts using the same CSS and JavaScript library. Each chart is defined by its own HTML file and CSV data source.

### Key Files

- **`chart.js`** - Core reusable chart library (works with any CSV file)
- **`styles.css`** - Shared responsive styling for all charts
- **`chart-template.html`** - Template to copy for creating new charts
- **`index.html`** - Example chart: NYC's Top Broker Ranking

### Creating New Charts

To create an additional chart:

1. **Create your CSV data file** with the same format as shown above:

   ```csv
   Name,2020,2021,2022,2026
   Agent Name,1,2,1,3
   Another Agent,2,1,3,1
   ```

2. **Copy the template**:

   ```bash
   cp chart-template.html my_new_chart.html
   ```

3. **Edit the HTML file** and update the configuration:

   ```javascript
   window.chartConfig = {
     csvFile: "data/my_data.csv", // Your CSV file in data/ folder
     title: "My Chart Title", // Your chart title
     containerId: "chart", // HTML element ID (usually 'chart')
   };
   ```

4. **Open in browser**: `open my_new_chart.html`

### Multi-Chart Example

Here's how you could structure multiple charts in the same directory:

```
rankings/
├── chart.js                 (shared library)
├── styles.css               (shared styles)
│
├── nyc_top_brokers_ranking.html
├── sales_ranking.html
└── regions_ranking.html
│
├── data/                    (all CSV outputs here)
│   ├── top_brokers_rank.csv     (for nyc_top_brokers_ranking.html)
│   ├── sales_data.csv           (for sales_ranking.html)
│   └── regions_data.csv         (for regions_ranking.html)
│
└── raw_data_csv/            (raw input data)
```

All HTML files share the same `chart.js` and `styles.css` - each just specifies its own CSV data and title.

### Configuration Reference

When updating `window.chartConfig`, you can customize:

```javascript
window.chartConfig = {
  csvFile: "data.csv", // Required: CSV file path
  title: "Chart Title", // Required: Chart title
  containerId: "chart", // Optional: HTML element ID (default: 'chart')
};
```

### Generating Data with Python Script

Use the included Python script to automatically generate ranked CSV data from raw broker data:

```bash
# From root, generate top 10 brokers
python scripts/process_broker_data.py --num 10

# Or from scripts folder
cd scripts
python process_broker_data.py --num 10
cd ..
```

This creates `data/top_brokers_rank.csv` which is automatically used by all charts.

**Setup:**

1. Install Python dependencies: `pip install -r requirements.txt`
2. Place raw CSV files in `raw_data_csv/` folder
3. Run the script with your desired broker count
4. The output CSV in `data/` folder is ready to use with any chart

### Key Benefits

- ✅ **Single library** - All charts use `chart.js` and `styles.css`
- ✅ **Easy to duplicate** - Just copy the template HTML file
- ✅ **No code duplication** - One implementation, multiple charts
- ✅ **Scalable** - Add as many charts as needed
- ✅ **Consistent styling** - All charts look professional and unified
- ✅ **Automated data generation** - Python script handles data processing

## File Structure

```
rankings/
├── chart.js                  # Reusable chart library
├── styles.css                # Reusable responsive styling
├── chart-template.html       # Template for creating new charts
├── index.html                # Example: NYC Top Broker Ranking
├── README.md                 # This file
├── requirements.txt          # Python dependencies
├── .gitignore                # Git configuration
│
├── data/                      # Generated CSV outputs
│   └── top_brokers_rank.csv  # Output from Python script
│
├── scripts/                   # Python scripts
│   └── process_broker_data.py # Data processing script
│
└── raw_data_csv/             # Raw ranking CSV files (input data)
    ├── 2025-NYC-Broker_Agent_Team-Ranking-TRD-Data.csv
    └── 2026-NYC-Broker_Agent_Team-Ranking-TRD-Data.csv
```

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (v14+)
- IE11: ❌ Not supported

## Responsiveness

The chart automatically adapts to three breakpoints:

- **Desktop** (>768px): Full labels and larger elements
- **Tablet** (480-768px): Reduced padding, smaller text
- **Mobile** (<480px): Minimal spacing, optimized for touch

## Customization

### Animation Speed

Modify `chart.js` and change the `animationDuration` value:

```javascript
const option = {
  animationDuration: 1000, // milliseconds (1000 = 1 second)
  animationEasing: "cubicInOut",
  // Options: 'linear', 'quadraticIn', 'quadraticOut', 'cubicInOut', 'elasticOut', etc.
};
```

### Colors

To use a different ECharts theme, modify the `createBumpChart()` function in `chart.js`:

```javascript
// Change from default to a dark theme
const chart = echarts.init(document.getElementById(containerId), "dark");
```

Available themes: `'light'` (default), `'dark'`, and other registered themes

### Line & Point Styling

Customize in `chart.js`, in the series configuration:

```javascript
series: seriesData.map((person) => ({
  name: person.name,
  type: "line",
  data: person.data,
  lineStyle: {
    width: 4, // Line thickness
  },
  symbolSize: 20, // Point size
  smooth: true, // smooth curves
}));
```

### Margins & Spacing

Adjust chart margins in `chart.js`:

```javascript
grid: {
  left: 80,      // Left margin in pixels
  right: 250,    // Right margin for labels
  bottom: 30,    // Bottom margin
  containLabel: false
}
```

## Troubleshooting

**Chart won't render:**

- Ensure CSV file exists (e.g., `top_brokers_rank.csv`)
- Check that `window.chartConfig.csvFile` points to the correct file
- Check browser console for error messages (F12 → Console tab)
- Verify CSV format is correct

**CSV format errors:**

- Ensure first row has: Name column, then year/period columns
- Years/periods must be numbers (2020, 2021, etc.)
- Rank values must be integers
- No empty rows at end of file
- Use comma (,) as delimiter, not semicolon

**Python script errors:**

- Ensure dependencies installed: `pip install -r requirements.txt`
- Run script from root: `python scripts/process_broker_data.py --num 10`
- Check that raw CSV files are in `raw_data_csv/` folder
- Verify column names are "Rank" and "Agent/Team" in raw data
- Verify year is correctly formatted in filename (e.g., `2026-NYC-...`)

**Animations stuttering:**

- Check if CSV has too many brokers (100+)
- Close other browser tabs to free memory
- Reduce `animationDuration` in `chart.js`
- Use Chrome/Firefox (better performance than Safari)

## Data Tips

**Best practices:**

- Keep 2-15 brokers for optimal readability
- Keep 3-10 time periods for clarity
- Use consistent ranking ranges (e.g., 1-10)
- Avoid missing values (use placeholder ranks if needed)
- Ensure no duplicate broker names

**Example CSV:**

```
Broker,2021,2022,2023,2024
Jones Lang LaSalle,1,1,2,2
CBRE Group,2,2,1,1
Cushman & Wakefield,3,3,3,3
Colliers International,4,4,4,4
Newmark Knight Frank,5,5,5,5
```

## License

MIT - Feel free to use and modify for your projects.

## Dependencies

- ECharts 5 (loaded from CDN)
- Modern browser with ES6 support (Chrome, Firefox, Safari, Edge)

## Performance Notes

- ECharts rendering is GPU-accelerated
- Handles 100+ brokers efficiently
- Smooth animations on all devices (GPU optimized)
- Chart resizes responsively without lag
- CSV parsing is instant (even for large files)

---

Built with ECharts using default professional styling for clean data visualization.
