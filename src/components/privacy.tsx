import React from "react";

interface PrivacyPageProps {
  onBack: () => void;
}
export default function PrivacyPage({onBack}: PrivacyPageProps) {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12 ">
       
       <button 
        onClick={onBack} 
        style={{height:'40px',width:'130px', background: 'var(--neon-cyan)',  color: 'var(--bg-primary)',borderRadius:"7px",fontWeight:"500",fontSize:"15px",borderColor:'white'}}
      >
        ← Back to Home
      </button>
   <h1 style={{
                      background: "rgba(0,255,200,0.1)",
                      border: "1px solid rgba(0,255,200,0.3)",
                      outline: "none",
                      color: "#fff",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      boxSizing: "border-box",
                      
                    }}>
        Privacy Policy
      </h1>

      <p className="text-gray-500 mb-8">Last Updated: June 2026</p>

      <section >
        <p style={{fontSize:'25px',background:'rgba(0,255,200,0.1)'}}>
          Welcome to Spectrax. Your privacy is important to us. This Privacy
          Policy explains how we collect, use, store, and protect your
          information when using our fitness and exercise tracking platform.
        </p>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}}>
          <h2 className="text-2xl font-semibold mb-2">
            Information We Collect
          </h2>

          <h3 className="font-semibold mt-4">Account Information</h3>
          <ul className="list-disc pl-6" style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}}>
            <li>Name (if provided)</li>
            <li>Email address</li>
            <li>User account identifiers</li>
            <li>Authentication information</li>
          </ul>

          <h3 className="font-semibold mt-4">Workout Data</h3>
          <ul className="list-disc pl-6" style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}}>
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
          <ul className="list-disc pl-6" style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}}>
            <li>Live camera feed used for exercise tracking</li>
            <li>Body movement analysis</li>
            <li>Exercise form detection</li>
            <li>Body type calibration information</li>
          </ul>

          <p style={{backgroundColor:'white'}}>
            Camera data is processed for workout tracking and form analysis. We
            do not intentionally store video recordings unless explicitly stated
            within a feature.
          </p>

          <h3 className="font-semibold mt-4">Technical Information</h3>
          <ul className="list-disc pl-6"style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}}>
            <li>Device information</li>
            <li>Browser information</li>
            <li>IP address</li>
            <li>Operating system</li>
            <li>Error logs</li>
            <li>Performance diagnostics</li>
            <li>Application usage data</li>
          </ul>
        </div>

        <div >
          <h2 className="text-2xl font-semibold mb-2">
            How We Use Your Information
          </h2>

          <ul className="list-disc pl-6" style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}}>
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
          <h2 className="text-2xl font-semibold mb-2" style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}}>
            Local Storage & Offline Data
          </h2>

          <p style={{backgroundColor:'white'}}>
            Spectrax stores certain information locally on your device to
            provide offline functionality and session recovery.
          </p>

          <ul className="list-disc pl-6 mt-2">
            <li>User preferences</li>
            <li>Theme settings</li>
            <li>Fitness calculator values</li>
            <li>Offline application data</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2" style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}}>
            Authentication Services
          </h2>

          <p style={{backgroundColor:'white'}}>
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

          <p style={{backgroundColor:'white'}}>
            Workout records and profile information may be synchronized with
            cloud services to allow access across devices and prevent data loss.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2" style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}}>
            Cookies & Similar Technologies
          </h2>

          <p style={{backgroundColor:'white'}}>
            We may use cookies, local storage, service workers, and similar
            technologies to:
          </p>

          <ul className="list-disc pl-6 mt-2" >
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

          <ul className="list-disc pl-6 mt-2" style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}}>
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
          <h2 className="text-2xl font-semibold mb-2 style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}}>">Your Rights</h2>

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
          <h2 className="text-2xl font-semibold mb-2" style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}}>
            Changes to This Policy
          </h2>

          <p>
            We may update this Privacy Policy from time to time. Changes become
            effective when published on this page.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2"style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}}>Contact Us</h2>

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
