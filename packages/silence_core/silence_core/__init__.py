"""Silence removal core: Silero VAD + ffmpeg jump-cut."""

from silence_core.core import (
    AUDIO_EXTENSIONS,
    VIDEO_EXTENSIONS,
    Segment,
    SilenceRemoverError,
    build_keep_segments,
    default_output_path,
    detect_speech_segments,
    export_audio_segments,
    export_video_segments,
    has_video_stream,
    merge_segments,
    probe_duration,
    process_file,
    require_ffmpeg,
    run_ffmpeg,
)

__all__ = [
    "AUDIO_EXTENSIONS",
    "VIDEO_EXTENSIONS",
    "Segment",
    "SilenceRemoverError",
    "build_keep_segments",
    "default_output_path",
    "detect_speech_segments",
    "export_audio_segments",
    "export_video_segments",
    "has_video_stream",
    "merge_segments",
    "probe_duration",
    "process_file",
    "require_ffmpeg",
    "run_ffmpeg",
]
