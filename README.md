# Las Alcaravaneras

Spanish-language information and forecasts for **www.alcaravaneras.com**, built with static HTML, CSS, and JavaScript. No framework, build step, or API key is required.

## Pages

- `index.html`: live conditions summary and links to the topical pages.
- `tiempo.html`: current weather, hourly conditions, and a seven-day forecast.
- `viento.html`: current wind, direction, gusts, hourly conditions, and a seven-day forecast.
- `mareas.html`: modeled sea level and approximate daily high and low points.
- `temperatura-agua.html`: modeled sea-surface temperature and its forecast.
- `oleaje.html`: significant wave height, direction, period, and forecast.
- `playa.html`: beach information, the consent-gated video and Instagram embeds, and the map.

Topical pages share `styles.css`. The existing live weather, wind, tide, bathing-water, video, Instagram, and map components now live on their matching pages and continue to use `script.js` plus the existing `privacy-consent.js` controls. The wave page uses `js/main.js`.

## Data and limitations

Weather data comes from the [Open-Meteo Forecast API](https://open-meteo.com/en/docs); marine level, sea-surface temperature, and wave data come from the [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api). Forecasts require a network connection. Model values may differ from conditions on the beach. Marine level estimates have limited accuracy near coasts and are not suitable for navigation. The beach-temperature page shows a model forecast, not a measured beach-temperature history.

Bathing-water classification and sample information use the existing EEA and NÁYADE sources on `temperatura-agua.html`; the homepage links to that detail from its summary. The homepage and beach page retain the consent controls for optional third-party content.

`sitemap.xml` lists the public pages. Canonical links use `https://www.alcaravaneras.com/`.
