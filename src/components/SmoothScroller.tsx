import { ReactLenis } from 'lenis/react';
import React from 'react';
import 'lenis/dist/lenis.css';

interface SmoothScrollerProps {
  children: React.ReactNode;
}

export function SmoothScroller({ children }: SmoothScrollerProps) {
  return (
    <ReactLenis root>
      {children}
    </ReactLenis>
  );
}
