import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FeedbackNotificationQueue } from "../feedbackEngine";

describe("FeedbackNotificationQueue", () => {
  let queue: FeedbackNotificationQueue;
  let mockSpeak: any;
  let mockCancel: any;

  beforeEach(() => {
    mockSpeak = vi.fn();
    mockCancel = vi.fn();

    // Set up mock window and speechSynthesis
    global.window = {
      speechSynthesis: {
        speak: mockSpeak,
        cancel: mockCancel,
      }
    } as any;

    global.SpeechSynthesisUtterance = class {
      text: string;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      rate: number = 1.0;

      constructor(text: string) {
        this.text = text;
      }
    } as any;

    queue = new FeedbackNotificationQueue();
  });

  afterEach(() => {
    // Cleanup mocks
    delete (global as any).window;
    delete (global as any).SpeechSynthesisUtterance;
  });

  it("should initialize empty", () => {
    expect(queue.getQueue()).toHaveLength(0);
    expect(queue.getCurrentItem()).toBeNull();
  });

  it("should play immediately if nothing is playing", () => {
    queue.enqueue("Rep 1", 0, "rep");
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(queue.getCurrentItem()?.text).toBe("Rep 1");
    expect(queue.getQueue()).toHaveLength(0);
  });

  it("should respect priority and order when enqueuing multiple items", () => {
    // Mock isSpeaking = true by enqueuing a starting item
    queue.enqueue("Rep 1", 0, "rep");

    // Enqueue a low priority and a high priority
    queue.enqueue("Rep 2", 0, "rep");
    queue.enqueue("Keep back straight", 2, "posture");

    // The high priority item should have immediately preempted and played,
    // so it is the current item, and the low-priority item is dropped from the queue.
    expect(queue.getCurrentItem()?.text).toBe("Keep back straight");
    expect(queue.getQueue()).toHaveLength(0);
  });

  it("should prune duplicate rep counts to avoid backlog", () => {
    queue.enqueue("Rep 1", 0, "rep"); // Plays immediately

    queue.enqueue("Rep 2", 0, "rep");
    queue.enqueue("Rep 3", 0, "rep");

    // The queue should only contain the latest rep count "Rep 3", "Rep 2" is pruned
    const pending = queue.getQueue();
    expect(pending).toHaveLength(1);
    expect(pending[0].text).toBe("Rep 3");
  });

  it("should respect cooldowns for same message warning types", () => {
    queue.enqueue("Keep back straight", 2, "posture"); // Plays immediately
    queue.enqueue("Keep back straight", 2, "posture"); // Duplicate warning enqueued immediately

    // Second one should be ignored due to the 3-second cooldown
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(queue.getQueue()).toHaveLength(0);
  });

  it("should allow same warning after cooldown expires", () => {
    queue.enqueue("Keep back straight", 2, "posture"); // Plays immediately
    
    // Fast-forward or bypass cooldown by updating map manually
    const now = Date.now();
    queue.getCooldowns().set("posture:Keep back straight", now - 4000);

    queue.enqueue("Keep back straight", 2, "posture");
    expect(queue.getQueue()).toHaveLength(1);
    expect(queue.getQueue()[0].text).toBe("Keep back straight");
  });

  it("should interrupt active low-priority item when high-priority warning enters", () => {
    queue.enqueue("Rep 1", 0, "rep"); // Plays immediately (currentItem is Rep 1)

    // Enqueue a high priority warning
    queue.enqueue("Keep back straight", 2, "posture");

    // High priority interrupts the active low priority
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockSpeak).toHaveBeenCalledTimes(2); // First for Rep 1, second for posture warning
    expect(queue.getCurrentItem()?.text).toBe("Keep back straight");
  });

  it("should clear the queue completely", () => {
    queue.enqueue("Rep 1", 0, "rep");
    queue.enqueue("Keep back straight", 2, "posture");
    queue.clear();

    expect(mockCancel).toHaveBeenCalled();
    expect(queue.getQueue()).toHaveLength(0);
    expect(queue.getCurrentItem()).toBeNull();
    expect(queue.getCooldowns().size).toBe(0);
  });
});
