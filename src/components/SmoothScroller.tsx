import { ReactLenis } from 'lenis/react';
import React from 'react';

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
