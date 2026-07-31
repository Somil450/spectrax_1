import React, { useEffect, useId, useRef } from "react";

interface KeyboardShortcutItem {
  keys: string[];
  label: string;
}

const SHORTCUTS: KeyboardShortcutItem[] = [
  { keys: ["Space"], label: "Start / Pause workout" },
  { keys: ["R"], label: "Reset current session" },
  { keys: ["H"], label: "Open Session History" },
  { keys: ["1", "2", "3", "4", "5"], label: "Quick-switch exercise" },
  { keys: ["Escape"], label: "Close modal / Go back" },
  { keys: ["?"], label: "Open this shortcuts cheat sheet" },
];

const kbdStyle: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: "12px",
  padding: "4px 8px",
  minWidth: "28px",
  textAlign: "center",
  background: "rgba(255, 255, 255, 0.12)",
  border: "1px solid rgba(255, 255, 255, 0.25)",
  borderRadius: "6px",
  boxShadow: "0 2px 0 rgba(0, 0, 0, 0.4)",
  color: "#fff",
};

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])",
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        backdropFilter: "blur(8px)",
      }}
      onClick={() => onCloseRef.current()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass"
        style={{
          width: "min(460px, 90vw)",
          maxHeight: "80vh",
          overflowY: "auto",
          padding: "24px",
          color: "#fff",
          background: "rgba(13, 17, 30, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <h2 id={titleId} style={{ margin: 0, fontSize: "20px" }}>
            Keyboard Shortcuts
          </h2>
          <button
            ref={closeButtonRef}
            className="btn-outline"
            onClick={() => onCloseRef.current()}
            aria-label="Close keyboard shortcuts"
          >
            ✕
          </button>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {SHORTCUTS.map((item) => (
            <li
              key={item.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "16px",
                padding: "10px 0",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <span>{item.label}</span>
              <span style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                {item.keys.map((key) => (
                  <kbd key={key} style={kbdStyle}>
                    {key}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;
