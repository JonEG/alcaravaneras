(() => {
  "use strict";

  const siteRoot = "https://alcaravaneras.com";
  const routes = {
    beach: [
      { label: "Inicio", path: "/" },
      { label: "La playa", path: "/playa.html" },
    ],
    "beach-services": [
      { label: "Inicio", path: "/" },
      { label: "Servicios", path: "/servicios.html" },
    ],
    accessibility: [
      { label: "Inicio", path: "/" },
      { label: "Servicios", path: "/servicios.html" },
      { label: "Accesibilidad", path: "/accesibilidad-playa.html" },
    ],
    lifeguard: [
      { label: "Inicio", path: "/" },
      { label: "Servicios", path: "/servicios.html" },
      { label: "Socorrismo", path: "/socorrismo.html" },
    ],
    weather: [
      { label: "Inicio", path: "/" },
      { label: "Condiciones de la playa", structured: false },
      { label: "Tiempo", path: "/tiempo.html" },
    ],
    wind: [
      { label: "Inicio", path: "/" },
      { label: "Condiciones de la playa", structured: false },
      { label: "Viento", path: "/viento.html" },
    ],
    tide: [
      { label: "Inicio", path: "/" },
      { label: "Condiciones de la playa", structured: false },
      { label: "Mareas", path: "/mareas.html" },
    ],
    water: [
      { label: "Inicio", path: "/" },
      { label: "Condiciones de la playa", structured: false },
      { label: "Temperatura del agua", path: "/temperatura-agua.html" },
    ],
    "water-quality": [
      { label: "Inicio", path: "/" },
      { label: "Condiciones de la playa", structured: false },
      { label: "Calidad del agua", path: "/calidad-agua.html" },
    ],
  };

  const items = routes[document.body.dataset.page];
  const main = document.querySelector("main");
  if (!items || !main || main.querySelector(":scope > .page-breadcrumbs")) return;

  const nav = document.createElement("nav");
  nav.className = "page-breadcrumbs";
  nav.setAttribute("aria-label", "Migas de pan");
  const list = document.createElement("ol");

  items.forEach((item, index) => {
    const entry = document.createElement("li");
    const isCurrent = index === items.length - 1;
    if (isCurrent) {
      const current = document.createElement("span");
      current.setAttribute("aria-current", "page");
      current.textContent = item.label;
      entry.append(current);
    } else if (item.path) {
      const link = document.createElement("a");
      link.href = item.path;
      link.textContent = item.label;
      entry.append(link);
    } else {
      entry.textContent = item.label;
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
      name: item.label,
      item: `${siteRoot}${item.path}`,
    })),
  };
  const schema = document.createElement("script");
  schema.type = "application/ld+json";
  schema.dataset.generatedBreadcrumbs = "true";
  schema.textContent = JSON.stringify(breadcrumbSchema);
  document.head.append(schema);
})();
