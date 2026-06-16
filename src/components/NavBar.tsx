import React, { useState, useEffect, useRef } from 'react';
import '../styles/NavBar.css';
import { Home, Activity, Award, SunMedium, Menu } from 'lucide-react';

interface NavBarProps {
  navigateTo: (screen: string) => void;
  theme: string;
  setTheme: (t: string) => void;
}

const themes = ['cyber-dark', 'retro', 'light'];

export const NavBar: React.FC<NavBarProps> = ({ navigateTo, theme, setTheme }) => {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef<number>(0);
  const ticking = useRef(false);

  const cycleTheme = () => {
    const idx = themes.indexOf(theme);
    const next = themes[(idx + 1) % themes.length] || themes[0];
    setTheme(next);
  };

  const navItem = (label: string, onClick: () => void, Icon?: any) => (
    <button className="nav-item btn-outline" onClick={() => { onClick(); setOpen(false); }}>
      {Icon && <Icon size={16} />} <span className="nav-label">{label}</span>
    </button>
  );

  useEffect(() => {
    let attached = false;
    let cleanup = () => {};

    const onScroll = (container: Element | Window) => {
      const currentY = container instanceof Window ? (window.scrollY || window.pageYOffset) : (container as Element).scrollTop;
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const delta = currentY - lastY.current;
          if (currentY > 80 && delta > 4) {
            setHidden(true);
          } else if (delta < 0 || currentY <= 80) {
            setHidden(false);
          }
          lastY.current = currentY;
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    const attachTo = (container: Element | Window) => {
      if (attached) return;
      attached = true;

      if (container instanceof Window) {
        const handler = () => onScroll(window);
        window.addEventListener('scroll', handler, { passive: true });
        cleanup = () => window.removeEventListener('scroll', handler as EventListener);
      } else {
        const handler = () => onScroll(container);
        container.addEventListener('scroll', handler as EventListener, { passive: true });
        cleanup = () => (container as Element).removeEventListener('scroll', handler as EventListener);
      }
    };

    // Try to find a scrollable container by common selectors first
    const knownSelectors = ['.screen-container', '.welcome-scroll-area', '.welcome-scroll-inner', '.spectrax-app', 'main', 'body'];
    let initial: Element | null = null;
    for (const sel of knownSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        // choose if it's actually scrollable
        if ((el as Element).scrollHeight > (el as Element).clientHeight) {
          initial = el as Element;
          break;
        }
        // keep candidate
        if (!initial) initial = el as Element;
      }
    }

    // If still not found, scan for any element that is scrollable
    if (!initial) {
      const all = Array.from(document.querySelectorAll('body *')) as Element[];
      for (const el of all) {
        try {
          const style = window.getComputedStyle(el);
          const overflowY = style.overflowY;
          if (el.scrollHeight > el.clientHeight && /auto|scroll|overlay/.test(overflowY)) {
            initial = el;
            break;
          }
        } catch (e) {
          // ignore cross-origin or inaccessible elements
        }
      }
    }

    if (initial) {
      attachTo(initial instanceof Element ? initial : window);
    } else {
      // Fallback to window so something listens right away
      attachTo(window);
    }

    // Observe DOM to detect newly added scrollable areas (like welcome-scroll-area)
    const observer = new MutationObserver(() => {
      if (attached) return;
      // try selectors and scan again
      for (const sel of knownSelectors) {
        const sc = document.querySelector(sel) as Element | null;
        if (sc && sc.scrollHeight > sc.clientHeight) {
          cleanup();
          attachTo(sc);
          observer.disconnect();
          return;
        }
      }

      const all = Array.from(document.querySelectorAll('body *')) as Element[];
      for (const el of all) {
        try {
          const style = window.getComputedStyle(el);
          const overflowY = style.overflowY;
          if (el.scrollHeight > el.clientHeight && /auto|scroll|overlay/.test(overflowY)) {
            cleanup();
            attachTo(el);
            observer.disconnect();
            return;
          }
        } catch (e) {}
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cleanup();
      observer.disconnect();
    };
  }, []);

  return (
    <header className={`spectrax-navbar glass ${hidden ? 'hidden' : ''}`}>
      <div className="nav-left">
        <div className="nav-brand" onClick={() => navigateTo('welcome')}>
          <Home size={18} />
          <span className="brand-text">SpectraX</span>
        </div>
      </div>

      <nav className={`nav-center ${open ? 'open' : ''}`} aria-hidden={!open}>
        {navItem('BMI', () => navigateTo('fitness'))}
        {navItem('History', () => navigateTo('history'), Activity)}
        {navItem('Trophies', () => navigateTo('trophy'), Award)}
      </nav>

      <div className="nav-right">
        <button className="theme-toggle btn-neon" onClick={cycleTheme} aria-label="Switch theme">
          <SunMedium size={16} />
          <span className="nav-label">{theme.replace('-', ' ')}</span>
        </button>

        <button className="mobile-menu has-tooltip tooltip-bottom" data-tooltip="Toggle menu" onClick={() => setOpen((s) => !s)} aria-label="Toggle menu">
          <Menu />
        </button>
      </div>
    </header>
  );
};

export default NavBar;
