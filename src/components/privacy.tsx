import React from "react";

export default function PrivacyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>

      <p className="text-gray-500 mb-8">Last Updated: June 2026</p>

      <section className="space-y-6">
        <p>
          Welcome to Spectrax. Your privacy is important to us. This Privacy
          Policy explains how we collect, use, store, and protect your
          information when using our fitness and exercise tracking platform.
        </p>

        <div>
          <h2 className="text-2xl font-semibold mb-2">
            Information We Collect
          </h2>

          <h3 className="font-semibold mt-4">Account Information</h3>
          <ul className="list-disc pl-6">
            <li>Name (if provided)</li>
            <li>Email address</li>
            <li>User account identifiers</li>
            <li>Authentication information</li>
          </ul>

          <h3 className="font-semibold mt-4">Workout Data</h3>
          <ul className="list-disc pl-6">
            <li>Exercise selections</li>
            <li>Repetition counts</li>
            <li>Accuracy scores</li>
            <li>Workout duration</li>
            <li>Calories burned estimates</li>
            <li>Workout history</li>
            <li>Achievement and badge progress</li>
            <li>Level and XP progression</li>
          </ul>

          <h3 className="font-semibold mt-4">Camera Data</h3>
          <ul className="list-disc pl-6">
            <li>Live camera feed used for exercise tracking</li>
            <li>Body movement analysis</li>
            <li>Exercise form detection</li>
            <li>Body type calibration information</li>
          </ul>

          <p className="mt-2">
            Camera data is processed for workout tracking and form analysis. We
            do not intentionally store video recordings unless explicitly stated
            within a feature.
          </p>

          <h3 className="font-semibold mt-4">Technical Information</h3>
          <ul className="list-disc pl-6">
            <li>Device information</li>
            <li>Browser information</li>
            <li>IP address</li>
            <li>Operating system</li>
            <li>Error logs</li>
            <li>Performance diagnostics</li>
            <li>Application usage data</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">
            How We Use Your Information
          </h2>

          <ul className="list-disc pl-6">
            <li>Provide fitness tracking services</li>
            <li>Authenticate users</li>
            <li>Track workout performance</li>
            <li>Calculate exercise statistics</li>
            <li>Estimate calories burned</li>
            <li>Store workout history</li>
            <li>Award achievements and badges</li>
            <li>Improve exercise detection accuracy</li>
            <li>Maintain application security</li>
            <li>Improve application performance</li>
            <li>Provide customer support</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">
            Local Storage & Offline Data
          </h2>

          <p>
            Spectrax stores certain information locally on your device to
            provide offline functionality and session recovery.
          </p>

          <ul className="list-disc pl-6 mt-2">
            <li>Workout session snapshots</li>
            <li>User preferences</li>
            <li>Theme settings</li>
            <li>Fitness calculator values</li>
            <li>Offline application data</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">
            Authentication Services
          </h2>

          <p>
            We may use Firebase Authentication and related authentication
            providers to manage user accounts securely.
          </p>

          <p className="mt-2">
            Authentication providers may process your information according to
            their own privacy policies.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">Data Synchronization</h2>

          <p>
            Workout records and profile information may be synchronized with
            cloud services to allow access across devices and prevent data loss.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">
            Cookies & Similar Technologies
          </h2>

          <p>
            We may use cookies, local storage, service workers, and similar
            technologies to:
          </p>

          <ul className="list-disc pl-6 mt-2">
            <li>Keep you signed in</li>
            <li>Remember preferences</li>
            <li>Enable offline functionality</li>
            <li>Improve performance</li>
            <li>Analyze application usage</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">Data Sharing</h2>

          <p>We do not sell your personal information.</p>

          <p className="mt-2">Information may be shared only with:</p>

          <ul className="list-disc pl-6 mt-2">
            <li>Cloud hosting providers</li>
            <li>Authentication providers</li>
            <li>Analytics and monitoring services</li>
            <li>Legal authorities when required by law</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">Data Security</h2>

          <p>
            We implement industry-standard security measures to protect user
            data against unauthorized access, alteration, disclosure, or
            destruction.
          </p>

          <p className="mt-2">
            However, no method of transmission or storage is 100% secure.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">Your Rights</h2>

          <ul className="list-disc pl-6">
            <li>Access your personal information</li>
            <li>Correct inaccurate information</li>
            <li>Delete your account</li>
            <li>Request export of your data</li>
            <li>Withdraw consent where applicable</li>
            <li>Object to certain processing activities</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">Children&apos;s Privacy</h2>

          <p>
            Spectrax is not intended for children under 13 years of age. We do
            not knowingly collect information from children under 13.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">
            Changes to This Policy
          </h2>

          <p>
            We may update this Privacy Policy from time to time. Changes become
            effective when published on this page.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">Contact Us</h2>

          <p>
            If you have any questions regarding this Privacy Policy or your
            personal data, please contact us:
          </p>

          <div className="mt-4 p-4 rounded-lg border">
            <p>
              <strong>Spectrax Support</strong>
            </p>
            <p>Email: support@spectrax.app</p>
            <p>Website: https://spectrax.app</p>
          </div>
        </div>
      </section>
    </main>
  );
}
