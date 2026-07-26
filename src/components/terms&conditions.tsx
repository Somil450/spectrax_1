import { Radius } from "lucide-react";
import React from "react";
interface TermsAndConditionsProps {
  onBack: () => void;
}
export default function TermsAndConditions({onBack}:TermsAndConditionsProps) {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
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
                      
                    }}>Terms & Conditions</h1>

      <p className="text-gray-500 mb-8">Last Updated: June 2026</p>

      <section className="space-y-8">
        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}}>
            1. Acceptance of Terms
          </h2>
          <p >
            By accessing or using Spectrax (&quot;the Service&quot;), you agree to
            be bound by these Terms and Conditions. If you do not agree with any
            part of these terms, you must not use the Service.
          </p>
        </div>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}} >2. Eligibility</h2>
          <p>
            You must be at least 13 years old or the minimum legal age required
            in your jurisdiction to use Spectrax.
          </p>

          <p className="mt-2">
            By using the Service, you represent that you meet these eligibility
            requirements.
          </p>
        </div>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}}>3. User Accounts</h2>

          <ul className="list-disc pl-6 space-y-2">
            <li>
              You are responsible for maintaining the confidentiality of your
              account credentials.
            </li>
            <li>
              You are responsible for all activities occurring under your
              account.
            </li>
            <li>You must provide accurate and current account information.</li>
            <li>
              We reserve the right to suspend or terminate accounts that violate
              these terms.
            </li>
          </ul>
        </div>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}}>
            4. Fitness & Health Disclaimer
          </h2>

          <p>
            Spectrax provides exercise tracking, workout analytics, and fitness
            guidance for informational purposes only.
          </p>

          <p className="mt-3">
            Spectrax is not a medical device and does not provide medical,
            health, nutritional, or professional fitness advice.
          </p>

          <p className="mt-3">
            You should consult a qualified healthcare professional before
            beginning any exercise program.
          </p>

          <p className="mt-3 font-medium">
            You participate in workouts entirely at your own risk.
          </p>
        </div>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}}>5. Camera Usage</h2>

          <p>
            Certain features require access to your device camera for exercise
            form detection and workout tracking.
          </p>

          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>Camera access is optional.</li>
            <li>
              Users may revoke camera permissions through device settings.
            </li>
            <li>
              Exercise detection accuracy may vary based on lighting,
              positioning, clothing, and hardware limitations.
            </li>
          </ul>
        </div>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}}>
            6. Workout Statistics & Accuracy
          </h2>

          <p>
            Spectrax attempts to provide accurate workout analytics, including:
          </p>

          <ul className="list-disc pl-6 mt-3">
            <li>Rep counting</li>
            <li>Accuracy scores</li>
            <li>Workout duration</li>
            <li>Streak calculations</li>
            <li>XP progression</li>
            <li>Calorie estimates</li>
          </ul>

          <p className="mt-3">
            These values are estimates only and should not be relied upon for
            medical, nutritional, or professional purposes.
          </p>
        </div>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}}>7. Acceptable Use</h2>

          <p>You agree not to:</p>

          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>Use the Service for unlawful purposes.</li>
            <li>Attempt to gain unauthorized access to systems.</li>
            <li>Reverse engineer or exploit the application.</li>
            <li>Interfere with application security features.</li>
            <li>Upload malicious software or harmful content.</li>
            <li>Use automated tools to abuse the Service.</li>
          </ul>
        </div>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}}>8. User Content</h2>

          <p>
            You retain ownership of any content, workout records, profile data,
            or information you submit through the Service.
          </p>

          <p className="mt-3">
            You grant Spectrax the right to process and store such information
            solely for operating and improving the Service.
          </p>
        </div>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}}>
            9. Intellectual Property
          </h2>

          <p>
            Spectrax, including its software, branding, logos, designs, exercise
            tracking systems, user interface, and related materials, is
            protected by intellectual property laws.
          </p>

          <p className="mt-3">
            You may not reproduce, modify, distribute, or create derivative
            works without prior written permission.
          </p>
        </div>

        <div>
          <h2 style={{textAlign:'center'}}>
            10. Availability of Service
          </h2>

          <p>
            We strive to maintain uninterrupted service but cannot guarantee
            continuous availability.
          </p>

          <p className="mt-3">
            Features may be modified, suspended, or discontinued without prior
            notice.
          </p>
        </div>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}}>
            11. Limitation of Liability
          </h2>

          <p>
            To the maximum extent permitted by law, Spectrax and its operators
            shall not be liable for:
          </p>

          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>Exercise-related injuries.</li>
            <li>Health complications.</li>
            <li>Loss of workout data.</li>
            <li>Service interruptions.</li>
            <li>Device malfunctions.</li>
            <li>Indirect or consequential damages.</li>
          </ul>
        </div>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}}>12. Indemnification</h2>

          <p>
            You agree to indemnify and hold harmless Spectrax, its owners,
            employees, and affiliates from claims arising from your use of the
            Service or violation of these Terms.
          </p>
        </div>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}}>13. Termination</h2>

          <p>
            We reserve the right to suspend or terminate access to the Service
            at any time for violations of these Terms or for security,
            operational, or legal reasons.
          </p>
        </div>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}}>14. Privacy</h2>

          <p>Your use of Spectrax is also governed by our Privacy Policy.</p>

          <a
            href="/privacy"
            className="text-blue-500 hover:underline mt-2 inline-block"
          >
            View Privacy Policy
          </a>
        </div>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}}>15. Changes to Terms</h2>

          <p>
            We may update these Terms from time to time. Continued use of the
            Service after updates constitutes acceptance of the revised Terms.
          </p>
        </div>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}}>16. Governing Law</h2>

          <p>
            These Terms shall be governed and interpreted in accordance with
            applicable laws of the jurisdiction in which Spectrax operates.
          </p>
        </div>

        <div style={{  boxShadow: '0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)'}} >
          <h2 style={{textAlign:'center'}}>
            17. Contact Information
          </h2>

          <p>
            If you have questions regarding these Terms and Conditions, please
            contact us.
          </p>

          <div className="mt-4 p-4 border rounded-lg">
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
