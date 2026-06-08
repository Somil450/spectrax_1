import React, { useEffect, useRef, useState } from "react";
import { ChevronUp } from "lucide-react";

const SCROLL_THRESHOLD = 320;

export const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const activeScrollElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const getWindowScrollTop = () =>
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    const updateVisibility = (scrollTop = getWindowScrollTop()) => {
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

      updateVisibility(Math.max(scrollTop, getWindowScrollTop()));
    };

    updateVisibility();
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

  return (
    <button
      type="button"
      className="scroll-to-top-button"
      onClick={handleClick}
      aria-label="Scroll to top"
    >
      <ChevronUp size={22} strokeWidth={2.5} aria-hidden="true" />
    </button>
  );
};
