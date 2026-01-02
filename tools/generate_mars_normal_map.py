#!/usr/bin/env python3
"""
Generate an approximate normal map from a Mars color TIFF or JPEG.

Usage:
    python3 tools/generate_mars_normal_map.py \
        --input client/assets/textures/Mars/Mars_MDIM_4k.tif \
        --out client/assets/textures/Mars/Mars_normal_4k.png

Requirements:
    - Pillow (PIL)
    - NumPy
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np  # type: ignore[import]
from PIL import Image

try:
    import tifffile  # type: ignore[import]
except ImportError:  # pragma: no cover
    tifffile = None


def generate_normal_map(src_path: Path, out_path: Path) -> None:
    print(f"[mars-normal] Loading image: {src_path}")
    Image.MAX_IMAGE_PIXELS = None

    with Image.open(src_path) as img:
        print(f"[mars-normal] Source size: {img.width} x {img.height}, mode={img.mode}")

        # When the image is extremely large (92k-wide TIFF), Pillow tries to load
        # the entire raster to resize, which exhausts RAM. If tifffile is available,
        # use it to subsample via memory mapping without materializing the whole array.
        target_width = 4096
        if img.width > target_width and tifffile is not None:
            print("[mars-normal] Using tifffile for memory-mapped downsampling...")
            img.close()
            with tifffile.TiffFile(src_path) as tif:
                arr_mm = tif.asarray(out='memmap')

                if arr_mm.ndim == 2:
                    channels = 1
                else:
                    channels = arr_mm.shape[2]

                h = arr_mm.shape[0]
                w = arr_mm.shape[1]
                factor = max(1, int(np.ceil(w / target_width)))
                new_w = w // factor
                new_h = h // factor
                output = np.zeros((new_h, new_w), dtype=np.float32)

                for y in range(new_h):
                    y_start = y * factor
                    y_end = y_start + factor
                    rows = arr_mm[y_start:y_end, :new_w * factor]
                    rows = rows.reshape(factor, new_w, factor, channels)
                    block_mean = rows.mean(axis=(0, 2)).astype(np.float32, copy=False)
                    if channels == 1:
                        gray_row = block_mean[:, 0]
                    else:
                        gray_row = (
                            0.299 * block_mean[:, 0] +
                            0.587 * block_mean[:, 1] +
                            0.114 * block_mean[:, 2]
                        )
                    output[y] = gray_row

                arr_small = np.clip(output, 0, 255).astype(np.uint8)
            gray = Image.fromarray(arr_small, mode="L")
            print(f"[mars-normal] Downsampled to {gray.width}x{gray.height}")
        else:
            if img.width > target_width:
                ratio = target_width / img.width
                new_height = int(img.height * ratio)
                print(f"[mars-normal] Downscaling to {target_width}x{new_height} for processing...")
                img = img.resize((target_width, new_height), Image.LANCZOS)
            gray = img.convert("L")

        arr = np.asarray(gray, dtype="float32") / 255.0

        print("[mars-normal] Computing gradients...")
        gx = np.zeros_like(arr)
        gy = np.zeros_like(arr)

        gx[:, 1:-1] = (arr[:, 2:] - arr[:, :-2]) * 0.5
        gy[1:-1, :] = (arr[2:, :] - arr[:-2, :]) * 0.5

        nz = np.ones_like(arr)
        length = np.sqrt(gx * gx + gy * gy + nz * nz) + 1e-8
        nx = -gx / length
        ny = -gy / length
        nz = nz / length

        normal_rgb = (np.stack(
            [(nx + 1) * 127.5, (ny + 1) * 127.5, (nz + 1) * 127.5],
            axis=-1
        ).clip(0, 255).astype("uint8"))

        normal_img = Image.fromarray(normal_rgb, mode="RGB")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        normal_img.save(out_path, format="PNG", compress_level=3)
        print(f"[mars-normal] Wrote normal map {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a Mars normal map from a color TIFF/JPEG.")
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="Path to the color image (e.g., 4k TIFF/JPEG).",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("client/assets/textures/Mars/Mars_normal_4k.png"),
        help="Output normal-map path (PNG).",
    )
    args = parser.parse_args()

    if not args.input.is_file():
        raise SystemExit(f"Input image not found: {args.input}")

    generate_normal_map(args.input, args.out)


if __name__ == "__main__":
    main()
