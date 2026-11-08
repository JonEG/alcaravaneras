const API_URL = "https://api.open-meteo.com/v1/forecast?latitude=28.1308&longitude=-15.4282&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&timezone=Atlantic%2FCanary&forecast_days=7&wind_speed_unit=kmh";
const MARINE_API_URL = "https://marine-api.open-meteo.com/v1/marine?latitude=28.1308&longitude=-15.4282&current=sea_level_height_msl,sea_surface_temperature&hourly=sea_level_height_msl,sea_surface_temperature&timezone=Atlantic%2FCanary&forecast_days=7&cell_selection=sea";
const BATHING_WATER_API_URL = "https://marine.discomap.eea.europa.eu/arcgis/rest/services/BathingWater/BathingWater_Dyna_WM_2025/MapServer/3/query";
const WATER_SAMPLES_URL = "data/latest-water-samples.json";
const $ = (id) => document.getElementById(id);
let forecastData = null;
let marineData = null;
let selectedDay = null;

const weatherDescriptions = (code) => {
  if (code === 0) return ["Despejado", "☀️"];
  if (code === 1) return ["Mayormente despejado", "🌤️"];
  if (code === 2) return ["Parcialmente nuboso", "⛅"];
  if (code === 3) return ["Nublado", "☁️"];
  if ([45, 48].includes(code)) return ["Bruma", "🌫️"];
  if ([51, 53, 55, 56, 57].includes(code)) return ["Llovizna", "🌦️"];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ["Lluvia", "🌧️"];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ["Nieve", "🌨️"];
  if ([95, 96, 99].includes(code)) return ["Tormenta", "⛈️"];
  return ["Condiciones variables", "🌥️"];
};

const directionName = (degrees) => {
  const names = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  return names[Math.round(degrees / 22.5) % 16];
};

const beaufort = (speed) => {
  const scale = [
    [1, "Calma", "El mar permanece en calma"], [5, "Brisa muy débil", "El viento apenas se nota"],
    [11, "Brisa débil", "Una brisa suave en la costa"], [19, "Brisa moderada", "El viento empieza a hacerse notar"],
    [28, "Brisa fresca", "El mar empieza a animarse"], [38, "Brisa fuerte", "Se forman pequeñas olas"],
    [49, "Viento fuerte", "Precaución en el mar"], [61, "Viento muy fuerte", "Condiciones adversas en la costa"],
    [75, "Temporal", "Evita las actividades en el mar"], [89, "Temporal fuerte", "Condiciones muy adversas"],
    [103, "Temporal duro", "Condiciones extremas en la costa"], [118, "Temporal muy duro", "Condiciones extremas en la costa"],
    [Infinity, "Temporal huracanado", "Condiciones extremas en la costa"],
  ];
  const index = scale.findIndex(([limit]) => speed < limit);
  const [, name, copy] = scale[Math.max(0, index)];
  return [Math.max(0, index), name, copy];
};

const dateAt = (iso, options) => new Date(iso).toLocaleDateString("es-ES", { timeZone: "Atlantic/Canary", ...options });

function renderDaily(data) {
  const rows = data.daily.time.map((day, i) => {
    const [description, icon] = weatherDescriptions(data.daily.weather_code[i]);
    const label = i === 0 ? "HOY" : dateAt(`${day}T12:00`, { weekday: "short", day: "numeric" }).toLocaleUpperCase("es-ES");
    const high = Math.round(data.daily.temperature_2m_max[i]);
    const low = Math.round(data.daily.temperature_2m_min[i]);
    const rain = data.daily.precipitation_probability_max[i] ?? 0;
    const selected = day === selectedDay;
    return `<button class="forecast-card forecast-day-button${i === 0 ? " is-today" : ""}${selected ? " is-selected" : ""}" type="button" data-day="${day}" aria-pressed="${selected}" title="${description}; lluvia ${rain}%"><span class="forecast-day">${label}</span><span class="forecast-icon" aria-label="${description}">${icon}</span><strong class="forecast-high">${high}°</strong><span class="forecast-low">${low}°</span>${rain >= 20 ? `<span class="forecast-rain">💧 ${rain}%</span>` : ""}</button>`;
  }).join("");
  $("daily-forecast").innerHTML = rows;
}

function selectedDayLabel(day, today) {
  if (day === today) return "Hoy";
  const label = dateAt(`${day}T12:00`, { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toLocaleUpperCase("es-ES") + label.slice(1);
}

function renderWeatherHourly(data, day = selectedDay) {
  const today = data.current.time.slice(0, 10);
  const currentHour = data.current.time.slice(0, 13);
  const hours = data.hourly.time.map((time, index) => ({ time, index })).filter(({ time }) => time.startsWith(day));
  const timeline = $("weather-hourly");
  timeline.innerHTML = hours.map(({ time, index }) => {
    const [description, icon] = weatherDescriptions(data.hourly.weather_code[index]);
    const chance = data.hourly.precipitation_probability[index] ?? 0;
    const isPast = day === today && time < currentHour;
    const isCurrent = day === today && time.slice(0, 13) === currentHour;
    const label = new Date(time).toLocaleTimeString("es-ES", { timeZone: "Atlantic/Canary", hour: "2-digit", minute: "2-digit" });
    return `<div class="weather-hour${isCurrent ? " is-current" : ""}${isPast ? " is-past" : ""}" title="${label} · ${description} · ${Math.round(data.hourly.temperature_2m[index])}° · lluvia ${chance}%"><span class="weather-hour-time">${label}</span><span class="weather-hour-icon" aria-hidden="true">${icon}</span><strong>${Math.round(data.hourly.temperature_2m[index])}°</strong><span class="weather-hour-rain">${chance >= 20 ? `💧 ${chance}%` : " "}</span></div>`;
  }).join("");
  timeline.scrollLeft = 0;
}

function renderHourly(data, day = selectedDay) {
  const today = data.current.time.slice(0, 10);
  const currentHour = data.current.time.slice(0, 13);
  const hours = data.hourly.time.map((time, index) => ({ time, index })).filter(({ time }) => time.startsWith(day));
  const timeline = $("hourly-forecast");
  timeline.innerHTML = hours.map(({ time, index: i }) => {
    const speed = Math.round(data.hourly.wind_speed_10m[i] || 0);
    const label = new Date(time).toLocaleTimeString("es-ES", { timeZone: "Atlantic/Canary", hour: "2-digit", minute: "2-digit" });
    const direction = data.hourly.wind_direction_10m[i];
    const gusts = Math.round(data.hourly.wind_gusts_10m[i] || 0);
    const isPast = day === today && time < currentHour;
    const isCurrent = day === today && time.slice(0, 13) === currentHour;
    return `<div class="hour-column${isCurrent ? " is-current" : ""}${isPast ? " is-past" : ""}" title="${label}: ${speed} km/h, rachas ${gusts} km/h, ${directionName(direction)}"><span class="hour-time">${label}</span><span class="hour-arrow" style="transform:rotate(${direction}deg)" aria-hidden="true">➤</span><strong class="hour-value">${speed} <small>km/h</small></strong><span class="hour-dir">${directionName(direction)}</span><span class="hour-gust">R. ${gusts}</span></div>`;
  }).join("");
  timeline.scrollLeft = 0;
}

function renderWindWeek(data) {
  $("wind-forecast").innerHTML = data.daily.time.map((day, i) => {
    const label = i === 0 ? "HOY" : dateAt(`${day}T12:00`, { weekday: "short" }).replace(".", "").toLocaleUpperCase("es-ES");
    const direction = directionName(data.daily.wind_direction_10m_dominant[i]);
    const [level] = beaufort(data.daily.wind_speed_10m_max[i]);
    const selected = day === selectedDay;
    return `<button class="wind-day${selected ? " is-selected" : ""}" type="button" data-day="${day}" aria-pressed="${selected}" title="${day}: rachas hasta ${Math.round(data.daily.wind_gusts_10m_max[i])} km/h"><span class="wind-day-name">${label}</span><span class="wind-glyph" style="transform:rotate(${data.daily.wind_direction_10m_dominant[i]}deg)" aria-label="Dirección ${direction}">➤</span><strong>${Math.round(data.daily.wind_speed_10m_max[i])} <small>km/h</small></strong><span class="wind-gust">Rachas ${Math.round(data.daily.wind_gusts_10m_max[i])}</span><span class="wind-bf">Bf ${level}</span></button>`;
  }).join("");
}

function renderSelectedDaySummary(data) {
  const index = data.daily.time.indexOf(selectedDay);
  if (index < 0) return;
  $("summary-day").textContent = selectedDayLabel(selectedDay, data.current.time.slice(0, 10)).toLocaleLowerCase("es-ES");
  $("today-high").textContent = Math.round(data.daily.temperature_2m_max[index]);
  $("today-low").textContent = Math.round(data.daily.temperature_2m_min[index]);
  $("current-rain").textContent = Math.round(data.daily.precipitation_probability_max[index] ?? 0);
}

function renderTideWeek(data) {
  const byDay = new Map();
  data.hourly.time.forEach((time, index) => {
    const day = time.slice(0, 10);
    const value = data.hourly.sea_level_height_msl[index];
    if (!Number.isFinite(value)) return;
    const values = byDay.get(day) ?? [];
    values.push({ time, value });
    byDay.set(day, values);
  });
  const today = data.current.time.slice(0, 10);
  $("tide-week").innerHTML = [...byDay.entries()].slice(0, 7).map(([day, values], index) => {
    const high = values.reduce((best, point) => point.value > best.value ? point : best, values[0]);
    const low = values.reduce((best, point) => point.value < best.value ? point : best, values[0]);
    const label = index === 0 ? "HOY" : dateAt(`${day}T12:00`, { weekday: "short", day: "numeric" }).toLocaleUpperCase("es-ES");
    const selected = day === selectedDay;
    return `<button class="tide-day${selected ? " is-selected" : ""}" type="button" data-day="${day}" aria-pressed="${selected}" title="Nivel modelado respecto a la media global; hoy: ${today === day ? "día actual" : label}"><span class="tide-day-name">${label}</span><span class="tide-day-extreme"><small>Pleamar aprox.</small><em>${high.time.slice(11, 16)}</em><strong>${high.value.toFixed(2)} m</strong></span><span class="tide-day-extreme"><small>Bajamar aprox.</small><em>${low.time.slice(11, 16)}</em><strong>${low.value.toFixed(2)} m</strong></span></button>`;
  }).join("");
}

function findTideTurningPoints(points) {
  return points.slice(1, -1).flatMap((point, index) => {
    const previous = points[index].value;
    const next = points[index + 2].value;
    if (point.value >= previous && point.value > next) return [{ ...point, type: "pleamar" }];
    if (point.value <= previous && point.value < next) return [{ ...point, type: "bajamar" }];
    return [];
  });
}

function renderTide(data, day = selectedDay) {
  if (!data?.current || !data?.hourly) return;
  selectedDay ??= data.current.time.slice(0, 10);
  renderTideWeek(data);
  const currentLevel = data.current.sea_level_height_msl;
  $("current-tide").textContent = Number.isFinite(currentLevel) ? currentLevel.toFixed(2) : "—";
  const times = data.hourly.time;
  const values = data.hourly.sea_level_height_msl;
  const allPoints = times.map((time, index) => ({ time, index, value: values[index] })).filter((point) => Number.isFinite(point.value));
  const today = data.current.time.slice(0, 10);
  const todayPoints = allPoints.filter((point) => point.time.startsWith(today));
  const futurePoints = allPoints.filter((point) => point.time > data.current.time);
  const trendSamples = futurePoints.slice(0, 4);
  let trendDelta = trendSamples.length && Number.isFinite(currentLevel) ? trendSamples[0].value - currentLevel : 0;
  if (Math.abs(trendDelta) < 0.01) {
    for (let index = 1; index < trendSamples.length; index += 1) {
      trendDelta = trendSamples[index].value - trendSamples[index - 1].value;
      if (Math.abs(trendDelta) >= 0.01) break;
    }
  }
  const trend = Math.abs(trendDelta) >= 0.01 ? (trendDelta > 0 ? "Subiendo" : "Bajando") : "—";
  $("tide-trend").textContent = trend;
  $("summary-tide-trend").textContent = trend;

  const nextExtreme = findTideTurningPoints(allPoints).find((point) => point.time > data.current.time);
  if (nextExtreme) {
    const eventDay = nextExtreme.time.slice(0, 10);
    const eventDayLabel = eventDay === today ? "hoy" : dateAt(`${eventDay}T12:00`, { weekday: "short", day: "numeric" }).replace(".", "");
    $("next-tide-label").textContent = `Próxima ${nextExtreme.type} · ${eventDayLabel}`;
    $("next-tide-time").textContent = nextExtreme.time.slice(11, 16);
    $("summary-tide-next-label").textContent = `Próxima ${nextExtreme.type} · ${eventDayLabel}`;
    $("summary-tide-next-time").textContent = nextExtreme.time.slice(11, 16);
  } else {
    $("next-tide-label").textContent = trend === "Subiendo" ? "Próxima pleamar" : "Próxima bajamar";
    $("next-tide-time").textContent = "—";
    $("summary-tide-next-label").textContent = trend === "Subiendo" ? "Próxima pleamar" : "Próxima bajamar";
    $("summary-tide-next-time").textContent = "—";
  }

  if (todayPoints.length) {
    const high = todayPoints.reduce((best, point) => point.value > best.value ? point : best, todayPoints[0]);
    const low = todayPoints.reduce((best, point) => point.value < best.value ? point : best, todayPoints[0]);
    const todayExtremes = [
      { type: "Pleamar aprox.", point: high },
      { type: "Bajamar aprox.", point: low },
    ].sort((a, b) => a.point.time.localeCompare(b.point.time));
    $("tide-extremes").innerHTML = todayExtremes.map(({ type, point }) => `<span><span class="tide-extreme-label">${type}</span><strong><time datetime="${point.time}">${point.time.slice(11, 16)}</time><small>${point.value.toFixed(2)} m</small></strong></span>`).join("");
  } else {
    $("tide-extremes").innerHTML = "";
  }

  const points = allPoints.filter((point) => point.time.startsWith(day));
  const label = selectedDayLabel(day, data.current.time.slice(0, 10));
  $("tide-hourly-title").textContent = `${label} · nivel del mar por horas`;
  if (!points.length) {
    $("tide-chart").innerHTML = '<p class="loading-row">No hay datos horarios de marea para este día.</p>';
    return;
  }

  const low = Math.min(...points.map((point) => point.value));
  const high = Math.max(...points.map((point) => point.value));
  const range = high - low || 0.1;
  const left = 42;
  const right = 980;
  const top = 24;
  const bottom = 162;
  const coordinates = points.map((point, index) => {
    const x = left + (index / Math.max(1, points.length - 1)) * (right - left);
    const y = top + ((high - point.value) / range) * (bottom - top);
    return { ...point, x, y };
  });
  const path = coordinates.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${path} L${right},${bottom} L${left},${bottom} Z`;
  const grid = [0, 1, 2].map((step) => {
    const y = top + (step / 2) * (bottom - top);
    const value = high - (step / 2) * range;
    return `<line class="tide-gridline" x1="${left}" y1="${y}" x2="${right}" y2="${y}"/><text class="tide-level-label" x="${left + 4}" y="${y - 5}">${value.toFixed(2)} m</text>`;
  }).join("");
  const hourMarks = coordinates.filter((point) => Number(point.time.slice(11, 13)) % 6 === 0).map((point) => `<text class="tide-hour-label" x="${point.x}" y="193" text-anchor="middle">${point.time.slice(11, 13)}:00</text>`).join("");
  const currentHour = data.current.time.slice(0, 13);
  const currentPoint = day === data.current.time.slice(0, 10) ? coordinates.find((point) => point.time.slice(0, 13) === currentHour) : null;
  const currentMarker = currentPoint ? `<line class="tide-current-marker" x1="${currentPoint.x}" y1="${top}" x2="${currentPoint.x}" y2="${bottom}"/><circle class="tide-current-dot" cx="${currentPoint.x}" cy="${currentPoint.y}" r="5"/>` : "";
  const hourlyPoints = coordinates.map((point) => `<g class="tide-point" data-time="${point.time.slice(11, 16)}" data-level="${point.value.toFixed(2)}" data-x="${point.x.toFixed(1)}" data-y="${point.y.toFixed(1)}" tabindex="0" role="img" aria-label="${point.time.slice(11, 16)} · nivel del mar ${point.value.toFixed(2)} metros"><line class="tide-hover-line" x1="${point.x}" y1="${top}" x2="${point.x}" y2="${bottom}"/><circle class="tide-hit" cx="${point.x}" cy="${point.y}" r="13"/><circle class="tide-dot" cx="${point.x}" cy="${point.y}" r="3"/></g>`).join("");
  $("tide-chart").innerHTML = `<svg viewBox="0 0 1000 205" role="img" aria-label="Curva estimada del nivel del mar para ${label}"><g>${grid}</g><path class="tide-area" d="${area}"/><path class="tide-line" d="${path}"/>${currentMarker}<g>${hourlyPoints}</g><g>${hourMarks}</g></svg><div class="tide-tooltip" id="tide-tooltip" role="status" hidden></div>`;
}

function renderSeaTemperature(data) {
  const temperature = data?.current?.sea_surface_temperature;
  const time = data?.current?.time;
  if (!Number.isFinite(temperature)) {
    $("sea-temperature").innerHTML = `—<span>°C</span>`;
    $("sea-temperature-time").textContent = "Temperatura del mar temporalmente no disponible.";
    $("summary-sea-temperature").innerHTML = `—<small>°C</small>`;
    return;
  }
  $("sea-temperature").innerHTML = `${temperature.toFixed(1)}<span>°C</span>`;
  $("summary-sea-temperature").innerHTML = `${temperature.toFixed(1)}<small>°C</small>`;
  if (time) {
    const date = dateAt(`${time.slice(0, 10)}T12:00`, { day: "numeric", month: "short" });
    $("sea-temperature-time").textContent = `Dato del modelo · ${date} · ${time.slice(11, 16)} h (Canarias)`;
  }
}

async function loadBathingWaterQuality() {
  const statusElement = $("water-quality-status");
  const detailElement = $("water-quality-detail");
  if (!statusElement || !detailElement) {
    console.error("No se pudo cargar la clasificación del agua de baño: faltan elementos de la sección de agua.");
    return;
  }
  const params = new URLSearchParams({
    where: "countryCode = 'ES' AND bathingWaterName LIKE '%ALCARAVANERAS%'",
    outFields: "bathingWaterName,qualityStatus,bwProfileLink,bathingWaterIdentifier",
    returnGeometry: "false",
    f: "json",
  });
  try {
    const response = await fetch(`${BATHING_WATER_API_URL}?${params}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Bathing water service returned ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(result.error.message || "Bathing water service returned an error");
    const features = (result.features ?? []).map(({ attributes }) => attributes).filter((item) => item?.bathingWaterName?.toLocaleUpperCase("es-ES").includes("ALCARAVANERAS"));
    if (!features.length) throw new Error("No bathing water classification was found for Las Alcaravaneras");

    const ratings = {
      Poor: { label: "Insuficiente", key: "poor", rank: 0 },
      "Not classified": { label: "Sin clasificar", key: "unclassified", rank: 1 },
      Sufficient: { label: "Suficiente", key: "sufficient", rank: 2 },
      Good: { label: "Buena", key: "good", rank: 3 },
      Excellent: { label: "Excelente", key: "excellent", rank: 4 },
    };
    const availableRatings = features.map((item) => ratings[item.qualityStatus]).filter(Boolean);
    if (!availableRatings.length) throw new Error("No usable classification was returned");
    const rating = [...availableRatings].sort((a, b) => a.rank - b.rank)[0];
    const points = new Set(features.map((item) => item.bathingWaterName)).size;
    statusElement.textContent = rating.label;
    statusElement.dataset.quality = rating.key;
    detailElement.textContent = availableRatings.some((item) => item.key !== rating.key)
      ? `Temporada 2025 · se muestra el resultado más desfavorable de ${points} puntos de muestreo.`
      : `Temporada 2025 · clasificación anual de ${points} puntos de muestreo.`;
  } catch (error) {
    console.error("No se pudo cargar la clasificación del agua de baño:", error);
    statusElement.textContent = "Clasificación no disponible";
    statusElement.dataset.quality = "unavailable";
    detailElement.textContent = "Consulta la información y los avisos vigentes en NÁYADE.";
  }
}

function renderWaterSamples(result) {
  const tableBody = $("water-samples");
  const updatedElement = $("water-samples-updated");
  if (!tableBody || !updatedElement || !Array.isArray(result.samples) || !result.samples.length) return;

  tableBody.replaceChildren(...result.samples.slice(0, 3).map((sample) => {
    const row = document.createElement("tr");
    const sampleResult = sample.observation || "";
    const isUnsuitable = /no apta|insuficiente/i.test(sampleResult);
    const isSuitable = /apta/i.test(sampleResult) && !isUnsuitable;
    const resultLabel = isUnsuitable ? "No Apto" : isSuitable ? "Apto" : sampleResult || "Sin dato";
    const resultCell = document.createElement("td");
    resultCell.textContent = resultLabel;
    resultCell.dataset.quality = isUnsuitable ? "poor" : isSuitable ? "good" : "unavailable";
    if (sampleResult) resultCell.title = sampleResult;
    const date = document.createElement("time");
    date.dateTime = sample.date;
    date.textContent = sample.dateLabel;
    [resultCell, date, sample.ecoli, sample.enterococci].forEach((value) => {
      const cell = document.createElement("td");
      if (value instanceof Node) cell.append(value);
      else cell.textContent = value ?? "—";
      row.append(cell);
    });
    return row;
  }));

  const latestSample = result.samples[0];
  const sampleStatus = (latestSample.observation || "").replace(/^zona\s*/i, "").trim();
  $("summary-water-quality").textContent = sampleStatus || "Sin dato";
  $("summary-water-quality").dataset.quality = /no apta|insuficiente/i.test(sampleStatus) ? "poor" : "good";
  $("summary-water-quality-date").textContent = `Última muestra · ${latestSample.dateLabel}`;

  if (result.updatedAt) {
    const updated = new Date(result.updatedAt);
    const label = new Intl.DateTimeFormat("es-ES", { timeZone: "Atlantic/Canary", dateStyle: "short", timeStyle: "short" }).format(updated);
    updatedElement.textContent = `Datos de respaldo sincronizados · ${label} (hora canaria)`;
  } else {
    updatedElement.textContent = "Muestras de NÁYADE · actualización automática diaria";
  }
}

async function loadWaterSamples() {
  const tableBody = $("water-samples");
  const updatedElement = $("water-samples-updated");
  if (!tableBody || !updatedElement) return;

  try {
    const response = await fetch(`${WATER_SAMPLES_URL}?t=${Date.now()}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Water samples file returned ${response.status}`);
    renderWaterSamples(await response.json());
  } catch (error) {
    console.error("No se pudieron cargar las muestras de NÁYADE:", error);
    tableBody.innerHTML = '<tr><td colspan="4">Muestras temporalmente no disponibles. Consulta NÁYADE.</td></tr>';
    updatedElement.textContent = "No se pudieron cargar las muestras.";
    $("summary-water-quality").textContent = "Sin dato";
    $("summary-water-quality").dataset.quality = "unavailable";
    $("summary-water-quality-date").textContent = "Consulta NÁYADE";
  }
}

function showTidePoint(point) {
  if (!point) return;
  const chart = $("tide-chart");
  const svg = chart.querySelector("svg");
  const tooltip = $("tide-tooltip");
  if (!svg || !tooltip) return;
  chart.querySelector(".tide-point.is-active")?.classList.remove("is-active");
  point.classList.add("is-active");
  const svgRect = svg.getBoundingClientRect();
  const chartRect = chart.getBoundingClientRect();
  const x = svgRect.left - chartRect.left + (Number(point.dataset.x) / 1000) * svgRect.width;
  tooltip.textContent = `${point.dataset.time} · ${point.dataset.level} m`;
  tooltip.style.left = `${Math.max(72, Math.min(chart.clientWidth - 72, x))}px`;
  tooltip.hidden = false;
}

function bindTideHover() {
  const chart = $("tide-chart");
  chart.addEventListener("pointermove", (event) => {
    const svg = chart.querySelector("svg");
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const viewX = Math.max(42, Math.min(980, ((event.clientX - rect.left) / rect.width) * 1000));
    const points = [...chart.querySelectorAll(".tide-point")];
    const nearest = points.reduce((best, point) => Math.abs(Number(point.dataset.x) - viewX) < Math.abs(Number(best.dataset.x) - viewX) ? point : best, points[0]);
    showTidePoint(nearest);
  });
  chart.addEventListener("focusin", (event) => showTidePoint(event.target.closest(".tide-point")));
  chart.addEventListener("pointerleave", () => {
    if (chart.contains(document.activeElement)) return;
    chart.querySelector(".tide-point.is-active")?.classList.remove("is-active");
    const tooltip = $("tide-tooltip");
    if (tooltip) tooltip.hidden = true;
  });
  chart.addEventListener("focusout", (event) => {
    if (chart.contains(event.relatedTarget)) return;
    chart.querySelector(".tide-point.is-active")?.classList.remove("is-active");
    const tooltip = $("tide-tooltip");
    if (tooltip) tooltip.hidden = true;
  });
}

function render(data) {
  forecastData = data;
  selectedDay ??= data.current.time.slice(0, 10);
  const current = data.current;
  const [description, icon] = weatherDescriptions(current.weather_code);
  $("current-temp").textContent = `${Math.round(current.temperature_2m)}°`;
  $("current-condition").textContent = description;
  $("current-icon").textContent = icon;
  $("summary-weather-temp").textContent = `${Math.round(current.temperature_2m)}°`;
  $("summary-weather-condition").textContent = description;
  $("summary-weather-icon").textContent = icon;
  $("current-wind-large").textContent = Math.round(current.wind_speed_10m);
  $("current-gusts").textContent = Math.round(current.wind_gusts_10m);
  $("current-direction").textContent = directionName(current.wind_direction_10m);
  $("summary-wind-speed").textContent = Math.round(current.wind_speed_10m);
  $("summary-wind-direction").textContent = directionName(current.wind_direction_10m);
  $("summary-wind-gusts").textContent = Math.round(current.wind_gusts_10m);
  $("today-summary-updated").textContent = `Actualizado · ${dateAt(current.time, { hour: "2-digit", minute: "2-digit" })} h`;
  $("compass-needle").style.transform = `rotate(${current.wind_direction_10m}deg)`;
  const [level, name] = beaufort(current.wind_speed_10m);
  $("beaufort-number").textContent = level;
  $("beaufort-name").textContent = name;
  $("updated-at").textContent = `Previsión actualizada · ${dateAt(current.time, { hour: "2-digit", minute: "2-digit" })}`;
  renderDaily(data);
  renderSelectedDaySummary(data);
  renderWeatherHourly(data);
  renderHourly(data);
  renderWindWeek(data);
  const dayLabel = selectedDayLabel(selectedDay, current.time.slice(0, 10));
  $("weather-hourly-title").textContent = `${dayLabel} · evolución por horas`;
  $("wind-hourly-title").textContent = `${dayLabel} · evolución por horas`;
  if (marineData) renderTide(marineData, selectedDay);
}

function selectForecastDay(day) {
  const availableDays = forecastData?.daily.time ?? [...new Set(marineData?.hourly?.time?.map((time) => time.slice(0, 10)) ?? [])];
  if (!availableDays.includes(day)) return;
  selectedDay = day;
  if (forecastData) {
    renderDaily(forecastData);
    renderWindWeek(forecastData);
    renderSelectedDaySummary(forecastData);
    renderWeatherHourly(forecastData, day);
    renderHourly(forecastData, day);
    const dayLabel = selectedDayLabel(day, forecastData.current.time.slice(0, 10));
    $("weather-hourly-title").textContent = `${dayLabel} · evolución por horas`;
    $("wind-hourly-title").textContent = `${dayLabel} · evolución por horas`;
  }
  if (marineData) renderTide(marineData, day);
}

async function loadForecast() {
  try {
    const response = await fetch(API_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
    render(await response.json());
  } catch (error) {
    console.error("No se pudo cargar la previsión meteorológica:", error);
    $("updated-at").textContent = "Previsión temporalmente no disponible";
    $("today-summary-updated").textContent = "Previsión temporalmente no disponible";
    $("summary-weather-icon").textContent = "—";
    $("summary-weather-temp").textContent = "—";
    $("summary-weather-condition").textContent = "Tiempo no disponible";
    $("summary-wind-speed").textContent = "—";
    $("summary-wind-direction").textContent = "—";
    $("summary-wind-gusts").textContent = "—";
    $("weather-hourly").innerHTML = '<p class="loading-row">No se pudo cargar la evolución de hoy.</p>';
    $("daily-forecast").innerHTML = '<p class="loading-row">No se pudo cargar la previsión. Vuelve a intentarlo más tarde.</p>';
    $("hourly-forecast").innerHTML = '<p class="loading-row">Consulta las condiciones de viento más tarde.</p>';
    $("wind-forecast").innerHTML = '<p class="loading-row">No se pudo cargar la previsión de viento.</p>';
  }
}

async function loadMarineForecast() {
  try {
    const response = await fetch(MARINE_API_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Marine service returned ${response.status}`);
    marineData = await response.json();
    renderTide(marineData);
    renderSeaTemperature(marineData);
  } catch (error) {
    console.error("No se pudo cargar la previsión de marea:", error);
    $("summary-tide-trend").textContent = "Sin datos";
    $("summary-tide-next-label").textContent = "Marea no disponible";
    $("summary-tide-next-time").textContent = "—";
    $("summary-sea-temperature").innerHTML = `—<small>°C</small>`;
    $("current-tide").textContent = "—";
    $("tide-extremes").textContent = "Marea temporalmente no disponible";
    $("tide-chart").innerHTML = '<p class="loading-row">No se pudo cargar la previsión de marea.</p>';
    $("sea-temperature").innerHTML = `—<span>°C</span>`;
    $("sea-temperature-time").textContent = "Temperatura del mar temporalmente no disponible.";
  }
}

const INSTAGRAM_OEMBED_URL = "https://graph.facebook.com/v26.0/instagram_oembed";
const INSTAGRAM_CONSENT_KEY = "alcaravaneras.instagram-consent";
let instagramEmbedScriptPromise;
let instagramFrameObserver;

function getInstagramConsent() {
  try {
    return localStorage.getItem(INSTAGRAM_CONSENT_KEY);
  } catch {
    return null;
  }
}

function saveInstagramConsent(value) {
  try {
    localStorage.setItem(INSTAGRAM_CONSENT_KEY, value);
  } catch (error) {
    console.warn("No se pudo guardar la preferencia de Instagram en este navegador:", error);
  }
}

function restoreInstagramLink(container) {
  const postUrl = container.dataset.instagramPost;
  const username = new URL(postUrl).pathname.split("/").filter(Boolean)[0];
  const link = document.createElement("a");
  link.href = postUrl;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = `Ver publicación de @${username} en Instagram ↗`;
  container.replaceChildren(link);
  container.classList.add("is-link-fallback");
}

function titleInstagramFrames(grid) {
  grid.querySelectorAll("iframe").forEach((frame) => {
    if (frame.title.trim()) return;
    const container = frame.closest("[data-instagram-post]");
    const username = container
      ? new URL(container.dataset.instagramPost).pathname.split("/").filter(Boolean)[0]
      : null;
    frame.title = username ? `Publicación de @${username} en Instagram` : "Publicación de Instagram";
  });
}

function watchInstagramFrames(grid) {
  if (!grid) return;
  if (!instagramFrameObserver) {
    instagramFrameObserver = new MutationObserver(() => titleInstagramFrames(grid));
    instagramFrameObserver.observe(grid, { childList: true, subtree: true });
  }
  titleInstagramFrames(grid);
}

function loadInstagramEmbedScript() {
  if (window.instgrm?.Embeds?.process) return Promise.resolve();
  if (!instagramEmbedScriptPromise) {
    instagramEmbedScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://www.instagram.com/embed.js";
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        instagramEmbedScriptPromise = null;
        reject(new Error("No se pudo cargar el script de Instagram."));
      };
      document.head.append(script);
    });
  }
  return instagramEmbedScriptPromise;
}

async function loadInstagramPosts() {
  const posts = [...document.querySelectorAll("[data-instagram-post]")];
  const rendered = await Promise.all(posts.map(async (container) => {
    const postUrl = container.dataset.instagramPost;
    const endpoint = new URL(INSTAGRAM_OEMBED_URL);
    endpoint.searchParams.set("url", postUrl);
    endpoint.searchParams.set("maxwidth", "540");
    endpoint.searchParams.set("hidecaption", "true");
    endpoint.searchParams.set("omitscript", "true");

    try {
      const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Meta oEmbed returned ${response.status}`);
      const data = await response.json();
      const embed = new DOMParser().parseFromString(data.html || "", "text/html").querySelector("blockquote.instagram-media");
      if (!embed) throw new Error("Meta oEmbed no devolvió el bloque de publicación.");
      container.replaceChildren(embed);
      return true;
    } catch (error) {
      container.classList.add("is-link-fallback");
      console.warn(`No se pudo incrustar la publicación de Instagram ${postUrl}:`, error);
      return false;
    }
  }));

  if (rendered.some(Boolean)) {
    try {
      await loadInstagramEmbedScript();
      window.instgrm?.Embeds?.process();
      titleInstagramFrames(document.querySelector(".instagram-grid"));
    } catch (error) {
      console.warn("No se pudo activar el renderizado de Instagram:", error);
      posts.forEach((container) => {
        if (container.querySelector("blockquote.instagram-media")) restoreInstagramLink(container);
      });
      return 0;
    }
  }
  return rendered.filter(Boolean).length;
}

function initializeInstagramConsent() {
  const consentPanel = $("instagram-consent");
  const acceptButton = $("load-instagram-posts");
  const rejectButton = $("keep-instagram-blocked");
  const controls = $("instagram-controls");
  const disableButton = $("disable-instagram-posts");
  const status = $("instagram-consent-status");
  const posts = [...document.querySelectorAll("[data-instagram-post]")];
  watchInstagramFrames(document.querySelector(".instagram-grid"));

  const showPreferenceControl = (preference, message) => {
    controls.hidden = false;
    controls.querySelector("span").textContent = message;
    disableButton.dataset.preference = preference;
    disableButton.textContent = preference === "accepted" ? "Desactivar" : "Cambiar preferencia";
  };

  acceptButton?.addEventListener("click", async () => {
    acceptButton.disabled = true;
    rejectButton.disabled = true;
    status.textContent = "Conectando con Instagram…";
    const loadedCount = await loadInstagramPosts();
    acceptButton.disabled = false;
    rejectButton.disabled = false;
    if (loadedCount > 0) {
      saveInstagramConsent("accepted");
      consentPanel.hidden = true;
      showPreferenceControl("accepted", `Instagram activado · ${loadedCount} de ${posts.length} publicaciones cargadas.`);
      return;
    }
    status.textContent = "No se pudieron cargar las publicaciones. Los enlaces directos siguen disponibles.";
  });

  rejectButton?.addEventListener("click", () => {
    saveInstagramConsent("rejected");
    consentPanel.hidden = true;
    showPreferenceControl("rejected", "Instagram bloqueado. Puedes abrir los enlaces directos.");
  });

  disableButton?.addEventListener("click", () => {
    if (disableButton.dataset.preference === "accepted") {
      saveInstagramConsent("rejected");
      posts.forEach(restoreInstagramLink);
      showPreferenceControl("rejected", "Instagram bloqueado. Puedes abrir los enlaces directos.");
      return;
    }
    controls.hidden = true;
    consentPanel.hidden = false;
    status.textContent = "";
  });

  const savedConsent = getInstagramConsent();
  if (savedConsent === "accepted") {
    consentPanel.hidden = true;
    showPreferenceControl("accepted", "Cargando publicaciones de Instagram…");
    loadInstagramPosts().then((loadedCount) => {
      showPreferenceControl(
        "accepted",
        loadedCount > 0
          ? `Instagram activado · ${loadedCount} de ${posts.length} publicaciones cargadas.`
          : "Instagram autorizado, pero las publicaciones no están disponibles ahora."
      );
    });
  } else if (savedConsent === "rejected") {
    consentPanel.hidden = true;
    showPreferenceControl("rejected", "Instagram bloqueado. Puedes abrir los enlaces directos.");
  }
}

["daily-forecast", "wind-forecast", "tide-week"].forEach((id) => {
  $(id).addEventListener("click", (event) => {
    const dayButton = event.target.closest("button[data-day]");
    if (dayButton) selectForecastDay(dayButton.dataset.day);
  });
});

const menuButton = document.querySelector(".menu-toggle");
const siteHeader = document.querySelector(".site-header");
const updateHeader = () => siteHeader.classList.toggle("scrolled", window.scrollY > 80);
window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();
menuButton.addEventListener("click", () => {
  const isOpen = siteHeader.classList.toggle("nav-open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
});
document.querySelectorAll("#site-nav a").forEach((link) => link.addEventListener("click", () => {
  siteHeader.classList.remove("nav-open");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Abrir menú");
}));
loadForecast();
loadMarineForecast();
loadBathingWaterQuality();
loadWaterSamples();
initializeInstagramConsent();
bindTideHover();
