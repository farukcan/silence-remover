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
