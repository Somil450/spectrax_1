// src/utils/shareSession.ts
import { toPng } from "html-to-image";

export interface ShareSessionPayload {
  exerciseType: string;
  totalReps: number;
  accuracyScore: number;
  duration: number;
  timestamp: number;
}

export interface ShareResult {
  success: boolean;
  method: "share" | "download" | "clipboard" | "none";
  error?: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Generates the share text for a session card.
 */
export function buildShareText(payload: ShareSessionPayload): string {
  const name = payload.exerciseType.replace(/_/g, " ").toUpperCase();
  return (
    `🏋️ I just finished ${name} with SpectraX!\n` +
    `${payload.totalReps} reps · ${payload.accuracyScore}% accuracy · ${formatDuration(payload.duration)}\n` +
    `${formatDate(payload.timestamp)}`
  );
}

/**
 * Captures a DOM node as a PNG data URL. Falls back to null when capture
 * fails (e.g., tainted canvas / webgl in the subtree).
 */
export async function captureNodeAsPng(node: HTMLElement): Promise<string | null> {
  try {
    const dataUrl = await toPng(node, {
      cacheBust: true,
      backgroundColor: "#0a0e1a",
      width: node.offsetWidth,
      height: node.offsetHeight,
    });
    return dataUrl;
  } catch (err) {
    console.error("Failed to capture session card image:", err);
    return null;
  }
}

/**
 * Shares a session card. Strategy:
 *  1. Capture the DOM node as an image.
 *  2. Prefer the native Web Share API (navigator.share with files).
 *  3. Fall back to clipboard image copy.
 *  4. Final fallback: trigger a PNG download.
 *  5. If capture fails, share/share-copy the generated text only.
 */
export async function shareSessionCard(
  node: HTMLElement,
  payload: ShareSessionPayload,
  fileName = "spectrax-workout.png",
): Promise<ShareResult> {
  const text = buildShareText(payload);
  const dataUrl = await captureNodeAsPng(node);

  // 1. Native share (desktop + mobile share sheet)
  if (dataUrl && typeof navigator.share === "function") {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      const shareData = {
        title: "SpectraX Workout",
        text,
        files: [file],
      };
      // Not all browsers accept `files`; fall back to text-only if needed.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share(shareData);
      } else {
        await navigator.share({ title: shareData.title, text });
      }
      return { success: true, method: "share" };
    } catch (err: any) {
      // AbortError = user cancelled — not an error.
      if (err && err.name === "AbortError") {
        return { success: false, method: "none", error: "cancelled" };
      }
      // Share failed — fall through to clipboard/download.
    }
  }

  // 2. Clipboard image copy
  if (dataUrl && typeof navigator.clipboard?.write === "function") {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      return { success: true, method: "clipboard" };
    } catch (err) {
      // Clipboard write failed — fall through to download.
    }
  }

  // 3. Download PNG
  if (dataUrl) {
    try {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      return { success: true, method: "download" };
    } catch (err) {
      // Download failed — fall through to text-only share.
    }
  }

  // 4. Text-only share (image capture unsupported)
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "SpectraX Workout", text });
      return { success: true, method: "share" };
    } catch (err: any) {
      if (err && err.name === "AbortError") {
        return { success: false, method: "none", error: "cancelled" };
      }
      return { success: false, method: "none", error: String(err?.message || err) };
    }
  }

  // 5. Last resort: copy text to clipboard
  if (typeof navigator.clipboard?.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true, method: "clipboard" };
    } catch (err) {
      return { success: false, method: "none", error: String(err) };
    }
  }

  return { success: false, method: "none", error: "No share mechanism available" };
}
