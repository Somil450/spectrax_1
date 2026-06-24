import React, { useState } from "react";
import {
  Github,
  Users,
  Shield,
  ArrowLeft,
  BookOpen,
  Award,
  Target,
} from "lucide-react";

export const Documentation: React.FC<{ onBack?: () => void }> = ({
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<"contributing" | "conduct">(
    "contributing",
  );

  return (
    <div className="documentation-page">
      <div className="doc-header">
        {onBack && (
          <button onClick={onBack} className="doc-back-btn">
            <ArrowLeft size={20} /> Back to Home
          </button>
        )}
        <div className="doc-title">
          <BookOpen size={36} />
          <h1>SpectraX Documentation</h1>
        </div>
        <p className="doc-subtitle">
          Complete guide for contributors and community standards
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="doc-tabs">
        <button
          className={`tab-btn ${activeTab === "contributing" ? "active" : ""}`}
          onClick={() => setActiveTab("contributing")}
        >
          <Users size={20} />
          Contributing Guide
        </button>
        <button
          className={`tab-btn ${activeTab === "conduct" ? "active" : ""}`}
          onClick={() => setActiveTab("conduct")}
        >
          <Shield size={20} />
          Code of Conduct
        </button>
      </div>

      <div className="doc-content">
        {/* ==================== CONTRIBUTING GUIDE ==================== */}
        {activeTab === "contributing" && (
          <div className="doc-section">
            <h2>Contributing to SpectraX</h2>
            <p>
              First off, thank you for considering contributing to SpectraX!
              <br />
              We truly appreciate your time and effort in helping improve the
              project.
            </p>
            <p>
              SpectraX is proudly participating in{" "}
              <strong>GirlScript Summer of Code 2026 (GSSoC'26)</strong> 💙
            </p>

            <h3>🌟 GSSoC'26 Contribution Guidelines</h3>

            <h4>📌 Issue Assignment</h4>
            <ul>
              <li>Browse available issues from the Issues section.</li>
              <li>Comment on the issue you want to work on.</li>
              <li>
                Wait until a maintainer assigns the issue to you before starting
                work.
              </li>
            </ul>
            <pre>
              I would like to work on this issue under GSSoC'26.
              <br />
              Please assign it to me.
            </pre>

            <h4>🏷️ Issue Labels</h4>
            <div className="two-column-grid">
              <div>
                <strong>gssoc-26</strong> — GSSoC contribution issue
                <br />
                <strong>good first issue</strong> — Beginner-friendly issue
                <br />
                <strong>bug</strong> — Bug fixes
              </div>
              <div>
                <strong>enhancement</strong> — Feature improvements
                <br />
                <strong>documentation</strong> — Documentation-related tasks
              </div>
            </div>

            <h4>🛠️ Project Setup</h4>
            <ol>
              <li>
                <strong>Fork the Repository</strong> — Click the Fork button on
                GitHub.
              </li>
              <li>
                <strong>Clone Your Fork</strong>
                <pre>
                  git clone https://github.com/YOUR_USERNAME/spectrax_1.git
                  <br />
                  cd spectrax_1
                </pre>
              </li>
              <li>
                <strong>Create a New Branch</strong>
                <pre>git checkout -b feature/your-feature-name</pre>
              </li>
            </ol>

            <h4>📌 Branch Naming Conventions</h4>
            <div className="two-column-grid">
              <div>
                <strong>feature/</strong> — New features
              </div>
              <div>
                <strong>bugfix/</strong> — Bug fixes
              </div>
              <div>
                <strong>docs/</strong> — Documentation updates
              </div>
              <div>
                <strong>refactor/</strong> — Code refactoring
              </div>
              <div>
                <strong>test/</strong> — Adding tests
              </div>
            </div>

            <h4>📦 Install Dependencies</h4>
            <strong>Frontend</strong>
            <pre>npm install</pre>
            <strong>Backend</strong>
            <pre>
              cd server
              <br />
              npm install
              <br />
              cd ..
            </pre>

            <h4>▶️ Running the Project</h4>
            <strong>Start Frontend</strong>
            <pre>npm run dev</pre>
            <strong>Start Backend</strong>
            <pre>
              cd server
              <br />
              npm start
            </pre>

            <h4>💬 Commit Message Guidelines</h4>
            <div className="two-column-grid">
              <div>
                <strong>feat:</strong> New feature
              </div>
              <div>
                <strong>fix:</strong> Bug fix
              </div>
              <div>
                <strong>docs:</strong> Documentation
              </div>
              <div>
                <strong>style:</strong> UI/Formatting
              </div>
              <div>
                <strong>refactor:</strong> Code restructuring
              </div>
              <div>
                <strong>test:</strong> Testing
              </div>
            </div>

            <h4>🧪 Testing Instructions</h4>
            <ul>
              <li>
                Run <code>npm run lint</code>
              </li>
              <li>
                Run <code>npm run build</code>
              </li>
              <li>Test your feature locally</li>
              <li>Check browser responsiveness</li>
              <li>Ensure there are no console errors</li>
            </ul>

            <h4>🎨 Code Style Guidelines</h4>
            <ul>
              <li>Use Prettier for formatting</li>
              <li>Follow ESLint rules</li>
              <li>Write clean and readable code</li>
              <li>Prefer reusable components</li>
              <li>Use React functional components and hooks</li>
              <li>Avoid unnecessary dependencies</li>
            </ul>

            <h4>🔄 Pull Request Process</h4>
            <ul>
              <li>Update your branch</li>
              <li>Test locally</li>
              <li>Update documentation if needed</li>
              <li>Push branch and open PR</li>
              <li>
                Link the issue (<code>Fixes #123</code>)
              </li>
              <li>Add screenshots/videos for UI changes</li>
            </ul>

            <h4>🛡️ Contribution Rules</h4>
            <ul>
              <li>PRs without linked issues may be closed</li>
              <li>Spam or low-quality PRs will not be accepted</li>
              <li>Avoid unnecessary file changes</li>
              <li>Follow repository structure</li>
            </ul>

            <h4>🤝 Need Help?</h4>
            <p>
              Open a discussion, ask in issue comments, or reach out to
              maintainers.
            </p>

            <div className="doc-cta">
              <a
                href="https://github.com/Somil450/spectrax_1"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-neon"
              >
                <Github size={18} /> View Repository
              </a>
            </div>
          </div>
        )}

        {/* ==================== CODE OF CONDUCT ==================== */}
        {activeTab === "conduct" && (
          <div className="doc-section">
            <h2>SpectraX Code of Conduct</h2>

            <h3>🤝 Our Commitment</h3>
            <p>
              We as contributors, maintainers, and community members pledge to
              create a welcoming, respectful, and harassment-free environment
              for everyone regardless of:
            </p>
            <div className="two-column-grid">
              <ul>
                <li>Age</li>
                <li>Body size</li>
                <li>Disability</li>
                <li>Ethnicity</li>
                <li>Gender identity and expression</li>
              </ul>
              <ul>
                <li>Experience level</li>
                <li>Nationality</li>
                <li>Personal appearance</li>
                <li>Race</li>
                <li>Religion</li>
                <li>Sexual identity and orientation</li>
              </ul>
            </div>

            <h3>✅ Expected Behavior</h3>
            <ul>
              <li>Using respectful and inclusive language</li>
              <li>Being supportive toward other contributors</li>
              <li>Accepting constructive feedback gracefully</li>
              <li>Respecting different viewpoints and experiences</li>
              <li>Focusing on collaboration and community growth</li>
              <li>Helping beginners and new contributors</li>
            </ul>

            <h3>❌ Unacceptable Behavior</h3>
            <ul>
              <li>Harassment, discrimination, or hateful conduct</li>
              <li>Trolling, insulting, or derogatory comments</li>
              <li>Personal or political attacks</li>
              <li>Public or private harassment</li>
              <li>Sharing someone’s private information without permission</li>
              <li>Posting inappropriate or offensive content</li>
              <li>
                Any conduct that could negatively affect the community
                environment
              </li>
            </ul>

            <h3>🛡️ Maintainer Responsibilities</h3>
            <ul>
              <li>Clarifying acceptable behavior standards</li>
              <li>Reviewing reported incidents fairly</li>
              <li>Taking appropriate corrective action when necessary</li>
              <li>Ensuring a healthy and inclusive project environment</li>
            </ul>
            <p>
              Maintainers may remove, edit, or reject contributions that violate
              this Code of Conduct.
            </p>

            <h3>🌍 Scope</h3>
            <p>
              This Code of Conduct applies within all project spaces, including
              GitHub repositories, issues, pull requests, discussions, chats,
              social media, and community events.
            </p>

            <h3>📢 Reporting Issues</h3>
            <p>
              If you experience or witness unacceptable behavior, please report
              it to the project maintainers.
              <br />
              <strong>Contact:</strong> [INSERT PROJECT EMAIL]
            </p>
            <p>
              All reports will be handled confidentially and reviewed fairly.
            </p>

            <h3>⚖️ Enforcement</h3>
            <p>
              Project maintainers may take any action they deem appropriate,
              including warnings, removal of comments, temporary restrictions,
              or permanent bans.
            </p>

            <h3>📚 Attribution</h3>
            <p>
              This Code of Conduct is adapted from the{" "}
              <a
                href="https://www.contributor-covenant.org/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Contributor Covenant
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Documentation;
