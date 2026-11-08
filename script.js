const API_URL = "https://api.open-meteo.com/v1/forecast?latitude=28.1308&longitude=-15.4282&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&timezone=Atlantic%2FCanary&forecast_days=7&wind_speed_unit=kmh";
const $ = (id) => document.getElementById(id);

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
    return `<div class="forecast-card${i === 0 ? " is-today" : ""}" title="${description}; lluvia ${rain}%"><span class="forecast-day">${label}</span><span class="forecast-icon" aria-label="${description}">${icon}</span><strong class="forecast-high">${high}°</strong><span class="forecast-low">${low}°</span>${rain >= 20 ? `<span class="forecast-rain">💧 ${rain}%</span>` : ""}</div>`;
  }).join("");
  $("daily-forecast").innerHTML = rows;
}

function renderWeatherHourly(data) {
  const today = data.current.time.slice(0, 10);
  const currentHour = data.current.time.slice(0, 13);
  const hours = data.hourly.time.map((time, index) => ({ time, index })).filter(({ time }) => time.startsWith(today));
  $("weather-hourly").innerHTML = hours.map(({ time, index }) => {
    const [description, icon] = weatherDescriptions(data.hourly.weather_code[index]);
    const chance = data.hourly.precipitation_probability[index] ?? 0;
    const isPast = time < currentHour;
    const isCurrent = time === currentHour;
    const label = dateAt(time, { hour: "2-digit" });
    return `<div class="weather-hour${isCurrent ? " is-current" : ""}${isPast ? " is-past" : ""}" title="${label} · ${description} · ${Math.round(data.hourly.temperature_2m[index])}° · lluvia ${chance}%"><span class="weather-hour-time">${label}</span><span class="weather-hour-icon" aria-hidden="true">${icon}</span><strong>${Math.round(data.hourly.temperature_2m[index])}°</strong><span class="weather-hour-rain">${chance >= 20 ? `💧 ${chance}%` : " "}</span></div>`;
  }).join("");
}

function renderHourly(data) {
  const today = data.current.time.slice(0, 10);
  const currentHour = data.current.time.slice(0, 13);
  const hours = data.hourly.time.map((time, index) => ({ time, index })).filter(({ time }) => time.startsWith(today));
  $("hourly-forecast").innerHTML = hours.map(({ time, index: i }) => {
    const speed = Math.round(data.hourly.wind_speed_10m[i] || 0);
    const label = dateAt(time, { hour: "2-digit" });
    const direction = data.hourly.wind_direction_10m[i];
    const gusts = Math.round(data.hourly.wind_gusts_10m[i] || 0);
    const isPast = time < currentHour;
    const isCurrent = time === currentHour;
    return `<div class="hour-column${isCurrent ? " is-current" : ""}${isPast ? " is-past" : ""}" title="${label}: ${speed} km/h, rachas ${gusts} km/h, ${directionName(direction)}"><span class="hour-time">${label}</span><span class="hour-arrow" style="transform:rotate(${direction}deg)" aria-hidden="true">➤</span><strong class="hour-value">${speed} <small>km/h</small></strong><span class="hour-dir">${directionName(direction)}</span><span class="hour-gust">R. ${gusts}</span></div>`;
  }).join("");
}

function renderWindWeek(data) {
  $("wind-forecast").innerHTML = data.daily.time.map((day, i) => {
    const label = i === 0 ? "HOY" : dateAt(`${day}T12:00`, { weekday: "short" }).replace(".", "").toLocaleUpperCase("es-ES");
    const direction = directionName(data.daily.wind_direction_10m_dominant[i]);
    const [level] = beaufort(data.daily.wind_speed_10m_max[i]);
    return `<div class="wind-day" title="${day}: rachas hasta ${Math.round(data.daily.wind_gusts_10m_max[i])} km/h"><span class="wind-day-name">${label}</span><span class="wind-glyph" style="transform:rotate(${data.daily.wind_direction_10m_dominant[i]}deg)" aria-label="Dirección ${direction}">➤</span><strong>${Math.round(data.daily.wind_speed_10m_max[i])} <small>km/h</small></strong><span class="wind-gust">Rachas ${Math.round(data.daily.wind_gusts_10m_max[i])}</span><span class="wind-bf">Bf ${level}</span></div>`;
  }).join("");
}

function render(data) {
  const current = data.current;
  const currentHour = data.hourly.time.findIndex((time) => time >= current.time.slice(0, 13));
  const rainChance = data.hourly.precipitation_probability[Math.max(0, currentHour)] ?? 0;
  const [description, icon] = weatherDescriptions(current.weather_code);
  $("current-temp").textContent = `${Math.round(current.temperature_2m)}°`;
  $("today-high").textContent = Math.round(data.daily.temperature_2m_max[0]);
  $("today-low").textContent = Math.round(data.daily.temperature_2m_min[0]);
  $("current-condition").textContent = description;
  $("current-icon").textContent = icon;
  $("current-wind").textContent = Math.round(current.wind_speed_10m);
  $("current-wind-large").textContent = Math.round(current.wind_speed_10m);
  $("current-rain").textContent = Math.round(rainChance);
  $("current-gusts").textContent = Math.round(current.wind_gusts_10m);
  $("current-direction").textContent = directionName(current.wind_direction_10m);
  $("compass-needle").style.transform = `rotate(${current.wind_direction_10m}deg)`;
  const [level, name] = beaufort(current.wind_speed_10m);
  $("beaufort-number").textContent = level;
  $("beaufort-name").textContent = name;
  $("updated-at").textContent = `Previsión actualizada · ${dateAt(current.time, { hour: "2-digit", minute: "2-digit" })}`;
  renderDaily(data);
  renderWeatherHourly(data);
  renderHourly(data);
  renderWindWeek(data);
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
