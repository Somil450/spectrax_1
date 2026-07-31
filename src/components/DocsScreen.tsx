import React from 'react';
import {
  ArrowLeft,
  BookOpen,
  Rocket,
  GitBranch,
  HeartHandshake,
  Wrench,
  CheckCircle2,
  XCircle,
  Terminal,
  Github,
  GitPullRequest,
} from 'lucide-react';

interface DocsScreenProps {
  onBack: () => void;
}

const sectionCard: React.CSSProperties = {
  background: 'var(--glass-bg)',
  border: '1px solid var(--glass-border)',
  borderRadius: '16px',
  padding: '24px',
  marginTop: '20px',
  boxShadow: 'var(--glass-shadow)',
  boxSizing: 'border-box',
};

const h2Style: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
  color: 'var(--neon-cyan)',
  letterSpacing: '2px',
  textTransform: 'uppercase',
  marginBottom: '8px',
};

const h3Style: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1.05rem',
  color: 'var(--neon-purple)',
  marginTop: '20px',
  marginBottom: '8px',
};

const pStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  lineHeight: 1.7,
  fontSize: '0.95rem',
};

const codeStyle: React.CSSProperties = {
  display: 'block',
  background: 'rgba(0, 240, 255, 0.06)',
  border: '1px solid rgba(0, 240, 255, 0.2)',
  borderRadius: '8px',
  padding: '12px 16px',
  fontFamily: 'monospace',
  fontSize: '0.85rem',
  color: 'var(--neon-cyan)',
  margin: '10px 0',
  overflowX: 'auto',
  whiteSpace: 'pre',
};

const listStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  lineHeight: 1.8,
  fontSize: '0.9rem',
  paddingLeft: '20px',
  margin: '8px 0',
};

const inlineCode: React.CSSProperties = {
  background: 'rgba(0, 240, 255, 0.1)',
  color: 'var(--neon-cyan)',
  padding: '2px 6px',
  borderRadius: '4px',
  fontFamily: 'monospace',
  fontSize: '0.85em',
};

const chipRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  margin: '10px 0',
};

const chip: React.CSSProperties = {
  background: 'rgba(168, 85, 247, 0.1)',
  border: '1px solid rgba(168, 85, 247, 0.3)',
  color: 'var(--neon-purple)',
  padding: '4px 12px',
  borderRadius: '20px',
  fontSize: '0.75rem',
  fontWeight: 700,
  fontFamily: 'monospace',
};

export const DocsScreen: React.FC<DocsScreenProps> = ({ onBack }) => {
  return (
    <div className="screen-container" style={{ padding: 'clamp(16px, 4vw, 40px)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <button
          onClick={onBack}
          className="btn-outline"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderColor: 'var(--neon-cyan)',
            color: 'var(--neon-cyan)',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem',
            letterSpacing: '1px',
            background: 'transparent',
          }}
        >
          <ArrowLeft size={18} />
          BACK TO HOME
        </button>

        <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="glass" style={{ padding: '16px', borderRadius: '16px', flexShrink: 0 }}>
            <BookOpen color="var(--neon-cyan)" size={32} />
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.8rem, 5vw, 2.6rem)', color: 'var(--text-primary)', letterSpacing: '2px', textTransform: 'uppercase' }}>
              Documentation
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Everything you need to get started, contribute, and work with SpectraX.
            </p>
          </div>
        </div>

        {/* ── Getting Started ─────────────────────────────────────── */}
        <div style={sectionCard}>
          <h2 style={h2Style}>
            <Rocket size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Getting Started
          </h2>
          <p style={pStyle}>
            SpectraX is an AI-powered fitness companion that provides real-time rep counting,
            form feedback, and progress tracking using on-device computer vision.
          </p>

          <h3 style={h3Style}>Fork and Clone</h3>
          <p style={pStyle}>Click the <strong>Fork</strong> button on the repository, then clone your fork:</p>
          <div style={codeStyle}>git clone https://github.com/YOUR_USERNAME/spectrax_1.git{'\n'}cd spectrax_1</div>

          <h3 style={h3Style}>Install Dependencies</h3>
          <p style={pStyle}>Frontend:</p>
          <div style={codeStyle}>npm install</div>
          <p style={pStyle}>Backend:</p>
          <div style={codeStyle}>cd server{'\n'}npm install{'\n'}cd ..</div>

          <h3 style={h3Style}>Run the Project</h3>
          <div style={codeStyle}>npm run dev</div>
          <div style={codeStyle}>cd server{'\n'}npm start</div>
        </div>

        {/* ── Contribution Guidelines ─────────────────────────────── */}
        <div style={sectionCard}>
          <h2 style={{ ...h2Style, color: 'var(--neon-green)' }}>
            <HeartHandshake size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Contribution Guidelines
          </h2>
          <p style={pStyle}>
            SpectraX proudly participates in <strong>GirlScript Summer of Code 2026 (GSSoC&apos;26)</strong>.
            Thank you for considering contributing!
          </p>

          <h3 style={{ ...h3Style, color: 'var(--neon-green)' }}>Issue Assignment</h3>
          <ul style={listStyle}>
            <li>Browse available issues from the Issues section.</li>
            <li>Comment on the issue you want to work on.</li>
            <li>Wait until a maintainer assigns the issue to you before starting work.</li>
          </ul>
          <p style={pStyle}>Example comment:</p>
          <div style={codeStyle}>I would like to work on this issue under GSSoC&apos;26.{'\n'}Please assign it to me.</div>

          <h3 style={{ ...h3Style, color: 'var(--neon-green)' }}>Common Issue Labels</h3>
          <div style={chipRow}>
            <span style={chip}>gssoc-26</span>
            <span style={chip}>good first issue</span>
            <span style={chip}>bug</span>
            <span style={chip}>enhancement</span>
            <span style={chip}>documentation</span>
          </div>

          <h3 style={{ ...h3Style, color: 'var(--neon-green)' }}>Branch Naming</h3>
          <p style={pStyle}>Always create a separate branch for your work:</p>
          <div style={codeStyle}>git checkout -b feature/your-feature-name</div>
          <div style={chipRow}>
            <span style={chip}>feature/…</span>
            <span style={chip}>bugfix/…</span>
            <span style={chip}>docs/…</span>
            <span style={chip}>refactor/…</span>
            <span style={chip}>test/…</span>
          </div>

          <h3 style={{ ...h3Style, color: 'var(--neon-green)' }}>Contribution Rules</h3>
          <ul style={listStyle}>
            <li>PRs without linked issues may be closed.</li>
            <li>Spam or low-quality PRs will not be accepted.</li>
            <li>Avoid unnecessary file changes.</li>
            <li>Follow the repository structure properly.</li>
          </ul>
        </div>

        {/* ── Development Workflow ────────────────────────────────── */}
        <div style={sectionCard}>
          <h2 style={{ ...h2Style, color: 'var(--neon-purple)' }}>
            <Wrench size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Development Workflow
          </h2>

          <h3 style={h3Style}>Commit Message Format</h3>
          <p style={pStyle}>Use meaningful commit messages with a conventional prefix:</p>
          <div style={codeStyle}>feat: add dark mode support{'\n'}fix: resolve navbar alignment issue{'\n'}docs: update installation instructions</div>
          <div style={chipRow}>
            <span style={chip}>feat:</span>
            <span style={chip}>fix:</span>
            <span style={chip}>docs:</span>
            <span style={chip}>style:</span>
            <span style={chip}>refactor:</span>
            <span style={chip}>test:</span>
          </div>

          <h3 style={h3Style}>Testing Instructions</h3>
          <ul style={listStyle}>
            <li>Run lint checks: <code style={inlineCode}>npm run lint</code></li>
            <li>Build the project: <code style={inlineCode}>npm run build</code></li>
            <li>Test your feature locally and check browser responsiveness.</li>
            <li>Ensure there are no console errors.</li>
          </ul>

          <h3 style={h3Style}>Code Style Guidelines</h3>
          <ul style={listStyle}>
            <li>Use <strong>Prettier</strong> for formatting and follow <strong>ESLint</strong> rules.</li>
            <li>Write clean, readable code and prefer reusable components.</li>
            <li>Use React functional components and hooks.</li>
            <li>Avoid unnecessary dependencies.</li>
          </ul>

          <h3 style={h3Style}>Pull Request Process</h3>
          <ol style={listStyle}>
            <li>Push your branch to GitHub: <code style={inlineCode}>git push origin your-branch-name</code></li>
            <li>Open a Pull Request and link the issue number (e.g. <code style={inlineCode}>Fixes #123</code>).</li>
            <li>Add screenshots or videos for UI changes.</li>
            <li>Make sure your branch is up to date and code is tested locally.</li>
          </ol>

          <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a
              href="https://github.com/Somil450/spectrax_1"
              target="_blank"
              rel="noreferrer"
              className="btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', borderColor: 'var(--neon-cyan)', color: 'var(--neon-cyan)', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px' }}
            >
              <Github size={16} /> GITHUB REPO
            </a>
            <a
              href="https://github.com/Somil450/spectrax_1/issues"
              target="_blank"
              rel="noreferrer"
              className="btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', borderColor: 'var(--neon-purple)', color: 'var(--neon-purple)', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px' }}
            >
              <GitPullRequest size={16} /> OPEN ISSUES
            </a>
          </div>
        </div>

        {/* ── Code of Conduct ─────────────────────────────────────── */}
        <div style={sectionCard}>
          <h2 style={{ ...h2Style, color: 'var(--neon-red)' }}>
            <HeartHandshake size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Code of Conduct
          </h2>
          <p style={pStyle}>
            We as contributors, maintainers, and community members pledge to create a welcoming,
            respectful, and harassment-free environment for everyone regardless of age, body size,
            disability, ethnicity, gender identity, experience level, nationality, personal appearance,
            race, religion, or sexual identity and orientation.
          </p>

          <h3 style={{ ...h3Style, color: 'var(--neon-green)' }}>
            <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Expected Behavior
          </h3>
          <ul style={listStyle}>
            <li>Using respectful and inclusive language.</li>
            <li>Being supportive toward other contributors.</li>
            <li>Accepting constructive feedback gracefully.</li>
            <li>Respecting different viewpoints and experiences.</li>
            <li>Focusing on collaboration and community growth.</li>
            <li>Helping beginners and new contributors.</li>
          </ul>

          <h3 style={{ ...h3Style, color: 'var(--neon-red)' }}>
            <XCircle size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Unacceptable Behavior
          </h3>
          <ul style={listStyle}>
            <li>Harassment, discrimination, or hateful conduct.</li>
            <li>Trolling, insulting, or derogatory comments.</li>
            <li>Personal or political attacks.</li>
            <li>Sharing someone&apos;s private information without permission.</li>
            <li>Posting inappropriate or offensive content.</li>
          </ul>

          <h3 style={h3Style}>Scope &amp; Enforcement</h3>
          <p style={pStyle}>
            This Code of Conduct applies to GitHub repositories, issues and pull requests,
            discussions, and related community spaces. Project maintainers may take any action
            they deem appropriate in response to violations, including warning contributors,
            removing contributions, temporary restrictions, or permanent bans.
          </p>
          <p style={{ ...pStyle, marginTop: '12px' }}>
            <Terminal size={14} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--neon-cyan)' }} />
            This Code of Conduct is adapted from the{' '}
            <a href="https://www.contributor-covenant.org/" target="_blank" rel="noreferrer" style={{ color: 'var(--neon-cyan)' }}>
              Contributor Covenant
            </a>.
          </p>
        </div>

        <p style={{ ...pStyle, textAlign: 'center', marginTop: '32px', fontSize: '0.85rem' }}>
          <GitBranch size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Thanks for being part of the SpectraX community.
        </p>
      </div>
    </div>
  );
};

export default DocsScreen;
