import { useEffect, useState } from "react";

const BackToTopButton = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);

    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <>
      {visible && (
        <button
          onClick={scrollToTop}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            padding: "12px 16px",
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: "rgba(0, 255, 255, 0.2)",
            color: "#00ffff",
            backdropFilter: "blur(10px)",
            boxShadow: "0 0 12px rgba(0,255,255,0.6)",
            fontSize: "18px",
            zIndex: 1000,
            transition: "all 0.3s ease",
          }}
        >
          ↑
        </button>
      )}
    </>
  );
};

export default BackToTopButton;