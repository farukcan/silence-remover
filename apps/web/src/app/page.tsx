import { SilenceUploader } from "@/components/SilenceUploader";

const bars = [18, 34, 22, 48, 28, 56, 30, 44, 20, 52, 26, 40, 16, 46, 24, 58, 32, 42];

export default function HomePage() {
  return (
    <main className="shell">
      <header className="brand">
        <h1 className="brand__name">CutAir</h1>
        <p className="brand__tag">Free silence remover</p>
      </header>

      <section className="hero">
        <h2>Tighten the take. Keep the voice.</h2>
        <p>
          Upload a voiceover or clip. We detect speech with Silero VAD and stitch
          a tighter cut — no account, no paywall.
        </p>
        <div className="waveform" aria-hidden="true">
          {bars.map((h, i) => (
            <span key={i} style={{ height: h, animationDelay: `${i * 0.06}s` }} />
          ))}
        </div>
      </section>

      <SilenceUploader />

      <footer className="footer">
        Rate limited per IP. Files are processed on our worker and stored temporarily.
      </footer>
    </main>
  );
}
