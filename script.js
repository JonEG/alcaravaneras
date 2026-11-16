const API_URL = "https://api.open-meteo.com/v1/forecast?latitude=28.1308&longitude=-15.4282&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&timezone=Atlantic%2FCanary&forecast_days=7&wind_speed_unit=kmh";
const MARINE_API_URL = "https://marine-api.open-meteo.com/v1/marine?latitude=28.1308&longitude=-15.4282&current=sea_level_height_msl,sea_surface_temperature&hourly=sea_level_height_msl,sea_surface_temperature&timezone=Atlantic%2FCanary&forecast_days=7&cell_selection=sea";
const BATHING_WATER_API_URL = "https://marine.discomap.eea.europa.eu/arcgis/rest/services/BathingWater/BathingWater_Dyna_WM_2025/MapServer/3/query";
const WATER_SAMPLES_URL = "/data/latest-water-samples.json";
const UI_LOCALE = window.AlcaravanerasI18n?.locale || "es-ES";
const t = window.t || ((key) => key);
const $ = (id) => document.getElementById(id);
const setText = (id, value) => {
  const element = $(id);
  if (element) element.textContent = value;
};
let forecastData = null;
let marineData = null;
let selectedDay = null;

const weatherDescriptions = (code) => {
  if (code === 0) return [t("weather.clear"), "☀️"];
  if (code === 1) return [t("weather.mostlyClear"), "🌤️"];
  if (code === 2) return [t("weather.partlyCloudy"), "⛅"];
  if (code === 3) return [t("weather.cloudy"), "☁️"];
  if ([45, 48].includes(code)) return [t("weather.fog"), "🌫️"];
  if ([51, 53, 55, 56, 57].includes(code)) return [t("weather.drizzle"), "🌦️"];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return [t("weather.rain"), "🌧️"];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return [t("weather.snow"), "🌨️"];
  if ([95, 96, 99].includes(code)) return [t("weather.storm"), "⛈️"];
  return [t("weather.variable"), "🌥️"];
};

const directionName = (degrees) => {
  const names = UI_LOCALE === "de-DE"
    ? ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    : UI_LOCALE === "en-GB"
      ? ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
      : ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  return names[Math.round(degrees / 22.5) % 16];
};

const beaufort = (speed) => {
  const scale = [
    [1, "wind.calm"], [5, "wind.veryLightBreeze"], [11, "wind.lightBreeze"], [19, "wind.moderateBreeze"],
    [28, "wind.freshBreeze"], [38, "wind.strongBreeze"], [49, "wind.strongWind"], [61, "wind.veryStrongWind"],
    [75, "wind.gale"], [89, "wind.strongGale"], [103, "wind.storm"], [118, "wind.violentStorm"], [Infinity, "wind.hurricane"],
  ];
  const index = scale.findIndex(([limit]) => speed < limit);
  const [, nameKey] = scale[Math.max(0, index)];
  return [Math.max(0, index), t(nameKey), ""];
};

const windSummaryDescription = (speed) => {
  if (!Number.isFinite(speed)) return "—";
  const [level] = beaufort(speed);
  if (level === 0) return t("wind.calm");
  if (level <= 2) return t("wind.levelGentle");
  if (level <= 4) return t("wind.levelModerate");
  if (level <= 6) return t("wind.levelStrong");
  return t("wind.levelVeryStrong");
};

const dateAt = (iso, options) => new Date(iso).toLocaleDateString(UI_LOCALE, { timeZone: "Atlantic/Canary", ...options });

function renderDaily(data) {
  const rows = data.daily.time.map((day, i) => {
    const [description, icon] = weatherDescriptions(data.daily.weather_code[i]);
    const label = i === 0 ? t("common.todayUpper") : dateAt(`${day}T12:00`, { weekday: "short", day: "numeric" }).toLocaleUpperCase(UI_LOCALE);
    const high = Math.round(data.daily.temperature_2m_max[i]);
    const low = Math.round(data.daily.temperature_2m_min[i]);
    const rain = data.daily.precipitation_probability_max[i] ?? 0;
    const selected = day === selectedDay;
    return `<button class="forecast-card forecast-day-button${i === 0 ? " is-today" : ""}${selected ? " is-selected" : ""}" type="button" data-day="${day}" aria-pressed="${selected}" title="${description}; ${t("weather.rain")} ${rain}%"><span class="forecast-day">${label}</span><span class="forecast-icon" aria-label="${description}">${icon}</span><strong class="forecast-high">${high}°</strong><span class="forecast-low">${low}°</span>${rain >= 20 ? `<span class="forecast-rain">💧 ${rain}%</span>` : ""}</button>`;
  }).join("");
  $("daily-forecast").innerHTML = rows;
}

function selectedDayLabel(day, today) {
  if (day === today) return t("common.today");
  const label = dateAt(`${day}T12:00`, { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toLocaleUpperCase(UI_LOCALE) + label.slice(1);
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
    const label = new Date(time).toLocaleTimeString(UI_LOCALE, { timeZone: "Atlantic/Canary", hour: "2-digit", minute: "2-digit" });
    return `<div class="weather-hour${isCurrent ? " is-current" : ""}${isPast ? " is-past" : ""}" title="${label} · ${description} · ${Math.round(data.hourly.temperature_2m[index])}° · ${t("weather.rainChance", { value: chance })}"><span class="weather-hour-time">${label}</span><span class="weather-hour-icon" aria-hidden="true">${icon}</span><strong>${Math.round(data.hourly.temperature_2m[index])}°</strong><span class="weather-hour-rain">${chance >= 20 ? `💧 ${chance}%` : " "}</span></div>`;
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
    const label = new Date(time).toLocaleTimeString(UI_LOCALE, { timeZone: "Atlantic/Canary", hour: "2-digit", minute: "2-digit" });
    const direction = data.hourly.wind_direction_10m[i];
    const gusts = Math.round(data.hourly.wind_gusts_10m[i] || 0);
    const isPast = day === today && time < currentHour;
    const isCurrent = day === today && time.slice(0, 13) === currentHour;
    return `<div class="hour-column${isCurrent ? " is-current" : ""}${isPast ? " is-past" : ""}" title="${t("wind.hourTitle", { time: label, speed, gusts, direction: directionName(direction) })}"><span class="hour-time">${label}</span><span class="hour-arrow" style="transform:rotate(${direction}deg)" aria-hidden="true">➤</span><strong class="hour-value">${speed} <small>km/h</small></strong><span class="hour-dir">${directionName(direction)}</span><span class="hour-gust">${t("wind.gusts", { value: gusts })}</span></div>`;
  }).join("");
  timeline.scrollLeft = 0;
}

function renderWindWeek(data) {
  $("wind-forecast").innerHTML = data.daily.time.map((day, i) => {
    const label = i === 0 ? t("common.todayUpper") : dateAt(`${day}T12:00`, { weekday: "short" }).replace(".", "").toLocaleUpperCase(UI_LOCALE);
    const direction = directionName(data.daily.wind_direction_10m_dominant[i]);
    const [level] = beaufort(data.daily.wind_speed_10m_max[i]);
    const selected = day === selectedDay;
    return `<button class="wind-day${selected ? " is-selected" : ""}" type="button" data-day="${day}" aria-pressed="${selected}" title="${day}: ${t("wind.gusts", { value: Math.round(data.daily.wind_gusts_10m_max[i]) })} km/h"><span class="wind-day-name">${label}</span><span class="wind-glyph" style="transform:rotate(${data.daily.wind_direction_10m_dominant[i]}deg)" aria-label="${t("wind.direction", { value: direction })}">➤</span><strong>${Math.round(data.daily.wind_speed_10m_max[i])} <small>km/h</small></strong><span class="wind-gust">${t("wind.gusts", { value: Math.round(data.daily.wind_gusts_10m_max[i]) })}</span><span class="wind-bf">Bf ${level}</span></button>`;
  }).join("");
}

function renderSelectedDaySummary(data) {
  const index = data.daily.time.indexOf(selectedDay);
  if (index < 0) return;
  $("summary-day").textContent = selectedDayLabel(selectedDay, data.current.time.slice(0, 10)).toLocaleLowerCase(UI_LOCALE);
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
    const label = index === 0 ? t("common.todayUpper") : dateAt(`${day}T12:00`, { weekday: "short", day: "numeric" }).toLocaleUpperCase(UI_LOCALE);
    const selected = day === selectedDay;
    return `<button class="tide-day${selected ? " is-selected" : ""}" type="button" data-day="${day}" aria-pressed="${selected}" title="${today === day ? t("common.today") : label}"><span class="tide-day-name">${label}</span><span class="tide-day-extreme"><small>${t("tide.highApprox")}</small><em>${high.time.slice(11, 16)}</em><strong>${high.value.toFixed(2)} m</strong></span><span class="tide-day-extreme"><small>${t("tide.lowApprox")}</small><em>${low.time.slice(11, 16)}</em><strong>${low.value.toFixed(2)} m</strong></span></button>`;
  }).join("");
}

function findTideTurningPoints(points) {
  return points.slice(1, -1).flatMap((point, index) => {
    const previous = points[index].value;
    const next = points[index + 2].value;
    if (point.value >= previous && point.value > next) return [{ ...point, type: t("tide.high") }];
    if (point.value <= previous && point.value < next) return [{ ...point, type: t("tide.low") }];
    return [];
  });
}

function renderTide(data, day) {
  if (!data?.current || !data?.hourly) return;
  selectedDay ??= data.current.time.slice(0, 10);
  day ??= selectedDay;
  if ($("tide-week")) renderTideWeek(data);
  const currentLevel = data.current.sea_level_height_msl;
  setText("current-tide", Number.isFinite(currentLevel) ? currentLevel.toFixed(2) : "—");
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
  const rising = trendDelta > 0;
  const trend = Math.abs(trendDelta) >= 0.01 ? t(rising ? "tide.rising" : "tide.falling") : "—";
  setText("tide-trend", trend);
  setText("summary-tide-trend", trend);

  const nextExtreme = findTideTurningPoints(allPoints).find((point) => point.time > data.current.time);
  if (nextExtreme) {
    const eventDay = nextExtreme.time.slice(0, 10);
    const eventDayLabel = eventDay === today ? t("common.today").toLocaleLowerCase(UI_LOCALE) : dateAt(`${eventDay}T12:00`, { weekday: "short", day: "numeric" }).replace(".", "");
    setText("next-tide-label", eventDay === today ? t("tide.nextToday", { type: nextExtreme.type }) : t("tide.nextDate", { type: nextExtreme.type, date: eventDayLabel }));
    setText("next-tide-time", nextExtreme.time.slice(11, 16));
    setText("summary-tide-next-label", eventDay === today ? t("tide.nextToday", { type: nextExtreme.type }) : t("tide.nextDate", { type: nextExtreme.type, date: eventDayLabel }));
    setText("summary-tide-next-time", nextExtreme.time.slice(11, 16));
  } else {
    setText("next-tide-label", t("tide.nextToday", { type: rising ? t("tide.high") : t("tide.low") }));
    setText("next-tide-time", "—");
    setText("summary-tide-next-label", t("tide.nextToday", { type: rising ? t("tide.high") : t("tide.low") }));
    setText("summary-tide-next-time", "—");
  }

  if ($("tide-extremes") && todayPoints.length) {
    const high = todayPoints.reduce((best, point) => point.value > best.value ? point : best, todayPoints[0]);
    const low = todayPoints.reduce((best, point) => point.value < best.value ? point : best, todayPoints[0]);
    const todayExtremes = [
      { type: t("tide.highApprox"), point: high },
      { type: t("tide.lowApprox"), point: low },
    ].sort((a, b) => a.point.time.localeCompare(b.point.time));
    $("tide-extremes").innerHTML = todayExtremes.map(({ type, point }) => `<span><span class="tide-extreme-label">${type}</span><strong><time datetime="${point.time}">${point.time.slice(11, 16)}</time><small>${point.value.toFixed(2)} m</small></strong></span>`).join("");
  } else if ($("tide-extremes")) {
    $("tide-extremes").innerHTML = "";
  }

  if (!$("tide-chart")) return;
  const points = allPoints.filter((point) => point.time.startsWith(day));
  const label = selectedDayLabel(day, data.current.time.slice(0, 10));
  setText("tide-hourly-title", `${label} · nivel del mar por horas`);
  if (!points.length) {
    $("tide-chart").innerHTML = `<p class="loading-row">${t("tide.noHourlyData")}</p>`;
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
  const hourlyPoints = coordinates.map((point) => `<g class="tide-point" data-time="${point.time.slice(11, 16)}" data-level="${point.value.toFixed(2)}" data-x="${point.x.toFixed(1)}" data-y="${point.y.toFixed(1)}" tabindex="0" role="img" aria-label="${point.time.slice(11, 16)} · ${t("tide.seaLevel", { value: point.value.toFixed(2) })}"><line class="tide-hover-line" x1="${point.x}" y1="${top}" x2="${point.x}" y2="${bottom}"/><circle class="tide-hit" cx="${point.x}" cy="${point.y}" r="13"/><circle class="tide-dot" cx="${point.x}" cy="${point.y}" r="3"/></g>`).join("");
  $("tide-chart").innerHTML = `<svg viewBox="0 0 1000 205" role="img" aria-label="${t("tide.chartTitle", { day: label })}"><g>${grid}</g><path class="tide-area" d="${area}"/><path class="tide-line" d="${path}"/>${currentMarker}<g>${hourlyPoints}</g><g>${hourMarks}</g></svg><div class="tide-tooltip" id="tide-tooltip" role="status" hidden></div>`;
}

function renderSeaTemperature(data) {
  const temperature = data?.current?.sea_surface_temperature;
  const time = data?.current?.time;
  if (!Number.isFinite(temperature)) {
    if ($("sea-temperature")) $("sea-temperature").innerHTML = `—<span>°C</span>`;
    setText("sea-temperature-time", t("water.temperatureUnavailable"));
    if ($("summary-sea-temperature")) $("summary-sea-temperature").innerHTML = `—<small>°C</small>`;
    renderSeaTemperatureTrend(data);
    return;
  }
  if ($("sea-temperature")) $("sea-temperature").innerHTML = `${temperature.toFixed(1)}<span>°C</span>`;
  if ($("summary-sea-temperature")) $("summary-sea-temperature").innerHTML = `${temperature.toFixed(1)}<small>°C</small>`;
  if (time) {
    const date = dateAt(`${time.slice(0, 10)}T12:00`, { day: "numeric", month: "short" });
    setText("sea-temperature-time", t("water.modelTime", { date, time: time.slice(11, 16) }));
  }
  renderSeaTemperatureTrend(data);
}

function renderSeaTemperatureTrend(data) {
  const chart = $("water-temperature-chart");
  if (!chart || !Array.isArray(data?.hourly?.time) || !Array.isArray(data?.hourly?.sea_surface_temperature)) return;
  const points = data.hourly.time.map((time, index) => ({ time, value: data.hourly.sea_surface_temperature[index] }))
    .filter((point, index) => Number.isFinite(point.value) && (index % 4 === 0 || index === data.hourly.time.length - 1));
  if (points.length < 2) {
    chart.textContent = t("tide.noChartData");
    return;
  }
  const width = 1000;
  const height = 235;
  const left = 48;
  const right = 985;
  const top = 25;
  const bottom = 185;
  const low = Math.min(...points.map((point) => point.value));
  const high = Math.max(...points.map((point) => point.value));
  const range = high - low || 0.1;
  const coordinates = points.map((point, index) => ({
    ...point,
    x: left + (index / (points.length - 1)) * (right - left),
    y: top + ((high - point.value) / range) * (bottom - top),
  }));
  const path = coordinates.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${path} L${right},${bottom} L${left},${bottom} Z`;
  const grid = [0, 1, 2].map((step) => {
    const y = top + (step / 2) * (bottom - top);
    const value = high - (step / 2) * range;
    return `<line class="tide-gridline" x1="${left}" y1="${y}" x2="${right}" y2="${y}"/><text class="tide-level-label" x="${left + 4}" y="${y - 5}">${value.toFixed(1)} °C</text>`;
  }).join("");
  const labels = coordinates.filter((point, index) => index === 0 || index === coordinates.length - 1 || point.time.slice(11, 13) === "12")
    .map((point) => `<text class="tide-hour-label" x="${point.x}" y="218" text-anchor="middle">${point.time.slice(8, 10)}/${point.time.slice(5, 7)}</text>`).join("");
  chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${t("water.temperatureChart")}"><g>${grid}</g><path class="tide-area" d="${area}"/><path class="tide-line" d="${path}"/><g>${labels}</g></svg>`;
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
      Poor: { label: t("water.poor"), key: "poor", rank: 0 },
      "Not classified": { label: t("water.unclassified"), key: "unclassified", rank: 1 },
      Sufficient: { label: t("water.sufficient"), key: "sufficient", rank: 2 },
      Good: { label: t("water.good"), key: "good", rank: 3 },
      Excellent: { label: t("water.excellent"), key: "excellent", rank: 4 },
    };
    const availableRatings = features.map((item) => ratings[item.qualityStatus]).filter(Boolean);
    if (!availableRatings.length) throw new Error("No usable classification was returned");
    const rating = [...availableRatings].sort((a, b) => a.rank - b.rank)[0];
    const points = new Set(features.map((item) => item.bathingWaterName)).size;
    statusElement.textContent = rating.label;
    statusElement.dataset.quality = rating.key;
    detailElement.textContent = availableRatings.some((item) => item.key !== rating.key)
      ? t("water.worstSample", { points })
      : t("water.annualRating", { points });
  } catch (error) {
    console.error("No se pudo cargar la clasificación del agua de baño:", error);
    statusElement.textContent = t("water.classificationUnavailable");
    statusElement.dataset.quality = "unavailable";
    detailElement.textContent = t("water.checkNotices");
  }
}

function renderWaterSamples(result) {
  const tableBody = $("water-samples");
  const updatedElement = $("water-samples-updated");
  if (!Array.isArray(result.samples) || !result.samples.length) return;

  if (tableBody) tableBody.replaceChildren(...result.samples.slice(0, 3).map((sample) => {
    const row = document.createElement("tr");
    const sampleResult = sample.observation || "";
    const isUnsuitable = /no apta|insuficiente/i.test(sampleResult);
    const isSuitable = /apta/i.test(sampleResult) && !isUnsuitable;
    const resultLabel = isUnsuitable ? t("water.unsuitable") : isSuitable ? t("water.suitable") : sampleResult || t("water.noResult");
    const resultCell = document.createElement("td");
    resultCell.textContent = resultLabel;
    resultCell.dataset.quality = isUnsuitable ? "poor" : isSuitable ? "good" : "unavailable";
    if (sampleResult) resultCell.title = sampleResult;
    const date = document.createElement("time");
    date.dateTime = sample.date;
    date.textContent = new Intl.DateTimeFormat(UI_LOCALE, { timeZone: "Atlantic/Canary", dateStyle: "short" }).format(new Date(`${sample.date}T12:00:00`));
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
  setText("summary-water-quality", sampleStatus ? (isNaN(Date.parse(latestSample.date)) ? sampleStatus : /no apta|insuficiente/i.test(sampleStatus) ? t("water.unsuitable") : t("water.suitable")) : t("water.noResult"));
  if ($("summary-water-quality")) $("summary-water-quality").dataset.quality = /no apta|insuficiente/i.test(sampleStatus) ? "poor" : "good";
  setText("summary-water-quality-date", t("water.sampleDate", { date: new Intl.DateTimeFormat(UI_LOCALE, { timeZone: "Atlantic/Canary", dateStyle: "short" }).format(new Date(`${latestSample.date}T12:00:00`)) }));

  if (updatedElement && result.updatedAt) {
    const updated = new Date(result.updatedAt);
    const label = new Intl.DateTimeFormat(UI_LOCALE, { timeZone: "Atlantic/Canary", dateStyle: "short", timeStyle: "short" }).format(updated);
    updatedElement.textContent = t("water.updated", { date: label });
  } else if (updatedElement) {
    updatedElement.textContent = t("water.autoUpdated");
  }
}

async function loadWaterSamples() {
  const tableBody = $("water-samples");
  const updatedElement = $("water-samples-updated");
  if (!tableBody && !$("summary-water-quality")) return;

  try {
    const response = await fetch(`${WATER_SAMPLES_URL}?t=${Date.now()}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Water samples file returned ${response.status}`);
    renderWaterSamples(await response.json());
  } catch (error) {
    console.error("No se pudieron cargar las muestras de NÁYADE:", error);
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="4">${t("errors.samples")}</td></tr>`;
    setText("water-samples-updated", t("water.unavailableRow"));
    setText("summary-water-quality", t("water.noResult"));
    if ($("summary-water-quality")) $("summary-water-quality").dataset.quality = "unavailable";
    setText("summary-water-quality-date", t("water.checkNayade"));
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
  setText("current-temp", `${Math.round(current.temperature_2m)}°`);
  setText("current-condition", description);
  setText("current-icon", icon);
  setText("summary-weather-temp", `${Math.round(current.temperature_2m)}°`);
  setText("summary-weather-condition", description);
  setText("summary-weather-icon", icon);
  setText("current-wind-large", Math.round(current.wind_speed_10m));
  setText("current-gusts", Math.round(current.wind_gusts_10m));
  setText("current-direction", directionName(current.wind_direction_10m));
  setText("summary-wind-speed", Math.round(current.wind_speed_10m));
  setText("summary-wind-level", windSummaryDescription(current.wind_speed_10m));
  setText("summary-wind-direction", directionName(current.wind_direction_10m));
  setText("summary-wind-gusts", Math.round(current.wind_gusts_10m));
  setText("today-summary-updated", t("weather.updatedSummary", { time: dateAt(current.time, { hour: "2-digit", minute: "2-digit" }) }));
  if ($("compass-needle")) $("compass-needle").style.transform = `rotate(${current.wind_direction_10m}deg)`;
  const [level, name] = beaufort(current.wind_speed_10m);
  setText("beaufort-number", level);
  setText("beaufort-name", name);
  setText("updated-at", t("weather.updatedForecast", { time: dateAt(current.time, { hour: "2-digit", minute: "2-digit" }) }));
  if ($("daily-forecast")) renderDaily(data);
  if ($("summary-day")) renderSelectedDaySummary(data);
  if ($("weather-hourly")) renderWeatherHourly(data);
  if ($("hourly-forecast")) renderHourly(data);
  if ($("wind-forecast")) renderWindWeek(data);
  const dayLabel = selectedDayLabel(selectedDay, current.time.slice(0, 10));
  setText("weather-hourly-title", t("weather.hourlyTitle", { day: dayLabel }));
  setText("wind-hourly-title", t("weather.hourlyTitle", { day: dayLabel }));
  if (marineData && ($("tide-chart") || $("summary-tide-trend"))) renderTide(marineData, selectedDay);
}

function selectForecastDay(day) {
  const availableDays = forecastData?.daily.time ?? [...new Set(marineData?.hourly?.time?.map((time) => time.slice(0, 10)) ?? [])];
  if (!availableDays.includes(day)) return;
  selectedDay = day;
  if (forecastData) {
    if ($("daily-forecast")) renderDaily(forecastData);
    if ($("wind-forecast")) renderWindWeek(forecastData);
    if ($("summary-day")) renderSelectedDaySummary(forecastData);
    if ($("weather-hourly")) renderWeatherHourly(forecastData, day);
    if ($("hourly-forecast")) renderHourly(forecastData, day);
    const dayLabel = selectedDayLabel(day, forecastData.current.time.slice(0, 10));
    setText("weather-hourly-title", t("weather.hourlyTitle", { day: dayLabel }));
    setText("wind-hourly-title", t("weather.hourlyTitle", { day: dayLabel }));
  }
  if (marineData && $("tide-chart")) renderTide(marineData, day);
}

async function loadForecast() {
  try {
    const response = await fetch(API_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
    render(await response.json());
  } catch (error) {
    console.error("No se pudo cargar la previsión meteorológica:", error);
    ["updated-at", "today-summary-updated"].forEach((id) => setText(id, t("weather.forecastUnavailable")));
    ["summary-weather-icon", "summary-weather-temp", "summary-wind-level", "summary-wind-speed", "summary-wind-direction", "summary-wind-gusts"].forEach((id) => setText(id, "—"));
    setText("summary-weather-condition", t("weather.unavailable"));
    ["current-temp", "today-high", "today-low", "current-rain", "current-wind-large", "current-gusts", "current-direction", "beaufort-number"].forEach((id) => setText(id, "—"));
    setText("current-condition", t("weather.conditionsUnavailable"));
    if ($("weather-hourly")) $("weather-hourly").innerHTML = `<p class="loading-row">${t("errors.weatherToday")}</p>`;
    if ($("daily-forecast")) $("daily-forecast").innerHTML = `<p class="loading-row">${t("errors.weatherForecast")}</p>`;
    if ($("hourly-forecast")) $("hourly-forecast").innerHTML = `<p class="loading-row">${t("errors.windLater")}</p>`;
    if ($("wind-forecast")) $("wind-forecast").innerHTML = `<p class="loading-row">${t("errors.windForecast")}</p>`;
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
    setText("summary-tide-trend", t("tide.noData"));
    setText("summary-tide-next-label", t("common.unavailable"));
    setText("summary-tide-next-time", "—");
    if ($("summary-sea-temperature")) $("summary-sea-temperature").innerHTML = `—<small>°C</small>`;
    setText("current-tide", "—");
    setText("tide-extremes", t("common.unavailable"));
    if ($("tide-chart")) $("tide-chart").innerHTML = `<p class="loading-row">${t("errors.tideForecast")}</p>`;
    if ($("sea-temperature")) $("sea-temperature").innerHTML = `—<span>°C</span>`;
    setText("sea-temperature-time", t("water.temperatureUnavailable"));
  }
}

const INSTAGRAM_OEMBED_URL = "https://graph.facebook.com/v26.0/instagram_oembed";
let instagramEmbedScriptPromise;
let instagramFrameObserver;

function getInstagramConsent() {
  try {
    const consent = window.AlcaravanerasConsent;
    return !consent?.chosen() ? null : consent.has("instagram") ? "accepted" : "rejected";
  } catch {
    return null;
  }
}

function saveInstagramConsent(value) {
  try {
    window.AlcaravanerasConsent?.update("instagram", value === "accepted");
  } catch (error) {
    console.warn("No se pudo guardar la preferencia de Instagram en este navegador:", error);
  }
}

function getYoutubeConsent() {
  try {
    const consent = window.AlcaravanerasConsent;
    return !consent?.chosen() ? null : consent.has("youtube") ? "accepted" : "rejected";
  } catch {
    return null;
  }
}

function saveYoutubeConsent(value) {
  try {
    window.AlcaravanerasConsent?.update("youtube", value === "accepted");
  } catch (error) {
    console.warn("No se pudo guardar la preferencia de YouTube en este navegador:", error);
  }
}

function restoreInstagramLink(container) {
  const postUrl = container.dataset.instagramPost;
  const username = new URL(postUrl).pathname.split("/").filter(Boolean)[0];
  const link = document.createElement("a");
  link.href = postUrl;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = t("consent.instagramLink", { name: username });
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
    frame.title = username ? t("instagram.frameTitle", { name: username }) : t("instagram.frameTitleGeneric");
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
  watchInstagramFrames(document.querySelector(".instagram-grid"));

  acceptButton?.addEventListener("click", () => {
    saveInstagramConsent("accepted");
  });

  rejectButton?.addEventListener("click", () => {
    saveInstagramConsent("rejected");
  });

  const savedConsent = getInstagramConsent();
  if (savedConsent === "accepted") {
    consentPanel.hidden = true;
    controls.hidden = true;
    loadInstagramPosts();
  } else if (savedConsent === "rejected") {
    consentPanel.hidden = false;
    controls.hidden = true;
  }
}

function initializeYoutubeConsent() {
  const consent = $("youtube-consent");
  const loadButton = $("load-youtube-video");
  const rejectButton = $("keep-youtube-blocked");
  const controls = $("youtube-controls");
  const player = $("youtube-player");
  if (!consent || !loadButton || !rejectButton || !controls || !player) return;

  const createFrame = (loading) => {
    const iframe = document.createElement("iframe");
    const videoId = consent.dataset.videoId || "_9LTWEetwJY";
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?feature=oembed`;
    iframe.title = player.getAttribute("aria-label") || t("video.youtubeTitle");
    iframe.loading = loading;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allow = "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.setAttribute("allowfullscreen", "");
    return iframe;
  };

  const loadVideo = () => {
    player.replaceChildren(createFrame("eager"));
    player.hidden = false;
    consent.hidden = true;
    controls.hidden = true;
  };

  loadButton.addEventListener("click", () => {
    saveYoutubeConsent("accepted");
  });
  rejectButton.addEventListener("click", () => {
    saveYoutubeConsent("rejected");
  });

  const savedConsent = getYoutubeConsent();
  if (savedConsent === "accepted") {
    consent.hidden = true;
    loadVideo();
  } else if (savedConsent === "rejected") {
    consent.hidden = false;
    controls.hidden = true;
  }
}

document.addEventListener("site-consent-change", (event) => {
  const choices = event.detail;
  const instagramPanel = $("instagram-consent");
  const instagramControls = $("instagram-controls");
  if (instagramPanel && instagramControls && choices.instagram) {
    instagramPanel.hidden = true;
    instagramControls.hidden = true;
    loadInstagramPosts();
  } else if (instagramPanel && instagramControls) {
    document.querySelectorAll("[data-instagram-post]").forEach(restoreInstagramLink);
    instagramPanel.hidden = false;
    instagramControls.hidden = true;
  }

  const youtubePanel = $("youtube-consent");
  const youtubeControls = $("youtube-controls");
  const player = $("youtube-player");
  if (youtubePanel && youtubeControls && player && choices.youtube) {
    youtubePanel.hidden = true;
    youtubeControls.hidden = true;
    if (!player.querySelector("iframe")) {
      const consent = $("youtube-consent");
      const frame = document.createElement("iframe");
      const videoId = consent?.dataset.videoId || "_9LTWEetwJY";
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?feature=oembed`;
      frame.title = player.getAttribute("aria-label") || t("video.youtubeTitle");
      frame.loading = "lazy";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.allow = "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      frame.setAttribute("allowfullscreen", "");
      player.replaceChildren(frame);
      player.hidden = false;
    }
  } else if (youtubePanel && youtubeControls && player) {
    player.replaceChildren();
    player.hidden = true;
    youtubePanel.hidden = false;
    youtubeControls.hidden = true;
  }

  const facebookPanel = $("facebook-consent");
  const facebookPlayer = $("facebook-player");
  if (!facebookPanel || !facebookPlayer) return;
  if (choices.facebook) {
    facebookPanel.hidden = true;
    const frame = document.createElement("iframe");
    const videoUrl = new URL("https://www.facebook.com/plugins/video.php");
    videoUrl.searchParams.set("href", "https://www.facebook.com/reel/925329129940031/");
    videoUrl.searchParams.set("show_text", "false");
    videoUrl.searchParams.set("width", "420");
    frame.src = videoUrl.toString();
    frame.title = t("video.facebookTitle");
    frame.loading = "lazy";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allow = "autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share";
    frame.setAttribute("allowfullscreen", "");
    facebookPlayer.replaceChildren(frame);
    facebookPlayer.hidden = false;
  } else {
    facebookPlayer.replaceChildren();
    facebookPlayer.hidden = true;
    facebookPanel.hidden = false;
  }
});

["daily-forecast", "wind-forecast", "tide-week"].forEach((id) => {
  if (!$(id)) return;
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
menuButton?.addEventListener("click", () => {
  const isOpen = siteHeader.classList.toggle("nav-open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", t(isOpen ? "menu.close" : "menu.open"));
});
document.querySelectorAll("#site-nav a").forEach((link) => link.addEventListener("click", () => {
  siteHeader.classList.remove("nav-open");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", t("menu.open"));
}));
if ($("summary-weather-temp") || $("current-temp") || $("current-wind-large")) loadForecast();
if ($("summary-tide-trend") || $("tide-chart") || $("sea-temperature")) loadMarineForecast();
if ($("water-quality-status")) loadBathingWaterQuality();
if ($("water-samples") || $("summary-water-quality")) loadWaterSamples();
if ($("youtube-consent")) initializeYoutubeConsent();
if ($("instagram-consent")) initializeInstagramConsent();
if ($("facebook-consent")) {
  const panel = $("facebook-consent");
  const player = $("facebook-player");
  const consent = window.AlcaravanerasConsent;
  if (consent?.has("facebook")) {
    document.dispatchEvent(new CustomEvent("site-consent-change", { detail: { facebook: true } }));
  }
  if (!consent?.has("facebook")) {
    panel.hidden = false;
    player.hidden = true;
  }
}
if ($("tide-chart")) bindTideHover();
