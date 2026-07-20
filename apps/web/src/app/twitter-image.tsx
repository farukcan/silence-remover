import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Silence Remover by Puhulab";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Twitter / X card image — same art as Open Graph (config must be local, not re-exported). */
export default function TwitterImage() {
  const bars = [28, 52, 36, 70, 44, 78, 40, 64, 32, 72, 48, 60, 34, 68, 42, 74];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background:
            "linear-gradient(160deg, #0b1110 0%, #121a18 45%, #0a1412 100%)",
          color: "#eef3ea",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "linear-gradient(135deg, #17211e, #0b1110)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 4,
              padding: "18px 14px",
              border: "1px solid rgba(214,255,75,0.25)",
            }}
          >
            {bars.slice(0, 9).map((h, i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: h,
                  borderRadius: 3,
                  background:
                    i === 4 || i === 5
                      ? "rgba(214,255,75,0.25)"
                      : "linear-gradient(180deg, #d6ff4b, #7dffc3)",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                fontSize: 54,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              Silence Remover
            </div>
            <div
              style={{
                fontSize: 22,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#9aaca2",
              }}
            >
              by Puhulab
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              maxWidth: 900,
              lineHeight: 1.15,
            }}
          >
            Tighten the take. Keep the voice.
          </div>
          <div style={{ fontSize: 26, color: "#9aaca2", maxWidth: 820 }}>
            Remove quiet gaps from voiceovers and short videos — free, no
            account.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            height: 72,
          }}
        >
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                width: 18,
                height: h,
                borderRadius: 6,
                background: "linear-gradient(180deg, #d6ff4b, #7dffc3)",
                opacity: 0.9,
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
