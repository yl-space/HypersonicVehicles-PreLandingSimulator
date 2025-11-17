#!/usr/bin/env python3
"""
Generate multi-resolution Mars color maps from the Trek/USGS MDIM TIFF.

Input (default):
    client/assets/textures/Mars/Mars_Viking_MDIM21_ClrMosaic_global_232m.tif

Outputs (default, all equirectangular RGB JPEGs):
    client/assets/textures/Mars/Mars_color_16k.jpg  (16384 x 8192)
    client/assets/textures/Mars/Mars_color_8k.jpg   (8192  x 4096)
    client/assets/textures/Mars/Mars_color_4k.jpg   (4096  x 2048)
    client/assets/textures/Mars/Mars_color_2k.jpg   (2048  x 1024)

Run from project root:
    python3 tools/generate_mars_textures.py
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def generate_levels(
    src_path: Path,
    out_dir: Path,
    sizes: list[tuple[int, int]],
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[mars-textures] Loading source TIFF: {src_path}")
    Image.MAX_IMAGE_PIXELS = None  # allow very large mosaics
    with Image.open(src_path) as img:
        print(f"[mars-textures] Source size: {img.width} x {img.height}, mode={img.mode}")

        # For very large mosaics (e.g. 92k x 46k), loading a full copy in
        # memory will explode RAM. We do two things:
        #   1) Only convert if we actually need to.
        #   2) Use Image.reduce() to downsample before any expensive copies.

        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")

        # Compute the largest requested width and pick an integer reduction
        # factor to get us near that scale in a single pass.
        max_target_width = max(w for w, _ in sizes)
        reduce_factor = max(1, img.width // (max_target_width * 2))
        if reduce_factor > 1:
            print(f"[mars-textures] Applying pre-reduction factor {reduce_factor} to save memory...")
            img = img.reduce(reduce_factor)
            print(f"[mars-textures] After reduce: {img.width} x {img.height}")

        # Ensure approximate 2:1 aspect for equirectangular output
        target_ratio = 2.0
        src_ratio = img.width / img.height
        if abs(src_ratio - target_ratio) > 0.05:
            print(
                f"[mars-textures] Warning: source ratio {src_ratio:.3f} "
                f"differs from expected 2:1. Cropping horizontally to center."
            )
            new_width = int(img.height * target_ratio)
            if new_width < img.width:
                left = (img.width - new_width) // 2
                right = left + new_width
                img = img.crop((left, 0, right, img.height))
                print(f"[mars-textures] Cropped to {img.width} x {img.height}.")

        for width, height in sizes:
            print(f"[mars-textures] Generating {width}x{height} ...")
            resized = img.resize((width, height), resample=Image.LANCZOS)

            if width >= 16000:
                name = "Mars_color_16k.jpg"
            elif width >= 8000:
                name = "Mars_color_8k.jpg"
            elif width >= 4000:
                name = "Mars_color_4k.jpg"
            else:
                name = "Mars_color_2k.jpg"

            out_path = out_dir / name
            resized.save(out_path, format="JPEG", quality=95, subsampling=0)
            print(f"[mars-textures] Wrote {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Mars color LOD textures from MDIM TIFF.")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("client/assets/textures/Mars/Mars_Viking_MDIM21_ClrMosaic_global_232m.tif"),
        help="Path to source MDIM TIFF (default: %(default)s)",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("client/assets/textures/Mars"),
        help="Output directory for JPEGs (default: %(default)s)",
    )
    parser.add_argument(
        "--sizes",
        nargs="*",
        metavar=("WIDTHxHEIGHT"),
        help="Optional custom sizes like 16384x8192 8192x4096 4096x2048 2048x1024",
    )

    args = parser.parse_args()

    if not args.input.is_file():
        raise SystemExit(f"Source TIFF not found: {args.input}")

    if args.sizes:
        parsed_sizes = []
        for token in args.sizes:
            try:
                w_str, h_str = token.lower().split("x")
                parsed_sizes.append((int(w_str), int(h_str)))
            except Exception as exc:  # noqa: BLE001
                raise SystemExit(f"Invalid size '{token}', expected WIDTHxHEIGHT") from exc
        sizes = parsed_sizes
    else:
        sizes = [
            (16384, 8192),
            (8192, 4096),
            (4096, 2048),
            (2048, 1024),
        ]

    generate_levels(args.input, args.out_dir, sizes)


if __name__ == "__main__":
    main()
