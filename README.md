# Las Alcaravaneras

Spanish-language weather and wind forecast for **alcaravaneras.com**. The site is plain HTML, CSS and JavaScript, so it can publish directly from the repository root on GitHub Pages.

## Live conditions

`script.js` requests current conditions, hourly forecasts for today, and a seven-day forecast from the [Open-Meteo Forecast API](https://open-meteo.com/en/docs) for Las Alcaravaneras. No API key or build step is needed. Forecasts require a network connection.

## Publish with GitHub Pages

1. Push this repository to GitHub.
2. In **Settings → Pages**, select **Deploy from a branch**, then choose `main` and `/ (root)`.
3. Keep `CNAME` in the repository root and set `alcaravaneras.com` as the custom domain in Pages settings.
4. At your DNS provider, configure the apex records using the current values in GitHub's [custom domain documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site). Optionally point `www` to your `username.github.io` hostname with a CNAME.
5. After DNS has propagated, enable **Enforce HTTPS** in Pages settings.

To preview the API-powered page locally, serve this directory with any static web server and open its local URL. Opening `index.html` directly may block the weather request in the browser.
