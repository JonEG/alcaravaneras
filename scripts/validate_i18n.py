#!/usr/bin/env python3
"""Check localization dictionaries, routes, SEO links and generated assets."""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://www.alcaravaneras.com"
routes = json.loads((ROOT / "src/routes.json").read_text(encoding="utf-8"))["pages"]
errors: list[str] = []


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.attrs: list[dict[str, str]] = []

    def handle_starttag(self, tag, attrs):
        self.attrs.append({key: value or "" for key, value in attrs})


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.nodes: list[str] = []
        self.ignored = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.ignored += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self.ignored:
            self.ignored -= 1

    def handle_data(self, data):
        value = data.strip()
        if value and not self.ignored:
            self.nodes.append(value)


dicts = {lang: json.loads((ROOT / f"src/i18n/{lang}.json").read_text(encoding="utf-8")) for lang in ("es", "en", "de")}
source_text = set()
for page in routes:
    source_page = VisibleText()
    source_page.feed((ROOT / page).read_text(encoding="utf-8"))
    source_text.update(source_page.nodes)
unchanged_terms = {
    "Las Alcaravaneras", "Las Palmas de Gran Canaria", "OpenStreetMap · Las Palmas de Gran Canaria",
    "E. coli", "Facebook / Meta", "Google Maps", "Instagram / Meta", "YouTube", "NÁYADE",
    "Open-Meteo", "Open-Meteo Marine Weather API", "OpenStreetMap", "alcaravaneras.consent",
    "iframe", "instagram.com/embed.js", "youtube-nocookie.com", "GTM-MM258425",
}
for lang in ("es", "en", "de"):
    for page, filename in routes.items():
        path = ROOT / page if lang == "es" else ROOT / lang / filename[lang]
        if not path.is_file():
            errors.append(f"Missing localized page: {path.relative_to(ROOT)}")
            continue
        html = path.read_text(encoding="utf-8")
        visible = VisibleText(); visible.feed(html)
        if lang != "es":
            for text in set(visible.nodes) & source_text:
                if text not in unchanged_terms and re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]{4}", text):
                    errors.append(f"Untranslated static text in {path.relative_to(ROOT)}: {text[:90]}")
        parser = Links(); parser.feed(html)
        attrs = parser.attrs
        html_lang = re.search(r"<html[^>]*\blang=\"([^\"]+)", html)
        if not html_lang or html_lang.group(1) != lang:
            errors.append(f"Wrong lang attribute: {path.relative_to(ROOT)}")
        canonicals = [a.get("href") for a in attrs if a.get("rel") == "canonical"]
        expected = BASE_URL + (("/" if page == "index.html" else f"/{page}") if lang == "es" else (f"/{lang}/" if filename[lang] == "index.html" else f"/{lang}/{filename[lang]}"))
        if canonicals != [expected]:
            errors.append(f"Canonical is not self-referencing: {path.relative_to(ROOT)}")
        alternates = {a.get("hreflang"): a.get("href") for a in attrs if a.get("rel") == "alternate"}
        for target_lang in ("es", "en", "de", "x-default"):
            if target_lang not in alternates:
                errors.append(f"Missing {target_lang} hreflang: {path.relative_to(ROOT)}")
        expected_alternates = {
            "es": BASE_URL + ("/" if page == "index.html" else f"/{page}"),
            "en": BASE_URL + ("/en/" if routes[page]["en"] == "index.html" else f"/en/{routes[page]['en']}"),
            "de": BASE_URL + ("/de/" if routes[page]["de"] == "index.html" else f"/de/{routes[page]['de']}"),
            "x-default": BASE_URL + ("/" if page == "index.html" else f"/{page}"),
        }
        if alternates != expected_alternates:
            errors.append(f"Hreflang routes do not match the page equivalents: {path.relative_to(ROOT)}")
        if "oleaje.html" in html:
            errors.append(f"Forbidden wave page reference: {path.relative_to(ROOT)}")
        for a in attrs:
            value = a.get("href") or a.get("src")
            if value and value.startswith("/") and not value.startswith("//"):
                local = ROOT / urlsplit(value).path.lstrip("/")
                if not local.exists():
                    errors.append(f"Broken local resource {value} in {path.relative_to(ROOT)}")
        picker = [a for a in attrs if a.get("hreflang") in {"es", "en", "de"} and a.get("aria-current") == "page"]
        choices = [a for a in attrs if a.get("hreflang") in {"es", "en", "de"} and a.get("href", "").startswith(BASE_URL)]
        if len(picker) != 1 or len(choices) < 3:
            errors.append(f"Language switch is incomplete: {path.relative_to(ROOT)}")
        if not re.search(r"<h1\b[^>]*>\s*[^<]+", html, re.I):
            errors.append(f"Missing static H1: {path.relative_to(ROOT)}")
        seo = dicts[lang].get("seo", {}).get(page, {})
        if not seo.get("title") or not seo.get("description") or f"<title>{seo.get('title')}</title>" not in html:
            errors.append(f"Missing localized SEO title or description: {path.relative_to(ROOT)}")

    es_keys = set(dicts["es"].get("strings", {}))
    shared_german_english = {
        "Wind", "Park", "Wind · Las Palmas de Gran Canaria", "Google Maps", "OpenStreetMap", "Instagram / Meta",
        "Facebook / Meta", "YouTube", "ES", "EN", "DE",
        "Las Palmas de Gran Canaria", "Las Alcaravaneras", "NÁYADE",
        "OpenStreetMap · Las Palmas de Gran Canaria",
    }
    for other in ("en", "de"):
        if set(dicts[other].get("strings", {})) != es_keys:
            errors.append(f"Translation key mismatch: es.json and {other}.json")
        if any(not value.strip() for value in dicts[other].get("strings", {}).values()):
            errors.append(f"Empty translation in {other}.json")
        for section in ("runtime", "seo"):
            if set(dicts[other].get(section, {})) != set(dicts["es"].get(section, {})):
                errors.append(f"{section} key mismatch: es.json and {other}.json")
    for key, value in dicts["de"].get("strings", {}).items():
        if value == dicts["en"].get("strings", {}).get(key) and value not in shared_german_english:
            errors.append(f"German translation matches English for source text: {key}")
    for key, value in dicts["de"].get("runtime", {}).items():
        if value == dicts["en"].get("runtime", {}).get(key) and value not in shared_german_english:
            errors.append(f"German runtime translation matches English: {key}")

for language, dictionary in dicts.items():
    if any(not value.strip() for value in dictionary.get("runtime", {}).values()):
        errors.append(f"Empty runtime translation in {language}.json")

tree = ET.parse(ROOT / "sitemap.xml")
ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9", "xhtml": "http://www.w3.org/1999/xhtml"}
locs = {node.text for node in tree.findall(".//sm:loc", ns)}
for page in routes:
    for lang in ("es", "en", "de"):
        path = "/" if lang == "es" and page == "index.html" else f"/{page}" if lang == "es" else f"/{lang}/" if routes[page][lang] == "index.html" else f"/{lang}/{routes[page][lang]}"
        url = BASE_URL + path
        if url not in locs:
            errors.append(f"Sitemap is missing {url}")
for url in tree.findall(".//sm:url", ns):
    refs = {node.attrib.get("hreflang"): node.attrib.get("href") for node in url.findall("xhtml:link", ns)}
    if len(refs) != 4 or any(value not in locs for value in refs.values()):
        errors.append("Sitemap hreflang set is missing or points to an unlisted page")

if errors:
    print("i18n validation found issues:")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)
print("i18n validation passed.")
