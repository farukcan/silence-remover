type UmamiTracker = {
  track: (
    event: string,
    data?: Record<string, string | number | boolean>,
  ) => void;
};

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

type EventData = Record<string, string | number | boolean>;

const pending: Array<{ event: string; data?: EventData }> = [];

/** Fire a Umami custom event when the tracker script is loaded. */
export function track(event: string, data?: EventData): void {
  if (typeof window === "undefined") return;
  if (window.umami) {
    window.umami.track(event, data);
    return;
  }
  pending.push({ event, data });
}

/** Flush events queued before the Umami script finished loading. */
export function flushUmamiQueue(): void {
  if (typeof window === "undefined" || !window.umami) return;
  while (pending.length > 0) {
    const item = pending.shift();
    if (!item) break;
    window.umami.track(item.event, item.data);
  }
}

/** Lowercase file extension without the leading dot (no filename). */
export function fileExt(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return "unknown";
  return name.slice(dot + 1).toLowerCase().slice(0, 16);
}

/**
 * Optional duration fields for Umami events (seconds, rounded).
 * Omits keys when values are missing so early funnel events stay clean.
 */
export function durationProps(
  inputSec?: number | null,
  outputSec?: number | null,
): EventData {
  const data: EventData = {};
  const inputOk = inputSec != null && Number.isFinite(inputSec) && inputSec >= 0;
  const outputOk =
    outputSec != null && Number.isFinite(outputSec) && outputSec >= 0;

  if (inputOk) data.input_sec = Math.round(inputSec);
  if (outputOk) data.output_sec = Math.round(outputSec);

  if (inputOk && outputOk) {
    const removed = Math.max(0, inputSec - outputSec);
    data.removed_sec = Math.round(removed);
    if (inputSec > 0) {
      data.removed_pct = Math.round((removed / inputSec) * 100);
    }
  }

  return data;
}
