(() => {
  "use strict";

  const siteRoot = "https://www.alcaravaneras.com";
  const language = document.documentElement.lang || "es";
  const translate = window.t || ((key) => key);
  const pagePaths = {
    "index.html": { es: "/", en: "/en/", de: "/de/" },
    "playa.html": { es: "/playa.html", en: "/en/beach.html", de: "/de/strand.html" },
    "servicios.html": { es: "/servicios.html", en: "/en/services.html", de: "/de/service.html" },
    "accesibilidad-playa.html": { es: "/accesibilidad-playa.html", en: "/en/beach-accessibility.html", de: "/de/barrierefreiheit.html" },
    "socorrismo.html": { es: "/socorrismo.html", en: "/en/lifeguards.html", de: "/de/rettungsschwimmer.html" },
    "tiempo.html": { es: "/tiempo.html", en: "/en/weather.html", de: "/de/wetter.html" },
    "viento.html": { es: "/viento.html", en: "/en/wind.html", de: "/de/wind.html" },
    "mareas.html": { es: "/mareas.html", en: "/en/tides.html", de: "/de/gezeiten.html" },
    "temperatura-agua.html": { es: "/temperatura-agua.html", en: "/en/water-temperature.html", de: "/de/wassertemperatur.html" },
    "calidad-agua.html": { es: "/calidad-agua.html", en: "/en/water-quality.html", de: "/de/wasserqualitaet.html" },
  };
  const routes = {
    beach: [
      { label: "crumb.home", path: "index.html" },
      { label: "crumb.beach", path: "playa.html" },
    ],
    "beach-services": [
      { label: "crumb.home", path: "index.html" },
      { label: "crumb.services", path: "servicios.html" },
    ],
    accessibility: [
      { label: "crumb.home", path: "index.html" },
      { label: "crumb.services", path: "servicios.html" },
      { label: "crumb.accessibility", path: "accesibilidad-playa.html" },
    ],
    lifeguard: [
      { label: "crumb.home", path: "index.html" },
      { label: "crumb.services", path: "servicios.html" },
      { label: "crumb.lifeguards", path: "socorrismo.html" },
    ],
    weather: [
      { label: "crumb.home", path: "index.html" },
      { label: "crumb.conditions", structured: false },
      { label: "crumb.weather", path: "tiempo.html" },
    ],
    wind: [
      { label: "crumb.home", path: "index.html" },
      { label: "crumb.conditions", structured: false },
      { label: "crumb.wind", path: "viento.html" },
    ],
    tide: [
      { label: "crumb.home", path: "index.html" },
      { label: "crumb.conditions", structured: false },
      { label: "crumb.tides", path: "mareas.html" },
    ],
    water: [
      { label: "crumb.home", path: "index.html" },
      { label: "crumb.conditions", structured: false },
      { label: "crumb.waterTemperature", path: "temperatura-agua.html" },
    ],
    "water-quality": [
      { label: "crumb.home", path: "index.html" },
      { label: "crumb.conditions", structured: false },
      { label: "crumb.waterQuality", path: "calidad-agua.html" },
    ],
  };

  const items = routes[document.body.dataset.page];
  const main = document.querySelector("main");
  if (!items || !main || main.querySelector(":scope > .page-breadcrumbs")) return;

  const nav = document.createElement("nav");
  nav.className = "page-breadcrumbs";
  nav.setAttribute("aria-label", translate("crumb.label"));
  const list = document.createElement("ol");

  items.forEach((item, index) => {
    const entry = document.createElement("li");
    const isCurrent = index === items.length - 1;
    if (isCurrent) {
      const current = document.createElement("span");
      current.setAttribute("aria-current", "page");
      current.textContent = translate(item.label);
      entry.append(current);
    } else if (item.path) {
      const link = document.createElement("a");
      link.href = pagePaths[item.path]?.[language] || "/";
      link.textContent = translate(item.label);
      entry.append(link);
    } else {
      entry.textContent = translate(item.label);
    }

    if (index > 0) {
      const separator = document.createElement("span");
      separator.className = "breadcrumb-separator";
      separator.setAttribute("aria-hidden", "true");
      separator.textContent = "›";
      entry.prepend(separator);
    }
    list.append(entry);
  });

  nav.append(list);
  main.prepend(nav);

  const schemaItems = items.filter((item) => item.structured !== false);
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: schemaItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: translate(item.label),
      item: `${siteRoot}${pagePaths[item.path]?.[language] || "/"}`,
    })),
  };
  const schema = document.createElement("script");
  schema.type = "application/ld+json";
  schema.dataset.generatedBreadcrumbs = "true";
  schema.textContent = JSON.stringify(breadcrumbSchema);
  document.head.append(schema);
})();
