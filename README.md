# Las Alcaravaneras

Information and forecasts for **www.alcaravaneras.com**, built with static HTML, CSS, and vanilla JavaScript. There is no framework or API key. Python's standard library generates the English and German static pages.

## Pages

- `index.html`: live conditions summary and links to the topical pages.
- `tiempo.html`: current weather, hourly conditions, and a seven-day forecast.
- `viento.html`: current wind, direction, gusts, hourly conditions, and a seven-day forecast.
- `mareas.html`: modeled sea level and approximate daily high and low points.
- `temperatura-agua.html`: modeled sea-surface temperature and its forecast.
- `playa.html`: beach information, the consent-gated video and Instagram embeds, and the map.
- `calidad-agua.html`, `servicios.html`, `accesibilidad-playa.html`, and `socorrismo.html`: bathing-water results, facilities, accessibility, and lifeguard information.
- `politica-de-cookies.html`: privacy and cookie information in each published language.

Topical pages share `styles.css`. Spanish routes stay at their current URLs; English routes are under `/en/` and German routes under `/de/`. All language versions share the existing live weather, wind, tide, bathing-water, video, Instagram, map and privacy-consent logic.

## Data and limitations

Weather data comes from the [Open-Meteo Forecast API](https://open-meteo.com/en/docs); marine level and sea-surface temperature come from the [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api). Forecasts require a network connection. Model values may differ from conditions on the beach. Marine level estimates have limited accuracy near coasts and are not suitable for navigation. The beach-temperature page shows a model forecast, not a measured beach-temperature history.

Bathing-water classification and sample information use the existing EEA and NÁYADE sources on `temperatura-agua.html`; the homepage links to that detail from its summary. The homepage and beach page retain the consent controls for optional third-party content.

`sitemap.xml` lists the public pages. Canonical links use `https://www.alcaravaneras.com/`.

## Languages and static page generation

Spanish remains available at the existing URLs. English pages are generated under `/en/` and German pages under `/de/`; their route names are maintained in `src/routes.json`. The Spanish HTML files remain the page templates, and language strings are stored in `src/i18n/es.json`, `src/i18n/en.json`, and `src/i18n/de.json`.

After changing a template or translation, run:

```sh
python scripts/build_i18n.py
python scripts/validate_i18n.py
```

The forecast workflow runs both commands after refreshing the Spanish live readings, then commits the translated static pages and sitemap with the updated data. New translations should use the same `strings` keys in all three JSON files; add each new page to `src/routes.json` only when an equivalent public page exists in Spanish.

The translated cookie policy is informational and has not received legal review. It should be reviewed by the site owner before being treated as final legal text.
