import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy — Silence Remover by Puhulab",
  description:
    "How Silence Remover by Puhulab handles uploads, temporary storage, and privacy.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="July 20, 2026">
      <div className="legal__callout">
        <strong>Privacy-first, no accounts.</strong> Silence Remover does not
        require signup. Media you upload is processed to remove quiet gaps,
        stored temporarily (about one day), then deleted. We do not use your
        files to train AI models.
      </div>

      <p>
        This Privacy Policy explains how Puhulab (&quot;we&quot;,
        &quot;us&quot;) collects, uses, and protects information when you use
        Silence Remover at{" "}
        <a href="https://silence-remover.puhulab.com">
          silence-remover.puhulab.com
        </a>{" "}
        (the &quot;Service&quot;). By using the Service, you agree to this
        policy.
      </p>

      <nav className="legal__toc" aria-label="Contents">
        <h2 className="legal__h2">Contents</h2>
        <ul>
          <li>
            <a href="#commitment">Our commitment</a>
          </li>
          <li>
            <a href="#collect">What we collect</a>
          </li>
          <li>
            <a href="#use">How we use information</a>
          </li>
          <li>
            <a href="#media">Media processing and storage</a>
          </li>
          <li>
            <a href="#third-parties">Third-party services</a>
          </li>
          <li>
            <a href="#retention">Data retention</a>
          </li>
          <li>
            <a href="#rights">Your rights and controls</a>
          </li>
          <li>
            <a href="#security">Security</a>
          </li>
          <li>
            <a href="#children">Children&apos;s privacy</a>
          </li>
          <li>
            <a href="#international">International users</a>
          </li>
          <li>
            <a href="#changes">Changes</a>
          </li>
          <li>
            <a href="#contact">Contact</a>
          </li>
        </ul>
      </nav>

      <h2 id="commitment" className="legal__h2">
        Our commitment
      </h2>
      <ul>
        <li>
          <strong>No accounts:</strong> we do not require email signup or a user
          profile to process a file
        </li>
        <li>
          <strong>Temporary storage:</strong> input and output objects are kept
          briefly (default one day), then removed by automated cleanup
        </li>
        <li>
          <strong>No AI training on your media:</strong> uploaded audio/video is
          not used to train machine-learning models
        </li>
        <li>
          <strong>Purpose-limited processing:</strong> files are processed only
          to provide silence removal and related download/preview features
        </li>
      </ul>

      <h2 id="collect" className="legal__h2">
        What information we collect
      </h2>
      <h3 className="legal__h3">Media and job data</h3>
      <ul>
        <li>
          Audio or video files you upload, and the processed output we generate
        </li>
        <li>
          Job metadata such as original filename, status, approximate durations,
          object storage keys, and timestamps
        </li>
        <li>
          A random job token used to authorize status checks and downloads (also
          stored in your browser&apos;s local storage if you use &quot;recent
          files&quot;)
        </li>
      </ul>
      <h3 className="legal__h3">Technical and usage data</h3>
      <ul>
        <li>
          Network address (IP) used for rate limiting and abuse prevention
        </li>
        <li>
          Basic request logs from our application and edge/network providers
          (for example timestamps, paths, user agent)
        </li>
        <li>
          Optional browser storage on your device (job id/token history for up
          to about one day)
        </li>
        <li>
          Privacy-friendly analytics events (page views and product actions such
          as upload started or download) via self-hosted Umami — no account
          identity, and no filenames or job tokens in analytics payloads
        </li>
      </ul>
      <p>
        We do not collect payment information, and we do not require your name
        or email to use the core Service (unless you choose to email us for
        support).
      </p>

      <h2 id="use" className="legal__h2">
        How we use information
      </h2>
      <ul>
        <li>To run silence-removal jobs and provide preview/download</li>
        <li>To enforce fair-use limits and protect the Service from abuse</li>
        <li>To operate, debug, and improve reliability of the Service</li>
        <li>To respond if you contact us</li>
        <li>To comply with law when required</li>
      </ul>

      <h2 id="media" className="legal__h2">
        Media processing and storage
      </h2>
      <p>When you upload a file:</p>
      <ul>
        <li>
          Your browser typically uploads directly to object storage using a
          short-lived signed URL
        </li>
        <li>
          Our worker downloads the file, processes it (speech/silence detection
          and editing), and stores the output
        </li>
        <li>
          Preview and download use short-lived signed URLs; downloads are
          intended as attachments rather than permanent public links
        </li>
      </ul>
      <p>
        Anyone who obtains a valid job token and signed URL while it is active
        could access that job&apos;s media. Tokens are meant to stay on your
        device; do not share them.
      </p>

      <h2 id="third-parties" className="legal__h2">
        Third-party services
      </h2>
      <p>
        We use infrastructure providers to run the Service. Depending on
        deployment, this may include:
      </p>
      <ul>
        <li>
          <strong>Cloudflare</strong> (for example R2 object storage, DNS, and
          related network services) — may process IP addresses, access logs, and
          stored objects
        </li>
        <li>
          <strong>Hosting / VPS providers</strong> running our web, API, worker,
          database, and queue containers
        </li>
        <li>
          <strong>Umami</strong> (self-hosted at{" "}
          <a href="https://umami.puhulab.com">umami.puhulab.com</a>) — page
          views and anonymized usage events to understand how the Service is
          used. Umami does not use cookies for visitor identity
        </li>
      </ul>
      <p>
        We share information with providers only as needed to operate the
        Service, or if required by law. We do not sell personal information.
      </p>

      <h2 id="retention" className="legal__h2">
        Data retention
      </h2>
      <ul>
        <li>
          <strong>Media objects:</strong> deleted automatically after about{" "}
          <strong>one day</strong> (configurable server-side retention)
        </li>
        <li>
          <strong>Job records:</strong> may remain in our database for
          operations and abuse prevention after object keys are cleared; they do
          not keep your media once objects are purged
        </li>
        <li>
          <strong>Browser local storage:</strong> recent-file entries on your
          device for up to about one day, or until you clear site data
        </li>
        <li>
          <strong>Server logs:</strong> retained only as long as reasonably
          needed for security and operations
        </li>
      </ul>

      <h2 id="rights" className="legal__h2">
        Your rights and controls
      </h2>
      <ul>
        <li>
          <strong>Device control:</strong> clear site data / local storage to
          remove recent-file tokens from your browser
        </li>
        <li>
          <strong>Downloads:</strong> save processed files to your own device;
          we do not provide long-term cloud libraries
        </li>
        <li>
          <strong>Requests:</strong> contact us to ask about access or deletion
          related to logs or job metadata we may still hold
        </li>
      </ul>
      <p>
        Because there is no account, we may need technical details (such as
        approximate time of upload or a job reference) to locate relevant
        records.
      </p>

      <h2 id="security" className="legal__h2">
        Security
      </h2>
      <p>
        We use HTTPS, signed object URLs, and standard cloud security practices.
        No method of transmission or storage is 100% secure. You use the Service
        at your own risk regarding highly sensitive media.
      </p>

      <h2 id="children" className="legal__h2">
        Children&apos;s privacy
      </h2>
      <p>
        The Service is not directed to children under 13. We do not knowingly
        collect personal information from children under 13. If you believe a
        child has provided such information through the Service, contact us and
        we will take appropriate steps.
      </p>

      <h2 id="international" className="legal__h2">
        International users
      </h2>
      <p>
        The Service may be hosted or use providers in multiple regions. If you
        access it from another country, your information may be processed in
        places with different data-protection laws. By using the Service, you
        understand that transfer may occur as needed to provide the Service.
      </p>

      <h2 id="changes" className="legal__h2">
        Changes to this policy
      </h2>
      <p>
        We may update this Privacy Policy from time to time. The &quot;Last
        updated&quot; date will change when we do. Continued use after updates
        constitutes acceptance of the revised policy.
      </p>

      <h2 id="contact" className="legal__h2">
        Contact
      </h2>
      <p>
        Privacy questions:{" "}
        <a href="mailto:info@puhulab.com">info@puhulab.com</a>.
      </p>
      <p>
        See also our <Link href="/terms">Terms and Conditions</Link>.
      </p>
    </LegalShell>
  );
}
