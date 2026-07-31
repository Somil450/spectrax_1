import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeyboardShortcuts } from "../useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  const dispatchKey = (key: string, target: HTMLElement = document.body) => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
  };

  it("calls the matching handler when a key is pressed", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ " ": handler }));

    act(() => {
      dispatchKey(" ");
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call a handler for an unmapped key", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ H: handler }));

    act(() => {
      dispatchKey("G");
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores key presses while typing in an input", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ H: handler }));

    const input = document.createElement("input");
    document.body.appendChild(input);
    try {
      act(() => {
        dispatchKey("H", input);
      });
    } finally {
      document.body.removeChild(input);
    }

    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores key presses while typing in a contentEditable element", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ R: handler }));

    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.appendChild(editable);
    try {
      act(() => {
        dispatchKey("R", editable);
      });
    } finally {
      document.body.removeChild(editable);
    }

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not register a listener while disabled", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ H: handler }, false));

    act(() => {
      dispatchKey("H");
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("uses the latest handlers without re-registering the listener", () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { rerender } = renderHook(({ map }) => useKeyboardShortcuts(map), {
      initialProps: { map: { H: firstHandler } },
    });

    rerender({ map: { H: secondHandler } });

    act(() => {
      dispatchKey("H");
    });

    expect(secondHandler).toHaveBeenCalledTimes(1);
    expect(firstHandler).not.toHaveBeenCalled();
    expect(
      addSpy.mock.calls.filter(([type]) => type === "keydown").length,
    ).toBe(1);
    expect(
      removeSpy.mock.calls.filter(([type]) => type === "keydown").length,
    ).toBe(0);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
