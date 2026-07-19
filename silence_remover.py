#!/usr/bin/env python3
"""Remove silences from audio/video using Silero VAD.

Designed for social-media voiceovers: keeps only speech and drops pauses
so the result plays faster / tighter. Default is jump-cut style (no gap kept).
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".wma"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}


@dataclass
class Segment:
    start: float
    end: float

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


def require_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        raise SystemExit("ffmpeg and ffprobe are required but were not found in PATH.")


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def has_video_stream(path: Path) -> bool:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=codec_type",
            "-of",
            "csv=p=0",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return bool(result.stdout.strip())


def load_wav_mono_float32(path: Path, expected_rate: int = 16000):
    """Load a PCM WAV without torchaudio (avoids torchcodec dependency)."""
    import wave

    import numpy as np
    import torch

    with wave.open(str(path), "rb") as wf:
        if wf.getnchannels() != 1:
            raise SystemExit(f"Expected mono WAV for VAD, got {wf.getnchannels()} channels")
        if wf.getframerate() != expected_rate:
            raise SystemExit(
                f"Expected {expected_rate} Hz WAV for VAD, got {wf.getframerate()} Hz"
            )
        if wf.getsampwidth() != 2:
            raise SystemExit(f"Expected 16-bit PCM WAV, got sample width {wf.getsampwidth()}")
        frames = wf.readframes(wf.getnframes())

    audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    return torch.from_numpy(audio)


def detect_speech_segments(
    audio_path: Path,
    *,
    threshold: float,
    min_speech_ms: int,
    min_silence_ms: int,
    speech_pad_ms: int,
) -> list[Segment]:
    from silero_vad import get_speech_timestamps, load_silero_vad

    model = load_silero_vad()
    wav = load_wav_mono_float32(audio_path, expected_rate=16000)
    timestamps = get_speech_timestamps(
        wav,
        model,
        sampling_rate=16000,
        threshold=threshold,
        min_speech_duration_ms=min_speech_ms,
        min_silence_duration_ms=min_silence_ms,
        speech_pad_ms=speech_pad_ms,
        return_seconds=True,
    )
    return [Segment(float(t["start"]), float(t["end"])) for t in timestamps]


def build_keep_segments(
    speech: list[Segment],
    total_duration: float,
    max_silence: float,
) -> list[Segment]:
    """Keep speech and shrink gaps longer than max_silence (0 = jump-cut)."""
    if not speech:
        return []

    # Pure jump-cut: concatenate speech windows only.
    if max_silence <= 0:
        return merge_segments(speech)

    keep: list[Segment] = []
    cursor = 0.0

    for seg in speech:
        gap = seg.start - cursor
        if gap > max_silence:
            # Drop the excess silence; keep only max_silence before speech.
            keep_start = max(0.0, seg.start - max_silence)
        else:
            keep_start = cursor

        keep_start = min(keep_start, seg.start)
        keep.append(Segment(keep_start, seg.end))
        cursor = seg.end

    # Optional trailing silence after the last speech segment.
    trailing = total_duration - cursor
    if trailing > 0:
        keep_tail = min(trailing, max_silence)
        if keep_tail > 0.01:
            keep.append(Segment(cursor, cursor + keep_tail))

    return merge_segments(keep)


def merge_segments(segments: list[Segment], gap_tolerance: float = 0.01) -> list[Segment]:
    if not segments:
        return []

    merged = [segments[0]]
    for seg in segments[1:]:
        prev = merged[-1]
        if seg.start <= prev.end + gap_tolerance:
            merged[-1] = Segment(prev.start, max(prev.end, seg.end))
        else:
            merged.append(seg)
    return merged


def export_audio_segments(
    input_path: Path,
    segments: list[Segment],
    output_path: Path,
) -> None:
    if not segments:
        raise SystemExit("No speech detected; nothing to export.")

    filter_parts: list[str] = []
    concat_inputs: list[str] = []
    for i, seg in enumerate(segments):
        filter_parts.append(
            f"[0:a]atrim=start={seg.start:.6f}:end={seg.end:.6f},"
            f"asetpts=PTS-STARTPTS[a{i}]"
        )
        concat_inputs.append(f"[a{i}]")

    filter_complex = (
        ";".join(filter_parts)
        + f";{''.join(concat_inputs)}concat=n={len(segments)}:v=0:a=1[outa]"
    )

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_path),
        "-filter_complex",
        filter_complex,
        "-map",
        "[outa]",
        "-c:a",
        "libmp3lame",
        "-q:a",
        "2",
        str(output_path),
    ]
    if output_path.suffix.lower() == ".wav":
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-filter_complex",
            filter_complex,
            "-map",
            "[outa]",
            str(output_path),
        ]
    elif output_path.suffix.lower() in {".m4a", ".aac", ".mp4"}:
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-filter_complex",
            filter_complex,
            "-map",
            "[outa]",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(output_path),
        ]

    run_ffmpeg(cmd)


def export_video_segments(
    input_path: Path,
    segments: list[Segment],
    output_path: Path,
) -> None:
    if not segments:
        raise SystemExit("No speech detected; nothing to export.")

    # Cut each keep-window, then concat demuxer for reliable A/V sync.
    with tempfile.TemporaryDirectory(prefix="silence-remover-") as tmp:
        tmp_dir = Path(tmp)
        list_path = tmp_dir / "concat.txt"
        clip_paths: list[Path] = []

        for i, seg in enumerate(segments):
            clip = tmp_dir / f"clip_{i:04d}.mp4"
            # Re-encode per clip so concat is frame-accurate after jumps.
            cmd = [
                "ffmpeg",
                "-y",
                "-ss",
                f"{seg.start:.6f}",
                "-to",
                f"{seg.end:.6f}",
                "-i",
                str(input_path),
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "18",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-movflags",
                "+faststart",
                str(clip),
            ]
            run_ffmpeg(cmd)
            clip_paths.append(clip)

        list_path.write_text(
            "".join(f"file '{p.resolve()}'\n" for p in clip_paths),
            encoding="utf-8",
        )
        cmd = [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_path),
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
        run_ffmpeg(cmd)


def run_ffmpeg(cmd: list[str]) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(
            "ffmpeg failed:\n"
            + (result.stderr.strip() or result.stdout.strip() or "unknown error")
        )


def default_output_path(input_path: Path) -> Path:
    return input_path.with_name(f"{input_path.stem}_nosilence{input_path.suffix}")


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
    require_ffmpeg()

    input_path = args.input.expanduser().resolve()
    if not input_path.exists():
        raise SystemExit(f"Input not found: {input_path}")

    output_path = (
        args.output.expanduser().resolve()
        if args.output
        else default_output_path(input_path)
    )

    suffix = input_path.suffix.lower()
    treat_as_video = suffix in VIDEO_EXTENSIONS or (
        suffix not in AUDIO_EXTENSIONS and has_video_stream(input_path)
    )

    print(f"Input:  {input_path}")
    print(f"Output: {output_path}")
    print("Loading Silero VAD and detecting speech...")

    # Silero reads many formats via torchaudio; for robustness extract wav when needed.
    with tempfile.TemporaryDirectory(prefix="silence-remover-vad-") as tmp:
        tmp_dir = Path(tmp)
        vad_audio = tmp_dir / "vad.wav"
        run_ffmpeg(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(input_path),
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-c:a",
                "pcm_s16le",
                str(vad_audio),
            ]
        )

        speech = detect_speech_segments(
            vad_audio,
            threshold=args.threshold,
            min_speech_ms=args.min_speech_ms,
            min_silence_ms=args.min_silence_ms,
            speech_pad_ms=args.speech_pad_ms,
        )

    total_duration = probe_duration(input_path)
    keep = build_keep_segments(speech, total_duration, args.max_silence)

    speech_dur = sum(s.duration for s in speech)
    keep_dur = sum(s.duration for s in keep)
    removed = max(0.0, total_duration - keep_dur)

    print(f"Duration in:     {total_duration:.2f}s")
    print(f"Speech detected: {speech_dur:.2f}s ({len(speech)} segments)")
    print(f"Duration out:    {keep_dur:.2f}s ({len(keep)} keep windows)")
    print(f"Removed:         {removed:.2f}s ({100 * removed / total_duration:.1f}%)")

    if args.json:
        print(
            json.dumps(
                {
                    "speech": [{"start": s.start, "end": s.end} for s in speech],
                    "keep": [{"start": s.start, "end": s.end} for s in keep],
                },
                indent=2,
            )
        )

    print("Exporting...")
    if treat_as_video:
        export_video_segments(input_path, keep, output_path)
    else:
        export_audio_segments(input_path, keep, output_path)

    out_duration = probe_duration(output_path)
    print(f"Done. Output duration: {out_duration:.2f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
