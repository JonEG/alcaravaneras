#!/usr/bin/env python3
"""Render translated, crawlable pages from the Spanish HTML and JSON dictionaries."""

from __future__ import annotations

import json
import re
from datetime import date
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://www.alcaravaneras.com"
ROUTES = json.loads((ROOT / "src/routes.json").read_text(encoding="utf-8"))["pages"]
LANGUAGES = ("es", "en", "de")
LOCALIZED_FILES = {
    "assets": ("assets",),
    "styles.css": ("styles.css",),
    "script.js": ("script.js",),
    "privacy-consent.js": ("privacy-consent.js",),
    "breadcrumbs.js": ("breadcrumbs.js",),
    "maps": ("maps",),
    "js": ("js",),
    "data": ("data",),
    "socorrismo.css": ("socorrismo.css",),
}


def destination(source: str, language: str) -> str:
    return "/" if source == "index.html" else f"/{ROUTES[source][language]}" if language != "es" else f"/{source}"


def route_path(source: str, language: str) -> str:
    if language == "es":
        return "/" if source == "index.html" else f"/{source}"
    path = ROUTES[source][language]
    return f"/{language}/" if path == "index.html" else f"/{language}/{path}"


class PageRenderer(HTMLParser):
    def __init__(self, page: str, language: str, strings: dict[str, str]):
        super().__init__(convert_charrefs=False)
        self.page = page
        self.language = language
        self.strings = strings
        self.parts: list[str] = []

    def _attrs(self, attrs: list[tuple[str, str | None]]) -> str:
        rendered = []
        has_main_landmark_label = False
        for name, value in attrs:
            if value is not None:
                if name == "id" and value == "contenido":
                    has_main_landmark_label = True
                if name in {"alt", "title", "aria-label", "placeholder"}:
                    value = self.strings.get(value, value)
                if name in {"href", "src", "action"}:
                    value = self._local_url(value)
                rendered.append(f' {name}="{escape(value, quote=True)}"')
            else:
                rendered.append(f" {name}")
        if has_main_landmark_label and not any(name == "aria-label" for name, _ in attrs):
            label = self.strings.get("Contenido principal", "Main content")
            rendered.append(f' aria-label="{escape(label, quote=True)}"')
        return "".join(rendered)

    def _local_url(self, value: str) -> str:
        if value.startswith(("//", "http:", "https:", "mailto:", "tel:", "data:")):
            return value
        parsed = urlsplit(value)
        path = parsed.path.lstrip("/")
        if not path or path == "index.html":
            mapped = route_path("index.html", self.language)
            return mapped + (("?" + parsed.query) if parsed.query else "") + (("#" + parsed.fragment) if parsed.fragment else "")
        if path in ROUTES:
            mapped = route_path(path, self.language)
            return mapped + (("?" + parsed.query) if parsed.query else "") + (("#" + parsed.fragment) if parsed.fragment else "")
        return "/" + path + (("?" + parsed.query) if parsed.query else "") + (("#" + parsed.fragment) if parsed.fragment else "")

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs = list(attrs)
        if tag == "html":
            attrs = [(k, self.language if k == "lang" else v) for k, v in attrs]
        self.parts.append(f"<{tag}{self._attrs(attrs)}>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.parts.append(f"<{tag}{self._attrs(attrs)} />")

    def handle_endtag(self, tag: str) -> None:
        self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        key = data.strip()
        translated = self.strings.get(key)
        if translated is None:
            self.parts.append(data)
            return
        left = data[: len(data) - len(data.lstrip())]
        right = data[len(data.rstrip()):]
        self.parts.append(left + escape(translated, quote=False) + right)

    def handle_entityref(self, name: str) -> None:
        self.parts.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self.parts.append(f"&#{name};")

    def handle_comment(self, data: str) -> None:
        self.parts.append(f"<!--{data}-->")


def set_meta(html: str, pattern: str, replacement: str) -> str:
    return re.sub(pattern, replacement, html, count=1, flags=re.I | re.S)


def render(source: str, page: str, language: str, dictionary: dict) -> str:
    parser = PageRenderer(page, language, dictionary["strings"])
    parser.feed(source)
    html = "".join(parser.parts)
    if page == "historia/origen-nombre-playa-alcaravaneras.html":
        html = re.sub(r"(?m)^[ \t]+(?=\r?$)", "", html)
    structured = dictionary.get("structured", {})
    if page == "playa.html" and structured:
        html = html.replace('"name": "Playa de Las Alcaravaneras"', '"name": ' + json.dumps(structured["beach_name"], ensure_ascii=False))
        html = html.replace('"description": "Playa urbana de Las Palmas de Gran Canaria, con información meteorológica y marítima para consultar sus condiciones."', '"description": ' + json.dumps(structured["beach_description"], ensure_ascii=False))
        html = html.replace('"url": "https://www.alcaravaneras.com/playa.html"', '"url": ' + json.dumps(BASE_URL + route_path(page, language)))
    title = dictionary["seo"][page]["title"]
    description = (
        re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html, re.I).group(1)
        if language == "es"
        else dictionary["seo"][page]["description"]
    )
    canonical = BASE_URL + route_path(page, language)
    html = set_meta(html, r"<title>.*?</title>", f"<title>{escape(title)}</title>")
    html = set_meta(html, r'(<meta\s+name="description"\s+content=")[^"]*(")', rf'\g<1>{escape(description, quote=True)}\2')
    html = set_meta(html, r'(<meta\s+property="og:title"\s+content=")[^"]*(")', rf'\g<1>{escape(title, quote=True)}\2')
    html = set_meta(html, r'(<meta\s+property="og:description"\s+content=")[^"]*(")', rf'\g<1>{escape(description, quote=True)}\2')
    html = set_meta(html, r'(<meta\s+property="og:url"\s+content=")[^"]*(")', rf'\g<1>{canonical}\2')
    html = set_meta(html, r'(<meta\s+name="twitter:title"\s+content=")[^"]*(")', rf'\g<1>{escape(title, quote=True)}\2')
    html = set_meta(html, r'(<meta\s+name="twitter:description"\s+content=")[^"]*(")', rf'\g<1>{escape(description, quote=True)}\2')
    if structured.get("image_alt"):
        html = set_meta(html, r'(<meta\s+property="og:image:alt"\s+content=")[^"]*(")', rf'\g<1>{escape(structured["image_alt"], quote=True)}\2')
    if page == "historia/origen-nombre-playa-alcaravaneras.html":
        image_url = "https://www.fotosantiguascanarias.org/oaistore/srvimg/img102/00007001_00007500/00007451/guarda/00007451_0001.jpg"
        image_alt = dictionary["strings"].get("Arenales de Santa Catalina, fotografía histórica de Luis Ojeda Pérez", "Arenales en Santa Catalina")
        html = set_meta(html, r'(<meta\s+property="og:image:alt"\s+content=")[^"]*(")', rf'\g<1>{escape(image_alt, quote=True)}\2')
        heading = re.search(r"<h1\b[^>]*>(.*?)</h1>", html, re.I | re.S)
        headline = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", heading.group(1))).strip() if heading else title
        article_schema = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": headline,
            "description": description,
            "image": [image_url],
            "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
            "inLanguage": dictionary["locale"],
            "publisher": {"@type": "Organization", "name": "Las Alcaravaneras", "url": BASE_URL},
        }
        schema_script = '<script type="application/ld+json">' + json.dumps(article_schema, ensure_ascii=False).replace("</", "<\\/") + "</script>"
        schema_pattern = r'<script\s+type="application/ld\+json">.*?</script>'
        if re.search(schema_pattern, html, re.I | re.S):
            html = re.sub(schema_pattern, schema_script, html, count=1, flags=re.I | re.S)
        else:
            html = html.replace("</head>", schema_script + "</head>", 1)
    canonical_link = f'<link rel="canonical" href="{canonical}">'
    alternates = "".join(f'<link rel="alternate" hreflang="{lang}" href="{BASE_URL + route_path(page, lang)}">' for lang in LANGUAGES)
    alternates += f'<link rel="alternate" hreflang="x-default" href="{BASE_URL + route_path(page, "es")}">'
    html = re.sub(r'<link\s+rel="canonical"[^>]*>', canonical_link, html, count=1, flags=re.I)
    html = html.replace("</head>", f"{alternates}</head>", 1)
    spanish_dictionary = json.loads((ROOT / "src/i18n/es.json").read_text(encoding="utf-8"))
    inline_i18n = json.dumps({"locale": dictionary["locale"], "runtime": dictionary.get("runtime", {}), "fallback": spanish_dictionary.get("runtime", {})}, ensure_ascii=False).replace("</", "<\\/")
    html = html.replace("<head>", f'<head><script id="site-translations" type="application/json">{inline_i18n}</script><script src="/js/i18n.js" defer></script>', 1)
    locale = {"es": "es_ES", "en": "en_GB", "de": "de_DE"}[language]
    html = set_meta(html, r'(<meta\s+property="og:locale"\s+content=")[^"]*(")', rf"\g<1>{locale}\2")
    site_nav = html.find('id="site-nav"')
    if site_nav >= 0:
        close = html.find("</nav>", site_nav)
        if close >= 0:
            choices = []
            for lang, label in (("es", "ES"), ("en", "EN"), ("de", "DE")):
                href = route_path(page, lang)
                current = ' aria-current="page"' if lang == language else ""
                choices.append(f'<a href="{href}" lang="{lang}" hreflang="{lang}"{current}>{label}</a>')
            picker = f'<div class="language-switch" role="group" aria-label="{escape(dictionary["strings"].get("Language", "Language"), quote=True)}">{" ".join(choices)}</div>'
            html = html[:close] + picker + html[close:]
    else:
        choices = []
        for lang, label in (("es", "ES"), ("en", "EN"), ("de", "DE")):
            href = route_path(page, lang)
            current = ' aria-current="page"' if lang == language else ""
            choices.append(f'<a href="{href}" lang="{lang}" hreflang="{lang}"{current}>{label}</a>')
        picker = f'<nav class="language-switch language-switch-standalone" aria-label="{escape(dictionary["strings"].get("Language", "Language"), quote=True)}">{" ".join(choices)}</nav>'
        html = re.sub(r"(<main\b[^>]*>)", lambda match: match.group(1) + picker, html, count=1, flags=re.I)
    html = html.replace("</body>", '<script src="/js/language-switch.js" defer></script></body>', 1)
    return html


def update_sitemap() -> None:
    ns = "http://www.sitemaps.org/schemas/sitemap/0.9"
    xhtml = "http://www.w3.org/1999/xhtml"
    ET.register_namespace("", ns)
    ET.register_namespace("xhtml", xhtml)
    root = ET.Element(f"{{{ns}}}urlset")
    for page in ROUTES:
        for language in LANGUAGES:
            url = ET.SubElement(root, f"{{{ns}}}url")
            loc = ET.SubElement(url, f"{{{ns}}}loc")
            loc.text = BASE_URL + route_path(page, language)
            lastmod = ET.SubElement(url, f"{{{ns}}}lastmod")
            lastmod.text = date.today().isoformat()
            for alternate in LANGUAGES:
                link = ET.SubElement(url, f"{{{xhtml}}}link", {"rel": "alternate", "hreflang": alternate, "href": BASE_URL + route_path(page, alternate)})
            ET.SubElement(url, f"{{{xhtml}}}link", {"rel": "alternate", "hreflang": "x-default", "href": BASE_URL + route_path(page, "es")})
    ET.ElementTree(root).write(ROOT / "sitemap.xml", encoding="utf-8", xml_declaration=True)


def main() -> None:
    dictionaries = {lang: json.loads((ROOT / f"src/i18n/{lang}.json").read_text(encoding="utf-8")) for lang in LANGUAGES}
    for page in ROUTES:
        source = (ROOT / page).read_text(encoding="utf-8")
        source = re.sub(r'<(?P<tag>div|nav)\b(?=[^>]*\bclass="[^"]*\blanguage-switch)[^>]*>.*?</(?P=tag)\s*>', "", source, flags=re.S)
        source = re.sub(r'<script src="/js/language-switch\.js" defer></script>', "", source)
        source = re.sub(r'<script id="site-translations" type="application/json">.*?</script>', "", source, flags=re.S)
        source = re.sub(r'<script src="/js/i18n\.js" defer></script>', "", source)
        source = re.sub(r'<link rel="alternate"[^>]*>', "", source)
        (ROOT / page).write_text(render(source, page, "es", dictionaries["es"]), encoding="utf-8")
        for language in ("en", "de"):
            target = ROOT / language / ROUTES[page][language]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(render(source, page, language, dictionaries[language]), encoding="utf-8")
    update_sitemap()
    print(f"Generated {len(ROUTES)} Spanish source pages and {len(ROUTES) * 2} localized static pages.")


if __name__ == "__main__":
    main()
