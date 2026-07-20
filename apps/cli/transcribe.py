#!/usr/bin/env python3
"""Word-level transcription to JSON using mlx-whisper (Apple Silicon).

Produces Whisper JSON with per-word timestamps, suitable for karaoke-style
overlays or further editing after silence removal.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


DEFAULT_MODEL = "mlx-community/whisper-large-v3-mlx"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Transcribe audio to word-level JSON with mlx-whisper."
    )
    parser.add_argument("input", type=Path, help="Input audio file (mp3/wav/...)")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output JSON path (default: <input_stem>.json)",
    )
    parser.add_argument(
        "--language",
        default="tr",
        help="Language code for Whisper (default: tr)",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"MLX Whisper model repo (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--no-word-timestamps",
        action="store_true",
        help="Disable per-word timestamps (segments only)",
    )
    parser.add_argument(
        "-q",
        "--quiet",
        action="store_true",
        help="Suppress transcription progress text",
    )
    return parser.parse_args(argv)


def default_output_path(input_path: Path) -> Path:
    return input_path.with_suffix(".json")


def transcribe_to_result(
    audio_path: Path,
    *,
    model: str,
    language: str,
    word_timestamps: bool,
    verbose: bool,
) -> dict:
    try:
        from mlx_whisper import transcribe
    except ImportError as exc:
        raise SystemExit(
            "mlx-whisper is required. Install with:\n"
            "  pip install mlx-whisper\n"
            "(Apple Silicon macOS recommended)"
        ) from exc

    return transcribe(
        str(audio_path),
        path_or_hf_repo=model,
        language=language,
        word_timestamps=word_timestamps,
        verbose=verbose,
    )


def write_json(result: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        f.write("\n")


def count_words(result: dict) -> int:
    total = 0
    for segment in result.get("segments") or []:
        words = segment.get("words") or []
        total += len(words)
    return total


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    input_path = args.input.expanduser().resolve()
    if not input_path.exists():
        raise SystemExit(f"Input not found: {input_path}")

    output_path = (
        args.output.expanduser().resolve()
        if args.output
        else default_output_path(input_path)
    )

    print(f"Input:  {input_path}")
    print(f"Output: {output_path}")
    print(f"Model:  {args.model}")
    print(f"Lang:   {args.language}")
    print("Transcribing...")

    result = transcribe_to_result(
        input_path,
        model=args.model,
        language=args.language,
        word_timestamps=not args.no_word_timestamps,
        verbose=not args.quiet,
    )
    write_json(result, output_path)

    segments = len(result.get("segments") or [])
    words = count_words(result)
    print(f"Done. segments={segments} words={words}")
    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
