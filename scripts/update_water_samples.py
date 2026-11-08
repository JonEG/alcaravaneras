#!/usr/bin/env python3
"""Refresh the latest Alcaravaneras bathing-water samples from NÁYADE."""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "latest-water-samples.json"
ENDPOINT = "https://nayadeciudadano.sanidad.gob.es/Splayas/ciudadano/ciudadanoVerZonaAction.do"
FORM_FIELDS = {
    "pestanya": "3",
    "actionProcedencia": "ciudadanoZonaAction",
    "codZona": "1476",
    "provinciaMapa": "",
    "codCCAA": "5",
    "codProvincia": "35",
    "codMunicipio": "35016",
    "denZona": "PLAYA ALCARAVANERAS",
    "codPlaya": "",
}
DATE_RE = re.compile(r"^\d{2}/\d{2}/\d{4}$")
DATE_FORMAT = "%d/%m/%Y"


class SampleTableParser(HTMLParser):
    """Collect rows containing a date and the three sample-result columns."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self.row: list[str] | None = None
        self.cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "tr":
            self.row = []
        elif tag in {"td", "th"} and self.row is not None:
            self.cell = []

    def handle_data(self, data: str) -> None:
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self.cell is not None and self.row is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None


def multipart_body(fields: dict[str, str], boundary: str) -> bytes:
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
                value.encode("utf-8"),
                b"\r\n",
            ]
        )
    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks)


def fetch_page() -> str:
    boundary = "----AlcaravanerasNayadeBoundary7MA4YWxkTrZu0gW"
    request = Request(
        ENDPOINT,
        data=multipart_body(FORM_FIELDS, boundary),
        headers={
            "Accept": "text/html,application/xhtml+xml",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "Alcaravaneras water-sample updater (https://alcaravaneras.com)",
            "Referer": "https://nayadeciudadano.sanidad.gob.es/Splayas/ciudadano/",
        },
        method="POST",
    )
    with urlopen(request, timeout=30) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def extract_samples(page: str) -> list[dict[str, str]]:
    parser = SampleTableParser()
    parser.feed(page)
    if "PLAYA ALCARAVANERAS PM2" not in " ".join(page.upper().split()):
        raise RuntimeError("NÁYADE response did not contain the expected PM2 sampling point")

    samples: list[dict[str, str]] = []
    for cells in parser.rows:
        date_index = next((i for i, cell in enumerate(cells) if DATE_RE.fullmatch(cell)), None)
        if date_index is None or len(cells) < date_index + 4:
            continue
        date_text, ecoli, enterococci, observation = cells[date_index : date_index + 4]
        sample_date = datetime.strptime(date_text, DATE_FORMAT).date()
        samples.append(
            {
                "date": sample_date.isoformat(),
                "dateLabel": date_text,
                "ecoli": ecoli,
                "enterococci": enterococci,
                "observation": observation,
            }
        )

    # Ignore any rows with a malformed or empty lab result before publishing.
    samples = [sample for sample in samples if sample["ecoli"] and sample["enterococci"] and sample["observation"]]
    samples.sort(key=lambda sample: sample["date"], reverse=True)
    if not samples:
        raise RuntimeError("No sample rows could be parsed from the NÁYADE response")
    return samples[:3]


def main() -> int:
    try:
        samples = extract_samples(fetch_page())
        existing: dict[str, object] = {}
        if OUTPUT.exists():
            existing = json.loads(OUTPUT.read_text(encoding="utf-8"))
        if existing.get("samples") == samples:
            print("NÁYADE samples are unchanged; keeping the current published JSON.")
            return 0

        result = {
            "source": "NÁYADE · Playa Alcaravaneras PM2",
            "sourceUrl": "https://nayadeciudadano.sanidad.gob.es/Splayas/ciudadano/",
            "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "samples": samples,
        }
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Published {len(samples)} samples; latest date is {samples[0]['date']}.")
        return 0
    except Exception as error:  # Keep the last known-good JSON if NÁYADE changes or is unavailable.
        print(f"Could not refresh NÁYADE samples: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
