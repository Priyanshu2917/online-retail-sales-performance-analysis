"""Download the documented public source workbook used by this portfolio project."""

from __future__ import annotations

import argparse
import shutil
import urllib.request
import zipfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://archive.ics.uci.edu/static/public/502/online+retail+ii.zip"


def download(destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    workbook_path = destination / "online_retail_II.xlsx"
    if workbook_path.exists():
        print(f"Source workbook already exists: {workbook_path}")
        return

    archive_path = destination / "online_retail_ii.zip"
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=120) as response, archive_path.open("wb") as archive_file:
        shutil.copyfileobj(response, archive_file)

    with zipfile.ZipFile(archive_path) as archive:
        candidates = [name for name in archive.namelist() if name.lower().endswith(".xlsx")]
        if not candidates:
            raise RuntimeError("The downloaded archive did not contain an Excel workbook.")
        with archive.open(candidates[0]) as source, workbook_path.open("wb") as target:
            shutil.copyfileobj(source, target)
    archive_path.unlink(missing_ok=True)
    print(f"Downloaded source workbook to {workbook_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download the UCI Online Retail II source workbook.")
    parser.add_argument("--destination", type=Path, default=PROJECT_ROOT / "data" / "raw")
    arguments = parser.parse_args()
    download(arguments.destination.resolve())
