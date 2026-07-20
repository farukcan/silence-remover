import Link from "next/link";
import type { ReactNode } from "react";

type LegalShellProps = {
  title: string;
  updated: string;
  children: ReactNode;
};

export function LegalShell({ title, updated, children }: LegalShellProps) {
  return (
    <main className="shell legal">
      <header className="brand">
        <Link href="/" className="brand__lockup brand__lockup--link">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="brand__mark"
            src="/brand/icon.svg"
            alt=""
            width={56}
            height={56}
          />
          <div className="brand__text">
            <p className="brand__name brand__name--sm">Silence Remover</p>
            <p className="brand__tag">by Puhulab</p>
          </div>
        </Link>
        <Link href="/" className="legal__back">
          ← Back
        </Link>
      </header>

      <article className="legal__doc">
        <h1 className="legal__title">{title}</h1>
        <p className="legal__updated">Last updated: {updated}</p>
        {children}
      </article>

      <footer className="footer legal__footer">
        <nav className="legal__nav" aria-label="Legal">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/">Home</Link>
        </nav>
        <p>Silence Remover by Puhulab</p>
      </footer>
    </main>
  );
}
