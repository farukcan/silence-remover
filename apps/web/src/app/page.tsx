import Link from "next/link";
import { SilenceUploader } from "@/components/SilenceUploader";

const bars = [32, 58, 38, 82, 48, 96, 52, 76, 34, 90, 44, 70, 28, 80, 40, 100, 54, 72];

export default function HomePage() {
  return (
    <main className="shell">
      <header className="brand">
        <div className="brand__lockup">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="brand__mark"
            src="/brand/icon.svg"
            alt="Silence Remover"
            width={56}
            height={56}
          />
          <div className="brand__text">
            <h1 className="brand__name">Silence Remover</h1>
            <p className="brand__tag">by Puhulab</p>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero__copy">
          <h2>Tighten the take. Keep the voice.</h2>
          <p>
            Upload a voiceover or clip. We remove the quiet gaps and give you a
            tighter cut — no account, no paywall.
          </p>
        </div>
        <div className="waveform" aria-hidden="true">
          {bars.map((h, i) => (
            <span
              key={i}
              style={{ ["--bar" as string]: h, animationDelay: `${i * 0.06}s` }}
            />
          ))}
        </div>
      </section>

      <SilenceUploader />

      <footer className="footer">
        <nav className="footer__links" aria-label="Legal">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
        <p>
          Fair use limits apply. Files are kept for 1 day, then deleted. Recent
          files on this device stay available until then.
        </p>
      </footer>
    </main>
  );
}
