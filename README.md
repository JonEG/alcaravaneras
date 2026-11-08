# Las Alcaravaneras

Spanish-language weather and wind forecast for **alcaravaneras.com**.

## Live conditions

`script.js` requests current conditions, hourly forecasts for today, and a seven-day forecast from the [Open-Meteo Forecast API](https://open-meteo.com/en/docs). It also requests hourly sea-level height, including tides, from the [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api). No API key or build step is needed. Forecasts require a network connection. The marine model has limited accuracy near coasts and is not suitable for navigation; levels are relative to global mean sea level.

The nautical-map section uses OpenSeaMap base tiles and nautical markers and links to the Spanish IHM chart catalogue and Notices to Mariners. OpenSeaMap is community-maintained and is shown only as supplementary orientation; it does not replace current official nautical charts.
