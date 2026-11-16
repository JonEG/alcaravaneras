(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const latitude = 28.1308;
  const longitude = -15.4282;
  const timezone = "Atlantic/Canary";
  const locale = window.AlcaravanerasI18n?.locale || "es-ES";
  const t = window.t || ((key) => key);
  const menuButton = $(".menu-toggle");
  const header = $(".site-header");
  const directionName = (degrees) => {
    const names = locale === "de-DE" ? ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"] : locale === "en-GB" ? ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"] : ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
    return names[Math.round(degrees / 22.5) % 16];
  };
  const dateLabel = (iso) => new Date(`${iso.slice(0, 10)}T12:00`).toLocaleDateString(locale, { timeZone: timezone, weekday: "short", day: "numeric" });
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  if (menuButton && header) {
    menuButton.addEventListener("click", () => {
      const open = header.classList.toggle("nav-open");
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", t(open ? "menu.close" : "menu.open"));
    });
    document.querySelectorAll("#site-nav a").forEach((link) => link.addEventListener("click", () => {
      header.classList.remove("nav-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", t("menu.open"));
    }));
  }

  function renderChart(points) {
    const container = $("[data-wave-chart]");
    if (!container || points.length < 2) return;
    const width = 900;
    const height = 260;
    const left = 44;
    const right = 882;
    const top = 24;
    const bottom = 220;
    const values = points.map((point) => point.value);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const range = high - low || 1;
    const coords = points.map((point, index) => ({
      ...point,
      x: left + index / (points.length - 1) * (right - left),
      y: top + (high - point.value) / range * (bottom - top),
    }));
    const path = coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const grid = [0, 1, 2].map((step) => {
      const y = top + step * (bottom - top) / 2;
      const value = high - step * range / 2;
      return `<line class="tide-gridline" x1="${left}" y1="${y}" x2="${right}" y2="${y}"/><text class="tide-level-label" x="${left + 3}" y="${y - 5}">${value.toFixed(1)} m</text>`;
    }).join("");
    const labels = [coords[0], coords[Math.floor((coords.length - 1) / 2)], coords.at(-1)]
      .map((point) => `<text class="tide-hour-label" x="${point.x}" y="248" text-anchor="middle">${point.time.slice(11, 16)}</text>`).join("");
    container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${t("waves.chartTitle")}"><g>${grid}</g><path class="tide-area" d="${path} L${right},${bottom} L${left},${bottom} Z"/><path class="tide-line" d="${path}"/><g>${labels}</g></svg>`;
  }

  function render(data) {
    const current = data.current;
    const asValue = (value, unit, digits = 1) => Number.isFinite(value) ? `${value.toFixed(digits)} ${unit}` : t("waves.noData");
    const set = (selector, value) => {
      const element = $(selector);
      if (element) element.textContent = value;
    };
    set("[data-wave-height]", asValue(current.wave_height, "m"));
    set("[data-wave-period]", asValue(current.wave_period, "s"));
    set("[data-wave-direction]", Number.isFinite(current.wave_direction) ? `${directionName(current.wave_direction)} · ${Math.round(current.wave_direction)}°` : t("waves.noData"));
    set("[data-swell-height]", asValue(current.swell_wave_height, "m"));
    set("[data-updated]", t("waves.updated", { time: current.time.slice(11, 16) }));

    const points = data.hourly.time.map((time, index) => ({ time, value: data.hourly.wave_height[index] }))
      .filter((point, index) => Number.isFinite(point.value) && index % 2 === 0);
    renderChart(points);

    const daily = $("[data-wave-days]");
    if (daily) daily.replaceChildren(...data.daily.time.map((day, index) => {
      const card = make("article", "data-card");
      card.append(make("span", "data-card-label", index === 0 ? t("common.today") : dateLabel(day)));
      card.append(make("strong", "", Number.isFinite(data.daily.wave_height_max[index]) ? `${data.daily.wave_height_max[index].toFixed(1)} m` : t("waves.noData")));
      const period = data.daily.wave_period_max[index];
      const direction = data.daily.wave_direction_dominant[index];
      card.append(make("span", "data-card-note", t("waves.maxHeight", { period: Number.isFinite(period) ? `${Math.round(period)} s` : t("waves.noData") })));
      card.append(make("span", "data-card-note", t("waves.direction", { direction: Number.isFinite(direction) ? directionName(direction) : t("waves.noData") })));
      return card;
    }));
  }

  const query = new URLSearchParams({
    latitude,
    longitude,
    timezone,
    forecast_days: "7",
    cell_selection: "sea",
    current: "wave_height,wave_direction,wave_period,swell_wave_height",
    hourly: "wave_height,wave_direction,wave_period,swell_wave_height",
    daily: "wave_height_max,wave_direction_dominant,wave_period_max",
  });
  fetch(`https://marine-api.open-meteo.com/v1/marine?${query}`, { headers: { Accept: "application/json" } })
    .then((response) => {
      if (!response.ok) throw new Error(`El servicio respondió ${response.status}`);
      return response.json();
    })
    .then(render)
    .catch((error) => {
      console.error(error);
      const updated = $("[data-updated]");
      if (updated) updated.textContent = t("waves.updateError");
      document.querySelectorAll("[data-loading]").forEach((element) => {
        element.textContent = t("waves.loadError");
      });
    });
})();
