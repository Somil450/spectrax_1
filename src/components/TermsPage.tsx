import {
  ArrowLeft,
  BadgeInfo,
  FileText,
  LockKeyhole,
  Mail,
  Scale,
  ShieldCheck,
  Users,
} from "lucide-react";
import "../styles/TermsPage.css";

interface TermsPageProps {
  onBack: () => void;
}

const sections = [
  {
    id: "acceptance",
    icon: ShieldCheck,
    title: "Acceptance of these terms",
    body:
      "By accessing or using SpectraX, you agree to follow these terms and any related policies referenced on the platform. If you do not agree, please do not use the service.",
    points: [
      "These terms apply to visitors, registered users, and contributors.",
      "We may update the terms when the product, laws, or platform requirements change.",
      "Continued use after a change means you accept the updated version.",
    ],
  },
  {
    id: "use",
    icon: Users,
    title: "Use of the platform",
    body:
      "SpectraX is provided to help users track workouts, review performance, and explore related features. You agree to use it responsibly and only for lawful, intended purposes.",
    points: [
      "Do not attempt to disrupt, overload, or reverse engineer the service.",
      "Do not impersonate another person or misrepresent your identity.",
      "Do not use the app in a way that violates applicable law or third-party rights.",
    ],
  },
  {
    id: "accounts",
    icon: LockKeyhole,
    title: "Accounts and security",
    body:
      "If you create an account, you are responsible for keeping your credentials secure and for activity carried out through your account.",
    points: [
      "Use accurate and current information when creating a profile.",
      "Notify us if you suspect unauthorized access to your account.",
      "We may suspend access if we detect abuse, fraud, or harmful activity.",
    ],
  },
  {
    id: "content",
    icon: FileText,
    title: "Content and feedback",
    body:
      "You retain ownership of the content you submit, but you grant SpectraX the rights needed to store, process, and display that content in connection with the service.",
    points: [
      "You are responsible for the content you upload or enter.",
      "Please avoid submitting sensitive information unless the feature explicitly asks for it.",
      "Feedback and suggestions may be used to improve the product without compensation.",
    ],
  },
  {
    id: "privacy",
    icon: BadgeInfo,
    title: "Data, privacy, and availability",
    body:
      "We handle data according to the platform's privacy practices and the capabilities that are built into the product. No online service is guaranteed to be available at all times.",
    points: [
      "Network delays, maintenance, or outages may temporarily affect access.",
      "Feature behavior may differ across devices, browsers, or environments.",
      "Use the product with the understanding that performance and results can vary.",
    ],
  },
  {
    id: "liability",
    icon: Scale,
    title: "Changes, termination, and liability",
    body:
      "We may update, suspend, or discontinue features when needed. To the extent permitted by law, SpectraX is not liable for indirect or incidental damages resulting from use of the service.",
    points: [
      "We may remove access that violates these terms or harms the service.",
      "We can modify or retire parts of the platform at any time.",
      "If you need help, contact the maintainers through the repository channels.",
    ],
  },
] as const;

export function TermsPage({ onBack }: TermsPageProps) {
  return (
    <main className="terms-page">
      <div className="terms-shell">
        <nav className="terms-nav" aria-label="Terms navigation">
          <button type="button" className="terms-back" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="terms-brand">
            <div className="terms-brand-mark">
              <span>S</span>
            </div>
            <div>
              <strong>SpectraX</strong>
              <span>Legal center</span>
            </div>
          </div>
        </nav>

        <section className="terms-hero">
          <div className="terms-hero-copy">
            <span className="terms-kicker">Terms &amp; conditions</span>
            <h1>Clear rules for using SpectraX.</h1>
            <p className="terms-lead">
              These terms explain how the platform works, what we expect from
              users, and how the service may evolve over time.
            </p>

            <div className="terms-actions">
              <a href="#acceptance" className="terms-primary-link">
                Read the terms
              </a>
              <span className="terms-updated">Last updated June 4, 2026</span>
            </div>
          </div>

          <aside className="terms-summary">
            <h2>At a glance</h2>
            <ul>
              <li>Use the platform responsibly and lawfully.</li>
              <li>Protect your account and keep your details accurate.</li>
              <li>We may update the product as SpectraX evolves.</li>
            </ul>
          </aside>
        </section>

        <section className="terms-layout" aria-label="Terms and conditions">
          <aside className="terms-toc" aria-label="Table of contents">
            <h2>Sections</h2>
            <a href="#acceptance">Acceptance</a>
            <a href="#use">Use of the platform</a>
            <a href="#accounts">Accounts and security</a>
            <a href="#content">Content and feedback</a>
            <a href="#privacy">Data and privacy</a>
            <a href="#liability">Changes and liability</a>
          </aside>

          <div className="terms-content">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <article key={section.id} id={section.id} className="terms-card">
                  <div className="terms-card-header">
                    <div className="terms-card-icon">
                      <Icon size={18} />
                    </div>
                    <h2>{section.title}</h2>
                  </div>
                  <p>{section.body}</p>
                  <ul>
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </article>
              );
            })}

            <article className="terms-note">
              <Mail size={18} />
              <p>
                Questions about these terms can be raised through the
                repository&apos;s issue tracker or community discussion channels.
              </p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}

export default TermsPage;
