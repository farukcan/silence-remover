"""CLI entrypoint for silence-core."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from silence_core.core import (
    SilenceRemoverError,
    default_output_path,
    process_file,
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Remove silences from audio/video with Silero VAD "
            "(default: jump-cut for faster social-media voiceovers)."
        )
    )
    parser.add_argument("input", type=Path, help="Input audio or video file")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output path (default: <input>_nosilence.<ext>)",
    )
    parser.add_argument(
        "--max-silence",
        type=float,
        default=0.0,
        help=(
            "Max silence to keep between speech segments, in seconds. "
            "0 = jump-cut / concatenate speech only (default: 0.0)"
        ),
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.65,
        help="Silero VAD speech probability threshold (default: 0.65)",
    )
    parser.add_argument(
        "--min-speech-ms",
        type=int,
        default=200,
        help="Ignore speech shorter than this many ms (default: 200)",
    )
    parser.add_argument(
        "--min-silence-ms",
        type=int,
        default=50,
        help=(
            "Min silence to split speech segments, in ms. "
            "Lower = more pauses removed (default: 50)"
        ),
    )
    parser.add_argument(
        "--speech-pad-ms",
        type=int,
        default=0,
        help=(
            "Padding around detected speech edges, in ms. "
            "0 keeps output shortest; raise slightly if words clip (default: 0)"
        ),
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print keep-segment timestamps as JSON",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    input_path = args.input.expanduser().resolve()
    output_path = (
        args.output.expanduser().resolve()
        if args.output
        else default_output_path(input_path)
    )

    print(f"Input:  {input_path}")
    print(f"Output: {output_path}")
    print("Loading Silero VAD and detecting speech...")

    try:
        result = process_file(
            input_path,
            output_path,
            max_silence=args.max_silence,
            threshold=args.threshold,
            min_speech_ms=args.min_speech_ms,
            min_silence_ms=args.min_silence_ms,
            speech_pad_ms=args.speech_pad_ms,
        )
    except SilenceRemoverError as exc:
        raise SystemExit(str(exc)) from exc

    speech_dur = sum(s.duration for s in result.speech)
    keep_dur = sum(s.duration for s in result.keep)
    removed = max(0.0, result.input_duration - keep_dur)

    print(f"Duration in:     {result.input_duration:.2f}s")
    print(f"Speech detected: {speech_dur:.2f}s ({len(result.speech)} segments)")
    print(f"Duration out:    {keep_dur:.2f}s ({len(result.keep)} keep windows)")
    print(f"Removed:         {removed:.2f}s ({100 * removed / result.input_duration:.1f}%)")

    if args.json:
        print(
            json.dumps(
                {
                    "speech": [{"start": s.start, "end": s.end} for s in result.speech],
                    "keep": [{"start": s.start, "end": s.end} for s in result.keep],
                },
                indent=2,
            )
        )

    print(f"Done. Output duration: {result.output_duration:.2f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
