(() => {
  "use strict";
  const payload = document.getElementById("site-translations");
  const messages = payload ? JSON.parse(payload.textContent) : { runtime: {} };
  window.t = (key, variables = {}) => {
    const template = messages.runtime?.[key] ?? messages.fallback?.[key];
    if (typeof template !== "string") {
      if (location.hostname === "localhost" || location.hostname === "127.0.0.1") console.warn(`Missing i18n key: ${key}`);
      return key;
    }
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => String(variables[name] ?? `{${name}}`));
  };
  window.AlcaravanerasI18n = { locale: messages.locale, language: document.documentElement.lang, t: window.t };
})();
