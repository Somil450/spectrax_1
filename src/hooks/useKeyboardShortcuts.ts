import { useEffect, useRef } from "react";

export type KeyboardShortcutHandler = (event: KeyboardEvent) => void;

export type KeyboardShortcutMap = Record<string, KeyboardShortcutHandler>;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null
  );
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcutMap,
  enabled = true,
): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const handler = shortcutsRef.current[event.key];
      if (!handler) return;

      event.preventDefault();
      handler(event);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
