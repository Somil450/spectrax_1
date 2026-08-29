import { describe, it, expect } from "vitest";
import {
  FeedbackPriority,
  FeedbackPriorityQueue,
} from "../feedbackEngine";

describe("FeedbackPriorityQueue", () => {
  it("returns the item immediately when nothing is playing", () => {
    const queue = new FeedbackPriorityQueue();
    const item = queue.enqueue("rep 3", FeedbackPriority.LOW);
    expect(item).not.toBeNull();
    expect(item!.text).toBe("rep 3");
    expect(queue.active?.text).toBe("rep 3");
    expect(queue.size).toBe(1);
  });

  it("queues lower-priority items while a higher one is active", () => {
    const queue = new FeedbackPriorityQueue();
    queue.enqueue("watch your depth", FeedbackPriority.HIGH);
    const queued = queue.enqueue("great rep!", FeedbackPriority.LOW);

    expect(queued).toBeNull();
    expect(queue.size).toBe(2);
    expect(queue.active?.text).toBe("watch your depth");
  });

  it("preempts an active low-priority announcement with a warning", () => {
    const queue = new FeedbackPriorityQueue();
    queue.enqueue("rep 5", FeedbackPriority.LOW);

    const warning = queue.enqueue(
      "keep your back straight",
      FeedbackPriority.HIGH
    );

    expect(warning).not.toBeNull();
    expect(warning!.text).toBe("keep your back straight");
    expect(queue.active?.text).toBe("keep your back straight");
    expect(queue.size).toBe(1); // overridden item is dropped
  });

  it("does not preempt when the new priority is equal or lower", () => {
    const queue = new FeedbackPriorityQueue();
    queue.enqueue("keep your back straight", FeedbackPriority.HIGH);
    const result = queue.enqueue("even depth", FeedbackPriority.HIGH);

    expect(result).toBeNull();
    expect(queue.active?.text).toBe("keep your back straight");
  });

  it("orders pending items by priority before promoting them", () => {
    const queue = new FeedbackPriorityQueue();
    // CRITICAL active item so the lower-priority ones queue up behind it
    queue.enqueue("safety alert", FeedbackPriority.CRITICAL);
    queue.enqueue("rep 1", FeedbackPriority.LOW);
    queue.enqueue("watch your depth", FeedbackPriority.MEDIUM);
    queue.enqueue("keep your back straight", FeedbackPriority.HIGH);

    // CRITICAL is active, remaining items are pending in priority order
    expect(queue.active?.text).toBe("safety alert");

    const next = queue.complete(queue.active!.id);
    expect(next).not.toBeNull();
    expect(next!.text).toBe("keep your back straight");

    const medium = queue.complete(next!.id);
    expect(medium).not.toBeNull();
    expect(medium!.text).toBe("watch your depth");

    const low = queue.complete(medium!.id);
    expect(low).not.toBeNull();
    expect(low!.text).toBe("rep 1");
  });

  it("promotes the next item after an announcement completes", () => {
    const queue = new FeedbackPriorityQueue();
    queue.enqueue("rep 1", FeedbackPriority.LOW);
    queue.enqueue("rep 2", FeedbackPriority.LOW);

    const next = queue.complete(queue.active!.id);
    expect(next).not.toBeNull();
    expect(next!.text).toBe("rep 2");
    expect(queue.size).toBe(1);
  });

  it("ignores stale completions for overridden announcements", () => {
    const queue = new FeedbackPriorityQueue();
    const rep = queue.enqueue("rep 5", FeedbackPriority.LOW)!;
    queue.enqueue("keep your back straight", FeedbackPriority.HIGH);

    // rep is no longer active; completing it must not disturb the warning
    const result = queue.complete(rep.id);
    expect(result).toBeNull();
    expect(queue.active?.text).toBe("keep your back straight");
  });

  it("dedupes identical text already spoken or pending", () => {
    const queue = new FeedbackPriorityQueue();
    queue.enqueue("watch your depth", FeedbackPriority.MEDIUM);

    expect(queue.enqueue("watch your depth", FeedbackPriority.MEDIUM)).toBeNull();
    expect(queue.size).toBe(1);
  });

  it("returns null for empty or whitespace-only text", () => {
    const queue = new FeedbackPriorityQueue();
    expect(queue.enqueue("   ", FeedbackPriority.LOW)).toBeNull();
    expect(queue.enqueue("", FeedbackPriority.LOW)).toBeNull();
    expect(queue.size).toBe(0);
  });

  it("drops the lowest-priority tail when the queue overflows", () => {
    const queue = new FeedbackPriorityQueue(3);
    queue.enqueue("safety alert", FeedbackPriority.CRITICAL);
    queue.enqueue("watch your depth", FeedbackPriority.MEDIUM);
    queue.enqueue("even depth", FeedbackPriority.MEDIUM);
    queue.enqueue("rep 1", FeedbackPriority.LOW);
    queue.enqueue("rep 2", FeedbackPriority.LOW);

    // size caps at active (1) + pending maxQueueSize (3) = 4
    expect(queue.size).toBe(4);

    // pending holds the 3 highest-priority items; the LOW tail (rep 2) was dropped
    const next = queue.complete(queue.active!.id);
    expect(next).not.toBeNull();
    expect(next!.text).toBe("watch your depth");
    const mid = queue.complete(next!.id);
    expect(mid).not.toBeNull();
    expect(mid!.text).toBe("even depth");
    const low = queue.complete(mid!.id);
    expect(low).not.toBeNull();
    expect(low!.text).toBe("rep 1");
    const empty = queue.complete(low!.id);
    expect(empty).toBeNull();
  });

  it("clear() empties both active and pending announcements", () => {
    const queue = new FeedbackPriorityQueue();
    queue.enqueue("safety alert", FeedbackPriority.CRITICAL);
    queue.enqueue("watch your depth", FeedbackPriority.MEDIUM);

    queue.clear();

    expect(queue.size).toBe(0);
    expect(queue.active).toBeNull();
  });
});
