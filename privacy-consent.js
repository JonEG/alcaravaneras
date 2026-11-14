(() => {
  "use strict";

  const POLICY_VERSION = "2026-11-14.1";
  const CONSENT_KEY = "alcaravaneras.consent";
  const GTM_ID = "GTM-MM258425";
  const EMPTY = { preferences: false, analytics: false, marketing: false, instagram: false, youtube: false, maps: false, openstreetmap: false };
  const banner = document.getElementById("consent-banner");
  const form = document.getElementById("consent-preferences");
  let consent = readConsent();

  function readConsent() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONSENT_KEY));
      const stillValid = saved?.updatedAt && Date.now() - Date.parse(saved.updatedAt) < 180 * 24 * 60 * 60 * 1000;
      return saved?.version === POLICY_VERSION && stillValid && saved?.choices
        ? { ...EMPTY, ...saved.choices }
        : null;
    } catch {
      return null;
    }
  }

  function saveConsent(choices) {
    const previousConsent = consent;
    consent = { ...EMPTY, ...choices };
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: POLICY_VERSION, updatedAt: new Date().toISOString(), choices: consent }));
    } catch (error) {
      console.warn("No se pudo guardar la preferencia de cookies en este navegador:", error);
    }
    updateGoogleConsent();
    if (previousConsent?.analytics && !consent.analytics) removeKnownGoogleCookies(/^_(ga|gid|gat)/i);
    if (previousConsent?.marketing && !consent.marketing) removeKnownGoogleCookies(/^_(gcl_|gac_)/i);
    applyExternalChoices();
    banner.hidden = true;
    document.dispatchEvent(new CustomEvent("site-consent-change", { detail: { ...consent } }));
  }

  function consentState() {
    return {
      analytics_storage: consent?.analytics ? "granted" : "denied",
      ad_storage: consent?.marketing ? "granted" : "denied",
      ad_user_data: consent?.marketing ? "granted" : "denied",
      ad_personalization: consent?.marketing ? "granted" : "denied",
    };
  }

  function startGoogleTagManager() {
    if (window.__alcaravanerasGtmStarted) return;
    window.__alcaravanerasGtmStarted = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("consent", "update", consentState());
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

    // Standard GTM loader, deferred until an optional Google category is granted.
    if (!document.querySelector(`script[data-gtm-container="${GTM_ID}"]`)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
      script.dataset.gtmContainer = GTM_ID;
      document.head.append(script);
    }
  }

  function updateGoogleConsent() {
    if (!consent) return;
    if (!window.__alcaravanerasGtmStarted) {
      if (consent.analytics || consent.marketing) startGoogleTagManager();
    } else window.gtag("consent", "update", consentState());
  }

  function removeKnownGoogleCookies(namePattern) {
    const host = location.hostname;
    const domainOptions = [""];
    if (!/^(localhost|127\.0\.0\.1)$/.test(host)) domainOptions.push(`; domain=.${host.split(".").slice(-2).join(".")}`);
    document.cookie.split(";").forEach((entry) => {
      const name = entry.split("=")[0].trim();
      if (!namePattern.test(name)) return;
      domainOptions.forEach((domain) => {
        document.cookie = `${name}=; Max-Age=0; path=/${domain}; SameSite=Lax`;
      });
    });
  }

  function setBlocked(iframeId, placeholderId, allowed) {
    const frame = document.getElementById(iframeId);
    const placeholder = document.getElementById(placeholderId);
    if (!frame) return;
    if (allowed) {
      if (!frame.hasAttribute("src")) frame.src = frame.dataset.src;
      frame.hidden = false;
      if (placeholder) placeholder.hidden = true;
    } else {
      frame.removeAttribute("src");
      frame.hidden = true;
      if (placeholder) placeholder.hidden = false;
    }
  }

  function applyExternalChoices() {
    const choices = consent || EMPTY;
    setBlocked("map-iframe", "map-placeholder", choices.maps);
  }

  function fillForm() {
    Object.entries(consent || EMPTY).forEach(([name, checked]) => {
      const input = form.elements.namedItem(name);
      if (input) input.checked = Boolean(checked);
    });
    form.hidden = false;
    banner.querySelector("[data-consent-action='configure']").hidden = true;
  }

  function openSettings() {
    banner.hidden = false;
    fillForm();
    banner.querySelector("[data-consent-action='accept']").focus();
  }

  document.querySelectorAll(".privacy-settings-link").forEach((button) => button.addEventListener("click", openSettings));

  document.querySelectorAll("[data-open-consent]").forEach((button) => button.addEventListener("click", openSettings));
  document.querySelectorAll("[data-accept-category]").forEach((button) => button.addEventListener("click", () => {
    const category = button.dataset.acceptCategory;
    if (Object.hasOwn(EMPTY, category)) saveConsent({ ...(consent || EMPTY), [category]: true });
  }));
  document.querySelectorAll("[data-reject-category]").forEach((button) => button.addEventListener("click", () => {
    const category = button.dataset.rejectCategory;
    if (Object.hasOwn(EMPTY, category)) saveConsent({ ...(consent || EMPTY), [category]: false });
  }));
  banner.addEventListener("click", (event) => {
    const action = event.target.closest("[data-consent-action]")?.dataset.consentAction;
    if (action === "configure") fillForm();
    if (action === "accept") saveConsent(Object.fromEntries(Object.keys(EMPTY).map((key) => [key, true])));
    if (action === "reject") saveConsent(EMPTY);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveConsent(Object.fromEntries(Object.keys(EMPTY).map((key) => [key, Boolean(form.elements.namedItem(key)?.checked)])));
  });
  window.AlcaravanerasConsent = {
    has: (category) => Boolean(consent?.[category]),
    chosen: () => Boolean(consent),
    update: (category, allowed) => saveConsent({ ...(consent || EMPTY), [category]: Boolean(allowed) }),
    open: openSettings,
  };

  applyExternalChoices();
  if (!consent) banner.hidden = false;
  updateGoogleConsent();
})();
