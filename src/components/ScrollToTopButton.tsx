import React, { useEffect, useRef, useState } from "react";
import { ChevronUp } from "lucide-react";

const SCROLL_THRESHOLD = 320;

export const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const activeScrollElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const getWindowScrollTop = () =>
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    const getScrollProgress = (): number => {
      const scrollTop = getWindowScrollTop();
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;

      if (scrollHeight <= clientHeight) return 0;

      const maxScroll = scrollHeight - clientHeight;
      return Math.min(Math.max((scrollTop / maxScroll) * 100, 0), 100);
    };

    const updateVisibilityAndProgress = (scrollTop = getWindowScrollTop()) => {
      const prog = getScrollProgress();
      setProgress(prog);
      setIsVisible(scrollTop > SCROLL_THRESHOLD);
    };

    const handleScroll = (event: Event) => {
      const target = event.target;
      const scrollElement =
        target instanceof HTMLElement ? target : document.scrollingElement;
      const scrollTop =
        scrollElement instanceof HTMLElement
          ? scrollElement.scrollTop
          : getWindowScrollTop();

      if (scrollElement instanceof HTMLElement && scrollTop > 0) {
        activeScrollElementRef.current = scrollElement;
      }

      updateVisibilityAndProgress(Math.max(scrollTop, getWindowScrollTop()));
    };

    updateVisibilityAndProgress();
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    activeScrollElementRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!isVisible) return null;

  // SVG circle parameters
  const size = 56; // Diameter of the button area
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <button
      type="button"
      className="scroll-to-top-button has-tooltip tooltip-left fixed bottom-8 right-8 z-50 flex items-center justify-center rounded-full bg-background shadow-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      onClick={handleClick}
      data-tooltip="Scroll to top"
      aria-label="Scroll to top"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {/* Progress Ring SVG */}
      <svg
        className="absolute inset-0 -rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted-foreground/30"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-all duration-150 ease-linear"
        />
      </svg>

      {/* Icon */}
      <ChevronUp
        size={22}
        strokeWidth={2.5}
        aria-hidden="true"
        className="relative z-10"
      />
    </button>
  );
};
