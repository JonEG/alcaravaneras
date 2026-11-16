(() => {
  "use strict";
  const query = window.location.search;
  document.querySelectorAll(".language-switch a").forEach((link) => {
    if (query && !new URL(link.href).search) link.href += query;
    link.addEventListener("click", () => {
      try { localStorage.setItem("alcaravaneras.language", link.lang || "es"); } catch { /* preference is optional */ }
    });
  });
})();
