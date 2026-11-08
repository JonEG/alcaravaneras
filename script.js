const API_URL = "https://api.open-meteo.com/v1/forecast?latitude=28.1308&longitude=-15.4282&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&timezone=Atlantic%2FCanary&forecast_days=7&wind_speed_unit=kmh";
const MARINE_API_URL = "https://marine-api.open-meteo.com/v1/marine?latitude=28.1308&longitude=-15.4282&current=sea_level_height_msl&hourly=sea_level_height_msl&timezone=Atlantic%2FCanary&forecast_days=7&cell_selection=sea";
const $ = (id) => document.getElementById(id);
let forecastData = null;
let marineData = null;
let selectedDay = null;

const weatherDescriptions = (code) => {
  if (code === 0) return ["Despejado", "☀"];
  if (code === 1) return ["Mayormente despejado", "◒"];
  if (code === 2) return ["Parcialmente nuboso", "◒"];
  if (code === 3) return ["Nublado", "☁"];
  if ([45, 48].includes(code)) return ["Bruma", "≋"];
  if ([51, 53, 55, 56, 57].includes(code)) return ["Llovizna", "☂"];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ["Lluvia", "☂"];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ["Granizo", "❄"];
  if ([95, 96, 99].includes(code)) return ["Tormenta", "ϟ"];
  return ["Condiciones variables", "☁"];
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
  $("weather-hourly").innerHTML = hours.map(({ time, index }) => {
    const [description, icon] = weatherDescriptions(data.hourly.weather_code[index]);
    const chance = data.hourly.precipitation_probability[index] ?? 0;
    const isPast = day === today && time < currentHour;
    const isCurrent = day === today && time.slice(0, 13) === currentHour;
    const label = dateAt(time, { hour: "2-digit" });
    return `<div class="weather-hour${isCurrent ? " is-current" : ""}${isPast ? " is-past" : ""}" title="${label} · ${description} · ${Math.round(data.hourly.temperature_2m[index])}° · lluvia ${chance}%"><span class="weather-hour-time">${label}</span><span class="weather-hour-icon" aria-hidden="true">${icon}</span><strong>${Math.round(data.hourly.temperature_2m[index])}°</strong><span class="weather-hour-rain">${chance >= 20 ? `💧 ${chance}%` : " "}</span></div>`;
  }).join("");
}

function renderHourly(data, day = selectedDay) {
  const today = data.current.time.slice(0, 10);
  const currentHour = data.current.time.slice(0, 13);
  const hours = data.hourly.time.map((time, index) => ({ time, index })).filter(({ time }) => time.startsWith(day));
  $("hourly-forecast").innerHTML = hours.map(({ time, index: i }) => {
    const speed = Math.round(data.hourly.wind_speed_10m[i] || 0);
    const label = dateAt(time, { hour: "2-digit" });
    const direction = data.hourly.wind_direction_10m[i];
    const gusts = Math.round(data.hourly.wind_gusts_10m[i] || 0);
    const isPast = day === today && time < currentHour;
    const isCurrent = day === today && time.slice(0, 13) === currentHour;
    return `<div class="hour-column${isCurrent ? " is-current" : ""}${isPast ? " is-past" : ""}" title="${label}: ${speed} km/h, rachas ${gusts} km/h, ${directionName(direction)}"><span class="hour-time">${label}</span><span class="hour-arrow" style="transform:rotate(${direction}deg)" aria-hidden="true">➤</span><strong class="hour-value">${speed} <small>km/h</small></strong><span class="hour-dir">${directionName(direction)}</span><span class="hour-gust">R. ${gusts}</span></div>`;
  }).join("");
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
    return `<button class="tide-day${selected ? " is-selected" : ""}" type="button" data-day="${day}" aria-pressed="${selected}" title="Nivel modelado respecto a la media global; hoy: ${today === day ? "día actual" : label}"><span class="tide-day-name">${label}</span><span class="tide-day-extreme"><small>Pleamar aprox.</small><strong>${high.value.toFixed(2)} m</strong><em>${high.time.slice(11, 16)}</em></span><span class="tide-day-extreme"><small>Bajamar aprox.</small><strong>${low.value.toFixed(2)} m</strong><em>${low.time.slice(11, 16)}</em></span></button>`;
  }).join("");
}

function renderTide(data, day = selectedDay) {
  if (!data?.current || !data?.hourly) return;
  selectedDay ??= data.current.time.slice(0, 10);
  renderTideWeek(data);
  const currentLevel = data.current.sea_level_height_msl;
  $("current-tide").textContent = Number.isFinite(currentLevel) ? currentLevel.toFixed(2) : "—";
  const times = data.hourly.time;
  const values = data.hourly.sea_level_height_msl;
  const points = times.map((time, index) => ({ time, index, value: values[index] })).filter((point) => point.time.startsWith(day) && Number.isFinite(point.value));
  const label = selectedDayLabel(day, data.current.time.slice(0, 10));
  $("tide-hourly-title").textContent = `${label} · nivel del mar por horas`;
  if (!points.length) {
    $("tide-chart").innerHTML = '<p class="loading-row">No hay datos horarios de marea para este día.</p>';
    $("tide-extremes").innerHTML = "";
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
  const minPoint = points.reduce((best, point) => point.value < best.value ? point : best, points[0]);
  const maxPoint = points.reduce((best, point) => point.value > best.value ? point : best, points[0]);
  const timeLabel = (time) => time.slice(11, 16);
  $("tide-extremes").innerHTML = `<span>Pleamar aprox.<strong>${maxPoint.value.toFixed(2)} m</strong><small>${timeLabel(maxPoint.time)}</small></span><span>Bajamar aprox.<strong>${minPoint.value.toFixed(2)} m</strong><small>${timeLabel(minPoint.time)}</small></span>`;
  $("tide-chart").innerHTML = `<svg viewBox="0 0 1000 205" role="img" aria-label="Curva estimada del nivel del mar para ${label}"><g>${grid}</g><path class="tide-area" d="${area}"/><path class="tide-line" d="${path}"/>${currentMarker}<g>${hourlyPoints}</g><g>${hourMarks}</g></svg><div class="tide-tooltip" id="tide-tooltip" role="status" hidden></div>`;
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
  $("current-wind-large").textContent = Math.round(current.wind_speed_10m);
  $("current-gusts").textContent = Math.round(current.wind_gusts_10m);
  $("current-direction").textContent = directionName(current.wind_direction_10m);
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
  } catch (error) {
    console.error("No se pudo cargar la previsión de marea:", error);
    $("current-tide").textContent = "—";
    $("tide-extremes").textContent = "Marea temporalmente no disponible";
    $("tide-chart").innerHTML = '<p class="loading-row">No se pudo cargar la previsión de marea.</p>';
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
bindTideHover();
