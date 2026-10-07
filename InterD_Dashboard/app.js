let { categories, months, unit, year } = window.salesData;
const categorySelect = document.querySelector("#category-select");
const selectionStatus = document.querySelector("#selection-status");
const refreshStatus = document.querySelector("#refresh-status");
const exportStatus = document.querySelector("#export-status");
const chartTooltip = document.querySelector("#chart-tooltip");
const tooltipValue = document.querySelector("#tooltip-value");
const tooltipNote = document.querySelector("#tooltip-note");
const numberFormat = new Intl.NumberFormat("ko-KR");
const dollarFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const svgNamespace = "http://www.w3.org/2000/svg";
const chartColors = {
  axis: "#a1abba",
  grid: "#e8edf4",
  selected: "#5478f5",
  muted: "#d8dfeb",
};
const refreshIntervalMs = 60 * 60 * 1000;
let lastDataSnapshot = JSON.stringify(window.salesData);
let isCheckingForUpdates = false;

function createSvgElement(name, attributes = {}, text) {
  const element = document.createElementNS(svgNamespace, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function categoryTotal(category) {
  return category.monthlySales.reduce((sum, quantity) => sum + quantity, 0);
}

function formatQuantity(quantity) {
  return `${numberFormat.format(quantity)} ${unit}`;
}

function validateSalesData(data) {
  if (
    !data ||
    !Number.isInteger(data.year) ||
    typeof data.unit !== "string" ||
    !data.unit.trim() ||
    typeof data.source !== "string" ||
    !data.source.trim() ||
    !Array.isArray(data.months) ||
    data.months.length === 0 ||
    data.months.some((month) => typeof month !== "string" || !month.trim()) ||
    !Array.isArray(data.categories) ||
    data.categories.length === 0
  ) {
    throw new Error("필수 항목(year, unit, source, months, categories)이 올바르지 않습니다.");
  }

  const categoryIds = new Set();
  for (const category of data.categories) {
    if (
      !category ||
      typeof category.id !== "string" ||
      !category.id.trim() ||
      categoryIds.has(category.id) ||
      typeof category.label !== "string" ||
      !category.label.trim() ||
      typeof category.color !== "string" ||
      !/^#[\da-f]{6}$/i.test(category.color) ||
      !Array.isArray(category.monthlySales) ||
      category.monthlySales.length !== data.months.length ||
      category.monthlySales.some(
        (quantity) => !Number.isFinite(quantity) || quantity < 0,
      )
    ) {
      throw new Error("카테고리 데이터 또는 월별 판매량 형식이 올바르지 않습니다.");
    }
    categoryIds.add(category.id);
  }

  if (
    data.categories.every((category) =>
      category.monthlySales.every((quantity) => quantity === 0),
    )
  ) {
    throw new Error("판매량 데이터에 표시할 값이 없습니다.");
  }
}

function updateCategoryOptions() {
  const previousValue = categorySelect.value;
  const options = [
    new Option("전체 카테고리", "all"),
    ...categories.map((category) => new Option(category.label, category.id)),
  ];
  categorySelect.replaceChildren(...options);
  categorySelect.value = categories.some(
    (category) => category.id === previousValue,
  )
    ? previousValue
    : "all";
}

function updateDatasetLabels(data) {
  document.querySelector("#data-note").textContent =
    `${data.source} · ${data.year}년 월별 판매 수량`;
  document.querySelectorAll(".year-label").forEach((label, index) => {
    const descriptions = [
      `${data.year}년 누적 판매 수량`,
      `${data.year}년 월별 판매 수량`,
      `${data.year}년 누적 판매량 비중`,
    ];
    label.textContent = descriptions[index];
  });
}

function formatCheckTime(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

async function checkForDataUpdates() {
  if (isCheckingForUpdates) {
    return;
  }
  isCheckingForUpdates = true;

  try {
    const response = await fetch("./sales-data.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`sales-data.json 요청 실패 (HTTP ${response.status})`);
    }

    const updatedData = await response.json();
    validateSalesData(updatedData);
    const updatedSnapshot = JSON.stringify(updatedData);
    const checkedAt = formatCheckTime(new Date());

    if (updatedSnapshot !== lastDataSnapshot) {
      categories = updatedData.categories;
      months = updatedData.months;
      unit = updatedData.unit;
      year = updatedData.year;
      window.salesData = updatedData;
      lastDataSnapshot = updatedSnapshot;
      updateCategoryOptions();
      updateDatasetLabels(updatedData);
      renderDashboard();
      refreshStatus.textContent = `판매 데이터 변경을 확인해 차트를 갱신했습니다 · ${checkedAt}`;
    } else {
      refreshStatus.textContent = `판매 데이터 확인 완료 · 변경 없음 · 다음 확인은 1시간 후 (${checkedAt})`;
    }
  } catch (error) {
    const checkedAt = formatCheckTime(new Date());
    refreshStatus.textContent = `판매 데이터 확인 실패 · ${error.message} · 기존 차트를 유지합니다 (${checkedAt})`;
  } finally {
    isCheckingForUpdates = false;
  }
}

function positionTooltip(x, y) {
  const halfWidth = chartTooltip.offsetWidth / 2;
  const boundedX = Math.min(
    Math.max(x, halfWidth + 8),
    window.innerWidth - halfWidth - 8,
  );
  chartTooltip.style.left = `${boundedX}px`;
  chartTooltip.style.top = `${Math.max(y, chartTooltip.offsetHeight + 20)}px`;
}

function attachTooltip(element, label, quantity) {
  const formattedValue = dollarFormat.format(quantity);
  const accessibleLabel = `${label}: ${formattedValue}; ${formatQuantity(quantity)} (표시 형식 예시, 실제 통화 매출 아님)`;
  const title = createSvgElement("title", {}, accessibleLabel);
  element.append(title);
  element.setAttribute("tabindex", "0");
  element.setAttribute("aria-label", accessibleLabel);
  element.setAttribute("aria-describedby", "chart-tooltip");
  element.classList.add("chart-data-point");

  const show = (x, y) => {
    tooltipValue.textContent = `${label} · ${formattedValue}`;
    tooltipNote.textContent = `${formatQuantity(quantity)} 기준 · 실제 통화 매출 아님`;
    chartTooltip.hidden = false;
    positionTooltip(x, y);
  };
  const hide = () => {
    chartTooltip.hidden = true;
  };

  element.addEventListener("pointerenter", (event) =>
    show(event.clientX, event.clientY),
  );
  element.addEventListener("pointermove", (event) =>
    positionTooltip(event.clientX, event.clientY),
  );
  element.addEventListener("pointerleave", hide);
  element.addEventListener("focus", () => {
    const bounds = element.getBoundingClientRect();
    show(bounds.left + bounds.width / 2, bounds.top);
  });
  element.addEventListener("blur", hide);
}

function inlineSvgStyles(source, clone) {
  const svgStyleProperties = [
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "font-family",
    "font-size",
    "font-weight",
    "text-anchor",
  ];
  const sourceElements = [source, ...source.querySelectorAll("*")];
  const cloneElements = [clone, ...clone.querySelectorAll("*")];

  sourceElements.forEach((sourceElement, index) => {
    const computedStyle = getComputedStyle(sourceElement);
    const styles = svgStyleProperties
      .map((property) => `${property}:${computedStyle.getPropertyValue(property)}`)
      .join(";");
    cloneElements[index].setAttribute("style", styles);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("차트 이미지를 불러오지 못했습니다."));
    image.src = source;
  });
}

async function exportChartAsPng(button) {
  const chart = document.getElementById(button.dataset.exportChart);
  if (!(chart instanceof SVGSVGElement)) {
    throw new Error("저장할 차트를 찾을 수 없습니다.");
  }

  const bounds = chart.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) {
    throw new Error("차트 크기를 확인할 수 없어 PNG로 저장하지 못했습니다.");
  }

  const pixelRatio = 2;
  const clone = chart.cloneNode(true);
  clone.setAttribute("xmlns", svgNamespace);
  clone.setAttribute("width", String(bounds.width));
  clone.setAttribute("height", String(bounds.height));
  clone.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
  inlineSvgStyles(chart, clone);

  const serialized = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([serialized], {
    type: "image/svg+xml;charset=utf-8",
  });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bounds.width * pixelRatio);
    canvas.height = Math.round(bounds.height * pixelRatio);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("PNG 변환용 캔버스를 만들 수 없습니다.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(pixelRatio, pixelRatio);
    context.drawImage(image, 0, 0, bounds.width, bounds.height);

    const pngBlob = await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("PNG 이미지 생성에 실패했습니다."));
        }
      }, "image/png");
    });
    const pngUrl = URL.createObjectURL(pngBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = button.dataset.filename;
    downloadLink.click();
    window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function drawAxes(svg, { maxValue, left, top, width, height, tickCount = 4 }) {
  const tickStep = Math.ceil(maxValue / tickCount / 50) * 50 || 50;
  const axisMax = tickStep * tickCount;

  for (let tick = 0; tick <= tickCount; tick += 1) {
    const value = axisMax - tick * tickStep;
    const y = top + (height * tick) / tickCount;
    svg.append(
      createSvgElement("line", {
        x1: left,
        x2: left + width,
        y1: y,
        y2: y,
        stroke: chartColors.grid,
      }),
      createSvgElement(
        "text",
        {
          x: left - 10,
          y: y + 4,
          "text-anchor": "end",
          class: "axis-label",
        },
        numberFormat.format(value),
      ),
    );
  }

  return axisMax;
}

function renderBarChart(selectedCategory) {
  const svg = document.querySelector("#bar-chart");
  const left = 54;
  const top = 16;
  const width = 550;
  const height = 164;
  const totals = categories.map(categoryTotal);
  const axisMax = drawAxes(svg, {
    maxValue: Math.max(...totals),
    left,
    top,
    width,
    height,
  });
  const slotWidth = width / categories.length;
  const barWidth = Math.min(50, slotWidth * 0.52);

  categories.forEach((category, index) => {
    const total = totals[index];
    const barHeight = (total / axisMax) * height;
    const x = left + slotWidth * index + (slotWidth - barWidth) / 2;
    const y = top + height - barHeight;
    const isSelected = selectedCategory?.id === category.id;
    const bar = createSvgElement("rect", {
      x,
      y,
      width: barWidth,
      height: barHeight,
      rx: 5,
      fill: selectedCategory
        ? isSelected
          ? chartColors.selected
          : chartColors.muted
        : category.color,
    });
    attachTooltip(bar, category.label, total);

    svg.append(
      bar,
      createSvgElement(
        "text",
        {
          x: x + barWidth / 2,
          y: y - 7,
          "text-anchor": "middle",
          class: "value-label",
        },
        numberFormat.format(total),
      ),
      createSvgElement(
        "text",
        {
          x: x + barWidth / 2,
          y: top + height + 22,
          "text-anchor": "middle",
          class: `axis-label${isSelected ? " axis-label-selected" : ""}`,
        },
        category.label,
      ),
    );
  });
}

function renderLineChart(selectedCategory) {
  const svg = document.querySelector("#line-chart");
  const left = 54;
  const top = 16;
  const width = 550;
  const height = 164;
  const monthlyTotals = months.map((_, monthIndex) =>
    selectedCategory
      ? selectedCategory.monthlySales[monthIndex]
      : categories.reduce(
          (total, category) => total + category.monthlySales[monthIndex],
          0,
        ),
  );
  const axisMax = drawAxes(svg, {
    maxValue: Math.max(...monthlyTotals),
    left,
    top,
    width,
    height,
  });
  const points = monthlyTotals.map((value, index) => ({
    x: left + (width * index) / (months.length - 1),
    y: top + height - (value / axisMax) * height,
  }));
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  svg.append(
    createSvgElement("path", {
      d: path,
      fill: "none",
      stroke: selectedCategory ? chartColors.selected : "#6383f5",
      "stroke-width": 3,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
  );

  points.forEach((point, index) => {
    const marker = createSvgElement("circle", {
      cx: point.x,
      cy: point.y,
      r: 5,
      fill: "#fff",
      stroke: selectedCategory ? chartColors.selected : "#6383f5",
      "stroke-width": 2,
    });
    attachTooltip(
      marker,
      `${selectedCategory?.label ?? "전체"} · ${months[index]}`,
      monthlyTotals[index],
    );

    svg.append(
      marker,
      createSvgElement(
        "text",
        {
          x: point.x,
          y: top + height + 22,
          "text-anchor": "middle",
          class: "axis-label",
        },
        months[index],
      ),
    );
  });

  document.querySelector("#line-title").textContent = selectedCategory
    ? `${selectedCategory.label} 월별 판매량`
    : "월별 전체 판매량 추이";
  document.querySelector("#line-footnote").textContent = selectedCategory
    ? `${selectedCategory.label} 연간 판매량: ${formatQuantity(categoryTotal(selectedCategory))}`
    : `전체 연간 판매량: ${formatQuantity(totalsForAllCategories())}`;
}

function totalsForAllCategories() {
  return categories.reduce((total, category) => total + categoryTotal(category), 0);
}

function donutSegmentPath(startAngle, endAngle, outerRadius = 82, innerRadius = 56) {
  const center = 120;
  const point = (radius, angle) => {
    const radians = ((angle - 90) * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(radians),
      y: center + radius * Math.sin(radians),
    };
  };
  const startOuter = point(outerRadius, startAngle);
  const endOuter = point(outerRadius, endAngle);
  const endInner = point(innerRadius, endAngle);
  const startInner = point(innerRadius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
    "Z",
  ].join(" ");
}

function renderDonutChart(selectedCategory) {
  const svg = document.querySelector("#donut-chart");
  const legend = document.querySelector("#donut-legend");
  const categoryValues = categories.map((category) => ({
    label: category.label,
    color: category.color,
    value: categoryTotal(category),
  }));
  const values = selectedCategory
    ? [
        {
          label: selectedCategory.label,
          color: selectedCategory.color,
          value: categoryTotal(selectedCategory),
        },
        {
          label: "그 외 카테고리",
          color: "#e7ebf2",
          value: totalsForAllCategories() - categoryTotal(selectedCategory),
        },
      ]
    : categoryValues;
  const total = values.reduce((sum, item) => sum + item.value, 0);
  let angle = 0;

  values.forEach((item) => {
    const nextAngle = angle + (item.value / total) * 360;
    const segment = createSvgElement("path", {
      d: donutSegmentPath(angle, nextAngle),
      fill: item.color,
    });
    attachTooltip(segment, item.label, item.value);
    svg.append(segment);
    angle = nextAngle;
  });

  svg.append(
    createSvgElement(
      "text",
      {
        x: 120,
        y: 115,
        "text-anchor": "middle",
        class: "donut-total",
      },
      numberFormat.format(total),
    ),
    createSvgElement(
      "text",
      {
        x: 120,
        y: 135,
        "text-anchor": "middle",
        class: "donut-unit",
      },
      "연간 판매량",
    ),
  );

  legend.replaceChildren(
    ...values.map((item) => {
      const listItem = document.createElement("li");
      const dot = document.createElement("span");
      const label = document.createElement("span");
      const percentage = document.createElement("span");
      const percent = Math.round((item.value / total) * 100);

      dot.className = "legend-dot";
      dot.style.backgroundColor = item.color;
      label.textContent = item.label;
      percentage.className = "legend-value";
      percentage.textContent = `${formatQuantity(item.value)} · ${percent}%`;
      listItem.append(dot, label, percentage);
      return listItem;
    }),
  );
  document.querySelector("#donut-title").textContent = selectedCategory
    ? `${selectedCategory.label} 판매 비중`
    : "연간 카테고리 구성";
  svg.setAttribute(
    "aria-label",
    selectedCategory
      ? `${selectedCategory.label}과 그 외 카테고리의 연간 판매량 비중`
      : `${year}년 카테고리별 연간 판매량 비중`,
  );
}

function renderDashboard() {
  const selectedCategory = categories.find(
    (category) => category.id === categorySelect.value,
  );
  const label = selectedCategory?.label ?? "전체 카테고리";

  for (const chartId of ["bar-chart", "line-chart", "donut-chart"]) {
    document.querySelector(`#${chartId}`).replaceChildren();
  }

  renderBarChart(selectedCategory);
  renderLineChart(selectedCategory);
  renderDonutChart(selectedCategory);
  document.querySelector("#bar-footnote").textContent = selectedCategory
    ? `${label} 누적 판매량을 파란색으로 강조했습니다.`
    : `총 판매량: ${formatQuantity(totalsForAllCategories())}`;
  selectionStatus.textContent = `현재 선택: ${label} · ${year}년`;
}

categorySelect.addEventListener("change", renderDashboard);
document.querySelectorAll("[data-export-chart]").forEach((button) => {
  button.addEventListener("click", async () => {
    button.disabled = true;
    exportStatus.textContent = "";
    try {
      await exportChartAsPng(button);
      exportStatus.textContent = `${button.dataset.filename} 파일로 PNG 차트를 저장했습니다.`;
    } catch (error) {
      exportStatus.textContent = `차트 PNG 저장 실패: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  });
});
updateDatasetLabels(window.salesData);
renderDashboard();

if (window.location.protocol === "file:") {
  refreshStatus.textContent =
    "자동 데이터 확인은 HTTP/HTTPS 웹 서버에서 페이지를 열 때 사용할 수 있습니다.";
} else {
  checkForDataUpdates();
  window.setInterval(checkForDataUpdates, refreshIntervalMs);
}
