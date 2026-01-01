"""
Prefetch a bounded set of Mars WMTS tiles from Trek into the local cache.
Defaults are conservative to keep image size small:
  - zoom levels: 0 through 3 (170 tiles total for the full globe)
  - format: jpg

Environment variables:
  PREFETCH_MIN_Z (default: 0)
  PREFETCH_MAX_Z (default: 3)
  TILE_CACHE_DIR (default: /app/tile_cache/mars)
"""

import os
from pathlib import Path
import httpx

WMTS_BASE = "https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm"


def matrix_dims(z: int) -> tuple[int, int]:
    """Return (cols, rows) for the Trek WMTS default028mm matrix."""
    cols = 1 << (z + 1)
    rows = 1 << z
    return cols, rows


def prefetch():
    min_z = int(os.getenv("PREFETCH_MIN_Z", "0"))
    max_z = int(os.getenv("PREFETCH_MAX_Z", "3"))
    cache_dir = Path(os.getenv("TILE_CACHE_DIR", "/app/tile_cache/mars"))
    cache_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    client = httpx.Client(timeout=10.0)

    for z in range(min_z, max_z + 1):
        cols, rows = matrix_dims(z)
        for x in range(cols):
            for y in range(rows):
                url = f"{WMTS_BASE}/{z}/{x}/{y}.jpg"
                dest = cache_dir / str(z) / str(x) / f"{y}.jpg"
                if dest.exists():
                    continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                try:
                    r = client.get(url)
                    if r.status_code == 200:
                        dest.write_bytes(r.content)
                        total += 1
                except Exception:
                    # Skip failures; they can be fetched at runtime
                    continue

    print(f"Prefetch complete. Downloaded {total} tiles into {cache_dir}")


if __name__ == "__main__":
    prefetch()
