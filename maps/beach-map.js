(function () {
  "use strict";

  const mapElement = document.getElementById("alcaravaneras-beach-map");
  if (!mapElement || !window.L) return;

  const language = document.documentElement.lang.toLowerCase().startsWith("en") ? "en" : "es";
  const labels = {
    es: { safety: "Seguridad", accessibility: "Accesibilidad", facilities: "Servicios", family: "Parque", sports: "Deportes", water: "Actividades acuáticas", approximate: "Ubicación aproximada", osmSource: "Geometría de OpenStreetMap", tileError: "No se pudieron cargar algunos mosaicos del mapa. Comprueba tu conexión o inténtalo más tarde.", dataError: "No se pudo cargar la información del mapa.", fullscreen: "Pantalla completa", exitFullscreen: "Salir de pantalla completa", mapTitle: "Mapa interactivo de servicios de la playa de Las Alcaravaneras", zones: { beach: "Arenal", beachvolleyball: "Vóley playa", canoeing: "Piragüismo" } },
    en: { safety: "Safety", accessibility: "Accessibility", facilities: "Facilities", family: "Park", sports: "Sports", water: "Water activities", approximate: "Approximate location", osmSource: "OpenStreetMap geometry", tileError: "Some map tiles could not be loaded. Check your connection or try again later.", dataError: "Map information could not be loaded.", fullscreen: "Fullscreen", exitFullscreen: "Exit fullscreen", zones: { beach: "Beach", beachvolleyball: "Beach volleyball", canoeing: "Canoeing" } }
  }[language];

  // Switch this URL to another OSM-compatible provider when needed. Keep that provider's attribution and usage policy.
  const tileUrl = window.ALCARAVANERAS_MAP_TILE_URL || mapElement.dataset.tileUrl || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const colors = { beach: "#f5d33b", beachvolleyball: "#ea904b", canoeing: "#00a9d6" };
  const categoryIcon = {
    rescue: "<path d='M9 3h6v6h6v6h-6v6H9v-6H3V9h6z' fill='currentColor' stroke='none'/>",
    access: "<circle cx='14' cy='4' r='2.2'/><circle cx='7.5' cy='16.5' r='4.8'/><path d='m12 7-2 5h6l2.5 4.5H22M11 9l4 1.2 1.7 3.1M10 12h6'/>",
    assist: "<circle cx='9.5' cy='3.8' r='2'/><circle cx='6.7' cy='14.2' r='3.8'/><path d='m9 6.5-1.4 4.7h5l2 3.5h2.7M8.5 8.5l4 1.1 1.5 2.6M14 17.2c1.1-.8 2.2-.8 3.3 0s2.2.8 3.3 0M14 20.5c1.1-.8 2.2-.8 3.3 0s2.2.8 3.3 0'/>",
    toilet: "<circle cx='6.5' cy='4' r='1.8'/><circle cx='17.5' cy='4' r='1.8'/><path d='M6.5 7v6m0-4-3 3m3-3 3 3m-3 1-2.5 6m2.5-6 2.5 6M17.5 7v4m0 0-3 6h6l-3-6m0 1v5m-2.5 4 2.5-4 2.5 4'/>",
    shower: "<path d='M4 8a8 8 0 0 1 16 0M12 8v2'/><path d='M8 14v1m4-1v1m4-1v1m-8 4v1m4-1v1m4-1v1'/>",
    playground: "<path d='M3.5 20 7.2 8M8 20l3.7-12M5.2 14.5h3.3M6.1 12h3.3M7.2 8H17v3M17 11c0 3.2 1.3 6 4.5 9M15.2 13c.2 2.5 1.1 4.8 3 7M18 20h4'/>",
    sports: "<circle cx='12' cy='12' r='9'/><path d='M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18'/>",
    swim: "<path d='M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0'/><circle cx='15' cy='7' r='2'/><path d='m13 9-3 3 3 1 3-2 3 1'/>",
    dive: "<circle cx='12' cy='7' r='2'/><path d='m10 10-3 3 4 2 3-2 3 1M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0'/>",
    kayak: "<path d='M3 15c2-4 16-4 18 0-2 4-16 4-18 0Z'/><path d='m8 8 8 9m0-9-8 9'/><path d='M3 20c2-1 4-1 6 0m6 0c2-1 4-1 6 0'/>",
  };

  function svgIcon(key, className) {
    const paths = categoryIcon[key] || categoryIcon.rescue;
    return '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + "</svg>";
  }
  const filterIcons = { safety: ["rescue"], accessibility: ["access", "assist"], facilities: ["toilet", "shower"], family: ["playground"], sports: ["sports"], water: ["swim", "dive", "kayak"] };
  document.querySelectorAll("[data-facility-filter]").forEach((input) => {
    const iconStrip = input.parentElement.querySelector(".beach-map-filter-icons");
    if (iconStrip) iconStrip.innerHTML = (filterIcons[input.dataset.facilityFilter] || []).map((icon) => '<span class="beach-map-legend-icon icon-' + escapeHtml(icon) + '">' + svgIcon(icon, "") + "</span>").join("");
  });
  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }
  function textFor(value) {
    return typeof value === "string" ? value : (value && (value[language] || value.es || value.en)) || "";
  }
  function categoryName(category) {
    return labels[category] || labels.water;
  }

  const map = L.map(mapElement, { center: [28.1310, -15.428721], zoom: 17, scrollWheelZoom: false, zoomControl: true, attributionControl: true });
  L.tileLayer(tileUrl, {
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    crossOrigin: true,
  }).addTo(map).on("tileerror", function () {
    document.getElementById("beach-map-status").textContent = labels.tileError;
  });

  const categoryLayers = {};
  const zoneLayers = {};

  function pointMarker(feature, latlng) {
    const properties = feature.properties || {};
    const title = textFor(properties.name);
    const description = textFor(properties.description);
    const approximate = properties.accuracy === "approximate";
    const markerIcon = L.divIcon({ className: "", html: '<span class="facility-marker category-' + escapeHtml(properties.category) + ' icon-' + escapeHtml(properties.icon) + '">' + svgIcon(properties.icon, "") + "</span>", iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -17] });
    const marker = L.marker(latlng, { icon: markerIcon, title: title, alt: title, keyboard: true });
    marker.bindPopup('<p class="beach-popup-category">' + escapeHtml(categoryName(properties.category)) + '</p><h3 class="beach-popup-title">' + escapeHtml(title) + '</h3><p class="beach-popup-description">' + escapeHtml(description) + (approximate ? '</p><span class="beach-popup-approx">' + escapeHtml(labels.approximate) + "</span>" : "</p>"), { minWidth: 190, maxWidth: 270, closeButton: true, autoPanPadding: [20, 25] });
    if (!categoryLayers[properties.category]) {
      categoryLayers[properties.category] = L.featureGroup();
      const filter = document.querySelector('[data-facility-filter="' + properties.category + '"]');
      if (!filter || filter.checked) categoryLayers[properties.category].addTo(map);
    }
    categoryLayers[properties.category].addLayer(marker);
    return marker;
  }

  fetch("data/beach-facilities.geojson")
    .then((response) => { if (!response.ok) throw new Error("facilities"); return response.json(); })
    .then((data) => data.features.forEach((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      pointMarker(feature, L.latLng(latitude, longitude));
    }))
    .catch(() => { document.getElementById("beach-map-status").textContent = labels.dataError; });

  fetch("data/beach-zones.geojson")
    .then((response) => { if (!response.ok) throw new Error("zones"); return response.json(); })
    .then((data) => {
      L.geoJSON(data, {
        style: (feature) => {
          const zone = feature.properties.zone;
          const approximate = feature.properties.accuracy === "approximate";
          return { color: colors[zone] || "#07558a", weight: zone === "beach" ? 2 : 1.5, opacity: .95, fillColor: colors[zone] || "#07558a", fillOpacity: approximate ? .14 : zone === "beach" ? .18 : .32, dashArray: approximate ? "5 4" : null };
        },
        onEachFeature: (feature, layer) => {
          const properties = feature.properties || {};
          const sourceNote = properties.accuracy === "mapped_osm" ? labels.osmSource : labels.approximate;
          layer.bindPopup('<h3 class="beach-popup-title">' + escapeHtml(textFor(properties.name)) + '</h3><p class="beach-popup-description">' + escapeHtml(sourceNote) + "</p>");
          zoneLayers[properties.zone] = layer;
          const filter = document.querySelector('[data-zone-filter="' + properties.zone + '"]');
          if (!filter || filter.checked) layer.addTo(map);
        },
      });
    })
    .catch(() => { document.getElementById("beach-map-status").textContent = labels.dataError; });

  document.querySelectorAll("[data-facility-filter]").forEach((input) => {
    input.addEventListener("change", () => {
      const category = input.dataset.facilityFilter;
      if (input.checked) map.addLayer(markerLayerFor(category));
      else if (categoryLayers[category]) map.removeLayer(categoryLayers[category]);
    });
  });
  function markerLayerFor(category) {
    if (!categoryLayers[category]) categoryLayers[category] = L.featureGroup();
    return categoryLayers[category];
  }
  document.querySelectorAll("[data-zone-filter]").forEach((input) => {
    input.addEventListener("change", () => {
      const layer = zoneLayers[input.dataset.zoneFilter];
      if (layer) input.checked ? layer.addTo(map) : map.removeLayer(layer);
    });
  });

  const fullscreenButton = document.getElementById("beach-map-fullscreen");
  const shell = document.getElementById("beach-map-shell");
  function updateFullscreenButton() {
    const full = document.fullscreenElement === shell || shell.classList.contains("is-fullscreen-fallback");
    fullscreenButton.textContent = full ? labels.exitFullscreen : labels.fullscreen;
    fullscreenButton.setAttribute("aria-label", fullscreenButton.textContent);
    window.setTimeout(() => map.invalidateSize(), 80);
  }
  fullscreenButton.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement === shell) await document.exitFullscreen();
      else if (shell.requestFullscreen) await shell.requestFullscreen();
      else shell.classList.toggle("is-fullscreen-fallback");
    } catch (error) {
      shell.classList.toggle("is-fullscreen-fallback");
    }
    updateFullscreenButton();
  });
  document.addEventListener("fullscreenchange", updateFullscreenButton);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && shell.classList.contains("is-fullscreen-fallback")) {
      shell.classList.remove("is-fullscreen-fallback");
      updateFullscreenButton();
      window.setTimeout(() => map.invalidateSize(), 80);
    }
  });
  window.addEventListener("resize", () => map.invalidateSize({ debounceMoveend: true }));
  window.setTimeout(() => map.invalidateSize(), 250);
})();
