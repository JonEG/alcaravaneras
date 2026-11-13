#!/usr/bin/env python3
"""Fetch Open-Meteo data and render current readings into the static pages."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SITEMAP = ROOT / "sitemap.xml"
LATITUDE = 28.1308
LONGITUDE = -15.4282
TIMEZONE = "Atlantic/Canary"

FORECAST_PARAMS = {
    "latitude": LATITUDE,
    "longitude": LONGITUDE,
    "current": "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    "hourly": "temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant",
    "timezone": TIMEZONE,
    "forecast_days": 7,
    "wind_speed_unit": "kmh",
}
MARINE_PARAMS = {
    "latitude": LATITUDE,
    "longitude": LONGITUDE,
    "current": "sea_level_height_msl,sea_surface_temperature",
    "hourly": "sea_level_height_msl,sea_surface_temperature",
    "timezone": TIMEZONE,
    "forecast_days": 7,
    "cell_selection": "sea",
}

WMO = {
    0: ("Despejado", "☀️"), 1: ("Mayormente despejado", "🌤️"),
    2: ("Parcialmente nuboso", "⛅"), 3: ("Nublado", "☁️"),
    45: ("Bruma", "🌫️"), 48: ("Bruma", "🌫️"),
    51: ("Llovizna", "🌦️"), 53: ("Llovizna", "🌦️"), 55: ("Llovizna", "🌦️"),
    56: ("Llovizna", "🌦️"), 57: ("Llovizna", "🌦️"),
    61: ("Lluvia", "🌧️"), 63: ("Lluvia", "🌧️"), 65: ("Lluvia", "🌧️"),
    66: ("Lluvia", "🌧️"), 67: ("Lluvia", "🌧️"), 71: ("Nieve", "🌨️"),
    73: ("Nieve", "🌨️"), 75: ("Nieve", "🌨️"), 77: ("Nieve", "🌨️"),
    80: ("Lluvia", "🌧️"), 81: ("Lluvia", "🌧️"), 82: ("Lluvia", "🌧️"),
    85: ("Nieve", "🌨️"), 86: ("Nieve", "🌨️"), 95: ("Tormenta", "⛈️"),
    96: ("Tormenta", "⛈️"), 99: ("Tormenta", "⛈️"),
}
DIRECTIONS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"]


def fetch_json(host: str, params: dict[str, object]) -> dict:
    request = Request(
        f"https://{host}/v1/{'forecast' if host.startswith('api.') else 'marine'}?{urlencode(params)}",
        headers={"Accept": "application/json", "User-Agent": "Alcaravaneras static data updater (https://www.alcaravaneras.com)"},
    )
    with urlopen(request, timeout=45) as response:
        payload = json.load(response)
    if not isinstance(payload, dict) or not isinstance(payload.get("current"), dict):
        raise RuntimeError(f"Unexpected response from {host}")
    return payload


def direction(degrees: float) -> str:
    return DIRECTIONS[round(degrees / 22.5) % 16]


def beaufort(speed: float) -> tuple[int, str]:
    ranges = [(1, "Calma"), (5, "Brisa muy débil"), (11, "Brisa débil"), (19, "Brisa moderada"),
              (28, "Brisa fresca"), (38, "Brisa fuerte"), (49, "Viento fuerte"),
              (61, "Viento muy fuerte"), (75, "Temporal"), (89, "Temporal fuerte"),
              (103, "Temporal duro"), (118, "Temporal muy duro"), (float("inf"), "Temporal huracanado")]
    for index, (limit, name) in enumerate(ranges):
        if speed < limit:
            return index, name
    return 12, "Temporal huracanado"


def text_updates(forecast: dict, marine: dict) -> tuple[dict[str, str], dict[str, str]]:
    current = forecast["current"]
    daily = forecast["daily"]
    sea = marine["current"]
    weather, icon = WMO.get(int(current["weather_code"]), ("Condiciones variables", "🌥️"))
    temp = round(current["temperature_2m"])
    speed = round(current["wind_speed_10m"])
    gusts = round(current["wind_gusts_10m"])
    wind_dir = direction(current["wind_direction_10m"])
    force, force_name = beaufort(current["wind_speed_10m"])
    wind_level = "Calma" if force == 0 else "Suave" if force <= 2 else "Moderado" if force <= 4 else "Fuerte" if force <= 6 else "Muy fuerte"
    # Open-Meteo returns this local wall time because the request sets Atlantic/Canary.
    timestamp = datetime.fromisoformat(current["time"])
    hour = timestamp.strftime("%H:%M")
    sea_temp = sea.get("sea_surface_temperature")
    sea_temp_text = f"{sea_temp:.1f}" if isinstance(sea_temp, (int, float)) else "—"
    sea_level = sea.get("sea_level_height_msl")

    ids = {
        "summary-weather-icon": icon, "summary-weather-temp": f"{temp}°",
        "summary-weather-condition": weather, "summary-wind-level": wind_level,
        "summary-wind-speed": str(speed), "summary-wind-direction": wind_dir,
        "summary-wind-gusts": str(gusts), "summary-sea-temperature": f'{sea_temp_text}<small>°C</small>',
        "current-temp": f"{temp}°", "current-condition": weather, "current-icon": icon,
        "current-wind-large": str(speed), "current-gusts": str(gusts), "current-direction": wind_dir,
        "beaufort-number": str(force), "beaufort-name": force_name,
        "today-high": str(round(daily["temperature_2m_max"][0])),
        "today-low": str(round(daily["temperature_2m_min"][0])),
        "current-rain": str(round(daily["precipitation_probability_max"][0])),
        "sea-temperature": f'{sea_temp_text}<span>°C</span>',
        "sea-temperature-time": f"Dato del modelo · {timestamp.day} {timestamp.strftime('%b')} · {hour} h (Canarias)",
        "updated-at": f"Previsión actualizada · {hour}",
        "today-summary-updated": f"Actualizado · {hour} h",
    }
    trend = "—"
    points: list[tuple[str, float]] = []
    if isinstance(sea_level, (int, float)):
        ids["current-tide"] = f"{sea_level:.2f}"
    if isinstance(sea_level, (int, float)) and marine.get("hourly"):
        tide_times = marine["hourly"].get("time", [])
        tide_values = marine["hourly"].get("sea_level_height_msl", [])
        points = [(time, value) for time, value in zip(tide_times, tide_values) if isinstance(value, (int, float))]
        future = [(time, value) for time, value in points if time > current["time"]]
        deltas = [value - sea_level for _, value in future[:4]]
        change = next((delta for delta in deltas if abs(delta) >= 0.01), 0)
        trend = "Subiendo" if change > 0 else "Bajando" if change < 0 else "—"
        ids["tide-trend"] = trend
        ids["summary-tide-trend"] = trend
        turns = [(points[i][0], points[i][1], "pleamar" if points[i][1] >= points[i - 1][1] and points[i][1] > points[i + 1][1] else "bajamar")
                 for i in range(1, len(points) - 1)
                 if (points[i][1] >= points[i - 1][1] and points[i][1] > points[i + 1][1]) or (points[i][1] <= points[i - 1][1] and points[i][1] < points[i + 1][1])]
        next_turn = next((turn for turn in turns if turn[0] > current["time"]), None)
        if next_turn:
            time, _, kind = next_turn
            ids["next-tide-label"] = ids["summary-tide-next-label"] = f"Próxima {kind} · hoy" if time[:10] == current["time"][:10] else f"Próxima {kind} · {time[8:10]}/{time[5:7]}"
            ids["next-tide-time"] = ids["summary-tide-next-time"] = time[11:16]

        today_points = [(time, value) for time, value in points if time[:10] == current["time"][:10]]
        if today_points:
            high = max(today_points, key=lambda point: point[1])
            low = min(today_points, key=lambda point: point[1])
            extremes = sorted((("Pleamar aprox.", high), ("Bajamar aprox.", low)), key=lambda item: item[1][0])
            ids["tide-extremes"] = "".join(
                f'<span><span class="tide-extreme-label">{label}</span><strong><time datetime="{time}">{time[11:16]}</time><small>{value:.2f} m</small></strong></span>'
                for label, (time, value) in extremes
            )

    weather_desc = f"{temp} °C, {weather.lower()}"
    wind_desc = f"viento {speed} km/h del {wind_dir}, rachas de {gusts} km/h"
    water_desc = f"agua {sea_temp_text} °C" if sea_temp is not None else "temperatura del agua no disponible"
    descs = {
        "index.html": f"Las Alcaravaneras ahora: {weather_desc}, {wind_desc}, {water_desc}. Consulta mareas y condiciones actuales de la playa en Las Palmas de Gran Canaria.",
        "tiempo.html": f"Tiempo actual en Las Alcaravaneras: {temp} °C y {weather.lower()}. Previsión de siete días en Las Palmas de Gran Canaria.",
        "viento.html": f"Viento actual en Las Alcaravaneras: {speed} km/h del {wind_dir}, con rachas de {gusts} km/h. Consulta la previsión horaria y semanal.",
        "mareas.html": f"Marea {trend.lower()} en Las Alcaravaneras, nivel estimado actual {sea_level:.2f} m respecto al nivel medio global. Consulta pleamares y bajamares aproximadas." if isinstance(sea_level, (int, float)) else "Consulta la estimación del nivel del mar, las pleamares y bajamares aproximadas en Las Alcaravaneras.",
        "temperatura-agua.html": f"Temperatura superficial estimada del mar en Las Alcaravaneras: {sea_temp_text} °C. Consulta su evolución prevista para los próximos días.",
    }
    return ids, descs


def replace_element(html: str, element_id: str, content: str) -> str:
    pattern = re.compile(rf"(<([a-zA-Z][\w:-]*)\b[^>]*\bid=[\"']{re.escape(element_id)}[\"'][^>]*>)(.*?)(</\2\s*>)", re.S | re.I)
    return pattern.sub(lambda match: match.group(1) + content + match.group(4), html, count=1)


def update_html(ids: dict[str, str], descriptions: dict[str, str]) -> None:
    pages = set(descriptions)
    # Also render the homepage values from the shared mapping.
    for page in pages:
        path = ROOT / page
        content = path.read_text(encoding="utf-8")
        for element_id, value in ids.items():
            if f'id="{element_id}"' in content:
                content = replace_element(content, element_id, value if "<" in value else escape(value))
        description = escape(descriptions[page], quote=True)
        content = re.sub(r'(<meta\s+name=["\']description["\']\s+content=["\'])[^"\']*(["\'])', rf'\g<1>{description}\2', content, count=1, flags=re.I)
        content = re.sub(r'(<meta\s+property=["\']og:description["\']\s+content=["\'])[^"\']*(["\'])', rf'\g<1>{description}\2', content, count=1, flags=re.I)
        path.write_text(content, encoding="utf-8")


def update_sitemap(today: str) -> None:
    sitemap = SITEMAP.read_text(encoding="utf-8")
    sitemap = re.sub(r"<lastmod>.*?</lastmod>", f"<lastmod>{today}</lastmod>", sitemap)
    sitemap = re.sub(r"(<url>\s*<loc>.*?</loc>)(\s*</url>)", rf"\1<lastmod>{today}</lastmod>\2", sitemap)
    SITEMAP.write_text(sitemap, encoding="utf-8")


def main() -> None:
    forecast = fetch_json("api.open-meteo.com", FORECAST_PARAMS)
    marine = fetch_json("marine-api.open-meteo.com", MARINE_PARAMS)
    DATA_DIR.mkdir(exist_ok=True)
    fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for filename, payload in (("open-meteo-forecast.json", forecast), ("open-meteo-marine.json", marine)):
        wrapped = {"source": "Open-Meteo", "updatedAt": fetched_at, "data": payload}
        (DATA_DIR / filename).write_text(json.dumps(wrapped, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    ids, descriptions = text_updates(forecast, marine)
    update_html(ids, descriptions)
    update_sitemap(forecast["current"]["time"][:10])
    print(f"Rendered Open-Meteo current readings for {forecast['current']['time']} (Canary Islands time).")


if __name__ == "__main__":
    main()
