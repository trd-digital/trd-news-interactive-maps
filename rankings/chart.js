/**
 * Reusable Bump Chart Module
 * Configuration object should be set in HTML file before loading this script
 *
 * Example usage in HTML:
 * <script>
 *   window.chartConfig = {
 *     csvFile: 'top_brokers_rank.csv',
 *     title: "NYC's Top Broker Ranking",
 *     containerId: 'chart'
 *   };
 * </script>
 * <script src="chart.js"></script>
 */

/**
 * Parse CSV data into ECharts bump chart format
 */
function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");

  if (lines.length < 2) {
    throw new Error("CSV must have at least 2 rows (header + data)");
  }

  // Parse header (years/periods)
  const header = lines[0].split(",").map((s) => s.trim());
  const years = header.slice(1).map((year) => {
    const num = Number(year);
    if (isNaN(num)) {
      throw new Error(`Column headers must be valid numbers, got: "${year}"`);
    }
    return num;
  });

  // Parse data rows
  const seriesData = [];
  const people = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(",").map((s) => s.trim());

    if (values.length !== header.length) {
      throw new Error(
        `Row ${i + 1} has ${values.length} values, expected ${header.length}`,
      );
    }

    const personName = values[0];
    if (!personName) continue;

    people.push(personName);

    const ranks = values.slice(1).map((val, idx) => {
      const num = Number(val);
      if (isNaN(num)) {
        throw new Error(
          `Invalid rank in row "${personName}", column ${years[idx]}: "${val}"`,
        );
      }
      return num;
    });

    seriesData.push({
      name: personName,
      data: ranks,
    });
  }

  if (seriesData.length === 0) {
    throw new Error("No valid data rows found in CSV");
  }

  return { years: years.map(String), seriesData, people };
}

/**
 * Create ECharts bump chart with default styles
 */
function createBumpChart(data, title) {
  const config = window.chartConfig || {};
  const containerId = config.containerId || "chart";
  const chart = echarts.init(document.getElementById(containerId));

  const { years, seriesData } = data;

  const option = {
    title: {
      text: title,
    },
    tooltip: {
      trigger: "item",
    },
    grid: {
      left: 50,
      right: 300,
      bottom: 50,
      top: 50,
      containLabel: true,
    },
    xAxis: {
      type: "category",
      splitLine: {
        show: true,
      },
      axisLabel: {
        show: true,
        margin: 10,
        fontSize: 14,
      },
      boundaryGap: false,
      data: years,
    },
    yAxis: {
      type: "value",
      axisLabel: {
        margin: 30,
        fontSize: 16,
        formatter: "#{value}",
      },
      inverse: true,
      interval: 1,
      min: 1,
      max: seriesData.length,
    },
    series: seriesData.map((person) => ({
      name: person.name,
      symbolSize: 20,
      type: "line",
      smooth: true,
      emphasis: {
        focus: "series",
      },
      endLabel: {
        show: true,
        formatter: "{a}",
        distance: 10,
        fontSize: 13,
        overflow: "truncate",
        padding: [4, 8],
      },
      lineStyle: {
        width: 4,
      },
      data: person.data,
    })),
    animationDuration: 1000,
    animationEasing: "cubicInOut",
  };

  chart.setOption(option);

  // Handle window resize
  window.addEventListener("resize", () => {
    chart.resize();
  });

  return chart;
}

/**
 * Main initialization
 */
async function init() {
  try {
    const config = window.chartConfig;

    if (!config || !config.csvFile) {
      throw new Error("Missing chartConfig or csvFile in window.chartConfig");
    }

    const csvFile = config.csvFile;
    const title = config.title || "Chart";

    const response = await fetch(csvFile);
    if (!response.ok) {
      throw new Error(`Failed to load ${csvFile}: ${response.status}`);
    }

    const csvText = await response.text();
    const parsedData = parseCSV(csvText);
    createBumpChart(parsedData, title);
  } catch (error) {
    console.error("Error:", error);
    const config = window.chartConfig || {};
    const containerId = config.containerId || "chart";
    document.getElementById(containerId).innerHTML = `
      <div class="error-message">
        <p><strong>Error:</strong> ${error.message}</p>
        <p style="font-size: 12px; margin-top: 8px;">
          Please check the configuration and ensure the CSV file exists.
        </p>
      </div>
    `;
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", init);
