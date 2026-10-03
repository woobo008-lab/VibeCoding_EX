const months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const monthlySales = Array(months.length).fill(null);
const marketSegments = ["자사", "경쟁사 A", "경쟁사 B", "기타"];
const defaultMarketShareColors = ["#286d54", "#d77c62", "#d5a84f", "#82a8c5"];
let marketShares = Array(marketSegments.length).fill(0);
let marketShareLabels = [...marketSegments];
let marketShareColors = [...defaultMarketShareColors];
let visibleMonthCount = months.length;
let nextMonthIndex = 0;
let monthTimer = null;
let resetTimer = null;
let simulationRunning = false;
let exportInProgress = false;
const simulationToggle = document.querySelector("#toggle-simulation");
const downloadButton = document.querySelector("#download-dashboard");
const marketShareMonth = document.querySelector("#market-share-month");
const csvInput = document.querySelector("#sales-csv-input");
const csvStatus = document.querySelector("#csv-status");

function generateMarketShares() {
  const weights = marketSegments.map(() => Math.random());
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const minimumShare = 5;
  const distributableShare = 100 - minimumShare * marketSegments.length;
  const exactShares = weights.map((weight) => weight / totalWeight * distributableShare);
  const shares = exactShares.map((share) => Math.floor(share) + minimumShare);
  const remainingPoints = 100 - shares.reduce((sum, share) => sum + share, 0);
  const remainderOrder = exactShares
    .map((share, index) => ({ index, fraction: share - shares[index] }))
    .sort((first, second) => second.fraction - first.fraction);

  for (let index = 0; index < remainingPoints; index += 1) {
    shares[remainderOrder[index].index] += 1;
  }
  return shares;
}

function getCumulativeSales() {
  let total = 0;
  return monthlySales.map((sale) => {
    if (sale === null) return null;
    total += sale;
    return total;
  });
}

function updateCharts() {
  const visibleMonths = months.slice(0, visibleMonthCount);
  salesChart.data.labels = visibleMonths;
  salesChart.data.datasets[0].data = monthlySales.slice(0, visibleMonthCount);
  cumulativeChart.data.labels = visibleMonths;
  cumulativeChart.data.datasets[0].data = getCumulativeSales().slice(0, visibleMonthCount);
  marketShareChart.data.labels = [...marketShareLabels];
  marketShareChart.data.datasets[0].data = [...marketShares];
  marketShareChart.data.datasets[0].backgroundColor = [...marketShareColors];
  salesChart.update("none");
  cumulativeChart.update("none");
  marketShareChart.update("none");
}

function setSimulationButton() {
  const label = simulationRunning ? "모의 정지" : "모의 시작";
  simulationToggle.setAttribute("aria-pressed", String(simulationRunning));
  simulationToggle.setAttribute("aria-label", label);
  simulationToggle.title = label;
  downloadButton.disabled = simulationRunning || exportInProgress;
  csvInput.disabled = simulationRunning || exportInProgress;
  downloadButton.title = simulationRunning
    ? "모의를 정지하면 PNG를 내려받을 수 있습니다"
    : "정지 대시보드 PNG 다운로드";
  simulationToggle.disabled = exportInProgress;
}

function recordNextMonth() {
  const monthIndex = nextMonthIndex;
  monthlySales[nextMonthIndex] = Math.floor(Math.random() * 401) + 100;
  marketShares = generateMarketShares();
  marketShareLabels = [...marketSegments];
  marketShareColors = [...defaultMarketShareColors];
  marketShareMonth.textContent = months[monthIndex];
  nextMonthIndex += 1;
  visibleMonthCount = nextMonthIndex;
  updateCharts();
}

function scheduleCycleRestart() {
  window.clearInterval(monthTimer);
  monthTimer = null;
  resetTimer = window.setTimeout(() => {
    if (!simulationRunning) return;
    monthlySales.fill(null);
    marketShares = Array(marketSegments.length).fill(0);
    marketShareLabels = [...marketSegments];
    marketShareColors = [...defaultMarketShareColors];
    marketShareMonth.textContent = "대기";
    nextMonthIndex = 0;
    visibleMonthCount = 0;
    updateCharts();
    recordNextMonth();
    monthTimer = window.setInterval(advanceMonth, 3000);
  }, 5000);
}

function advanceMonth() {
  if (!simulationRunning || nextMonthIndex >= months.length) return;
  recordNextMonth();
  if (nextMonthIndex === months.length) scheduleCycleRestart();
}

function startSimulation() {
  simulationRunning = true;
  setSimulationButton();

  if (nextMonthIndex >= months.length) {
    monthlySales.fill(null);
    marketShares = Array(marketSegments.length).fill(0);
    marketShareLabels = [...marketSegments];
    marketShareColors = [...defaultMarketShareColors];
    marketShareMonth.textContent = "대기";
    nextMonthIndex = 0;
    visibleMonthCount = 0;
    updateCharts();
  }
  if (nextMonthIndex === 0) recordNextMonth();
  monthTimer = window.setInterval(advanceMonth, 3000);
}

function stopSimulation() {
  simulationRunning = false;
  window.clearInterval(monthTimer);
  window.clearTimeout(resetTimer);
  monthTimer = null;
  resetTimer = null;
  setSimulationButton();
}

const salesChart = new Chart(document.querySelector("#chart-one"), {
  type: "bar",
  data: {
    labels: months,
    datasets: [{
      label: "월별 판매",
      data: monthlySales,
      backgroundColor: "rgb(40 109 84 / 72%)",
      borderRadius: 3,
      maxBarThickness: 22
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: { mode: "index", intersect: false }
    },
    interaction: { mode: "index", intersect: false },
    scales: {
      x: {
        grid: { display: false },
        ticks: { autoSkip: true, maxTicksLimit: 6, maxRotation: 0 },
        border: { display: false }
      },
      y: {
        beginAtZero: true,
        ticks: { maxTicksLimit: 5 },
        grid: { color: "#e7eee9", drawTicks: false },
        border: { display: false }
      }
    }
  }
});

const cumulativeChart = new Chart(document.querySelector("#chart-two"), {
    type: "line",
    data: {
      labels: months,
      datasets: [{
        label: "누적 합계",
        data: getCumulativeSales(),
        borderColor: "#d77c62",
        backgroundColor: "#d77c62",
        borderWidth: 2,
        pointRadius: 2.5,
        pointHoverRadius: 4,
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { mode: "index", intersect: false }
      },
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          grid: { display: false },
          ticks: { autoSkip: true, maxTicksLimit: 6, maxRotation: 0 },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { maxTicksLimit: 5 },
          grid: { color: "#e7eee9", drawTicks: false },
          border: { display: false }
        }
      }
    }
});

const marketShareChart = new Chart(document.querySelector("#chart-market-share"), {
  type: "pie",
  data: {
    labels: marketShareLabels,
    datasets: [{
      data: marketShares,
      backgroundColor: marketShareColors,
      borderColor: "#ffffff",
      borderWidth: 2
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, boxHeight: 10, padding: 10, font: { size: 10 } }
      },
      tooltip: {
        callbacks: {
          label(context) { return `${context.label}: ${context.raw}%`; }
        }
      }
    }
  }
});

simulationToggle.addEventListener("click", () => {
  if (simulationRunning) stopSimulation();
  else startSimulation();
});

function normalizeHeader(header) {
  const value = header.trim().replace(/^\uFEFF/, "").toLowerCase();
  const aliases = {
    "월": "month",
    month: "month",
    "판매량": "sales",
    sales: "sales",
    "점유율": "share",
    "시장 점유율": "share",
    "시장점유율": "share",
    share: "share"
  };
  return aliases[value] || value;
}

function parseMonth(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2})\s*월?$/);
  return match ? Number(match[1]) : NaN;
}

function parseNumber(value, columnName) {
  const normalized = String(value ?? "").trim().replace(/,/g, "").replace(/%$/, "");
  const number = Number(normalized);
  if (normalized === "" || !Number.isFinite(number)) {
    throw new Error(`${columnName} 값이 숫자가 아닙니다.`);
  }
  return number;
}

function validateCsvRows(rows) {
  if (rows.length === 0 || rows.length > months.length) {
    throw new Error("CSV에는 1월부터 12월 사이의 데이터가 있어야 합니다.");
  }

  return rows.map((row, index) => {
    const month = parseMonth(row.month);
    if (month !== index + 1) {
      throw new Error(`CSV 월은 1월부터 순서대로 있어야 합니다. ${index + 1}월 행을 확인해 주세요.`);
    }

    const sales = parseNumber(row.sales, "판매량");
    const share = parseNumber(row.share, "점유율");
    if (sales < 0) throw new Error(`${month}월 판매량은 0 이상이어야 합니다.`);
    if (share < 0 || share > 100) throw new Error(`${month}월 점유율은 0~100 사이여야 합니다.`);
    return { month, sales, share };
  });
}

function applyCsvRows(rows) {
  stopSimulation();
  monthlySales.fill(null);
  for (const row of rows) monthlySales[row.month - 1] = row.sales;

  nextMonthIndex = rows.length;
  visibleMonthCount = rows.length;
  const latest = rows[rows.length - 1];
  marketShares = [latest.share, 100 - latest.share];
  marketShareLabels = ["자사", "기타 시장"];
  marketShareColors = ["#286d54", "#dce6df"];
  marketShareMonth.textContent = `${months[latest.month - 1]} 기준`;
  csvStatus.textContent = `${rows.length}개월 데이터를 불러왔습니다.`;
  csvStatus.hidden = false;
  updateCharts();
}

csvInput.addEventListener("change", () => {
  const [file] = csvInput.files;
  if (!file) return;
  if (typeof Papa === "undefined") {
    csvStatus.textContent = "CSV 읽기 도구를 불러오지 못했습니다.";
    csvStatus.hidden = false;
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
    complete(results) {
      try {
        const rows = validateCsvRows(results.data);
        applyCsvRows(rows);
      } catch (error) {
        csvStatus.textContent = error.message;
        csvStatus.hidden = false;
      } finally {
        csvInput.value = "";
      }
    },
    error(error) {
      csvStatus.textContent = `CSV를 읽지 못했습니다: ${error.message}`;
      csvStatus.hidden = false;
      csvInput.value = "";
    }
  });
});

downloadButton.addEventListener("click", async () => {
  if (simulationRunning || exportInProgress) return;
  if (typeof html2canvas !== "function") {
    csvStatus.textContent = "PNG 내보내기 도구를 불러오지 못했습니다.";
    csvStatus.hidden = false;
    return;
  }

  exportInProgress = true;
  setSimulationButton();
  try {
    const snapshot = await html2canvas(document.querySelector(".page-shell"), {
      backgroundColor: "#f1f6f2",
      scale: 2,
      logging: false
    });
    const image = await new Promise((resolve) => snapshot.toBlob(resolve, "image/png"));
    if (!image) throw new Error("PNG 이미지를 만들지 못했습니다.");

    const imageUrl = URL.createObjectURL(image);
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `sales-dashboard-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
  } catch (error) {
    csvStatus.textContent = `PNG 저장에 실패했습니다: ${error.message}`;
    csvStatus.hidden = false;
  } finally {
    exportInProgress = false;
    setSimulationButton();
  }
});

downloadButton.addEventListener("click", async () => {
  if (simulationRunning || exportInProgress) return;
  if (typeof html2canvas !== "function") {
    window.alert("PNG 내보내기 도구를 불러오지 못했습니다.");
    return;
  }

  exportInProgress = true;
  setSimulationButton();
  try {
    const snapshot = await html2canvas(document.querySelector(".page-shell"), {
      backgroundColor: "#f1f6f2",
      scale: 2,
      logging: false
    });
    const image = await new Promise((resolve) => snapshot.toBlob(resolve, "image/png"));
    if (!image) return;

    const imageUrl = URL.createObjectURL(image);
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `sales-dashboard-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
  } catch (error) {
    console.error("Dashboard PNG export failed:", error);
  } finally {
    exportInProgress = false;
    setSimulationButton();
  }
});

setSimulationButton();