import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Terms and Conditions — Silence Remover by Puhulab",
  description:
    "Terms governing use of Silence Remover by Puhulab — free silence removal for audio and video.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms and Conditions" updated="July 20, 2026">
      <div className="legal__callout">
        <strong>Key points.</strong> Silence Remover is a free web tool by
        Puhulab. No account is required. You upload media to process silence
        removal; files are stored temporarily and deleted after one day. We do
        not sell your media or use it to train AI models.
      </div>

      <p>
        These Terms and Conditions (&quot;Terms&quot;) govern your use of the
        Silence Remover website and related services at{" "}
        <a href="https://silence-remover.puhulab.com">
          silence-remover.puhulab.com
        </a>{" "}
        (the &quot;Service&quot;), operated by Puhulab. By accessing or using
        the Service, you agree to these Terms. If you do not agree, do not use
        the Service.
      </p>

      <nav className="legal__toc" aria-label="Contents">
        <h2 className="legal__h2">Contents</h2>
        <ul>
          <li>
            <a href="#eligibility">Eligibility</a>
          </li>
          <li>
            <a href="#how-it-works">How the Service works</a>
          </li>
          <li>
            <a href="#your-content">Your content and ownership</a>
          </li>
          <li>
            <a href="#acceptable-use">Acceptable use</a>
          </li>
          <li>
            <a href="#fair-use">Fair use and rate limits</a>
          </li>
          <li>
            <a href="#disclaimers">Disclaimers and limitations</a>
          </li>
          <li>
            <a href="#ip">Intellectual property</a>
          </li>
          <li>
            <a href="#changes">Changes to Terms</a>
          </li>
          <li>
            <a href="#contact">Contact</a>
          </li>
          <li>
            <a href="#indemnification">Indemnification</a>
          </li>
          <li>
            <a href="#governing-law">Governing law</a>
          </li>
        </ul>
      </nav>

      <h2 id="eligibility" className="legal__h2">
        Eligibility
      </h2>
      <p>
        You must be at least 13 years old to use the Service. If you are under
        18, you must have parental or guardian consent. By using the Service,
        you represent that you meet these requirements.
      </p>
      <p>
        No account registration is required. Access is provided on a free,
        no-signup basis, subject to automated fair-use limits (for example,
        limits based on network address).
      </p>

      <h2 id="how-it-works" className="legal__h2">
        How the Service works
      </h2>
      <p>Silence Remover provides:</p>
      <ul>
        <li>
          Upload of audio or video files for automatic silence / quiet-gap
          removal
        </li>
        <li>
          Temporary storage of input and output files in object storage (for
          example Cloudflare R2)
        </li>
        <li>
          In-browser preview of original and processed media, duration
          comparison, and download of the processed file
        </li>
        <li>
          Optional &quot;recent files&quot; access on the same browser device
          via local storage for up to one day
        </li>
      </ul>
      <p>
        Processing runs on our infrastructure (application servers and workers).
        File uploads and downloads are typically transferred directly between
        your browser and object storage using short-lived signed URLs; we do not
        claim ownership of your media.
      </p>

      <h2 id="your-content" className="legal__h2">
        Your content and ownership
      </h2>
      <p>
        You retain ownership of all media you upload and of the processed
        outputs generated for you (&quot;Your Content&quot;).
      </p>
      <p>By using the Service, you grant Puhulab a limited license to:</p>
      <ul>
        <li>
          Receive, store, and process Your Content solely to provide silence
          removal and related features you request
        </li>
        <li>
          Use trusted infrastructure providers (hosting, object storage,
          networking) as needed to operate the Service
        </li>
      </ul>
      <p>We will not:</p>
      <ul>
        <li>Use Your Content to train AI models</li>
        <li>
          Sell Your Content or share it for advertising or marketing
        </li>
        <li>Claim ownership of Your Content</li>
      </ul>
      <p>
        You are solely responsible for Your Content and must have the rights to
        upload and process it. Do not upload material you are not allowed to
        use.
      </p>

      <h2 id="acceptable-use" className="legal__h2">
        Acceptable use
      </h2>
      <p>You agree to use the Service lawfully. You must not:</p>
      <ul>
        <li>Use the Service for illegal purposes or to violate any law</li>
        <li>
          Upload content that infringes intellectual property or privacy rights
        </li>
        <li>
          Upload malware, or attempt to hack, scrape, overload, or disrupt the
          Service
        </li>
        <li>
          Circumvent rate limits, abuse shared infrastructure, or automate
          excessive use beyond fair-use limits
        </li>
        <li>
          Use the Service to process child sexual abuse material or other
          prohibited illegal content
        </li>
      </ul>
      <p>
        We may block access, delete stored objects, or refuse service when we
        reasonably believe these Terms are violated.
      </p>

      <h2 id="fair-use" className="legal__h2">
        Fair use and rate limits
      </h2>
      <p>
        The Service is free and capacity-limited. We apply automated limits
        (including per network address / IP), maximum upload size, and temporary
        retention of files (typically one day). Limits may change. Exceeding
        limits may result in temporary refusal of new jobs without affecting
        prior lawful use.
      </p>

      <h2 id="disclaimers" className="legal__h2">
        Disclaimers and limitations of liability
      </h2>
      <h3 className="legal__h3">Service provided &quot;as is&quot;</h3>
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available&quot;
        without warranties of any kind, express or implied. We do not guarantee
        uninterrupted, secure, or error-free operation; that processing results
        will meet your expectations; or that every bug will be fixed.
      </p>
      <h3 className="legal__h3">Processing quality</h3>
      <p>
        Silence detection and cutting are automated. Results may remove wanted
        quiet, keep unwanted noise, or clip speech. You should review outputs
        before professional or public use. We are not liable for decisions made
        based on processed media.
      </p>
      <h3 className="legal__h3">Data loss and retention</h3>
      <p>
        Files are stored temporarily and deleted on a retention schedule
        (default: one day). Browser &quot;recent files&quot; data lives on your
        device and may be cleared if you wipe site data. We are not responsible
        for loss due to retention, user deletion of browser data, outages, or
        other failures. Keep your own backups of important media.
      </p>
      <h3 className="legal__h3">Third-party infrastructure</h3>
      <p>
        The Service relies on third parties (for example cloud hosting, object
        storage such as Cloudflare R2, and network providers). We are not
        responsible for their outages, policy changes, or security incidents
        beyond our reasonable control.
      </p>
      <h3 className="legal__h3">Limitation of liability</h3>
      <p>
        To the fullest extent permitted by law, Puhulab and its team will not be
        liable for any indirect, incidental, special, consequential, or punitive
        damages, including loss of data, revenue, or opportunities, arising from
        your use of the Service.
      </p>

      <h2 id="ip" className="legal__h2">
        Intellectual property
      </h2>
      <p>
        The Silence Remover product name, branding, site design, and software
        (excluding Your Content) are owned by Puhulab or its licensors. You
        receive a limited, non-exclusive, non-transferable right to use the
        Service for personal or internal purposes as provided. You may not copy,
        reverse engineer, or misuse our trademarks or branding without
        permission.
      </p>

      <h2 id="changes" className="legal__h2">
        Changes to these Terms
      </h2>
      <p>
        We may update these Terms from time to time. The &quot;Last
        updated&quot; date above reflects the latest revision. Material changes
        may be indicated on the website. Continued use after changes take effect
        constitutes acceptance. If you do not agree, stop using the Service.
      </p>

      <h2 id="contact" className="legal__h2">
        Contact
      </h2>
      <p>
        Questions about these Terms:{" "}
        <a href="mailto:info@puhulab.com">info@puhulab.com</a>. We
        typically respond within a few business days.
      </p>
      <p>
        See also our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2 id="indemnification" className="legal__h2">
        Indemnification
      </h2>
      <p>
        You agree to indemnify and hold harmless Puhulab and its providers from
        claims, damages, and expenses (including reasonable legal fees) arising
        from your use of the Service, your violation of these Terms, or Your
        Content.
      </p>

      <h2 id="governing-law" className="legal__h2">
        Governing law and disputes
      </h2>
      <p>
        These Terms are governed by applicable law. Disputes should first be
        addressed in good faith with us. If unresolved, disputes may be brought
        before competent courts in the appropriate jurisdiction.
      </p>
      <p>
        By using Silence Remover, you acknowledge that you have read and agree
        to these Terms and our Privacy Policy.
      </p>
    </LegalShell>
  );
}
