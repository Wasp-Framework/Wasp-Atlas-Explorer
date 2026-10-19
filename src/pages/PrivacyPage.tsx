import React from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export function PrivacyPage({ onOpenAbout }: { onOpenAbout: () => void }) {
  return (
    <div className="legal-page">
      <Navbar onOpenAbout={onOpenAbout} />
      <main className="legal-page__content">
        <h1 className="legal-page__title">Privacy Policy</h1>

        <section className="legal-page__section">
          <h2>Overview</h2>
          <p>
            WASP Atlas is a static, open-source website. We take your privacy
            seriously and have designed this site to collect as little data as
            possible.
          </p>
        </section>

        <section className="legal-page__section">
          <h2>Data collection</h2>
          <p>
            This website does <strong>not</strong> use cookies, analytics
            services, tracking pixels, or other user tracking. Browsing and
            editing an assembly does not upload the design. Optional sharing
            with HiveLens is described below.
          </p>
        </section>

        <section className="legal-page__section">
          <h2>Hosting</h2>
          <p>
            This website is hosted on GitHub Pages. GitHub may collect technical
            data such as IP addresses in server logs as part of their hosting
            service. For details, see the{' '}
            <a
              href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
              target="_blank"
              rel="noreferrer noopener"
            >
              GitHub Privacy Statement
            </a>.
          </p>
        </section>

        <section className="legal-page__section">
          <h2>Sharing assemblies with HiveLens</h2>
          <p>
            Choosing Create link in the Open in HiveLens dialog uploads a
            snapshot of your assembly, its filename, and model units to Vercel
            Blob storage through the HiveLens sharing service. Sharing does not
            require an account. Anyone with the link can download the snapshot
            until it expires, up to 24 hours after creation. Expired snapshots
            are scheduled for deletion; imported copies can remain on receiving
            devices. Avoid including information you do not want link recipients
            to access. Downloading a JSON file does not create an online share.
          </p>
          <p>
            HiveLens can save imported assemblies in the receiving browser.
            Users can remove these copies through its Local assemblies library
            or by clearing browser data. Requests to the sharing service also
            pass through Vercel hosting and abuse protection.
          </p>
        </section>

        <section className="legal-page__section">
          <h2>External links</h2>
          <p>
            This site contains links to external websites (GitHub, Food4Rhino,
            Google Forms). These third-party sites have their own privacy
            policies, and we have no control over their data practices.
          </p>
        </section>

        <section className="legal-page__section">
          <h2>Contact</h2>
          <p>
            If you have questions about this privacy policy, please contact us at{' '}
            <a href="mailto:hello@rogerwinkler.de">hello@rogerwinkler.de</a>.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
