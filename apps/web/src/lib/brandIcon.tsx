import { ImageResponse } from "next/og";

const BARS = [28, 52, 36, 70, 44, 78, 40, 64, 32, 72, 48, 60, 34];

/** Square brand mark PNG for PWA / Apple touch icons. */
export function brandIconResponse(size: number) {
  const pad = Math.round(size * 0.18);
  const inner = size - pad * 2;
  const gap = Math.max(2, Math.round(size * 0.02));
  const barCount = 9;
  const barW = Math.max(
    3,
    Math.floor((inner - gap * (barCount - 1)) / barCount),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #17211e 0%, #0b1110 100%)",
          borderRadius: Math.round(size * 0.22),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            gap,
            height: inner,
            width: inner,
          }}
        >
          {BARS.slice(0, barCount).map((h, i) => {
            const mid = i === 3 || i === 4 || i === 5;
            const height = Math.round((h / 100) * inner * (mid ? 0.22 : 0.95));
            return (
              <div
                key={i}
                style={{
                  width: barW,
                  height: Math.max(Math.round(size * 0.08), height),
                  borderRadius: Math.ceil(barW / 2),
                  background: mid
                    ? "rgba(214,255,75,0.28)"
                    : "linear-gradient(180deg, #d6ff4b, #7dffc3)",
                }}
              />
            );
          })}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
