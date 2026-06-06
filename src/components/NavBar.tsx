import React from 'react';
import '../styles/NavBar.css';
import { Home, Activity, Award, Info, Mail } from 'lucide-react';

interface NavBarProps {
  navigateTo: (screen: string) => void;
  theme: string;
  setTheme: (t: string) => void;
}

export const NavBar: React.FC<NavBarProps> = ({ navigateTo }) => {
  return (
    <header className="spectrax-navbar glass">
      <div className="nav-left">
        <div className="nav-brand" onClick={() => navigateTo('welcome')}>
          <Home size={18} />
          <span className="brand-text">SpectraX</span>
        </div>
      </div>

      <nav className="nav-center">
        <button className="nav-item btn-outline" onClick={() => navigateTo('fitness')}>
          BMI
        </button>
        <button className="nav-item btn-outline" onClick={() => navigateTo('history')}>
          <Activity size={14} /> <span className="nav-label">History</span>
        </button>
        <button className="nav-item btn-outline" onClick={() => navigateTo('trophy')}>
          <Award size={14} /> <span className="nav-label">Trophies</span>
        </button>
        <button className="nav-item btn-outline" onClick={() => navigateTo('about')}>
          <Info size={14} /> <span className="nav-label">About Us</span>
        </button>
        <button className="nav-item btn-outline" onClick={() => navigateTo('contact')}>
          <Mail size={14} /> <span className="nav-label">Contact Us</span>
        </button>
      </nav>

      <div className="nav-right" />
    </header>
  );
};

export default NavBar;
