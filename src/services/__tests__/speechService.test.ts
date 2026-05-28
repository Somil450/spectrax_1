import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { speechService } from '../speechService';

describe('speechService', () => {
  let speakMock: any;
  let cancelMock: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28T12:00:00Z'));

    // Mock SpeechSynthesisUtterance
    class MockSpeechSynthesisUtterance {
      text: string;
      rate: number = 1.0;
      pitch: number = 1.0;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    (global as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    if (typeof window !== 'undefined') {
      (window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    }

    speakMock = vi.fn().mockImplementation((utterance: any) => {
      if (utterance.onstart) utterance.onstart();
    });
    cancelMock = vi.fn();

    // Mock window.speechSynthesis
    if (typeof window === 'undefined') {
      (global as any).window = {};
    }
    
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: speakMock,
        cancel: cancelMock,
        speaking: false,
      },
      writable: true,
      configurable: true,
    });

    speechService.setEnabled(true);
    speechService.cancel();
    (speechService as any).lastSpokenTime.clear();
    (speechService as any).globalLastSpokenTime = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should clean emojis and custom symbols from text', () => {
    speechService.speak('Keep your back straight ❌');
    expect(speakMock).toHaveBeenCalled();
    const utterance = speakMock.mock.calls[0][0];
    expect(utterance.text).toBe('Keep your back straight');
  });

  it('should respect enable/disable toggle', () => {
    speechService.setEnabled(false);
    speechService.speak('Keep your back straight');
    expect(speakMock).not.toHaveBeenCalled();
  });

  it('should respect duplicate prompt cooldown', () => {
    speechService.speak('Keep your back straight', 'low', 5000);
    expect(speakMock).toHaveBeenCalledTimes(1);

    // Speak again immediately - should be throttled
    speechService.speak('Keep your back straight', 'low', 5000);
    expect(speakMock).toHaveBeenCalledTimes(1);

    // Fast-forward time by 6 seconds
    vi.advanceTimersByTime(6000);

    speechService.speak('Keep your back straight', 'low', 5000);
    expect(speakMock).toHaveBeenCalledTimes(2);
  });

  it('should respect global inter-phrase delay for non-high priority prompts', () => {
    speechService.speak('Good job', 'low');
    expect(speakMock).toHaveBeenCalledTimes(1);

    // Speak a different prompt immediately
    speechService.speak('Go lower', 'low');
    expect(speakMock).not.toHaveBeenCalledTimes(2); // Throttled by global inter-phrase delay

    // Advance by 2 seconds
    vi.advanceTimersByTime(2000);

    speechService.speak('Go lower', 'low');
    expect(speakMock).toHaveBeenCalledTimes(2);
  });

  it('should allow high priority prompts to interrupt other speech', () => {
    // Mock speechSynthesis.speaking to true
    (window.speechSynthesis as any).speaking = true;

    speechService.speak('Great rep', 'low');
    expect(speakMock).not.toHaveBeenCalled(); // Blocked because engine is speaking

    speechService.speak('Adjust your posture', 'high');
    expect(cancelMock).toHaveBeenCalled(); // High priority cancels active speech
    expect(speakMock).toHaveBeenCalled(); // Plays
  });
});
